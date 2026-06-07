"""Singleton settings creator (no dummy data)."""
from models import OrgSettings


async def ensure_settings(db) -> None:
    s = await db.settings.find_one({"id": "org_singleton"})
    if not s:
        await db.settings.insert_one(OrgSettings().model_dump())
