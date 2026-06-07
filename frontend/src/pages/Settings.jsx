import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function Settings() {
  const [s, setS] = useState(null);

  useEffect(() => {
    api.get("/settings").then((r) => setS(r.data));
  }, []);

  if (!s) return <p className="p-8" style={{ color: "var(--text-tertiary)" }}>Loading…</p>;

  const upd = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const r = await api.put("/settings", s);
    setS(r.data);
    toast.success("Settings saved");
  };

  return (
    <div data-testid="settings-page">
      <PageHeader
        eyebrow="Workspace"
        title="Settings."
        description="Brand, billing details and message templates."
        actions={
          <button data-testid="settings-save-btn" onClick={save} className="px-4 py-2 text-sm flex items-center gap-2" style={{ background: "var(--brand)", color: "white" }}>
            <Save size={14} /> Save
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface p-6 space-y-3">
          <p className="label-tiny">Organisation</p>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white flex items-center justify-center" style={{ border: "1px solid var(--border)" }}>
              <img src={s.logo_url || "https://res.cloudinary.com/ds2xh85dt/image/upload/v1779656917/ChatGPT_Image_May_25_2026_02_37_24_AM_m8b5km.png"} alt="logo" className="w-10 h-10 object-contain" />
            </div>
            <div className="flex-1">
              <Label className="label-tiny">Logo URL</Label>
              <Input placeholder="https://res.cloudinary.com/ds2xh85dt/image/upload/v1779656917/ChatGPT_Image_May_25_2026_02_37_24_AM_m8b5km.png" value={s.logo_url || ""} onChange={(e) => upd("logo_url", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="label-tiny">Name</Label><Input value={s.name} onChange={(e) => upd("name", e.target.value)} /></div>
            <div><Label className="label-tiny">Owner</Label><Input value={s.owner_name} onChange={(e) => upd("owner_name", e.target.value)} /></div>
            <div><Label className="label-tiny">Email</Label><Input value={s.email} onChange={(e) => upd("email", e.target.value)} /></div>
            <div><Label className="label-tiny">Phone</Label><Input value={s.phone} onChange={(e) => upd("phone", e.target.value)} /></div>
            <div className="col-span-2"><Label className="label-tiny">Address</Label><Input value={s.address} onChange={(e) => upd("address", e.target.value)} /></div>
            <div><Label className="label-tiny">Website</Label><Input value={s.website} onChange={(e) => upd("website", e.target.value)} /></div>
            <div><Label className="label-tiny">GSTIN</Label><Input value={s.gst_number} onChange={(e) => upd("gst_number", e.target.value)} /></div>
          </div>
        </div>

        <div className="surface p-6 space-y-3">
          <p className="label-tiny">Targets</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-tiny">Daily target (₹)</Label>
              <Input type="number" value={s.daily_target} onChange={(e) => upd("daily_target", parseFloat(e.target.value || 0))} />
            </div>
            <div>
              <Label className="label-tiny">Monthly target (₹)</Label>
              <Input type="number" value={s.monthly_target} onChange={(e) => upd("monthly_target", parseFloat(e.target.value || 0))} />
            </div>
            <div>
              <Label className="label-tiny">Invoice prefix</Label>
              <Input value={s.invoice_prefix} onChange={(e) => upd("invoice_prefix", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="surface p-6 space-y-3">
          <p className="label-tiny">Bank / UPI</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="label-tiny">Bank name</Label><Input value={s.bank_name} onChange={(e) => upd("bank_name", e.target.value)} /></div>
            <div><Label className="label-tiny">Account no.</Label><Input value={s.bank_account} onChange={(e) => upd("bank_account", e.target.value)} /></div>
            <div><Label className="label-tiny">IFSC</Label><Input value={s.bank_ifsc} onChange={(e) => upd("bank_ifsc", e.target.value)} /></div>
            <div><Label className="label-tiny">UPI ID</Label><Input value={s.upi_id} onChange={(e) => upd("upi_id", e.target.value)} /></div>
          </div>
        </div>

        <div className="surface p-6 space-y-3">
          <p className="label-tiny">WhatsApp template</p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Use placeholders: {"{client_name}, {invoice_number}, {org_name}, {owner_name}, {total}, {balance}"}
          </p>
          <Textarea rows={8} value={s.whatsapp_template} onChange={(e) => upd("whatsapp_template", e.target.value)} />
        </div>

        <div className="surface p-6 space-y-3">
          <p className="label-tiny">Email / SMTP (for PDF auto-attach)</p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Configure to send invoices via email with PDF automatically attached. Use Gmail App Password or any SMTP provider.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="label-tiny">SMTP Host</Label>
              <Input placeholder="smtp.gmail.com" value={s.smtp_host || ""} onChange={(e) => upd("smtp_host", e.target.value)} />
            </div>
            <div>
              <Label className="label-tiny">SMTP Port</Label>
              <Input type="number" placeholder="587" value={s.smtp_port || 587} onChange={(e) => upd("smtp_port", parseInt(e.target.value || 587))} />
            </div>
            <div>
              <Label className="label-tiny">From address</Label>
              <Input placeholder="you@gmail.com" value={s.smtp_from || ""} onChange={(e) => upd("smtp_from", e.target.value)} />
            </div>
            <div>
              <Label className="label-tiny">SMTP Username</Label>
              <Input placeholder="you@gmail.com" value={s.smtp_user || ""} onChange={(e) => upd("smtp_user", e.target.value)} />
            </div>
            <div>
              <Label className="label-tiny">SMTP Password / App Password</Label>
              <Input type="password" placeholder="••••••••" value={s.smtp_pass || ""} onChange={(e) => upd("smtp_pass", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="surface p-6 col-span-1 lg:col-span-2 space-y-3">
          <p className="label-tiny">Default invoice notes</p>
          <Textarea value={s.invoice_notes_default} onChange={(e) => upd("invoice_notes_default", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
