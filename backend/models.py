"""Pydantic models for Insapi Marketing Workspace."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id() -> str:
    return str(uuid.uuid4())


# ---------- Settings / Organization ----------
class OrgSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: "org_singleton")
    name: str = "Insapi Marketing"
    owner_name: str = "Insapi Marketing"
    email: str = "hello@insapimarketing.com"
    phone: str = "+91 90000 00000"
    address: str = "Insapi Marketing Studio, India"
    website: str = "insapimarketing.com"
    gst_number: str = ""
    pan: str = ""
    currency: str = "INR"
    daily_target: float = 1000.0
    monthly_target: float = 30000.0
    bank_name: str = ""
    bank_account: str = ""
    bank_ifsc: str = ""
    upi_id: str = ""
    invoice_prefix: str = "IM"
    invoice_notes_default: str = "Thank you for your business."
    whatsapp_template: str = (
        "Hi {client_name},\n\n"
        "Here is your invoice {invoice_number} from {org_name}.\n"
        "Amount due: ₹{balance}.\n\n"
        "PDF attached.\n\n"
        "Thanks,\n{owner_name} · {org_name}"
    )
    logo_url: str = ""
    logo_filter: str = "none"  # none|grayscale|blue|red|green|custom
    logo_custom_color: str = ""  # hex color for custom filter
    # Email / SMTP settings
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = ""
    updated_at: str = Field(default_factory=now_iso)


# ---------- Clients ----------
class ClientBase(BaseModel):
    name: str
    company: str = ""
    email: str = ""
    whatsapp: str = ""
    address: str = ""
    rating: int = 5
    notes: str = ""
    tags: List[str] = []


class ClientCreate(ClientBase):
    pass


class Client(ClientBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    created_at: str = Field(default_factory=now_iso)


# ---------- Projects ----------
class ProjectBase(BaseModel):
    name: str
    client_id: Optional[str] = None
    description: str = ""
    status: str = "Active"  # Active|Pending|Delivered|Completed|Delayed
    start_date: Optional[str] = None
    deadline: Optional[str] = None
    budget: float = 0
    work_type: str = "Reel Editing"
    milestones: List[dict] = []


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    created_at: str = Field(default_factory=now_iso)


# ---------- Tasks ----------
class TaskBase(BaseModel):
    title: str
    description: str = ""
    status: str = "todo"  # todo|in_progress|review|completed
    priority: str = "medium"  # low|medium|high|urgent
    due_date: Optional[str] = None
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    estimated_minutes: int = 0
    actual_minutes: int = 0
    billable_amount: float = 0
    tags: List[str] = []


class TaskCreate(TaskBase):
    pass


class Task(TaskBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    completed_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# ---------- Payments ----------
class PaymentBase(BaseModel):
    client_id: Optional[str] = None
    invoice_id: Optional[str] = None
    work_details: str = ""
    amount: float
    paid_amount: float = 0
    due_date: Optional[str] = None
    method: str = "UPI"  # UPI|Bank|Card|Cash|Other
    notes: str = ""
    status: str = "pending"  # pending|partial|paid|overdue


class PaymentCreate(PaymentBase):
    pass


class Payment(PaymentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    created_at: str = Field(default_factory=now_iso)
    paid_at: Optional[str] = None


# ---------- Invoices ----------
class InvoiceLine(BaseModel):
    description: str
    quantity: float = 1
    rate: float = 0
    amount: float = 0


class InvoiceBase(BaseModel):
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    issue_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).date().isoformat())
    due_date: Optional[str] = None
    lines: List[InvoiceLine] = []
    subtotal: float = 0
    discount_pct: float = 0
    discount_amount: float = 0
    tax_pct: float = 18
    tax_amount: float = 0
    total: float = 0
    paid_amount: float = 0
    notes: str = ""
    status: str = "draft"  # draft|sent|viewed|paid|overdue


class InvoiceCreate(InvoiceBase):
    pass


class Invoice(InvoiceBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    number: str = ""  # WD-2026-0001
    created_at: str = Field(default_factory=now_iso)
    sent_at: Optional[str] = None


# ---------- Expenses ----------
class ExpenseBase(BaseModel):
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    category: str = "other"  # travel|software|materials|equipment|utilities|other
    description: str = ""
    amount: float = 0
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).date().isoformat())
    receipt_url: Optional[str] = None
    status: str = "pending"  # pending|approved|reimbursed
    notes: str = ""


class ExpenseCreate(ExpenseBase):
    pass


class Expense(ExpenseBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    created_at: str = Field(default_factory=now_iso)


# ---------- Notifications ----------
class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    title: str
    body: str = ""
    kind: str = "info"  # info|warning|success|error
    read: bool = False
    created_at: str = Field(default_factory=now_iso)
