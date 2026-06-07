"""Small async-friendly SQLite document store for the API.

The app code was originally written against a tiny subset of Motor's collection
API. This module preserves that subset while storing JSON documents in SQLite.
"""
from __future__ import annotations

import copy
import json
import os
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


class SQLiteCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = docs

    def sort(self, field: str, direction: int = 1) -> "SQLiteCursor":
        reverse = direction < 0
        self._docs.sort(key=lambda doc: doc.get(field) or "", reverse=reverse)
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        docs = self._docs if length is None else self._docs[:length]
        return [copy.deepcopy(doc) for doc in docs]


class SQLiteCollection:
    def __init__(self, database: "SQLiteDatabase", name: str):
        self.database = database
        self.name = name

    def _key_for(self, doc: Dict[str, Any]) -> str:
        return str(doc.get("id") or doc.get("_id"))

    def _load_all(self) -> List[Dict[str, Any]]:
        rows = self.database.conn.execute(
            "SELECT data FROM documents WHERE collection = ?",
            (self.name,),
        ).fetchall()
        return [json.loads(row["data"]) for row in rows]

    def _load_by_key(self, key: str) -> Optional[Dict[str, Any]]:
        row = self.database.conn.execute(
            "SELECT data FROM documents WHERE collection = ? AND doc_key = ?",
            (self.name, key),
        ).fetchone()
        return json.loads(row["data"]) if row else None

    def _save(self, doc: Dict[str, Any]) -> None:
        key = self._key_for(doc)
        if not key or key == "None":
            raise ValueError(f"Document in {self.name} must include 'id' or '_id'")
        payload = json.dumps(doc, ensure_ascii=False, separators=(",", ":"), default=str)
        self.database.conn.execute(
            """
            INSERT INTO documents (collection, doc_key, data)
            VALUES (?, ?, ?)
            ON CONFLICT(collection, doc_key) DO UPDATE SET data = excluded.data
            """,
            (self.name, key, payload),
        )

    def _matches(self, doc: Dict[str, Any], query: Optional[Dict[str, Any]]) -> bool:
        if not query:
            return True
        for field, expected in query.items():
            actual = doc.get(field)
            if isinstance(expected, dict):
                if "$ne" in expected and actual == expected["$ne"]:
                    return False
                unsupported = set(expected) - {"$ne"}
                if unsupported:
                    raise ValueError(f"Unsupported SQLite filter operator(s): {unsupported}")
            elif actual != expected:
                return False
        return True

    def _apply_update(self, doc: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
        out = copy.deepcopy(doc)
        if "$set" in update:
            out.update(update["$set"])
        if "$inc" in update:
            for field, amount in update["$inc"].items():
                out[field] = (out.get(field) or 0) + amount
        operators = set(update) & {"$set", "$inc"}
        if not operators:
            out.update(update)
        unsupported = set(update) - {"$set", "$inc"}
        if operators and unsupported:
            raise ValueError(f"Unsupported SQLite update operator(s): {unsupported}")
        return out

    async def find_one(
        self,
        query: Optional[Dict[str, Any]] = None,
        projection: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        del projection
        with self.database.lock:
            docs: Iterable[Dict[str, Any]]
            key = None
            if query:
                key = query.get("id") or query.get("_id")
            if key is not None:
                found = self._load_by_key(str(key))
                if found and self._matches(found, query):
                    return copy.deepcopy(found)
                return None
            docs = self._load_all()
            for doc in docs:
                if self._matches(doc, query):
                    return copy.deepcopy(doc)
            return None

    def find(
        self,
        query: Optional[Dict[str, Any]] = None,
        projection: Optional[Dict[str, Any]] = None,
    ) -> SQLiteCursor:
        del projection
        with self.database.lock:
            docs = [doc for doc in self._load_all() if self._matches(doc, query)]
        return SQLiteCursor(docs)

    async def insert_one(self, doc: Dict[str, Any]) -> None:
        with self.database.lock:
            self._save(copy.deepcopy(doc))
            self.database.conn.commit()

    async def insert_many(self, docs: List[Dict[str, Any]]) -> None:
        if not docs:
            return
        with self.database.lock:
            for doc in docs:
                self._save(copy.deepcopy(doc))
            self.database.conn.commit()

    async def update_one(
        self,
        query: Dict[str, Any],
        update: Dict[str, Any],
        upsert: bool = False,
    ) -> None:
        with self.database.lock:
            docs = self._load_all()
            for doc in docs:
                if self._matches(doc, query):
                    self._save(self._apply_update(doc, update))
                    self.database.conn.commit()
                    return
            if upsert:
                base = {k: v for k, v in query.items() if not isinstance(v, dict)}
                self._save(self._apply_update(base, update))
                self.database.conn.commit()

    async def find_one_and_update(
        self,
        query: Dict[str, Any],
        update: Dict[str, Any],
        upsert: bool = False,
        return_document: Any = None,
    ) -> Optional[Dict[str, Any]]:
        del return_document
        with self.database.lock:
            docs = self._load_all()
            current = next((doc for doc in docs if self._matches(doc, query)), None)
            if current is None:
                if not upsert:
                    return None
                current = {k: v for k, v in query.items() if not isinstance(v, dict)}
            updated = self._apply_update(current, update)
            self._save(updated)
            self.database.conn.commit()
            return copy.deepcopy(updated)

    async def delete_one(self, query: Dict[str, Any]) -> None:
        with self.database.lock:
            docs = self._load_all()
            for doc in docs:
                if self._matches(doc, query):
                    self.database.conn.execute(
                        "DELETE FROM documents WHERE collection = ? AND doc_key = ?",
                        (self.name, self._key_for(doc)),
                    )
                    self.database.conn.commit()
                    return

    async def delete_many(self, query: Optional[Dict[str, Any]] = None) -> None:
        with self.database.lock:
            if not query:
                self.database.conn.execute(
                    "DELETE FROM documents WHERE collection = ?",
                    (self.name,),
                )
            else:
                for doc in self._load_all():
                    if self._matches(doc, query):
                        self.database.conn.execute(
                            "DELETE FROM documents WHERE collection = ? AND doc_key = ?",
                            (self.name, self._key_for(doc)),
                        )
            self.database.conn.commit()


class SQLiteDatabase:
    def __init__(self, db_path: str | Path):
        self.path = Path(db_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        self._collections: Dict[str, SQLiteCollection] = {}
        self._init_schema()

    def _init_schema(self) -> None:
        with self.lock:
            self.conn.execute("PRAGMA journal_mode=WAL")
            self.conn.execute("PRAGMA synchronous=NORMAL")
            self.conn.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    collection TEXT NOT NULL,
                    doc_key TEXT NOT NULL,
                    data TEXT NOT NULL,
                    PRIMARY KEY (collection, doc_key)
                )
                """
            )
            self.conn.commit()

    def __getattr__(self, name: str) -> SQLiteCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self._collections:
            self._collections[name] = SQLiteCollection(self, name)
        return self._collections[name]

    def close(self) -> None:
        with self.lock:
            self.conn.close()


def default_sqlite_path() -> Path:
    data_dir = os.environ.get("DATA_DIR")
    if data_dir:
        return Path(data_dir) / "webdesert_workspace.sqlite3"
    return Path(__file__).parent / "webdesert_workspace.sqlite3"


def create_database() -> SQLiteDatabase:
    return SQLiteDatabase(os.environ.get("SQLITE_PATH") or default_sqlite_path())
