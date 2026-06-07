"""DB helpers."""
from typing import Any, Dict


def clean(doc: Dict[str, Any] | None) -> Dict[str, Any] | None:
    """Strip private persistence fields from API documents."""
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def clean_many(docs):
    return [clean(d) for d in docs]
