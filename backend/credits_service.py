"""Client credit ledger — combines invoices, payments, manual credits."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CreditEntryBase(BaseModel):
    client_id: str
    kind: str = "credit"  # credit | refund | adjustment | advance
    amount: float = 0.0  # positive = client paid us (advance/credit), negative = we owe client (refund)
    note: str = ""
    date: Optional[str] = None  # ISO date


class CreditEntryCreate(CreditEntryBase):
    pass


class CreditEntry(CreditEntryBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=_now)


async def client_ledger(db, client_id: str) -> Dict[str, Any]:
    """Return ledger entries sorted by date with running balance.

    Convention:
      - Invoices are DEBITS (client owes you) -> +amount
      - Payments are CREDITS (client paid you) -> -amount
      - Manual credit/advance is CREDIT -> -amount
      - Manual refund is DEBIT -> +amount

    `balance_due` > 0 means client owes that much.
    `balance_due` < 0 means client has advance credit with you.
    """
    invs = await db.invoices.find({"client_id": client_id}, {"_id": 0}).to_list(2000)
    pays = await db.payments.find({"client_id": client_id}, {"_id": 0}).to_list(2000)
    credits = await db.credits.find({"client_id": client_id}, {"_id": 0}).to_list(2000)

    entries: List[Dict[str, Any]] = []

    for inv in invs:
        if inv.get("status") == "draft":
            continue  # drafts don't hit the ledger
        entries.append({
            "id": f"inv_{inv['id']}",
            "kind": "invoice",
            "ref_id": inv["id"],
            "ref": inv.get("number", ""),
            "date": inv.get("issue_date") or inv.get("created_at", "")[:10],
            "amount": float(inv.get("total", 0) or 0),  # debit
            "label": f"Invoice {inv.get('number','')}",
            "note": "",
        })

    for p in pays:
        if float(p.get("paid_amount", 0) or 0) <= 0:
            continue
        entries.append({
            "id": f"pay_{p['id']}",
            "kind": "payment",
            "ref_id": p.get("invoice_id") or p["id"],
            "ref": p.get("method", ""),
            "date": (p.get("paid_at") or p.get("created_at", ""))[:10] or p.get("due_date"),
            "amount": -float(p.get("paid_amount", 0) or 0),  # credit
            "label": f"Payment · {p.get('method','')}",
            "note": p.get("notes", "") or p.get("work_details", ""),
        })

    for c in credits:
        amt = float(c.get("amount", 0) or 0)
        kind = c.get("kind", "credit")
        if kind in ("credit", "advance"):
            signed = -abs(amt)  # client gives money (advance) -> credit
            label = "Advance credit" if kind == "advance" else "Credit adjustment"
        elif kind == "refund":
            signed = abs(amt)
            label = "Refund"
        else:
            signed = amt  # adjustment: take as given
            label = "Adjustment"
        entries.append({
            "id": f"crd_{c['id']}",
            "kind": kind,
            "ref_id": c["id"],
            "ref": "",
            "date": c.get("date") or c.get("created_at", "")[:10],
            "amount": signed,
            "label": label,
            "note": c.get("note", ""),
        })

    # sort by date asc, fallback to id
    entries.sort(key=lambda e: (e.get("date") or "", e["id"]))

    running = 0.0
    for e in entries:
        running += e["amount"]
        e["balance"] = round(running, 2)

    total_billed = sum(e["amount"] for e in entries if e["kind"] == "invoice")
    total_paid = sum(-e["amount"] for e in entries if e["kind"] == "payment")
    total_credit = sum(-e["amount"] for e in entries if e["kind"] in ("credit", "advance"))
    total_refund = sum(e["amount"] for e in entries if e["kind"] == "refund")

    return {
        "entries": entries,
        "summary": {
            "total_billed": round(total_billed, 2),
            "total_paid": round(total_paid, 2),
            "total_credit": round(total_credit, 2),
            "total_refund": round(total_refund, 2),
            "balance_due": round(running, 2),  # +ve = owes you, -ve = has credit
        },
    }


async def all_clients_summary(db) -> List[Dict[str, Any]]:
    clients = await db.clients.find({}, {"_id": 0}).to_list(2000)
    out = []
    for c in clients:
        led = await client_ledger(db, c["id"])
        s = led["summary"]
        out.append({
            "id": c["id"],
            "name": c.get("name", ""),
            "company": c.get("company", ""),
            "whatsapp": c.get("whatsapp", ""),
            **s,
        })
    out.sort(key=lambda x: x.get("balance_due", 0), reverse=True)
    return out
