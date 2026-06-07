"""UPI deeplink + QR code helpers."""
from __future__ import annotations

import io
import urllib.parse
from typing import Optional

import qrcode
from qrcode.constants import ERROR_CORRECT_M


def build_upi_link(
    upi_id: str,
    payee_name: str = "",
    amount: float | None = None,
    note: str = "",
) -> str:
    """Build a standard UPI deeplink (upi://pay?...)."""
    if not upi_id:
        return ""
    params = {"pa": upi_id, "cu": "INR"}
    if payee_name:
        params["pn"] = payee_name
    if amount is not None and float(amount) > 0:
        params["am"] = f"{float(amount):.2f}"
    if note:
        params["tn"] = note
    return "upi://pay?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)


def build_qr_png(data: str, box_size: int = 8, border: int = 2) -> bytes:
    """Return a PNG image (bytes) for the given QR data."""
    if not data:
        return b""
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0B0B0B", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
