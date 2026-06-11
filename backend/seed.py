"""Singleton settings creator (no dummy data)."""
from models import OrgSettings

LEGACY_DEFAULT_LOGO_URL = "https://res.cloudinary.com/ds2xh85dt/image/upload/v1779656917/ChatGPT_Image_May_25_2026_02_37_24_AM_m8b5km.png"


async def ensure_settings(db) -> None:
    s = await db.settings.find_one({"id": "org_singleton"})
    if not s:
        await db.settings.insert_one(OrgSettings().model_dump())
        return

    patch = {}
    if s.get("logo_url") == LEGACY_DEFAULT_LOGO_URL:
        patch["logo_url"] = ""
    if "logo_filter" not in s:
        patch["logo_filter"] = "none"
    if "logo_custom_color" not in s:
        patch["logo_custom_color"] = ""
    if patch:
        await db.settings.update_one({"id": "org_singleton"}, {"$set": patch})
