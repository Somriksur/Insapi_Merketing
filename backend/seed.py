"""Singleton settings creator — loads defaults from default_settings.json."""
from __future__ import annotations

import json
from pathlib import Path

from models import OrgSettings

_DEFAULT_SETTINGS_FILE = Path(__file__).parent / "default_settings.json"


def _load_default_settings() -> dict:
    """Load default settings from the committed JSON file, falling back to model defaults."""
    if _DEFAULT_SETTINGS_FILE.exists():
        try:
            data = json.loads(_DEFAULT_SETTINGS_FILE.read_text(encoding="utf-8"))
            # Merge with model defaults so any new fields added later are included
            base = OrgSettings().model_dump()
            base.update({k: v for k, v in data.items() if k in base})
            return base
        except Exception:
            pass
    return OrgSettings().model_dump()


async def ensure_settings(db) -> None:
    s = await db.settings.find_one({"id": "org_singleton"})
    if not s:
        # Fresh install — seed from default_settings.json
        defaults = _load_default_settings()
        defaults["id"] = "org_singleton"
        await db.settings.insert_one(defaults)
        return

    # Migrate older records that may be missing newer fields
    patch = {}
    if "logo_filter" not in s:
        patch["logo_filter"] = "none"
    if "logo_custom_color" not in s:
        patch["logo_custom_color"] = ""
    if "invoice_color" not in s:
        # Pull the value from default_settings.json so it stays consistent
        defaults = _load_default_settings()
        patch["invoice_color"] = defaults.get("invoice_color", "#0B0B0B")
    if patch:
        await db.settings.update_one({"id": "org_singleton"}, {"$set": patch})
