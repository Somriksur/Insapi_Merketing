"""Pixel-faithful invoice PDF matching the on-screen preview."""
from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Any, Dict, List

import requests

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

from upi_service import build_qr_png, build_upi_link

ASSETS = Path(__file__).parent / "assets"
LOGO_PATH = ASSETS / "logo.png"
FONT_REG = ASSETS / "fonts" / "Inv-Regular.ttf"
FONT_BOLD = ASSETS / "fonts" / "Inv-Bold.ttf"

# Default logo URL as fallback
DEFAULT_LOGO_URL = "https://res.cloudinary.com/ds2xh85dt/image/upload/v1779656917/ChatGPT_Image_May_25_2026_02_37_24_AM_m8b5km.png"

BRAND = colors.HexColor("#1D4ED8")
INK = colors.HexColor("#0B0B0B")
GRAY_500 = colors.HexColor("#6B7280")
GRAY_700 = colors.HexColor("#374151")
GRAY_400 = colors.HexColor("#9CA3AF")
LINE = colors.HexColor("#E5E7EB")
ROW_ALT = colors.HexColor("#FAFAFA")

# Map of logo_filter → brand hex (mirrors frontend branding.js getLogoColor)
_FILTER_COLORS = {
    "blue":  "#1D4ED8",
    "red":   "#DC2626",
    "green": "#059669",
}
_DEFAULT_BRAND_HEX = "#1D4ED8"


def _brand_color(org: Dict[str, Any]) -> "colors.HexColor":
    """
    Resolve the brand color from org settings so the PDF matches the app UI.
    Priority: custom hex → preset filter color → default blue.
    """
    logo_filter = (org.get("logo_filter") or "none").lower()
    if logo_filter == "custom":
        custom = (org.get("logo_custom_color") or "").strip()
        import re
        if re.match(r"^#[0-9a-fA-F]{6}$", custom):
            return colors.HexColor(custom)
    if logo_filter in _FILTER_COLORS:
        return colors.HexColor(_FILTER_COLORS[logo_filter])
    return BRAND


def _money(v) -> str:
    try:
        return f"\u20B9{float(v):,.0f}"
    except Exception:
        return "\u20B90"


def _money_full(v) -> str:
    try:
        return f"\u20B9{float(v):,.2f}"
    except Exception:
        return "\u20B90.00"


def _apply_color_filter(img_bytes: bytes, filter_type: str, custom_color: str = "") -> bytes:
    """
    Apply color filter to image bytes.
    Supports: grayscale, blue, red, green, custom color overlay.
    Returns filtered image bytes.
    """
    try:
        from PIL import Image, ImageEnhance, ImageOps
        
        # Open image from bytes
        img = Image.open(io.BytesIO(img_bytes))
        
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        if filter_type == "grayscale":
            # Convert to grayscale but keep alpha channel
            gray = ImageOps.grayscale(img.convert('RGB'))
            gray_rgba = Image.new('RGBA', img.size)
            gray_rgba.paste(gray)
            gray_rgba.putalpha(img.split()[3] if img.mode == 'RGBA' else 255)
            img = gray_rgba
            
        elif filter_type in ["blue", "red", "green"]:
            # Apply color tint
            r, g, b, a = img.split()
            
            if filter_type == "blue":
                # Reduce red and green, keep blue
                r = r.point(lambda x: int(x * 0.3))
                g = g.point(lambda x: int(x * 0.5))
            elif filter_type == "red":
                # Keep red, reduce green and blue
                g = g.point(lambda x: int(x * 0.3))
                b = b.point(lambda x: int(x * 0.3))
            elif filter_type == "green":
                # Keep green, reduce red and blue
                r = r.point(lambda x: int(x * 0.3))
                b = b.point(lambda x: int(x * 0.5))
            
            img = Image.merge('RGBA', (r, g, b, a))
            
        elif filter_type == "custom" and custom_color:
            # Apply custom color overlay
            try:
                # Parse hex color
                color = custom_color.strip('#')
                if len(color) == 6:
                    overlay_r = int(color[0:2], 16)
                    overlay_g = int(color[2:4], 16)
                    overlay_b = int(color[4:6], 16)
                    
                    # Create color overlay
                    overlay = Image.new('RGB', img.size, (overlay_r, overlay_g, overlay_b))
                    
                    # Blend with original (50% opacity)
                    rgb = img.convert('RGB')
                    blended = Image.blend(rgb, overlay, 0.3)
                    
                    # Restore alpha channel
                    result = Image.new('RGBA', img.size)
                    result.paste(blended)
                    if img.mode == 'RGBA':
                        result.putalpha(img.split()[3])
                    img = result
            except Exception:
                pass
        
        # Save filtered image to bytes
        output = io.BytesIO()
        img.save(output, format='PNG')
        return output.getvalue()
        
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error applying color filter: {e}")
        # Return original image if filter fails
        return img_bytes


def _load_logo_image(org: Dict[str, Any]) -> ImageReader | None:
    """
    Load logo image from URL or local file and apply color filter.
    Priority: org.logo_url > local LOGO_PATH > DEFAULT_LOGO_URL
    Returns ImageReader object or None if loading fails.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    img_bytes = None
    source_name = None
    
    # Try org logo URL first
    logo_url = org.get("logo_url", "").strip()
    if logo_url:
        try:
            logger.info(f"Attempting to load logo from org.logo_url: {logo_url}")
            response = requests.get(logo_url, timeout=10)
            if response.status_code == 200:
                img_bytes = response.content
                source_name = logo_url
                logger.info(f"Successfully loaded logo from URL: {logo_url}")
            else:
                logger.warning(f"Failed to load logo from URL (status {response.status_code}): {logo_url}")
        except Exception as e:
            logger.error(f"Error loading logo from URL {logo_url}: {e}")
    
    # Try local logo file if URL failed
    if not img_bytes and LOGO_PATH.exists():
        try:
            logger.info(f"Attempting to load logo from local path: {LOGO_PATH}")
            with open(LOGO_PATH, 'rb') as f:
                img_bytes = f.read()
            source_name = "local file"
            logger.info(f"Successfully loaded logo from local path")
        except Exception as e:
            logger.error(f"Error loading logo from local path: {e}")
    
    # Try default logo URL as fallback
    if not img_bytes:
        try:
            logger.info(f"Attempting to load default logo from: {DEFAULT_LOGO_URL}")
            response = requests.get(DEFAULT_LOGO_URL, timeout=10)
            if response.status_code == 200:
                img_bytes = response.content
                source_name = "default URL"
                logger.info(f"Successfully loaded default logo")
        except Exception as e:
            logger.error(f"Error loading default logo: {e}")
    
    if not img_bytes:
        logger.warning("Failed to load logo from any source")
        return None
    
    # Apply color filter if specified
    logo_filter = org.get("logo_filter", "none")
    if logo_filter and logo_filter != "none":
        logger.info(f"Applying logo filter: {logo_filter}")
        custom_color = org.get("logo_custom_color", "")
        img_bytes = _apply_color_filter(img_bytes, logo_filter, custom_color)
    
    # Create ImageReader from filtered bytes
    try:
        img = ImageReader(io.BytesIO(img_bytes))
        logger.info(f"Successfully created ImageReader from {source_name}")
        return img
    except Exception as e:
        logger.error(f"Error creating ImageReader: {e}")
        return None


def _register_fonts():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    candidates = [
        ("Inv-Regular", str(FONT_REG)),
        ("Inv-Bold", str(FONT_BOLD)),
    ]
    for name, path in candidates:
        try:
            if os.path.exists(path) and name not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont(name, path))
        except Exception:
            pass


_register_fonts()


def _wrap_text(c, text: str, x: float, y: float, max_width: float, font_name: str, font_size: float, color, line_height: float = 11) -> float:
    """
    Wrap text to fit within max_width and draw it.
    Returns the final y position after drawing all lines.
    """
    from reportlab.pdfbase.pdfmetrics import stringWidth
    
    words = str(text).split()
    lines = []
    current_line = ""
    
    for word in words:
        test_line = (current_line + " " + word).strip()
        width = stringWidth(test_line, font_name, font_size)
        
        if width <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word
    
    if current_line:
        lines.append(current_line)
    
    # Draw all lines
    c.setFillColor(color)
    c.setFont(font_name, font_size)
    for line in lines:
        c.drawString(x, y, line)
        y -= line_height
    
    return y


def F(bold: bool = False) -> str:
    from reportlab.pdfbase import pdfmetrics

    names = pdfmetrics.getRegisteredFontNames()
    if bold and "Inv-Bold" in names:
        return "Inv-Bold"
    if not bold and "Inv-Regular" in names:
        return "Inv-Regular"
    return "Helvetica-Bold" if bold else "Helvetica"


def build_invoice_pdf(
    invoice: Dict[str, Any],
    client: Dict[str, Any] | None,
    org: Dict[str, Any],
) -> bytes:
    buf = io.BytesIO()
    PW, PH = A4
    M = 18 * 2.83465  # 18 mm in points
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Invoice {invoice.get('number','')}")

    x = M
    y = PH - M
    content_w = PW - 2 * M

    # Resolve brand color from settings (changes with logo color filter)
    BRAND_COL = _brand_color(org)
    # Resolve invoice template accent color (header, table, dividers)
    _inv_color_hex = (org.get("invoice_color") or "").strip()
    import re as _re
    INV_COLOR = colors.HexColor(_inv_color_hex) if _re.match(r"^#[0-9a-fA-F]{6}$", _inv_color_hex) else INK

    # ===================== TOP HEADER =====================
    # Logo (left) + brand name + tagline
    logo_w = 36
    logo_h = 36
    
    # Load logo from URL or local file
    logo_img = _load_logo_image(org)
    if logo_img:
        try:
            c.drawImage(logo_img, x, y - logo_h, width=logo_w, height=logo_h, 
                       mask="auto", preserveAspectRatio=True)
        except Exception as e:
            # If image rendering fails, log error and continue without logo
            import logging
            logging.getLogger(__name__).error(f"Failed to render logo in PDF: {e}")
            pass

    # Brand text
    c.setFillColor(INV_COLOR)
    c.setFont(F(bold=True), 22)
    c.drawString(x + logo_w + 10, y - 18, org.get("name", "Insapi Marketing"))

    c.setFillColor(GRAY_500)
    c.setFont(F(), 7)
    c.drawString(x + logo_w + 10, y - 30, (org.get("website") or "").upper())

    # Right side: INVOICE label + number
    c.setFillColor(GRAY_500)
    c.setFont(F(), 8)
    c.drawRightString(PW - M, y - 8, "INVOICE")
    c.setFillColor(INK)
    c.setFont(F(bold=True), 26)
    invoice_no = invoice.get("number") or "DRAFT"
    c.drawRightString(PW - M, y - 32, invoice_no)

    # Horizontal rule under header — uses invoice color
    rule_y = y - 48
    c.setStrokeColor(INV_COLOR)
    c.setLineWidth(1.2)
    c.line(x, rule_y, PW - M, rule_y)

    # ===================== FROM / BILL TO =====================
    y_cursor = rule_y - 22

    col_w = content_w / 2
    max_text_width = col_w - 20  # Leave some padding
    
    # FROM column
    c.setFillColor(GRAY_500)
    c.setFont(F(bold=True), 7)
    c.drawString(x, y_cursor, "FROM")
    c.setFillColor(INK)
    c.setFont(F(bold=True), 9)
    c.drawString(x, y_cursor - 14, org.get("owner_name", ""))

    c.setFont(F(), 9)
    c.setFillColor(GRAY_700)
    
    # Wrap address and other fields
    y_from = y_cursor - 26
    if org.get("address"):
        y_from = _wrap_text(c, org.get("address", ""), x, y_from, max_text_width, F(), 9, GRAY_700, 11)
    
    other_from = [
        org.get("email", ""),
        org.get("phone", ""),
    ]
    if org.get("gst_number"):
        other_from.append(f"GSTIN: {org['gst_number']}")
    
    for ln in other_from:
        if ln:
            y_from = _wrap_text(c, ln, x, y_from, max_text_width, F(), 9, GRAY_700, 11)

    # BILL TO column
    bx = x + col_w + 10
    c.setFillColor(GRAY_500)
    c.setFont(F(bold=True), 7)
    c.drawString(bx, y_cursor, "BILL TO")
    
    y_to = y_cursor - 14
    if client:
        c.setFillColor(INK)
        c.setFont(F(bold=True), 9)
        head = client.get("name", "")
        if client.get("company"):
            head = f"{head} \u00B7 {client['company']}"
        c.drawString(bx, y_to, head)
        y_to -= 12
        
        c.setFont(F(), 9)
        c.setFillColor(GRAY_700)
        
        lines_to = [
            client.get("email", ""),
            client.get("whatsapp", ""),
            client.get("address", ""),
        ]
        for ln in lines_to:
            if ln:
                y_to = _wrap_text(c, ln, bx, y_to, max_text_width, F(), 9, GRAY_700, 11)
    else:
        c.setFillColor(GRAY_400)
        c.setFont(F(), 9)
        c.drawString(bx, y_to, "No client selected")
        y_to -= 12

    # Issued / Due - position below the longer column
    dy = min(y_from, y_to) - 12
    c.setFillColor(GRAY_500)
    c.setFont(F(bold=True), 7)
    c.drawString(bx, dy, "ISSUED")
    c.drawString(bx + 90, dy, "DUE")
    c.setFillColor(INK)
    c.setFont(F(), 10)
    c.drawString(bx, dy - 13, str(invoice.get("issue_date") or "-"))
    c.drawString(bx + 90, dy - 13, str(invoice.get("due_date") or "-"))

    # ===================== LINE ITEMS TABLE =====================
    table_y = dy - 36
    row_h = 22
    header_h = 22

    # Column widths
    col_no_w = 22
    col_qty_w = 50
    col_rate_w = 70
    col_amt_w = 80
    col_desc_w = content_w - col_no_w - col_qty_w - col_rate_w - col_amt_w

    # Header bar — uses invoice color
    c.setFillColor(INV_COLOR)
    c.rect(x, table_y - header_h, content_w, header_h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(F(bold=True), 7.5)
    hx = x
    c.drawString(hx + 6, table_y - 15, "#")
    hx += col_no_w
    c.drawString(hx + 6, table_y - 15, "DESCRIPTION")
    hx += col_desc_w
    c.drawRightString(hx + col_qty_w - 6, table_y - 15, "QTY")
    hx += col_qty_w
    c.drawRightString(hx + col_rate_w - 6, table_y - 15, "RATE")
    hx += col_rate_w
    c.drawRightString(hx + col_amt_w - 6, table_y - 15, "AMOUNT")

    # Rows
    lines: List[Dict[str, Any]] = invoice.get("lines", []) or []
    if not lines:
        lines = [{"description": "—", "quantity": 0, "rate": 0, "amount": 0}]

    row_top = table_y - header_h
    for idx, l in enumerate(lines):
        row_y = row_top - (idx + 1) * row_h
        # alternating bg
        if idx % 2 == 1:
            c.setFillColor(ROW_ALT)
            c.rect(x, row_y, content_w, row_h, fill=1, stroke=0)
        # bottom border
        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        c.line(x, row_y, x + content_w, row_y)

        c.setFillColor(GRAY_500)
        c.setFont(F(), 9)
        cx = x
        c.drawString(cx + 6, row_y + 7, str(idx + 1))

        c.setFillColor(INK)
        cx += col_no_w
        desc = str(l.get("description") or "")
        
        # Wrap description if too long
        from reportlab.pdfbase.pdfmetrics import stringWidth
        max_desc_width = col_desc_w - 12
        if stringWidth(desc, F(), 9) > max_desc_width:
            # Truncate with ellipsis if it doesn't fit
            while len(desc) > 0 and stringWidth(desc + "…", F(), 9) > max_desc_width:
                desc = desc[:-1]
            desc = desc + "…"
        
        c.drawString(cx + 6, row_y + 7, desc)

        cx += col_desc_w
        c.drawRightString(cx + col_qty_w - 6, row_y + 7, f"{l.get('quantity', 0):g}")

        cx += col_qty_w
        c.drawRightString(cx + col_rate_w - 6, row_y + 7, _money(l.get("rate", 0)))

        cx += col_rate_w
        c.drawRightString(cx + col_amt_w - 6, row_y + 7, _money(l.get("amount", 0)))

    rows_bottom = row_top - len(lines) * row_h

    # ===================== TOTALS BOX =====================
    sub = float(invoice.get("subtotal", 0) or 0)
    disc_pct = float(invoice.get("discount_pct", 0) or 0)
    disc = float(invoice.get("discount_amount", 0) or 0)
    tax_pct = float(invoice.get("tax_pct", 0) or 0)
    tax = float(invoice.get("tax_amount", 0) or 0)
    total = float(invoice.get("total", 0) or 0)
    paid = float(invoice.get("paid_amount", 0) or 0)
    balance = max(0.0, total - paid)

    totals_w = 220
    tx = PW - M - totals_w
    ty = rows_bottom - 24

    rows = [
        ("Subtotal", _money(sub), False),
        (f"Discount ({disc_pct:g}%)", f"- {_money(disc)}", False),
        (f"GST ({tax_pct:g}%)", _money(tax), False),
    ]
    line_h = 14
    for label, val, _ in rows:
        c.setFillColor(GRAY_700)
        c.setFont(F(), 9)
        c.drawString(tx, ty, label)
        c.setFillColor(INK)
        c.drawRightString(tx + totals_w, ty, val)
        ty -= line_h

    # Total rule — uses invoice color
    ty -= 4
    c.setStrokeColor(INV_COLOR)
    c.setLineWidth(0.8)
    c.line(tx, ty + 8, tx + totals_w, ty + 8)
    c.setFont(F(bold=True), 10)
    c.setFillColor(INK)
    c.drawString(tx, ty, "Total")
    c.drawRightString(tx + totals_w, ty, _money_full(total))
    ty -= line_h

    if paid > 0:
        c.setFont(F(), 9)
        c.setFillColor(GRAY_700)
        c.drawString(tx, ty, "Paid")
        c.setFillColor(INK)
        c.drawRightString(tx + totals_w, ty, _money(paid))
        ty -= line_h
        c.setFont(F(bold=True), 10)
        c.setFillColor(BRAND_COL)
        c.drawString(tx, ty, "Balance")
        c.drawRightString(tx + totals_w, ty, _money_full(balance))
        ty -= line_h

    # ===================== NOTES + PAYMENT =====================
    by = min(ty - 22, rows_bottom - 30)
    if invoice.get("notes"):
        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        c.line(x, by + 10, PW - M, by + 10)
        c.setFillColor(GRAY_500)
        c.setFont(F(bold=True), 7)
        c.drawString(x, by - 2, "NOTES")
        c.setFillColor(GRAY_700)
        c.setFont(F(), 9)
        note = str(invoice.get("notes") or "")
        
        # Use proper text wrapping for notes
        wy = by - 14
        max_note_width = content_w - 20
        wy = _wrap_text(c, note, x, wy, max_note_width, F(), 9, GRAY_700, 11)
        by = wy - 4

    bank_parts = []
    if org.get("bank_name"):
        bank_parts.append(org["bank_name"])
    if org.get("bank_account"):
        bank_parts.append(f"A/C {org['bank_account']}")
    if org.get("bank_ifsc"):
        bank_parts.append(f"IFSC {org['bank_ifsc']}")
    if org.get("upi_id"):
        bank_parts.append(f"UPI {org['upi_id']}")
    if bank_parts:
        c.setFillColor(GRAY_500)
        c.setFont(F(bold=True), 7)
        c.drawString(x, by - 2, "PAYMENT")
        c.setFillColor(GRAY_700)
        c.setFont(F(), 9)
        bank_text = " \u00B7 ".join(bank_parts)
        # Wrap bank details if too long
        max_bank_width = content_w * 0.6  # Leave space for QR code
        by = _wrap_text(c, bank_text, x, by - 14, max_bank_width, F(), 9, GRAY_700, 11)

    # ===================== UPI QR =====================
    upi_id = org.get("upi_id") or ""
    if upi_id:
        try:
            payee = org.get("owner_name") or org.get("name") or "Insapi Marketing"
            amount = max(0.0, total - paid)
            note = f"Invoice {invoice.get('number','')}"
            link = build_upi_link(upi_id, payee_name=payee, amount=amount if amount > 0 else None, note=note)
            qr_bytes = build_qr_png(link, box_size=6, border=1)
            if qr_bytes:
                qr_img = ImageReader(io.BytesIO(qr_bytes))
                qr_size = 78
                qx = PW - M - qr_size
                qy = by - 14 - qr_size - 6
                c.drawImage(qr_img, qx, qy, width=qr_size, height=qr_size, mask="auto")
                c.setFillColor(GRAY_500)
                c.setFont(F(bold=True), 7)
                c.drawRightString(PW - M, qy - 8, "SCAN TO PAY VIA UPI")
                c.setFillColor(GRAY_700)
                c.setFont(F(), 8)
                c.drawRightString(PW - M, qy - 18, upi_id)
        except Exception:
            pass

    # ===================== FOOTER =====================
    c.setFillColor(GRAY_400)
    c.setFont(F(), 7.5)
    footer = f"{org.get('name','Insapi Marketing')} \u00B7 {org.get('website','')} \u00B7 Generated by Insapi Marketing Workspace"
    c.drawCentredString(PW / 2, M / 2, footer)

    c.showPage()
    c.save()
    return buf.getvalue()
