import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Plus, Trash2, ChevronRight, MessageCircle, Upload, Download, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { formatDate, formatINR, todayISO } from "../lib/format";

const KIND_LABEL = {
  invoice: "Invoice",
  payment: "Payment",
  credit: "Credit",
  advance: "Advance",
  refund: "Refund",
  adjustment: "Adjustment",
};

export default function Credits() {
  const [summary, setSummary] = useState([]);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [open, setOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    client_id: "",
    kind: "advance",
    amount: 0,
    note: "",
    date: todayISO(),
  });

  const loadSummary = async () => {
    const [s, c] = await Promise.all([
      api.get("/ledger/summary"),
      api.get("/clients"),
    ]);
    setSummary(s.data);
    setClients(c.data);
  };

  const loadLedger = async (id) => {
    const r = await api.get(`/clients/${id}/ledger`);
    setLedger(r.data);
  };

  useEffect(() => { loadSummary(); }, []);

  const openClient = async (c) => {
    setSelected(c);
    await loadLedger(c.id);
  };

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const saveCredit = async () => {
    if (!form.client_id) return toast.error("Pick a client");
    if (!form.amount) return toast.error("Amount required");
    await api.post("/credits", form);
    toast.success("Credit recorded");
    setOpen(false);
    setForm({ client_id: "", kind: "advance", amount: 0, note: "", date: todayISO() });
    loadSummary();
    if (selected) await loadLedger(selected.id);
  };

  const removeCredit = async (entry) => {
    if (!entry.id.startsWith("crd_")) return toast.error("Only manual credits can be deleted from here.");
    const id = entry.ref_id;
    await api.delete(`/credits/${id}`);
    loadSummary();
    if (selected) await loadLedger(selected.id);
  };

  const totals = useMemo(() => {
    const owed = summary.filter((s) => s.balance_due > 0).reduce((a, b) => a + b.balance_due, 0);
    const advance = summary.filter((s) => s.balance_due < 0).reduce((a, b) => a + b.balance_due, 0);
    return { owed, advance: Math.abs(advance), clients: summary.length };
  }, [summary]);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    setImporting(true);
    setImportResult(null);
    try {
      const r = await fetch(`${API_BASE}/credits/import`, { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.detail || "Import failed");
      } else {
        setImportResult(data);
        if (data.imported > 0) {
          toast.success(`Imported ${data.imported} entries${data.created_clients ? ` (${data.created_clients} new clients)` : ""}`);
        } else {
          toast.error("Nothing imported. Check the file format.");
        }
        await loadSummary();
        if (selected) await loadLedger(selected.id);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div data-testid="credits-page">
      <PageHeader
        eyebrow="Khata · Client ledger"
        title="Credits."
        description="Every client's running tab: work billed, payments received, advance credits, refunds. Stays accurate forever."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="hidden"
              data-testid="credits-file-input"
            />
            <a
              href={`${API_BASE}/credits/template.xlsx`}
              data-testid="download-template"
              className="px-4 py-2 text-sm flex items-center gap-2"
              style={{ border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
            >
              <Download size={14} /> Template
            </a>
            <button
              data-testid="import-excel-btn"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="px-4 py-2 text-sm flex items-center gap-2"
              style={{ border: "1px solid var(--border-strong)", color: "var(--text-primary)", opacity: importing ? 0.5 : 1 }}
            >
              <Upload size={14} /> {importing ? "Importing…" : "Upload Excel"}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button data-testid="new-credit-btn" className="px-4 py-2 text-sm flex items-center gap-2" style={{ background: "var(--brand)", color: "white" }}>
                <Plus size={14} /> Record credit
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }}>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl tracking-tight">New ledger entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="label-tiny">Client</Label>
                  <Select value={form.client_id || "_none"} onValueChange={(v) => upd("client_id", v === "_none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="label-tiny">Kind</Label>
                    <Select value={form.kind} onValueChange={(v) => upd("kind", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="advance">Advance from client</SelectItem>
                        <SelectItem value="credit">Credit / discount given</SelectItem>
                        <SelectItem value="refund">Refund to client</SelectItem>
                        <SelectItem value="adjustment">Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="label-tiny">Amount (₹)</Label>
                    <Input data-testid="credit-amount" type="number" value={form.amount} onChange={(e) => upd("amount", parseFloat(e.target.value || 0))} />
                  </div>
                </div>
                <div>
                  <Label className="label-tiny">Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => upd("date", e.target.value)} />
                </div>
                <div>
                  <Label className="label-tiny">Note</Label>
                  <Textarea value={form.note} onChange={(e) => upd("note", e.target.value)} />
                </div>
                <button data-testid="credit-save-btn" onClick={saveCredit} className="w-full py-2 text-sm font-medium" style={{ background: "var(--brand)", color: "white" }}>Save</button>
              </div>
            </DialogContent>
          </Dialog>
          </>
        }
      />

      {importResult && (
        <div data-testid="import-result" className="surface p-4 mb-4 flex items-start gap-3" style={{ borderColor: importResult.errors.length ? "rgba(245,158,11,0.5)" : "rgba(16,185,129,0.5)" }}>
          <AlertCircle size={16} className="mt-0.5" style={{ color: importResult.errors.length ? "#F59E0B" : "#10B981" }} />
          <div className="flex-1 min-w-0 text-sm">
            <p>
              <strong>{importResult.imported}</strong> rows imported
              {importResult.created_clients > 0 && ` · ${importResult.created_clients} new client${importResult.created_clients > 1 ? "s" : ""}`}
              {importResult.skipped > 0 && ` · ${importResult.skipped} skipped`}
            </p>
            {importResult.errors.length > 0 && (
              <ul className="mt-2 text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                {importResult.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>· Row {e.row}: {e.reason}</li>
                ))}
                {importResult.errors.length > 5 && <li>… +{importResult.errors.length - 5} more</li>}
              </ul>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="text-xs opacity-60 hover:opacity-100">dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="surface p-5">
          <p className="label-tiny">Owed to you</p>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#F59E0B" }}>{formatINR(totals.owed)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>across {summary.filter((s) => s.balance_due > 0).length} clients</p>
        </div>
        <div className="surface p-5">
          <p className="label-tiny">Advance held</p>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#10B981" }}>{formatINR(totals.advance)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>received but not yet billed</p>
        </div>
        <div className="surface p-5">
          <p className="label-tiny">Active clients</p>
          <p className="font-display text-3xl font-bold tracking-tighter">{totals.clients}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>on your books</p>
        </div>
      </div>

      <div className="surface">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Client", "Billed", "Paid", "Credits", "Balance", ""].map((h) => (
                <th key={h} className="text-left label-tiny px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center" style={{ color: "var(--text-tertiary)" }}>
                No clients yet. Add clients and create invoices to see ledgers.
              </td></tr>
            )}
            {summary.map((s) => {
              const owe = s.balance_due > 0;
              const adv = s.balance_due < 0;
              return (
                <tr key={s.id} data-testid={`ledger-row-${s.id}`} onClick={() => openClient(s)} className="hover-surface cursor-pointer" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{s.company || ""}</p>
                  </td>
                  <td className="px-5 py-3 font-mono">{formatINR(s.total_billed)}</td>
                  <td className="px-5 py-3 font-mono" style={{ color: "#10B981" }}>{formatINR(s.total_paid)}</td>
                  <td className="px-5 py-3 font-mono" style={{ color: "var(--text-secondary)" }}>{formatINR(s.total_credit)}</td>
                  <td className="px-5 py-3 font-mono font-bold" style={{ color: owe ? "#F59E0B" : adv ? "#10B981" : "var(--text-secondary)" }}>
                    {owe ? "+" : adv ? "-" : ""}{formatINR(Math.abs(s.balance_due))}
                    <span className="text-[10px] ml-2 uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                      {owe ? "owes" : adv ? "credit" : "clear"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right"><ChevronRight size={14} className="opacity-50" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setLedger(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-tight">{selected?.name} — Ledger</DialogTitle>
          </DialogHeader>
          {ledger && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="surface-2 p-3">
                  <p className="label-tiny">Billed</p>
                  <p className="font-mono">{formatINR(ledger.summary.total_billed)}</p>
                </div>
                <div className="surface-2 p-3">
                  <p className="label-tiny">Paid</p>
                  <p className="font-mono" style={{ color: "#10B981" }}>{formatINR(ledger.summary.total_paid)}</p>
                </div>
                <div className="surface-2 p-3">
                  <p className="label-tiny">Advance</p>
                  <p className="font-mono">{formatINR(ledger.summary.total_credit)}</p>
                </div>
                <div className="surface-2 p-3">
                  <p className="label-tiny">Balance</p>
                  <p className="font-mono font-bold" style={{ color: ledger.summary.balance_due > 0 ? "#F59E0B" : ledger.summary.balance_due < 0 ? "#10B981" : "var(--text-secondary)" }}>
                    {ledger.summary.balance_due > 0 ? "+" : ledger.summary.balance_due < 0 ? "-" : ""}{formatINR(Math.abs(ledger.summary.balance_due))}
                  </p>
                </div>
              </div>

              <div className="surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Date", "Type", "Reference / Note", "Amount", "Balance", ""].map((h) => (
                        <th key={h} className="text-left label-tiny px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.entries.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--text-tertiary)" }}>No activity yet.</td></tr>
                    )}
                    {ledger.entries.map((e) => (
                      <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-tertiary)" }}>{formatDate(e.date)}</td>
                        <td className="px-4 py-2.5 text-xs uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                          {KIND_LABEL[e.kind] || e.kind}
                        </td>
                        <td className="px-4 py-2.5">
                          <p>{e.label}</p>
                          {e.note && <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{e.note}</p>}
                        </td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: e.amount > 0 ? "#F59E0B" : "#10B981" }}>
                          {e.amount > 0 ? "+" : ""}{formatINR(e.amount)}
                        </td>
                        <td className="px-4 py-2.5 font-mono">{formatINR(e.balance)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {e.id.startsWith("crd_") && (
                            <button onClick={() => removeCredit(e)} className="opacity-60 hover:opacity-100"><Trash2 size={12} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selected?.whatsapp && ledger.summary.balance_due > 0 && (
                <a
                  href={`https://wa.me/${selected.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${selected.name},\n\nGentle reminder — there is a pending balance of ₹${ledger.summary.balance_due.toLocaleString("en-IN")} on your account with Insapi Marketing.\n\nPlease settle at your convenience. Thanks!`)}`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="remind-whatsapp"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm"
                  style={{ background: "#10B981", color: "white" }}
                >
                  <MessageCircle size={14} /> Send WhatsApp reminder
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
