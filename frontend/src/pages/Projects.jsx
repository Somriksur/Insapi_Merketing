import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { formatDate, formatINR } from "../lib/format";

const STATUSES = ["Active", "Pending", "Delivered", "Completed", "Delayed"];
const TYPES = ["Reel Editing", "YouTube Long-form", "Podcast Edit", "Wedding Film", "Ad Cut", "Other"];

const empty = {
  name: "",
  client_id: "",
  description: "",
  status: "Active",
  start_date: "",
  deadline: "",
  budget: 0,
  work_type: "Reel Editing",
};

export default function Projects() {
  const [list, setList] = useState([]);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const [p, c] = await Promise.all([api.get("/projects"), api.get("/clients")]);
    setList(p.data);
    setClients(c.data);
  };
  useEffect(() => { load(); }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const payload = { ...form };
    if (!payload.client_id) delete payload.client_id;
    if (!payload.start_date) delete payload.start_date;
    if (!payload.deadline) delete payload.deadline;
    await api.post("/projects", payload);
    setForm(empty);
    setOpen(false);
    toast.success("Project created");
    load();
  };

  const del = async (id) => { await api.delete(`/projects/${id}`); load(); };

  const clientName = (id) => clients.find((c) => c.id === id)?.name || "—";

  return (
    <div data-testid="projects-page">
      <PageHeader
        eyebrow="Pipeline"
        title="Projects."
        description="Active engagements with timelines, milestones and budgets."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button data-testid="new-project-btn" className="px-4 py-2 text-sm flex items-center gap-2" style={{ background: "var(--brand)", color: "white" }}>
                <Plus size={14} /> New project
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }}>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl tracking-tight">New project</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="label-tiny">Name</Label>
                  <Input data-testid="project-name-input" value={form.name} onChange={(e) => upd("name", e.target.value)} />
                </div>
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
                    <Label className="label-tiny">Status</Label>
                    <Select value={form.status} onValueChange={(v) => upd("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="label-tiny">Start</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => upd("start_date", e.target.value)} />
                  </div>
                  <div>
                    <Label className="label-tiny">Deadline</Label>
                    <Input type="date" value={form.deadline} onChange={(e) => upd("deadline", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="label-tiny">Type</Label>
                    <Select value={form.work_type} onValueChange={(v) => upd("work_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="label-tiny">Budget (₹)</Label>
                    <Input type="number" value={form.budget} onChange={(e) => upd("budget", parseFloat(e.target.value || 0))} />
                  </div>
                </div>
                <div>
                  <Label className="label-tiny">Description</Label>
                  <Textarea value={form.description} onChange={(e) => upd("description", e.target.value)} />
                </div>
                <button data-testid="project-save-btn" onClick={save} className="w-full py-2 text-sm font-medium" style={{ background: "var(--brand)", color: "white" }}>Create</button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No projects yet.</p>
        )}
        {list.map((p) => (
          <div key={p.id} data-testid={`project-card-${p.id}`} className="surface p-5 flex flex-col gap-3">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <p className="label-tiny mb-1">{p.work_type}</p>
                <h3 className="font-display text-lg font-bold tracking-tight truncate">{p.name}</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{clientName(p.client_id)}</p>
              </div>
              <StatusBadge value={p.status} />
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{p.description || "—"}</p>
            <div className="flex justify-between items-center text-xs pt-3" style={{ borderTop: "1px solid var(--border)", color: "var(--text-tertiary)" }}>
              <span>Due {formatDate(p.deadline)}</span>
              <span className="font-mono">{formatINR(p.budget)}</span>
            </div>
            <div className="flex justify-end">
              <button onClick={() => del(p.id)} className="opacity-50 hover:opacity-100"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
