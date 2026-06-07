import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Plus, Trash2, Star, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

const empty = { name: "", company: "", email: "", whatsapp: "", address: "", rating: 5, notes: "" };

export default function Clients() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const r = await api.get("/clients");
    setList(r.data);
  };
  useEffect(() => { load(); }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    if (editing) {
      await api.put(`/clients/${editing}`, form);
      toast.success("Client updated");
    } else {
      await api.post("/clients", form);
      toast.success("Client added");
    }
    setOpen(false);
    setForm(empty);
    setEditing(null);
    load();
  };

  const del = async (id) => {
    await api.delete(`/clients/${id}`);
    toast.success("Deleted");
    load();
  };

  const startEdit = (c) => {
    setEditing(c.id);
    setForm({ ...empty, ...c });
    setOpen(true);
  };

  return (
    <div data-testid="clients-page">
      <PageHeader
        eyebrow="Directory"
        title="Clients."
        description="Your relationship index. WhatsApp them in one click from any invoice."
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
            <DialogTrigger asChild>
              <button data-testid="new-client-btn" className="px-4 py-2 text-sm flex items-center gap-2" style={{ background: "var(--brand)", color: "white" }}>
                <Plus size={14} /> Add client
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }}>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl tracking-tight">{editing ? "Edit client" : "New client"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="label-tiny">Name</Label>
                  <Input data-testid="client-name-input" value={form.name} onChange={(e) => upd("name", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="label-tiny">Company</Label>
                    <Input value={form.company} onChange={(e) => upd("company", e.target.value)} />
                  </div>
                  <div>
                    <Label className="label-tiny">Rating</Label>
                    <Input type="number" min={1} max={5} value={form.rating} onChange={(e) => upd("rating", parseInt(e.target.value || 5))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="label-tiny">Email</Label>
                    <Input value={form.email} onChange={(e) => upd("email", e.target.value)} />
                  </div>
                  <div>
                    <Label className="label-tiny">WhatsApp</Label>
                    <Input data-testid="client-whatsapp-input" value={form.whatsapp} placeholder="+91…" onChange={(e) => upd("whatsapp", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="label-tiny">Address</Label>
                  <Input value={form.address} onChange={(e) => upd("address", e.target.value)} />
                </div>
                <div>
                  <Label className="label-tiny">Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => upd("notes", e.target.value)} />
                </div>
                <button data-testid="client-save-btn" onClick={save} className="w-full py-2 text-sm font-medium" style={{ background: "var(--brand)", color: "white" }}>
                  {editing ? "Save" : "Create"}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="surface">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Name", "Company", "Contact", "Rating", "Tags", ""].map((h) => (
                <th key={h} className="text-left label-tiny px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center" style={{ color: "var(--text-tertiary)" }}>No clients yet.</td></tr>
            )}
            {list.map((c) => (
              <tr key={c.id} data-testid={`client-row-${c.id}`} style={{ borderBottom: "1px solid var(--border)" }} className="hover-surface">
                <td className="px-5 py-3 cursor-pointer" onClick={() => startEdit(c)}>
                  <p className="font-medium">{c.name}</p>
                </td>
                <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{c.company || "—"}</td>
                <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>
                  <p>{c.email || "—"}</p>
                  <p className="text-xs">{c.whatsapp || "—"}</p>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: c.rating || 0 }).map((_, i) => (
                      <Star key={i} size={12} fill="#F59E0B" stroke="#F59E0B" />
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {(c.tags || []).join(", ")}
                </td>
                <td className="px-5 py-3 text-right">
                  {c.whatsapp && (
                    <a
                      href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`whatsapp-${c.id}`}
                      className="inline-flex items-center gap-1 mr-3 text-xs"
                      style={{ color: "#10B981" }}
                    >
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                  )}
                  <button onClick={() => del(c.id)} className="opacity-60 hover:opacity-100">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
