import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Plus, Trash2, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { formatDate, formatINR } from "../lib/format";

// Generate list of months from 24 months ago up to current month
function generateMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}
const MONTH_OPTIONS = generateMonthOptions();

const empty = {
  client_id: "",
  invoice_id: "",
  work_details: "",
  amount: 0,
  paid_amount: 0,
  due_date: "",
  method: "UPI",
  status: "pending",
  notes: "",
};

const METHODS = ["UPI", "Bank", "Card", "Cash", "Other"];

export default function Payments() {
  const [list, setList] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("all");
  const [showOutstanding, setShowOutstanding] = useState(false);
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const load = async () => {
    const [p, c, i] = await Promise.all([
      api.get("/payments"),
      api.get("/clients"),
      api.get("/invoices"),
    ]);
    setList(p.data);
    setClients(c.data);
    setInvoices(i.data);
  };

  useEffect(() => { load(); }, []);

  const upd = (k, v) => {
    setForm((f) => {
      const newForm = { ...f, [k]: v };
      // If status is set to "paid", automatically set paid_amount to amount
      if (k === "status" && v === "paid" && newForm.paid_amount < newForm.amount) {
        newForm.paid_amount = newForm.amount;
      }
      // If paid_amount equals or exceeds amount, automatically set status to "paid"
      if (k === "paid_amount" && v >= newForm.amount && newForm.amount > 0) {
        newForm.status = "paid";
      }
      // If paid_amount is less than amount but greater than 0, set to "partial"
      if (k === "paid_amount" && v > 0 && v < newForm.amount) {
        newForm.status = "partial";
      }
      return newForm;
    });
  };

  const save = async () => {
    const payload = { ...form };
    if (!payload.client_id) delete payload.client_id;
    if (!payload.invoice_id) delete payload.invoice_id;
    if (!payload.due_date) delete payload.due_date;
    if (editing) {
      await api.put(`/payments/${editing}`, payload);
      toast.success("Payment updated");
    } else {
      await api.post("/payments", payload);
      toast.success("Payment added");
    }
    setOpen(false);
    setForm(empty);
    setEditing(null);
    load();
  };

  const del = async (id) => { await api.delete(`/payments/${id}`); load(); };

  const clientName = (id) => clients.find((c) => c.id === id)?.name || "—";
  const invoiceNumber = (id) => invoices.find((c) => c.id === id)?.number || "—";

  const filtered = list.filter((p) => {
    // Month filter — match against paid_at or created_at
    const d = p.paid_at || p.created_at || "";
    const inMonth = d.startsWith(monthFilter);
    // Status filter
    const statusMatch = filter === "all" || p.status === filter;
    return inMonth && statusMatch;
  });

  const totals = {
    received: list.reduce((a, b) => a + (b.paid_amount || 0), 0),
    pending: list.filter((p) => ["pending", "partial"].includes(p.status)).reduce((a, b) => a + ((b.amount || 0) - (b.paid_amount || 0)), 0),
    overdue: list.filter((p) => p.status === "overdue").reduce((a, b) => a + ((b.amount || 0) - (b.paid_amount || 0)), 0),
  };

  // Month-filtered totals
  const monthlyPayments = list.filter((p) => {
    const d = p.paid_at || p.created_at || "";
    return d.startsWith(monthFilter);
  });
  const monthlyTotals = {
    received: monthlyPayments.reduce((a, b) => a + (b.paid_amount || 0), 0),
    count: monthlyPayments.length,
  };

  // Group payments by invoice to calculate actual outstanding
  const invoicePayments = {};
  list.forEach((p) => {
    if (p.invoice_id) {
      if (!invoicePayments[p.invoice_id]) {
        invoicePayments[p.invoice_id] = {
          invoice_id: p.invoice_id,
          client_id: p.client_id,
          work_details: p.work_details,
          total_amount: 0,
          total_paid: 0,
          payments: [],
          status: p.status,
          due_date: p.due_date,
        };
      }
      // For invoice-linked payments, use invoice total from first payment
      if (invoicePayments[p.invoice_id].total_amount === 0) {
        invoicePayments[p.invoice_id].total_amount = p.amount || 0;
      }
      invoicePayments[p.invoice_id].total_paid += p.paid_amount || 0;
      invoicePayments[p.invoice_id].payments.push(p);
    } else {
      // For non-invoice payments, treat each as separate
      const key = `standalone_${p.id}`;
      invoicePayments[key] = {
        invoice_id: null,
        client_id: p.client_id,
        work_details: p.work_details,
        total_amount: p.amount || 0,
        total_paid: p.paid_amount || 0,
        payments: [p],
        status: p.status,
        due_date: p.due_date,
      };
    }
  });

  // Calculate actual outstanding from grouped invoices
  const actualOutstanding = Object.values(invoicePayments)
    .filter((inv) => inv.total_paid < inv.total_amount)
    .reduce((sum, inv) => sum + (inv.total_amount - inv.total_paid), 0);

  // Get outstanding payments with client details (grouped by invoice)
  const outstandingPayments = Object.values(invoicePayments)
    .filter((inv) => inv.total_paid < inv.total_amount)
    .map((inv) => ({
      ...inv,
      clientName: clientName(inv.client_id),
      invoiceNum: inv.invoice_id ? invoiceNumber(inv.invoice_id) : "—",
      remaining: inv.total_amount - inv.total_paid,
    }))
    .sort((a, b) => b.remaining - a.remaining);

  // helpers for prev/next month navigation
  const currentIdx = MONTH_OPTIONS.findIndex((m) => m.value === monthFilter);
  const goPrev = () => { if (currentIdx > 0) setMonthFilter(MONTH_OPTIONS[currentIdx - 1].value); };
  const goNext = () => { if (currentIdx < MONTH_OPTIONS.length - 1) setMonthFilter(MONTH_OPTIONS[currentIdx + 1].value); };
  const selectedLabel = MONTH_OPTIONS.find((m) => m.value === monthFilter)?.label || monthFilter;

  return (
    <div data-testid="payments-page">
      <PageHeader
        eyebrow="Cash flow"
        title="Payments."
        description="Track inflows, partial payments and overdue dues."
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
            <DialogTrigger asChild>
              <button data-testid="new-payment-btn" className="px-4 py-2 text-sm flex items-center gap-2" style={{ background: "var(--brand)", color: "white" }}>
                <Plus size={14} /> Record payment
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }}>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl tracking-tight">{editing ? "Edit payment" : "Record payment"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="label-tiny">Client</Label>
                    <Select value={form.client_id || "_none"} onValueChange={(v) => upd("client_id", v === "_none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">None</SelectItem>
                        {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="label-tiny">Invoice</Label>
                    <Select value={form.invoice_id || "_none"} onValueChange={(v) => upd("invoice_id", v === "_none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">None</SelectItem>
                        {invoices.map((c) => <SelectItem key={c.id} value={c.id}>{c.number}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="label-tiny">Work details</Label>
                  <Input value={form.work_details} onChange={(e) => upd("work_details", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="label-tiny">Amount</Label>
                    <Input data-testid="payment-amount-input" type="number" value={form.amount} onChange={(e) => upd("amount", parseFloat(e.target.value || 0))} />
                  </div>
                  <div>
                    <Label className="label-tiny">Paid</Label>
                    <Input type="number" value={form.paid_amount} onChange={(e) => upd("paid_amount", parseFloat(e.target.value || 0))} />
                  </div>
                  <div>
                    <Label className="label-tiny">Method</Label>
                    <Select value={form.method} onValueChange={(v) => upd("method", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{METHODS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="label-tiny">Due date</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => upd("due_date", e.target.value)} />
                  </div>
                  <div>
                    <Label className="label-tiny">Status</Label>
                    <Select value={form.status} onValueChange={(v) => upd("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["pending", "partial", "paid", "overdue"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <button data-testid="payment-save-btn" onClick={save} className="w-full py-2 text-sm font-medium" style={{ background: "var(--brand)", color: "white" }}>{editing ? "Save" : "Record"}</button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* ── Month Selector Bar ── */}
      <div
        className="flex items-center justify-between mb-6 px-5 py-3"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <CalendarDays size={16} style={{ color: "var(--brand)" }} />
          <span className="label-tiny">Viewing month</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Prev arrow */}
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            className="p-1.5 rounded"
            style={{
              border: "1px solid var(--border)",
              color: currentIdx === 0 ? "var(--text-tertiary)" : "var(--text-primary)",
              cursor: currentIdx === 0 ? "not-allowed" : "pointer",
              background: "transparent",
            }}
          >
            <ChevronLeft size={14} />
          </button>

          {/* Dropdown */}
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger
              className="w-48 text-sm font-medium"
              style={{
                background: "var(--bg-surface-hover)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
              }}
            >
              <SelectValue>{selectedLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent style={{ maxHeight: 280 }}>
              {MONTH_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Next arrow */}
          <button
            onClick={goNext}
            disabled={currentIdx === MONTH_OPTIONS.length - 1}
            className="p-1.5 rounded"
            style={{
              border: "1px solid var(--border)",
              color: currentIdx === MONTH_OPTIONS.length - 1 ? "var(--text-tertiary)" : "var(--text-primary)",
              cursor: currentIdx === MONTH_OPTIONS.length - 1 ? "not-allowed" : "pointer",
              background: "transparent",
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Payment count badge for selected month */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {monthlyPayments.length} payment{monthlyPayments.length !== 1 ? "s" : ""} ·{" "}
            <span style={{ color: "#10B981" }}>{formatINR(monthlyTotals.received)} received</span>
          </span>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="surface p-5">
          <p className="label-tiny">Total Received (All-time)</p>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#10B981" }}>{formatINR(totals.received)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>All payments received</p>
        </div>
        <div className="surface p-5">
          <p className="label-tiny">This Month</p>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "var(--brand-color)" }}>{formatINR(monthlyTotals.received)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{monthlyTotals.count} payment{monthlyTotals.count !== 1 ? "s" : ""} in {selectedLabel}</p>
        </div>
        <div
          className="surface p-5 cursor-pointer hover-surface"
          onClick={() => setShowOutstanding(true)}
        >
          <p className="label-tiny">Outstanding</p>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#F59E0B" }}>{formatINR(actualOutstanding)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            {outstandingPayments.length} invoice{outstandingPayments.length !== 1 ? "s" : ""} · Click to view
          </p>
        </div>
        <div className="surface p-5">
          <p className="label-tiny">Overdue</p>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#EF4444" }}>{formatINR(totals.overdue)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Past due date</p>
        </div>
      </div>

      {/* Outstanding Payments Dialog */}
      <Dialog open={showOutstanding} onOpenChange={setShowOutstanding}>
        <DialogContent className="max-w-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-tight">Outstanding Payments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4" style={{ background: "var(--bg-surface-hover)", border: "1px solid var(--border)" }}>
              <span className="font-medium">Total Outstanding</span>
              <span className="font-display text-2xl font-bold" style={{ color: "#F59E0B" }}>
                {formatINR(actualOutstanding)}
              </span>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {outstandingPayments.length === 0 ? (
                <p className="text-center py-8" style={{ color: "var(--text-tertiary)" }}>
                  No outstanding payments
                </p>
              ) : (
                outstandingPayments.map((inv) => (
                  <div
                    key={inv.invoice_id || inv.payments[0].id}
                    className="p-4 flex justify-between items-start"
                    style={{ background: "var(--bg-surface-hover)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{inv.clientName}</span>
                        {inv.invoiceNum !== "—" && (
                          <span className="text-xs font-mono px-2 py-0.5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                            {inv.invoiceNum}
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {inv.work_details || "—"}
                      </p>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span style={{ color: "var(--text-tertiary)" }}>
                          Total: {formatINR(inv.total_amount)}
                        </span>
                        <span style={{ color: "#10B981" }}>
                          Paid: {formatINR(inv.total_paid)}
                        </span>
                        {inv.payments.length > 1 && (
                          <span style={{ color: "var(--text-tertiary)" }}>
                            ({inv.payments.length} payments)
                          </span>
                        )}
                      </div>
                      {inv.payments.length > 1 && (
                        <div className="mt-2 pl-3 border-l-2" style={{ borderColor: "var(--border)" }}>
                          {inv.payments.map((p) => (
                            <div key={p.id} className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
                              {formatDate(p.paid_at || p.created_at)}: {formatINR(p.paid_amount)} via {p.method}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Remaining</p>
                      <p className="font-mono text-lg font-bold" style={{ color: "#F59E0B" }}>
                        {formatINR(inv.remaining)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setShowOutstanding(false)}
                className="px-4 py-2 text-sm"
                style={{ background: "var(--brand)", color: "white" }}
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Status Filter Tabs ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "partial", "paid", "overdue"].map((s) => (
            <button
              key={s}
              data-testid={`filter-${s}`}
              onClick={() => setFilter(s)}
              className="px-3 py-1.5 text-xs uppercase tracking-widest"
              style={{
                border: "1px solid var(--border)",
                background: filter === s ? "var(--brand)" : "transparent",
                color: filter === s ? "white" : "var(--text-secondary)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        {filtered.length > 0 && (
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Payments Table ── */}
      <div className="surface">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Client", "Invoice", "Amount", "Paid", "Due", "Method", "Status", ""].map((h) => (
                <th key={h} className="text-left label-tiny px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center" style={{ color: "var(--text-tertiary)" }}>
                  <div className="flex flex-col items-center gap-2">
                    <CalendarDays size={24} style={{ opacity: 0.3 }} />
                    <span>No payments for {selectedLabel}</span>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr
                key={p.id}
                data-testid={`payment-row-${p.id}`}
                style={{ borderBottom: "1px solid var(--border)" }}
                className="hover-surface"
              >
                <td className="px-5 py-3">{clientName(p.client_id)}</td>
                <td className="px-5 py-3 font-mono text-xs">{invoiceNumber(p.invoice_id)}</td>
                <td className="px-5 py-3 font-mono">{formatINR(p.amount)}</td>
                <td className="px-5 py-3 font-mono" style={{ color: "#10B981" }}>{formatINR(p.paid_amount)}</td>
                <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{formatDate(p.due_date)}</td>
                <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{p.method}</td>
                <td className="px-5 py-3"><StatusBadge value={p.status} /></td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => { setEditing(p.id); setForm({ ...empty, ...p }); setOpen(true); }} className="text-xs mr-3" style={{ color: "var(--brand)" }}>Edit</button>
                  <button onClick={() => del(p.id)} className="opacity-60 hover:opacity-100"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
