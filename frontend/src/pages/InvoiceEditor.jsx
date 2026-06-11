import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, API_BASE } from "../lib/api";
import LogoMark from "../components/LogoMark";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, FileDown, Mail, MessageCircle, Plus, Save, Trash2 } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { formatINR, formatDate, todayISO } from "../lib/format";
import { toast } from "sonner";

const STATUSES = ["draft", "sent", "viewed", "paid", "overdue"];

export default function InvoiceEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [inv, setInv] = useState(null);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [org, setOrg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [payments, setPayments] = useState([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({
    paid_amount: 0,
    paid_at: todayISO(),
    method: "UPI",
    notes: "",
  });
  
  // Client autocomplete state
  const [clientSearch, setClientSearch] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState("");
  const clientInputRef = useRef(null);

  const load = async () => {
    const [c, p, s] = await Promise.all([
      api.get("/clients"),
      api.get("/projects"),
      api.get("/settings"),
    ]);
    setClients(c.data);
    setProjects(p.data);
    setOrg(s.data);
    if (isNew) {
      setInv({
        client_id: "",
        project_id: "",
        issue_date: todayISO(),
        due_date: "",
        lines: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
        tax_pct: 18,
        discount_pct: 0,
        notes: s.data.invoice_notes_default || "",
        status: "draft",
        paid_amount: 0,
      });
    } else {
      const [invRes, paymentsRes] = await Promise.all([
        api.get(`/invoices/${id}`),
        api.get("/payments"),
      ]);
      setInv(invRes.data);
      // Filter payments for this invoice
      setPayments(paymentsRes.data.filter(p => p.invoice_id === id));
      
      // Set the client name if a client is selected
      if (invRes.data.client_id) {
        const client = c.data.find(cl => cl.id === invRes.data.client_id);
        if (client) {
          setSelectedClientName(client.name);
          setClientSearch(client.name);
        }
      }
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Filter clients based on search input
  const filteredClients = useMemo(() => {
    if (!clientSearch || clientSearch.length === 0) return clients;
    const search = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(search) || 
      (c.company && c.company.toLowerCase().includes(search))
    );
  }, [clientSearch, clients]);

  // Handle client selection from suggestions
  const selectClient = (client) => {
    setClientSearch(client.name);
    setSelectedClientName(client.name);
    upd("client_id", client.id);
    setShowClientSuggestions(false);
  };

  // Handle manual client name entry (new client)
  const handleClientInputChange = (value) => {
    setClientSearch(value);
    setShowClientSuggestions(value.length > 0);
    
    // Check if it matches an existing client
    const exactMatch = clients.find(c => c.name.toLowerCase() === value.toLowerCase());
    if (exactMatch) {
      upd("client_id", exactMatch.id);
      setSelectedClientName(exactMatch.name);
    } else {
      // Clear client_id if it's a new name
      upd("client_id", "");
      setSelectedClientName(value);
    }
  };

  // Handle blur - create new client if needed
  const handleClientBlur = async () => {
    setTimeout(() => setShowClientSuggestions(false), 200);
    
    // If user typed a name that doesn't exist, create the client
    if (clientSearch && clientSearch.trim() && !inv.client_id) {
      try {
        const newClient = await api.post("/clients", {
          name: clientSearch.trim(),
          company: "",
          email: "",
          whatsapp: "",
          address: "",
          rating: 5,
          notes: "",
          tags: []
        });
        
        // Update the clients list
        setClients(prev => [...prev, newClient.data]);
        
        // Select the new client
        upd("client_id", newClient.data.id);
        setSelectedClientName(newClient.data.name);
        toast.success(`New client "${newClient.data.name}" created`);
      } catch (err) {
        console.error("Failed to create client:", err);
      }
    }
  };

  const upd = (k, v) => setInv((x) => ({ ...x, [k]: v }));
  const updLine = (i, k, v) => {
    setInv((x) => {
      const lines = [...x.lines];
      lines[i] = { ...lines[i], [k]: v };
      lines[i].amount = (parseFloat(lines[i].quantity) || 0) * (parseFloat(lines[i].rate) || 0);
      return { ...x, lines };
    });
  };

  const addLine = () => setInv((x) => ({ ...x, lines: [...x.lines, { description: "", quantity: 1, rate: 0, amount: 0 }] }));
  const removeLine = (i) => setInv((x) => ({ ...x, lines: x.lines.filter((_, idx) => idx !== i) }));

  const totals = useMemo(() => {
    if (!inv) return { sub: 0, disc: 0, tax: 0, total: 0 };
    const sub = inv.lines.reduce((a, l) => a + (parseFloat(l.amount) || 0), 0);
    const disc = (sub * (parseFloat(inv.discount_pct) || 0)) / 100;
    const tax = ((sub - disc) * (parseFloat(inv.tax_pct) || 0)) / 100;
    return { sub, disc, tax, total: sub - disc + tax };
  }, [inv]);

  const save = async () => {
    if (!inv) return;
    setSaving(true);
    try {
      const payload = {
        client_id: inv.client_id || undefined,
        project_id: inv.project_id || undefined,
        issue_date: inv.issue_date || todayISO(),
        due_date: inv.due_date || undefined,
        lines: inv.lines.map((l) => ({
          description: l.description,
          quantity: parseFloat(l.quantity) || 0,
          rate: parseFloat(l.rate) || 0,
          amount: parseFloat(l.amount) || 0,
        })),
        discount_pct: parseFloat(inv.discount_pct) || 0,
        tax_pct: parseFloat(inv.tax_pct) || 0,
        notes: inv.notes || "",
        status: inv.status || "draft",
        paid_amount: parseFloat(inv.paid_amount) || 0,
      };
      if (isNew) {
        const r = await api.post("/invoices", payload);
        toast.success(`Created ${r.data.number}`);
        navigate(`/invoices/${r.data.id}`);
      } else {
        const r = await api.put(`/invoices/${id}`, payload);
        setInv(r.data);
        toast.success("Saved");
      }
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = () => {
    if (isNew) return toast.error("Save first");
    window.open(`${API_BASE}/invoices/${id}/pdf`, "_blank");
  };

  const sendWA = async () => {
    if (isNew) return toast.error("Save first");
    
    try {
      // Get the WhatsApp message and URL
      const r = await api.get(`/invoices/${id}/whatsapp`);
      
      // Get invoice number for the filename
      const filename = inv.number ? `Invoice-${inv.number}.pdf` : `Invoice-${id}.pdf`;
      
      // Download the PDF first
      const pdfUrl = `${API_BASE}/invoices/${id}/pdf`;
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      
      // Create download link and trigger download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      // Show success message with instructions
      toast.success(`PDF downloaded as "${filename}". Opening WhatsApp...`, {
        duration: 5000,
      });
      
      // Small delay to let user see the download
      setTimeout(() => {
        // Open WhatsApp with the pre-filled message
        window.open(r.data.url, "_blank");
        
        // Show instructions after opening WhatsApp
        setTimeout(() => {
          toast.info("Attach the downloaded PDF in WhatsApp and send!", {
            duration: 7000,
          });
        }, 1000);
      }, 500);
      
    } catch (e) {
      console.error("WhatsApp send error:", e);
      toast.error("Failed to prepare WhatsApp message");
    }
  };

  const sendEmail = async () => {
    if (isNew) return toast.error("Save first");
    setSendingEmail(true);
    try {
      const r = await api.post(`/invoices/${id}/send-email`);
      toast.success(`Email sent to ${r.data.to}`);
    } catch (e) {
      const msg = e.response?.data?.detail || "Failed to send email";
      toast.error(msg);
    } finally {
      setSendingEmail(false);
    }
  };

  const addPayment = async () => {
    if (isNew) return toast.error("Save invoice first");
    if (!newPayment.paid_amount || newPayment.paid_amount <= 0) {
      return toast.error("Enter a valid payment amount");
    }
    
    try {
      await api.post("/payments", {
        invoice_id: id,
        client_id: inv.client_id,
        amount: totals.total,
        paid_amount: parseFloat(newPayment.paid_amount),
        paid_at: newPayment.paid_at,
        method: newPayment.method,
        notes: newPayment.notes,
        work_details: `Payment for invoice ${inv.number}`,
        status: "paid",
      });
      
      toast.success("Payment recorded");
      setShowAddPayment(false);
      setNewPayment({
        paid_amount: 0,
        paid_at: todayISO(),
        method: "UPI",
        notes: "",
      });
      
      // Reload invoice and payments
      await load();
    } catch (err) {
      toast.error("Failed to record payment");
    }
  };

  const deletePayment = async (paymentId) => {
    if (!confirm("Delete this payment?")) return;
    try {
      await api.delete(`/payments/${paymentId}`);
      toast.success("Payment deleted");
      await load();
    } catch (err) {
      toast.error("Failed to delete payment");
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.paid_amount) || 0), 0);
  const balance = totals.total - totalPaid;

  if (!inv || !org) return <p className="p-8" style={{ color: "var(--text-tertiary)" }}>Loading…</p>;

  const client = clients.find((c) => c.id === inv.client_id);

  return (
    <div data-testid="invoice-editor">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <button onClick={() => navigate("/invoices")} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={14} /> Invoices
        </button>
        <div className="flex gap-2 items-center flex-wrap">
          {!isNew && <StatusBadge value={inv.status} />}
          {!isNew && <span className="font-mono text-sm">{inv.number}</span>}
          <button onClick={save} disabled={saving} data-testid="invoice-save-btn" className="px-4 py-2 text-sm flex items-center gap-2" style={{ background: "var(--brand)", color: "white", opacity: saving ? 0.6 : 1 }}>
            <Save size={14} /> {isNew ? "Create" : "Save"}
          </button>
          {!isNew && (
            <>
              <button onClick={downloadPDF} data-testid="invoice-pdf-btn" className="px-4 py-2 text-sm flex items-center gap-2" style={{ border: "1px solid var(--border-strong)" }}>
                <FileDown size={14} /> PDF
              </button>
              <button onClick={sendWA} data-testid="invoice-whatsapp-btn" className="px-4 py-2 text-sm flex items-center gap-2" style={{ background: "#10B981", color: "white" }}>
                <MessageCircle size={14} /> WhatsApp
              </button>
              <button
                onClick={sendEmail}
                disabled={sendingEmail}
                data-testid="invoice-email-btn"
                className="px-4 py-2 text-sm flex items-center gap-2"
                style={{ background: "var(--brand-color)", color: "white", opacity: sendingEmail ? 0.6 : 1 }}
              >
                <Mail size={14} /> {sendingEmail ? "Sending…" : "Email PDF"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-5">
          <div className="surface p-5 space-y-4">
            <p className="label-tiny">Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Label className="label-tiny">Client Name</Label>
                <Input
                  ref={clientInputRef}
                  type="text"
                  placeholder="Type client name..."
                  value={clientSearch}
                  onChange={(e) => handleClientInputChange(e.target.value)}
                  onFocus={() => setShowClientSuggestions(clientSearch.length > 0)}
                  onBlur={handleClientBlur}
                  className="w-full"
                  data-testid="client-autocomplete-input"
                />
                {showClientSuggestions && filteredClients.length > 0 && (
                  <div 
                    className="absolute z-50 w-full mt-1 bg-white shadow-lg border max-h-48 overflow-y-auto"
                    style={{ 
                      border: "1px solid var(--border)",
                      borderRadius: "4px"
                    }}
                  >
                    {filteredClients.map((c) => (
                      <div
                        key={c.id}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectClient(c);
                        }}
                        data-testid={`client-suggestion-${c.id}`}
                      >
                        <div className="font-medium">{c.name}</div>
                        {c.company && (
                          <div className="text-xs text-gray-500">{c.company}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {clientSearch && !inv.client_id && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                    New client will be created
                  </p>
                )}
              </div>
              <div>
                <Label className="label-tiny">Project</Label>
                <Select value={inv.project_id || "_none"} onValueChange={(v) => upd("project_id", v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="label-tiny">Issue date</Label>
                <Input type="date" value={inv.issue_date} onChange={(e) => upd("issue_date", e.target.value)} />
              </div>
              <div>
                <Label className="label-tiny">Due date</Label>
                <Input type="date" value={inv.due_date || ""} onChange={(e) => upd("due_date", e.target.value)} />
              </div>
              {!isNew && (
                <div className="col-span-2">
                  <Label className="label-tiny">Status</Label>
                  <Select value={inv.status} onValueChange={(v) => upd("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="surface p-5 space-y-3">
            <div className="flex justify-between items-center">
              <p className="label-tiny">Line items</p>
              <button data-testid="add-line-btn" onClick={addLine} className="text-xs flex items-center gap-1" style={{ color: "var(--brand)" }}>
                <Plus size={12} /> Add line
              </button>
            </div>
            {inv.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <Input data-testid={`line-desc-${i}`} placeholder="Description" value={l.description} onChange={(e) => updLine(i, "description", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Input data-testid={`line-qty-${i}`} type="number" value={l.quantity} onChange={(e) => updLine(i, "quantity", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Input data-testid={`line-rate-${i}`} type="number" value={l.rate} onChange={(e) => updLine(i, "rate", e.target.value)} />
                </div>
                <div className="col-span-1 text-right text-xs font-mono">{formatINR(l.amount, { compact: true })}</div>
                <div className="col-span-1 text-right">
                  <button data-testid={`line-del-${i}`} onClick={() => removeLine(i)} className="opacity-60 hover:opacity-100"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="surface p-5 grid grid-cols-2 gap-3">
            <div>
              <Label className="label-tiny">Discount %</Label>
              <Input type="number" value={inv.discount_pct} onChange={(e) => upd("discount_pct", parseFloat(e.target.value || 0))} />
            </div>
            <div>
              <Label className="label-tiny">GST %</Label>
              <Input type="number" value={inv.tax_pct} onChange={(e) => upd("tax_pct", parseFloat(e.target.value || 0))} />
            </div>
            <div className="col-span-2">
              <Label className="label-tiny">Notes</Label>
              <Textarea value={inv.notes} onChange={(e) => upd("notes", e.target.value)} />
            </div>
          </div>

          {/* Payment History Section */}
          {!isNew && (
            <div className="surface p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="label-tiny">Payment History</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                    {payments.length} payment{payments.length !== 1 ? 's' : ''} · {formatINR(totalPaid)} paid · {formatINR(balance)} balance
                  </p>
                </div>
                <button
                  onClick={() => setShowAddPayment(!showAddPayment)}
                  className="px-3 py-1.5 text-xs flex items-center gap-1"
                  style={{ background: "var(--brand)", color: "white" }}
                >
                  <Plus size={12} /> Add Payment
                </button>
              </div>

              {showAddPayment && (
                <div className="p-4 space-y-3" style={{ background: "var(--bg-surface-hover)", border: "1px solid var(--border)" }}>
                  <p className="text-xs font-medium">Record New Payment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="label-tiny">Amount (₹)</Label>
                      <Input
                        type="number"
                        value={newPayment.paid_amount}
                        onChange={(e) => setNewPayment({ ...newPayment, paid_amount: parseFloat(e.target.value) || 0 })}
                        placeholder="Enter amount"
                      />
                    </div>
                    <div>
                      <Label className="label-tiny">Payment Date</Label>
                      <Input
                        type="date"
                        value={newPayment.paid_at}
                        onChange={(e) => setNewPayment({ ...newPayment, paid_at: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="label-tiny">Method</Label>
                      <Select value={newPayment.method} onValueChange={(v) => setNewPayment({ ...newPayment, method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["UPI", "Bank", "Card", "Cash", "Other"].map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="label-tiny">Notes (optional)</Label>
                      <Input
                        value={newPayment.notes}
                        onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                        placeholder="Payment notes"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addPayment}
                      className="px-4 py-2 text-xs"
                      style={{ background: "var(--brand)", color: "white" }}
                    >
                      Record Payment
                    </button>
                    <button
                      onClick={() => setShowAddPayment(false)}
                      className="px-4 py-2 text-xs"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {payments.length > 0 ? (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3"
                      style={{ background: "var(--bg-surface-hover)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium" style={{ color: "#10B981" }}>
                            {formatINR(payment.paid_amount)}
                          </span>
                          <span className="text-xs px-2 py-0.5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                            {payment.method}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                            {formatDate(payment.paid_at || payment.created_at)}
                          </span>
                          {payment.notes && (
                            <>
                              <span style={{ color: "var(--text-tertiary)" }}>·</span>
                              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                {payment.notes}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deletePayment(payment.id)}
                        className="opacity-60 hover:opacity-100"
                        title="Delete payment"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>
                  No payments recorded yet
                </p>
              )}

              {payments.length > 0 && (
                <div className="pt-3 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-secondary)" }}>Total Invoice</span>
                    <span className="font-mono">{formatINR(totals.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-secondary)" }}>Total Paid</span>
                    <span className="font-mono" style={{ color: "#10B981" }}>{formatINR(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <span>Balance Due</span>
                    <span className="font-mono" style={{ color: balance > 0 ? "#F59E0B" : "#10B981" }}>
                      {formatINR(balance)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-6 self-start">
          <div className="bg-white text-black p-8 shadow-2xl" style={{ minHeight: 800 }}>
            <div className="flex justify-between items-start gap-4 pb-4" style={{ borderBottom: "2px solid #0B0B0B" }}>
              <div className="flex items-center gap-3">
                <LogoMark settings={org} className="w-12 h-12" alt="logo" />
                <div>
                  <p className="font-bold text-2xl tracking-tight" style={{ color: "var(--brand-color)", fontFamily: "'Outfit', sans-serif" }}>{org.name}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">{org.website}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Invoice</p>
                <p className="font-bold text-3xl tracking-tighter" style={{ fontFamily: "'Outfit', sans-serif" }}>{isNew ? "DRAFT" : inv.number}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-6 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">From</p>
                <p className="font-medium">{org.owner_name}</p>
                <p className="text-gray-700">{org.address}</p>
                <p className="text-gray-700">{org.email}</p>
                <p className="text-gray-700">{org.phone}</p>
                {org.gst_number && <p className="text-gray-700">GSTIN: {org.gst_number}</p>}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Bill to</p>
                {client ? (
                  <>
                    <p className="font-medium">{client.name}{client.company ? ` · ${client.company}` : ""}</p>
                    <p className="text-gray-700">{client.email}</p>
                    <p className="text-gray-700">{client.whatsapp}</p>
                    <p className="text-gray-700">{client.address}</p>
                  </>
                ) : (
                  <p className="text-gray-400">No client selected</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div><span className="text-[10px] uppercase tracking-widest text-gray-500">Issued</span><p>{formatDate(inv.issue_date)}</p></div>
                  <div><span className="text-[10px] uppercase tracking-widest text-gray-500">Due</span><p>{formatDate(inv.due_date)}</p></div>
                </div>
              </div>
            </div>

            <table className="w-full mt-8 text-xs">
              <thead>
                <tr style={{ background: "#0B0B0B", color: "white" }}>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest">#</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest">Description</th>
                  <th className="text-right px-3 py-2 text-[10px] uppercase tracking-widest">Qty</th>
                  <th className="text-right px-3 py-2 text-[10px] uppercase tracking-widest">Rate</th>
                  <th className="text-right px-3 py-2 text-[10px] uppercase tracking-widest">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #E5E7EB" }}>
                    <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2">{l.description || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2 text-right font-mono">{l.quantity || 0}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatINR(l.rate)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatINR(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mt-6">
              <div className="w-64 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="font-mono">{formatINR(totals.sub)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Discount ({inv.discount_pct || 0}%)</span><span className="font-mono">- {formatINR(totals.disc)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">GST ({inv.tax_pct || 0}%)</span><span className="font-mono">{formatINR(totals.tax)}</span></div>
                <div className="flex justify-between pt-2 mt-2 font-bold" style={{ borderTop: "1px solid #0B0B0B" }}>
                  <span>Total</span><span className="font-mono">{formatINR(totals.total)}</span>
                </div>
                {!isNew && payments.length > 0 && (
                  <>
                    <div className="pt-2 mt-2" style={{ borderTop: "1px solid #E5E7EB" }}>
                      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Payments Received</p>
                      {payments.map((p, idx) => (
                        <div key={p.id} className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-gray-600">{formatDate(p.paid_at || p.created_at)} · {p.method}</span>
                          <span className="font-mono">{formatINR(p.paid_amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-2 mt-1 font-bold" style={{ borderTop: "1px solid #0B0B0B", color: balance > 0 ? "#F59E0B" : "#10B981" }}>
                      <span>{balance > 0 ? "Balance Due" : "Paid in Full"}</span>
                      <span className="font-mono">{formatINR(Math.max(0, balance))}</span>
                    </div>
                  </>
                )}
                {!isNew && payments.length === 0 && inv.paid_amount > 0 && (
                  <>
                    <div className="flex justify-between"><span className="text-gray-600">Paid</span><span className="font-mono">{formatINR(inv.paid_amount)}</span></div>
                    <div className="flex justify-between font-bold" style={{ color: "var(--brand-color)" }}>
                      <span>Balance</span><span className="font-mono">{formatINR(Math.max(0, totals.total - (inv.paid_amount || 0)))}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {inv.notes && (
              <div className="mt-8 pt-4" style={{ borderTop: "1px solid #E5E7EB" }}>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Notes</p>
                <p className="text-xs text-gray-700">{inv.notes}</p>
              </div>
            )}

            {(org.bank_name || org.upi_id) && (
              <div className="mt-4 flex justify-between items-end gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Payment</p>
                  <p className="text-xs text-gray-700">
                    {[org.bank_name, org.bank_account && `A/C ${org.bank_account}`, org.bank_ifsc && `IFSC ${org.bank_ifsc}`, org.upi_id && `UPI ${org.upi_id}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {org.upi_id && !isNew && (
                  <div className="text-center shrink-0">
                    <img
                      src={`${API_BASE}/invoices/${id}/upi-qr.png?ts=${inv.paid_amount || 0}`}
                      alt="UPI QR"
                      className="w-24 h-24 border border-gray-200"
                      data-testid="upi-qr-preview"
                    />
                    <p className="text-[9px] uppercase tracking-widest text-gray-500 mt-1">Scan to pay via UPI</p>
                    <p className="text-[10px] text-gray-700">{org.upi_id}</p>
                  </div>
                )}
              </div>
            )}

            <p className="mt-10 text-center text-[10px] tracking-widest uppercase text-gray-400">
              {org.name} · {org.website} · Generated by Insapi Marketing Workspace
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
