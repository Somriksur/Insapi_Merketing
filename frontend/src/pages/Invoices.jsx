import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, API_BASE } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Plus, Trash2, MessageCircle, FileDown, Mail } from "lucide-react";
import { formatDate, formatINR } from "../lib/format";
import { toast } from "sonner";

export default function Invoices() {
  const [list, setList] = useState([]);
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sendingEmail, setSendingEmail] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    const [a, b] = await Promise.all([api.get("/invoices"), api.get("/clients")]);
    setList(a.data);
    setClients(b.data);
  };
  useEffect(() => { load(); }, []);

  const clientName = (id) => clients.find((c) => c.id === id)?.name || "—";

  const create = async () => {
    const r = await api.post("/invoices", {
      lines: [{ description: "New service", quantity: 1, rate: 1000, amount: 1000 }],
      tax_pct: 18,
    });
    navigate(`/invoices/${r.data.id}`);
  };

  const del = async (id) => {
    if (!window.confirm("Delete invoice?")) return;
    await api.delete(`/invoices/${id}`);
    toast.success("Deleted");
    load();
  };

  const sendWA = async (id) => {
    try {
      // Get the WhatsApp message and URL
      const r = await api.get(`/invoices/${id}/whatsapp`);
      
      // Get invoice details for the filename
      const invoice = list.find(inv => inv.id === id);
      const filename = invoice?.number ? `Invoice-${invoice.number}.pdf` : `Invoice-${id}.pdf`;
      
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

  const sendEmail = async (id) => {
    setSendingEmail(id);
    try {
      const r = await api.post(`/invoices/${id}/send-email`);
      toast.success(`Email sent to ${r.data.to}`);
    } catch (e) {
      const msg = e.response?.data?.detail || "Failed to send email";
      toast.error(msg);
    } finally {
      setSendingEmail(null);
    }
  };

  const filtered = list.filter((i) => filter === "all" || i.status === filter);

  return (
    <div data-testid="invoices-page">
      <PageHeader
        eyebrow="Billing"
        title="Invoices."
        description="Editable, GST-ready, exportable. Send via WhatsApp with one click."
        actions={
          <button data-testid="new-invoice-btn" onClick={create} className="px-4 py-2 text-sm flex items-center gap-2" style={{ background: "var(--brand)", color: "white" }}>
            <Plus size={14} /> New invoice
          </button>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "draft", "sent", "viewed", "paid", "overdue"].map((s) => (
          <button
            key={s}
            data-testid={`inv-filter-${s}`}
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

      <div className="surface">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Number", "Client", "Issue", "Due", "Total", "Paid", "Status", ""].map((h) => (
                <th key={h} className="text-left label-tiny px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-10 text-center" style={{ color: "var(--text-tertiary)" }}>No invoices.</td></tr>
            )}
            {filtered.map((inv) => (
              <tr key={inv.id} data-testid={`invoice-row-${inv.id}`} style={{ borderBottom: "1px solid var(--border)" }} className="hover-surface">
                <td className="px-5 py-3 font-mono">
                  <Link to={`/invoices/${inv.id}`} className="hover:underline">{inv.number}</Link>
                </td>
                <td className="px-5 py-3">{clientName(inv.client_id)}</td>
                <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{formatDate(inv.issue_date)}</td>
                <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{formatDate(inv.due_date)}</td>
                <td className="px-5 py-3 font-mono">{formatINR(inv.total)}</td>
                <td className="px-5 py-3 font-mono" style={{ color: "#10B981" }}>{formatINR(inv.paid_amount)}</td>
                <td className="px-5 py-3"><StatusBadge value={inv.status} /></td>
                <td className="px-5 py-3 text-right">
                  <button data-testid={`invoice-pdf-${inv.id}`} onClick={() => window.open(`${API_BASE}/invoices/${inv.id}/pdf`, "_blank")} className="mr-3" style={{ color: "var(--text-secondary)" }} title="PDF">
                    <FileDown size={14} />
                  </button>
                  <button data-testid={`invoice-wa-${inv.id}`} onClick={() => sendWA(inv.id)} className="mr-3" style={{ color: "#10B981" }} title="WhatsApp">
                    <MessageCircle size={14} />
                  </button>
                  <button
                    data-testid={`invoice-email-${inv.id}`}
                    onClick={() => sendEmail(inv.id)}
                    disabled={sendingEmail === inv.id}
                    className="mr-3"
                    style={{ color: sendingEmail === inv.id ? "var(--text-tertiary)" : "var(--brand-color)" }}
                    title="Send email with PDF"
                  >
                    <Mail size={14} />
                  </button>
                  <button onClick={() => del(inv.id)} className="opacity-60 hover:opacity-100"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
