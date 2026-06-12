"""Insapi Marketing Workspace API."""
from __future__ import annotations

import asyncio
import email.mime.application
import email.mime.multipart
import email.mime.text
import io
import logging
import os
import smtplib
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import ai_service
from db_utils import clean, clean_many
from models import (
    Client,
    ClientCreate,
    Expense,
    ExpenseCreate,
    Invoice,
    InvoiceCreate,
    Notification,
    OrgSettings,
    Payment,
    PaymentCreate,
    Project,
    ProjectCreate,
    Task,
    TaskCreate,
)
from pdf_service import build_invoice_pdf
from seed import ensure_settings
from sqlite_db import create_database
from upi_service import build_qr_png, build_upi_link
from credits_service import (
    CreditEntry,
    CreditEntryCreate,
    all_clients_summary,
    client_ledger,
)
from excel_service import build_template_xlsx, parse_and_import

db = create_database()

app = FastAPI(title="Insapi Marketing Workspace API")
api = APIRouter(prefix="/api")

# Thread pool for CPU-bound tasks (PDF gen, Excel, etc.) — Fix #12
_executor = ThreadPoolExecutor(max_workers=4)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("insapi")


# ============================================================
# Health
# ============================================================
@api.get("/")
async def root():
    return {"ok": True, "service": "Insapi Marketing Workspace"}


# ============================================================
# Settings
# ============================================================
@api.get("/settings", response_model=OrgSettings)
async def get_settings():
    s = await db.settings.find_one({"id": "org_singleton"}, {"_id": 0})
    if not s:
        s = OrgSettings().model_dump()
        await db.settings.insert_one(s)
        s = clean(s.copy())
    return OrgSettings(**s)


class SettingsUpdate(BaseModel):
    name: Optional[str] = None
    owner_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    gst_number: Optional[str] = None
    pan: Optional[str] = None
    daily_target: Optional[float] = None
    monthly_target: Optional[float] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    invoice_prefix: Optional[str] = None
    invoice_notes_default: Optional[str] = None
    whatsapp_template: Optional[str] = None
    logo_url: Optional[str] = None
    logo_filter: Optional[str] = None
    logo_custom_color: Optional[str] = None
    invoice_color: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None
    smtp_from: Optional[str] = None


@api.put("/settings", response_model=OrgSettings)
async def update_settings(body: SettingsUpdate):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"id": "org_singleton"},
        {"$set": patch},
        upsert=True,
    )
    s = await db.settings.find_one({"id": "org_singleton"}, {"_id": 0})
    return OrgSettings(**s)


# ============================================================
# Clients
# ============================================================
@api.get("/clients", response_model=List[Client])
async def list_clients():
    docs = await db.clients.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Client(**d) for d in docs]


@api.post("/clients", response_model=Client)
async def create_client(body: ClientCreate):
    obj = Client(**body.model_dump())
    await db.clients.insert_one(obj.model_dump())
    return obj


@api.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str):
    d = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Client not found")
    return Client(**d)


@api.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, body: ClientCreate):
    await db.clients.update_one({"id": client_id}, {"$set": body.model_dump()})
    d = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Client not found")
    return Client(**d)


@api.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    await db.clients.delete_one({"id": client_id})
    return {"ok": True}


# ============================================================
# Projects
# ============================================================
@api.get("/projects", response_model=List[Project])
async def list_projects():
    docs = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Project(**d) for d in docs]


@api.post("/projects", response_model=Project)
async def create_project(body: ProjectCreate):
    obj = Project(**body.model_dump())
    await db.projects.insert_one(obj.model_dump())
    return obj


@api.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, body: ProjectCreate):
    await db.projects.update_one({"id": project_id}, {"$set": body.model_dump()})
    d = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Project not found")
    return Project(**d)


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    await db.projects.delete_one({"id": project_id})
    return {"ok": True}


# ============================================================
# Tasks
# ============================================================
@api.get("/tasks", response_model=List[Task])
async def list_tasks():
    docs = await db.tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [Task(**d) for d in docs]


@api.post("/tasks", response_model=Task)
async def create_task(body: TaskCreate):
    obj = Task(**body.model_dump())
    await db.tasks.insert_one(obj.model_dump())
    return obj


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    billable_amount: Optional[float] = None
    tags: Optional[List[str]] = None


@api.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, body: TaskUpdate):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if patch.get("status") == "completed":
        patch["completed_at"] = datetime.now(timezone.utc).isoformat()
    await db.tasks.update_one({"id": task_id}, {"$set": patch})
    d = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Task not found")
    return Task(**d)


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}


# ============================================================
# Payments
# ============================================================
@api.get("/payments", response_model=List[Payment])
async def list_payments():
    docs = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [Payment(**d) for d in docs]


@api.get("/payments/stats")
async def payment_stats():
    """Get payment statistics for debugging."""
    payments = await db.payments.find({}, {"_id": 0}).to_list(5000)
    
    total_payments = len(payments)
    paid_count = sum(1 for p in payments if p.get("status") == "paid")
    partial_count = sum(1 for p in payments if p.get("status") == "partial")
    pending_count = sum(1 for p in payments if p.get("status") == "pending")
    
    # Count payments with paid_at
    with_paid_at = sum(1 for p in payments if p.get("paid_at"))
    without_paid_at = total_payments - with_paid_at
    
    # Calculate revenue
    total_revenue = sum(float(p.get("paid_amount", 0) or 0) for p in payments if p.get("paid_at"))
    total_paid_amount = sum(float(p.get("paid_amount", 0) or 0) for p in payments)
    
    return {
        "total_payments": total_payments,
        "by_status": {
            "paid": paid_count,
            "partial": partial_count,
            "pending": pending_count,
        },
        "paid_at_tracking": {
            "with_paid_at": with_paid_at,
            "without_paid_at": without_paid_at,
            "percentage_tracked": round(with_paid_at * 100 / max(1, total_payments), 1),
        },
        "revenue": {
            "tracked_revenue": round(total_revenue, 2),
            "total_paid_amount": round(total_paid_amount, 2),
            "difference": round(total_paid_amount - total_revenue, 2),
        }
    }


@api.post("/payments", response_model=Payment)
async def create_payment(body: PaymentCreate):
    obj = Payment(**body.model_dump())
    
    # Set paid_at for ANY payment where money was received
    if obj.paid_amount > 0:
        if not obj.paid_at:
            obj.paid_at = datetime.now(timezone.utc).isoformat()
    
    # Set status based on payment amount
    if obj.paid_amount >= obj.amount and obj.amount > 0:
        obj.status = "paid"
    elif obj.paid_amount > 0:
        obj.status = "partial"
    else:
        obj.status = obj.status or "pending"
    
    await db.payments.insert_one(obj.model_dump())
    if obj.invoice_id:
        await _sync_invoice_payment(obj.invoice_id)
    return obj


class PaymentUpdate(BaseModel):
    work_details: Optional[str] = None
    amount: Optional[float] = None
    paid_amount: Optional[float] = None
    due_date: Optional[str] = None
    method: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


@api.put("/payments/{payment_id}", response_model=Payment)
async def update_payment(payment_id: str, body: PaymentUpdate):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    cur = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not cur:
        raise HTTPException(404, "Payment not found")
    new = {**cur, **patch}
    paid = float(new.get("paid_amount", 0) or 0)
    amt = float(new.get("amount", 0) or 0)
    
    # If status is manually set to "paid", ensure paid_at is set
    if patch.get("status") == "paid" and not new.get("paid_at"):
        new["paid_at"] = datetime.now(timezone.utc).isoformat()
        # Also ensure paid_amount equals amount if not already set
        if paid < amt:
            new["paid_amount"] = amt
    elif paid >= amt and amt > 0:
        new["status"] = "paid"
        new["paid_at"] = datetime.now(timezone.utc).isoformat()
    elif paid > 0:
        new["status"] = "partial"
        # Set paid_at for partial payments too
        if not new.get("paid_at"):
            new["paid_at"] = datetime.now(timezone.utc).isoformat()
    else:
        if not patch.get("status"):
            new["status"] = "pending"
    
    await db.payments.update_one({"id": payment_id}, {"$set": new})
    if new.get("invoice_id"):
        await _sync_invoice_payment(new["invoice_id"])
    d = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    return Payment(**d)


@api.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str):
    cur = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    await db.payments.delete_one({"id": payment_id})
    if cur and cur.get("invoice_id"):
        await _sync_invoice_payment(cur["invoice_id"])
    return {"ok": True}


async def _sync_invoice_payment(invoice_id: str):
    """Recalc invoice paid_amount from related payments."""
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        return
    pays = await db.payments.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(500)
    total_paid = sum(float(p.get("paid_amount", 0) or 0) for p in pays)
    new_status = inv.get("status", "draft")
    total = float(inv.get("total", 0) or 0)
    if total > 0 and total_paid >= total:
        new_status = "paid"
    elif total_paid > 0 and new_status == "draft":
        new_status = "sent"
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"paid_amount": total_paid, "status": new_status}},
    )


# ============================================================
# Invoices
# ============================================================
async def _next_invoice_number(prefix: str = "IM") -> str:
    year = datetime.now(timezone.utc).year
    res = await db.counters.find_one_and_update(
        {"_id": f"invoice_{year}"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    val = (res or {}).get("value", 1)
    return f"{prefix}-{year}-{val:04d}"


def _calc_invoice(inv: Dict[str, Any]) -> Dict[str, Any]:
    lines = inv.get("lines", []) or []
    sub = 0.0
    for l in lines:
        amt = float(l.get("quantity", 0) or 0) * float(l.get("rate", 0) or 0)
        l["amount"] = round(amt, 2)
        sub += amt
    disc_pct = float(inv.get("discount_pct", 0) or 0)
    disc_amt = round(sub * disc_pct / 100, 2)
    tax_pct = float(inv.get("tax_pct", 0) or 0)
    tax_amt = round((sub - disc_amt) * tax_pct / 100, 2)
    total = round(sub - disc_amt + tax_amt, 2)
    inv["subtotal"] = round(sub, 2)
    inv["discount_amount"] = disc_amt
    inv["tax_amount"] = tax_amt
    inv["total"] = total
    return inv


@api.get("/invoices", response_model=List[Invoice])
async def list_invoices():
    docs = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [Invoice(**d) for d in docs]


@api.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    d = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Invoice not found")
    return Invoice(**d)


@api.post("/invoices", response_model=Invoice)
async def create_invoice(body: InvoiceCreate):
    settings = await db.settings.find_one({"id": "org_singleton"}, {"_id": 0}) or {}
    prefix = settings.get("invoice_prefix", "IM")
    obj = Invoice(**body.model_dump())
    obj.number = await _next_invoice_number(prefix)
    data = _calc_invoice(obj.model_dump())
    await db.invoices.insert_one(data)
    return Invoice(**data)


@api.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: str, body: InvoiceCreate):
    cur = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not cur:
        raise HTTPException(404, "Invoice not found")
    new = {**cur, **body.model_dump()}
    new = _calc_invoice(new)
    await db.invoices.update_one({"id": invoice_id}, {"$set": new})
    d = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return Invoice(**d)


class InvoiceStatusUpdate(BaseModel):
    status: str


@api.patch("/invoices/{invoice_id}/status", response_model=Invoice)
async def patch_invoice_status(invoice_id: str, body: InvoiceStatusUpdate):
    patch: Dict[str, Any] = {"status": body.status}
    if body.status == "sent":
        patch["sent_at"] = datetime.now(timezone.utc).isoformat()
    await db.invoices.update_one({"id": invoice_id}, {"$set": patch})
    d = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Invoice not found")
    return Invoice(**d)


@api.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    await db.invoices.delete_one({"id": invoice_id})
    await db.payments.delete_many({"invoice_id": invoice_id})
    return {"ok": True}


@api.get("/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: str):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    cli = (
        await db.clients.find_one({"id": inv.get("client_id")}, {"_id": 0})
        if inv.get("client_id")
        else None
    )
    org = await db.settings.find_one({"id": "org_singleton"}, {"_id": 0}) or {}
    pdf_bytes = await asyncio.get_event_loop().run_in_executor(
        _executor, build_invoice_pdf, inv, cli, org
    )
    fname = f"{inv.get('number','invoice')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{fname}"'},
    )


@api.get("/invoices/{invoice_id}/whatsapp")
async def invoice_whatsapp(invoice_id: str):
    """Return a wa.me deeplink with the formatted message and PDF instructions."""
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    cli = (
        await db.clients.find_one({"id": inv.get("client_id")}, {"_id": 0})
        if inv.get("client_id")
        else None
    )
    org = await db.settings.find_one({"id": "org_singleton"}, {"_id": 0}) or {}
    template = org.get("whatsapp_template") or (
        "Hi {client_name},\n\nHere is your invoice {invoice_number} from {org_name}.\n"
        "Amount due: ₹{balance}.\n\nPDF attached.\n\nThanks,\n{owner_name} · {org_name}"
    )
    balance = max(0.0, float(inv.get("total", 0) or 0) - float(inv.get("paid_amount", 0) or 0))
    msg = template.format(
        client_name=(cli or {}).get("name", "there"),
        invoice_number=inv.get("number", ""),
        org_name=org.get("name", "Insapi Marketing"),
        owner_name=org.get("owner_name", "Team"),
        total=f"{float(inv.get('total',0)):,.0f}",
        balance=f"{balance:,.0f}",
    )
    phone = (cli or {}).get("whatsapp", "") or ""
    phone_clean = "".join(ch for ch in phone if ch.isdigit())
    text = urllib.parse.quote(msg)
    if phone_clean:
        url = f"https://wa.me/{phone_clean}?text={text}"
    else:
        url = f"https://wa.me/?text={text}"
    return {"url": url, "message": msg, "phone": phone_clean}


@api.post("/invoices/{invoice_id}/send-email")
async def send_invoice_email(invoice_id: str):
    """Send invoice PDF as email attachment to the client."""
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    cli = (
        await db.clients.find_one({"id": inv.get("client_id")}, {"_id": 0})
        if inv.get("client_id")
        else None
    )
    org = await db.settings.find_one({"id": "org_singleton"}, {"_id": 0}) or {}

    to_email = (cli or {}).get("email", "")
    if not to_email:
        raise HTTPException(400, "Client has no email address. Add one in Clients settings.")

    smtp_host = org.get("smtp_host", "")
    smtp_user = org.get("smtp_user", "")
    smtp_pass = org.get("smtp_pass", "")
    smtp_from = org.get("smtp_from", "") or smtp_user
    smtp_port = int(org.get("smtp_port", 587) or 587)

    if not smtp_host or not smtp_user:
        raise HTTPException(400, "SMTP not configured. Go to Settings and fill in SMTP Host, User, and Password.")

    # Build PDF in thread pool (CPU-bound)
    pdf_bytes = await asyncio.get_event_loop().run_in_executor(
        _executor, build_invoice_pdf, inv, cli, org
    )

    balance = max(0.0, float(inv.get("total", 0) or 0) - float(inv.get("paid_amount", 0) or 0))
    org_name = org.get("name", "Insapi Marketing")
    inv_number = inv.get("number", "Invoice")

    subject = f"Invoice {inv_number} from {org_name}"
    body = (
        f"Dear {(cli or {}).get('name', 'Client')},\n\n"
        f"Please find your invoice {inv_number} attached.\n\n"
        f"Amount Due: ₹{balance:,.2f}\n"
        f"Invoice Total: ₹{float(inv.get('total', 0)):,.2f}\n\n"
        f"Thank you for your business.\n\n"
        f"Regards,\n{org.get('owner_name', org_name)}\n{org_name}"
    )

    def _send():
        msg = email.mime.multipart.MIMEMultipart()
        msg["From"] = smtp_from
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(email.mime.text.MIMEText(body, "plain"))
        part = email.mime.application.MIMEApplication(pdf_bytes, _subtype="pdf")
        part.add_header("Content-Disposition", "attachment", filename=f"{inv_number}.pdf")
        msg.attach(part)
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_email, msg.as_string())

    try:
        await asyncio.get_event_loop().run_in_executor(_executor, _send)
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(502, "SMTP authentication failed. Check your username and password in Settings.")
    except smtplib.SMTPException as e:
        raise HTTPException(502, f"Email failed: {e}")
    except Exception as e:
        raise HTTPException(502, f"Could not send email: {e}")

    # Mark invoice as sent
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "to": to_email, "invoice": inv_number}


# ============================================================
# UPI / QR
# ============================================================
@api.get("/upi/qr.png")
async def upi_qr(amount: float | None = None, note: str = ""):
    """Org-level UPI QR with optional amount."""
    org = await db.settings.find_one({"id": "org_singleton"}, {"_id": 0}) or {}
    upi_id = org.get("upi_id") or ""
    if not upi_id:
        raise HTTPException(404, "UPI ID not configured in Settings")
    link = build_upi_link(
        upi_id,
        payee_name=org.get("owner_name") or org.get("name") or "Insapi Marketing",
        amount=amount,
        note=note or org.get("name", ""),
    )
    png = build_qr_png(link, box_size=10, border=2)
    return StreamingResponse(io.BytesIO(png), media_type="image/png",
                             headers={"Cache-Control": "no-cache"})


@api.get("/invoices/{invoice_id}/upi-qr.png")
async def invoice_upi_qr(invoice_id: str):
    """QR for the specific invoice's balance due."""
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    org = await db.settings.find_one({"id": "org_singleton"}, {"_id": 0}) or {}
    upi_id = org.get("upi_id") or ""
    if not upi_id:
        raise HTTPException(404, "UPI ID not configured")
    balance = max(0.0, float(inv.get("total", 0) or 0) - float(inv.get("paid_amount", 0) or 0))
    link = build_upi_link(
        upi_id,
        payee_name=org.get("owner_name") or org.get("name") or "Insapi Marketing",
        amount=balance if balance > 0 else None,
        note=f"Invoice {inv.get('number','')}",
    )
    png = build_qr_png(link, box_size=10, border=2)
    return StreamingResponse(io.BytesIO(png), media_type="image/png",
                             headers={"Cache-Control": "no-cache"})


# ============================================================
# Expenses
# ============================================================
@api.get("/expenses", response_model=List[Expense])
async def list_expenses():
    docs = await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(2000)
    return [Expense(**d) for d in docs]


@api.post("/expenses", response_model=Expense)
async def create_expense(body: ExpenseCreate):
    obj = Expense(**body.model_dump())
    await db.expenses.insert_one(obj.model_dump())
    return obj


class ExpenseUpdate(BaseModel):
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    receipt_url: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


@api.put("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, body: ExpenseUpdate):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    cur = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not cur:
        raise HTTPException(404, "Expense not found")
    new = {**cur, **patch}
    await db.expenses.update_one({"id": expense_id}, {"$set": new})
    d = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    return Expense(**d)


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str):
    await db.expenses.delete_one({"id": expense_id})
    return {"ok": True}


@api.get("/expenses/summary")
async def expenses_summary():
    """Get expense summary by category and status."""
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(5000)
    
    total = sum(float(e.get("amount", 0) or 0) for e in expenses)
    by_category: Dict[str, float] = {}
    by_status: Dict[str, float] = {}
    
    for e in expenses:
        amt = float(e.get("amount", 0) or 0)
        cat = e.get("category", "other")
        status = e.get("status", "pending")
        
        by_category[cat] = by_category.get(cat, 0) + amt
        by_status[status] = by_status.get(status, 0) + amt
    
    return {
        "total": round(total, 2),
        "by_category": {k: round(v, 2) for k, v in by_category.items()},
        "by_status": {k: round(v, 2) for k, v in by_status.items()},
        "count": len(expenses),
    }


# ============================================================
# Credit Ledger
# ============================================================
@api.get("/credits")
async def list_credits():
    docs = await db.credits.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api.post("/credits", response_model=CreditEntry)
async def create_credit(body: CreditEntryCreate):
    obj = CreditEntry(**body.model_dump())
    await db.credits.insert_one(obj.model_dump())
    return obj


@api.delete("/credits/{credit_id}")
async def delete_credit(credit_id: str):
    await db.credits.delete_one({"id": credit_id})
    return {"ok": True}


@api.get("/clients/{client_id}/ledger")
async def get_client_ledger(client_id: str):
    return await client_ledger(db, client_id)


@api.get("/ledger/summary")
async def ledger_summary():
    return await all_clients_summary(db)


# ---------- Credits: Excel/CSV import ----------
@api.get("/credits/template.xlsx")
async def credits_template():
    xlsx = build_template_xlsx()
    return StreamingResponse(
        io.BytesIO(xlsx),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="insapi-marketing-credits-template.xlsx"'},
    )


@api.post("/credits/import")
async def import_credits(file: UploadFile = File(...), auto_create_clients: bool = True):
    name = (file.filename or "").lower()
    if not (name.endswith(".xlsx") or name.endswith(".xls") or name.endswith(".csv")):
        raise HTTPException(400, "Only .xlsx, .xls or .csv files are supported")
    data = await file.read()
    if len(data) > 5_000_000:
        raise HTTPException(400, "File too large (max 5 MB)")
    result = await parse_and_import(db, data, file.filename or "upload.xlsx",
                                    auto_create_clients=auto_create_clients)
    return result


# ============================================================
# Dashboard / Analytics
# ============================================================
def _parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


@api.get("/dashboard")
async def dashboard():
    settings = await db.settings.find_one({"id": "org_singleton"}, {"_id": 0}) or {}
    daily_target = float(settings.get("daily_target", 1000))
    monthly_target = float(settings.get("monthly_target", 30000))

    now = datetime.now(timezone.utc)
    today = now.date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    payments = await db.payments.find({}, {"_id": 0}).to_list(5000)
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(5000)
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(5000)

    daily = weekly = monthly = 0.0
    pending_amount = 0.0
    partial_amount = 0.0
    overdue_amount = 0.0
    paid_invoices_total = 0.0
    partial_payments_count = 0

    for p in payments:
        amt_paid = float(p.get("paid_amount", 0) or 0)
        paid_at = _parse_iso(p.get("paid_at"))
        if paid_at:
            d = paid_at.date()
            if d == today:
                daily += amt_paid
            if d >= week_start:
                weekly += amt_paid
            if d >= month_start:
                monthly += amt_paid
        if p.get("status") == "pending":
            pending_amount += float(p.get("amount", 0) or 0) - amt_paid
        elif p.get("status") == "partial":
            partial_amount += float(p.get("amount", 0) or 0) - amt_paid
            partial_payments_count += 1
        if p.get("status") == "overdue":
            overdue_amount += float(p.get("amount", 0) or 0) - amt_paid

    for inv in invoices:
        if inv.get("status") == "paid":
            paid_invoices_total += float(inv.get("total", 0) or 0)

    # Calculate expenses
    total_expenses = sum(float(e.get("amount", 0) or 0) for e in expenses)
    pending_expenses = sum(
        float(e.get("amount", 0) or 0) 
        for e in expenses 
        if e.get("status") == "pending"
    )
    monthly_expenses = 0.0
    for e in expenses:
        e_date_str = e.get("date") or e.get("created_at") or ""
        e_date = _parse_iso(e_date_str)
        if e_date and e_date.date() >= month_start:
            monthly_expenses += float(e.get("amount", 0) or 0)

    tasks_completed_today = 0
    tasks_completed_week = 0
    pending_tasks = 0
    in_progress = 0
    streak_days = 0
    daily_completed_set = set()
    for t in tasks:
        if t.get("status") == "completed":
            ca = _parse_iso(t.get("completed_at"))
            if ca:
                d = ca.date()
                daily_completed_set.add(d)
                if d == today:
                    tasks_completed_today += 1
                if d >= week_start:
                    tasks_completed_week += 1
        elif t.get("status") == "in_progress":
            in_progress += 1
        else:
            pending_tasks += 1

    # streak: consecutive days back from today with at least 1 completed task
    cur = today
    while cur in daily_completed_set:
        streak_days += 1
        cur = cur - timedelta(days=1)

    # weekly revenue trend (last 7 days)
    trend = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        amt = sum(
            float(p.get("paid_amount", 0) or 0)
            for p in payments
            if (_parse_iso(p.get("paid_at")) or datetime.min.replace(tzinfo=timezone.utc)).date() == d
        )
        trend.append({"date": d.isoformat(), "amount": round(amt, 2)})

    completion_pct = 0
    total_tasks = len(tasks)
    if total_tasks:
        completion_pct = round(
            sum(1 for t in tasks if t.get("status") == "completed") * 100 / total_tasks
        )

    return {
        "daily_revenue": round(daily, 2),
        "weekly_revenue": round(weekly, 2),
        "monthly_revenue": round(monthly, 2),
        "daily_target": daily_target,
        "monthly_target": monthly_target,
        "daily_pct": min(100, round(daily * 100 / max(1, daily_target))),
        "monthly_pct": min(100, round(monthly * 100 / max(1, monthly_target))),
        "pending_amount": round(pending_amount, 2),
        "partial_amount": round(partial_amount, 2),
        "partial_payments_count": partial_payments_count,
        "overdue_amount": round(overdue_amount, 2),
        "paid_invoices_total": round(paid_invoices_total, 2),
        "total_expenses": round(total_expenses, 2),
        "monthly_expenses": round(monthly_expenses, 2),
        "net_profit": round(monthly - monthly_expenses, 2),
        "pending_expenses": round(pending_expenses, 2),
        "tasks_completed_today": tasks_completed_today,
        "tasks_completed_week": tasks_completed_week,
        "pending_tasks": pending_tasks,
        "in_progress": in_progress,
        "completion_pct": completion_pct,
        "streak_days": streak_days,
        "trend": trend,
    }


@api.get("/analytics")
async def analytics():
    payments = await db.payments.find({}, {"_id": 0}).to_list(5000)
    clients = await db.clients.find({}, {"_id": 0}).to_list(2000)
    projects = await db.projects.find({}, {"_id": 0}).to_list(2000)
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(5000)

    # by client
    by_client: Dict[str, float] = {}
    for p in payments:
        if p.get("status") == "paid":
            by_client[p.get("client_id")] = by_client.get(p.get("client_id"), 0) + float(
                p.get("paid_amount", 0) or 0
            )
    client_names = {c.get("id"): c.get("name", "—") for c in clients}
    top_clients = sorted(
        ({"name": client_names.get(k, "—"), "revenue": round(v, 2)} for k, v in by_client.items()),
        key=lambda x: x["revenue"],
        reverse=True,
    )[:6]

    # by work type
    proj_type = {p.get("id"): p.get("work_type", "Other") for p in projects}
    by_type: Dict[str, float] = {}
    for inv in await db.invoices.find({}, {"_id": 0}).to_list(5000):
        if inv.get("status") == "paid":
            wt = proj_type.get(inv.get("project_id"), "Other")
            by_type[wt] = by_type.get(wt, 0) + float(inv.get("total", 0) or 0)
    work_types = sorted(
        ({"name": k, "revenue": round(v, 2)} for k, v in by_type.items()),
        key=lambda x: x["revenue"],
        reverse=True,
    )

    # last 6 months
    today = datetime.now(timezone.utc).date()
    months = []
    for i in range(5, -1, -1):
        ym = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        amt = 0.0
        for p in payments:
            paid_at = _parse_iso(p.get("paid_at"))
            if paid_at and paid_at.date().year == ym.year and paid_at.date().month == ym.month:
                amt += float(p.get("paid_amount", 0) or 0)
        months.append({"month": ym.strftime("%b"), "amount": round(amt, 2)})

    # productivity per day (last 14 days)
    prod = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        c = sum(
            1
            for t in tasks
            if t.get("status") == "completed"
            and (_parse_iso(t.get("completed_at")) or datetime.min.replace(tzinfo=timezone.utc)).date() == d
        )
        prod.append({"date": d.isoformat(), "completed": c})

    income_per_hour = 0.0
    total_min = sum(int(t.get("actual_minutes", 0) or 0) for t in tasks)
    paid_total = sum(
        float(p.get("paid_amount", 0) or 0) for p in payments if p.get("paid_at")
    )
    if total_min > 0:
        income_per_hour = round(paid_total / (total_min / 60.0), 2)

    return {
        "top_clients": top_clients,
        "work_types": work_types,
        "monthly_revenue": months,
        "productivity": prod,
        "income_per_hour": income_per_hour,
        "total_minutes": total_min,
        "paid_total": round(paid_total, 2),
    }


# ============================================================
# AI
# ============================================================
@api.get("/ai/insights")
async def ai_insights():
    stats = await dashboard()
    return {"insights": await ai_service.generate_insights(stats)}


@api.get("/ai/forecast")
async def ai_forecast():
    settings = await db.settings.find_one({"id": "org_singleton"}, {"_id": 0}) or {}
    target = float(settings.get("monthly_target", 30000))
    today = datetime.now(timezone.utc).date()
    month_start = today.replace(day=1)
    payments = await db.payments.find({}, {"_id": 0}).to_list(5000)
    history = []
    for p in payments:
        paid_at = _parse_iso(p.get("paid_at"))
        if paid_at and paid_at.date() >= month_start:
            history.append({"date": paid_at.date().isoformat(), "amount": float(p.get("paid_amount", 0) or 0)})
    return await ai_service.forecast_revenue(history, target)


@api.get("/ai/prioritize")
async def ai_prioritize():
    tasks = await db.tasks.find({"status": {"$ne": "completed"}}, {"_id": 0}).to_list(200)
    return {"tasks": await ai_service.prioritize_tasks(tasks)}


@api.get("/ai/summary")
async def ai_summary():
    stats = await dashboard()
    return {"summary": await ai_service.weekly_summary(stats)}


# ============================================================
# Reports / Export
# ============================================================
def _csv(rows: List[Dict[str, Any]], headers: List[str]) -> str:
    import csv
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=headers, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return buf.getvalue()


@api.get("/reports/{kind}.csv")
async def export_csv(kind: str):
    if kind == "invoices":
        docs = await db.invoices.find({}, {"_id": 0}).to_list(5000)
        headers = ["number", "client_id", "issue_date", "due_date", "subtotal", "tax_amount", "total", "paid_amount", "status"]
    elif kind == "payments":
        docs = await db.payments.find({}, {"_id": 0}).to_list(5000)
        headers = ["client_id", "invoice_id", "work_details", "amount", "paid_amount", "due_date", "method", "status", "paid_at"]
    elif kind == "expenses":
        docs = await db.expenses.find({}, {"_id": 0}).to_list(5000)
        headers = ["client_id", "project_id", "category", "description", "amount", "date", "status", "notes"]
    elif kind == "clients":
        docs = await db.clients.find({}, {"_id": 0}).to_list(5000)
        headers = ["name", "company", "email", "whatsapp", "address", "rating"]
    elif kind == "tasks":
        docs = await db.tasks.find({}, {"_id": 0}).to_list(5000)
        headers = ["title", "status", "priority", "due_date", "estimated_minutes", "actual_minutes", "billable_amount"]
    else:
        raise HTTPException(404, "Unknown report kind")
    csv_text = _csv(docs, headers)
    return StreamingResponse(
        io.BytesIO(csv_text.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{kind}.csv"'},
    )


@api.get("/reports/monthly")
async def monthly_reports(year: int = None):
    """Get monthly breakdown of revenue, expenses, and profit."""
    if year is None:
        year = datetime.now(timezone.utc).year
    
    # Get all payments and expenses for the year
    payments = await db.payments.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    
    # Initialize months
    months = []
    month_names = ["January", "February", "March", "April", "May", "June", 
                   "July", "August", "September", "October", "November", "December"]
    
    for month_num in range(1, 13):
        month_revenue = 0.0
        month_expenses = 0.0
        
        # Calculate revenue from payments
        for p in payments:
            paid_at = _parse_iso(p.get("paid_at"))
            if paid_at and paid_at.year == year and paid_at.month == month_num:
                month_revenue += float(p.get("paid_amount", 0) or 0)
        
        # Calculate expenses
        for e in expenses:
            expense_date = e.get("date", "")
            if expense_date:
                try:
                    e_date = datetime.fromisoformat(expense_date.replace("Z", "+00:00"))
                    if e_date.year == year and e_date.month == month_num:
                        month_expenses += float(e.get("amount", 0) or 0)
                except Exception:
                    pass
        
        month_profit = month_revenue - month_expenses
        
        months.append({
            "month": month_names[month_num - 1],
            "month_num": month_num,
            "revenue": round(month_revenue, 2),
            "expenses": round(month_expenses, 2),
            "profit": round(month_profit, 2),
        })
    
    return {
        "year": year,
        "months": months,
        "total_revenue": round(sum(m["revenue"] for m in months), 2),
        "total_expenses": round(sum(m["expenses"] for m in months), 2),
        "total_profit": round(sum(m["profit"] for m in months), 2),
    }


# ============================================================
# Notifications (in-app reminders)
# ============================================================
@api.get("/notifications", response_model=List[Notification])
async def list_notifications():
    docs = await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Notification(**d) for d in docs]


@api.post("/notifications/sync")
async def sync_notifications():
    """Generate notifications from current state (overdue invoices, missed deadlines)."""
    today = datetime.now(timezone.utc).date()
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(2000)
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(2000)
    new_notifs = []
    for inv in invoices:
        due = inv.get("due_date")
        if (
            inv.get("status") in ("sent", "viewed")
            and due
            and due < today.isoformat()
        ):
            new_notifs.append(
                Notification(
                    title=f"Invoice {inv.get('number')} overdue",
                    body=f"Total ₹{inv.get('total',0):,.0f} past due.",
                    kind="warning",
                ).model_dump()
            )
    for t in tasks:
        if t.get("status") != "completed" and t.get("due_date") and t["due_date"] < today.isoformat():
            new_notifs.append(
                Notification(
                    title=f"Task overdue: {t.get('title')}",
                    body=f"Was due {t.get('due_date')}.",
                    kind="warning",
                ).model_dump()
            )
    if new_notifs:
        await db.notifications.delete_many({})
        await db.notifications.insert_many(new_notifs)
    return {"count": len(new_notifs)}


# ============================================================
# App wiring
# ============================================================
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await ensure_settings(db)
        log.info("Settings ready.")
    except Exception as e:
        log.exception("Startup error: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    _executor.shutdown(wait=False)
    log.info("Server shutdown complete.")
