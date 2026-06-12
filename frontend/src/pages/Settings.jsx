import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useBranding, DEFAULT_LOGO_URL } from "../lib/branding";
import LogoMark from "../components/LogoMark";

export default function Settings() {
  const { setBranding } = useBranding();
  const [s, setS] = useState(null);

  useEffect(() => {
    api.get("/settings").then((r) => setS(r.data));
  }, []);

  if (!s) return <p className="p-8" style={{ color: "var(--text-tertiary)" }}>Loading…</p>;

  const upd = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const r = await api.put("/settings", s);
    setS(r.data);
    setBranding(r.data);
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
              <LogoMark settings={s} className="w-10 h-10" alt="Logo preview" />
            </div>
            <div className="flex-1">
              <Label className="label-tiny">Logo URL</Label>
              <Input placeholder={DEFAULT_LOGO_URL} value={s.logo_url || ""} onChange={(e) => upd("logo_url", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-tiny">Logo Color Filter</Label>
              <Select value={s.logo_filter || "none"} onValueChange={(v) => upd("logo_filter", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No filter</SelectItem>
                  <SelectItem value="grayscale">Grayscale</SelectItem>
                  <SelectItem value="blue">Blue tint</SelectItem>
                  <SelectItem value="red">Red tint</SelectItem>
                  <SelectItem value="green">Green tint</SelectItem>
                  <SelectItem value="custom">Custom color</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {s.logo_filter === "custom" && (
              <div>
                <Label className="label-tiny">Custom Color (Hex)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="color" 
                    value={s.logo_custom_color || "#000000"} 
                    onChange={(e) => upd("logo_custom_color", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input 
                    placeholder="#000000" 
                    value={s.logo_custom_color || ""} 
                    onChange={(e) => upd("logo_custom_color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            )}
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
          <p className="label-tiny">Invoice Template Color</p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Choose a color for the invoice header, table, and accent lines. This affects both the live preview and the downloaded PDF.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="invoice-color-picker"
              value={s.invoice_color || "#0B0B0B"}
              onChange={(e) => upd("invoice_color", e.target.value)}
              style={{
                width: 48,
                height: 48,
                padding: 2,
                border: "1px solid var(--border)",
                borderRadius: 4,
                cursor: "pointer",
                background: "none",
              }}
            />
            <div className="flex-1">
              <Label className="label-tiny">Hex Color</Label>
              <Input
                placeholder="#0B0B0B"
                value={s.invoice_color || ""}
                onChange={(e) => upd("invoice_color", e.target.value)}
              />
            </div>
            {/* Preview swatches */}
            <div className="flex flex-col gap-1 items-center">
              {["#0B0B0B", "#1D4ED8", "#7C3AED", "#059669", "#DC2626", "#D97706"].map((c) => (
                <button
                  key={c}
                  title={c}
                  onClick={() => upd("invoice_color", c)}
                  style={{
                    width: 20,
                    height: 20,
                    background: c,
                    border: s.invoice_color === c ? "2px solid white" : "2px solid transparent",
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>
          {/* Live mini preview */}
          <div className="mt-3 p-3 rounded text-xs" style={{ background: s.invoice_color || "#0B0B0B", color: "white", fontFamily: "'Outfit', sans-serif" }}>
            <span className="font-bold tracking-widest uppercase" style={{ fontSize: 10 }}>Invoice Header Preview</span>
            <div className="flex justify-between mt-1">
              <span>#&nbsp;&nbsp;Description</span>
              <span>Amount</span>
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
