import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { formatDate, formatINR, todayISO } from "../lib/format";

const empty = {
  client_id: "",
  project_id: "",
  category: "other",
  description: "",
  amount: 0,
  date: todayISO(),
  receipt_url: "",
  status: "pending",
  notes: "",
};

const CATEGORIES = [
  { value: "travel", label: "Travel" },
  { value: "software", label: "Software" },
  { value: "materials", label: "Materials" },
  { value: "equipment", label: "Equipment" },
  { value: "utilities", label: "Utilities" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "reimbursed", label: "Reimbursed" },
];

export default function Expenses() {
  const [list, setList] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const [e, c, p, s] = await Promise.all([
      api.get("/expenses"),
      api.get("/clients"),
      api.get("/projects"),
      api.get("/expenses/summary"),
    ]);
    setList(e.data);
    setClients(c.data);
    setProjects(p.data);
    setSummary(s.data);
  };

  useEffect(() => { load(); }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const payload = { ...form };
    if (!payload.client_id) delete payload.client_id;
    if (!payload.project_id) delete payload.project_id;
    if (!payload.receipt_url) delete payload.receipt_url;
    if (editing) {
      await api.put(`/expenses/${editing}`, payload);
      toast.success("Expense updated");
    } else {
      await api.post("/expenses", payload);
      toast.success("Expense added");
    }
    setOpen(false);
    setForm(empty);
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this expense?")) return;
    await api.delete(`/expenses/${id}`);
    toast.success("Expense deleted");
    load();
  };

  const edit = (item) => {
    setForm(item);
    setEditing(item.id);
    setOpen(true);
  };

  const filtered = list.filter((e) => {
    if (filter === "all") return true;
    return e.status === filter;
  });

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Finance"
        title="Expenses"
        description="Track business expenses and reimbursements"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                className="px-4 py-2 text-sm flex items-center gap-2"
                style={{ background: "var(--brand)", color: "white" }}
                onClick={() => {
                  setForm(empty);
                  setEditing(null);
                }}
              >
                <Plus size={18} />
                Add Expense
              </button>
            </DialogTrigger>
            <DialogContent 
              className="max-w-2xl"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0, color: "var(--text-primary)" }}
            >
              <DialogHeader>
                <DialogTitle className="font-display text-2xl tracking-tight">{editing ? "Edit Expense" : "New Expense"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="label-tiny">Client (optional)</Label>
                    <Select value={form.client_id} onValueChange={(v) => upd("client_id", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="label-tiny">Project (optional)</Label>
                    <Select value={form.project_id} onValueChange={(v) => upd("project_id", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="label-tiny">Category</Label>
                    <Select value={form.category} onValueChange={(v) => upd("category", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="label-tiny">Status</Label>
                    <Select value={form.status} onValueChange={(v) => upd("status", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="label-tiny">Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => upd("description", e.target.value)}
                    placeholder="What was this expense for?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="label-tiny">Amount (₹)</Label>
                    <Input
                      type="number"
                      value={form.amount}
                      onChange={(e) => upd("amount", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label className="label-tiny">Date</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => upd("date", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="label-tiny">Receipt URL (optional)</Label>
                  <Input
                    value={form.receipt_url}
                    onChange={(e) => upd("receipt_url", e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label className="label-tiny">Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => upd("notes", e.target.value)}
                    placeholder="Additional details..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    className="px-4 py-2 text-sm"
                    style={{ border: "1px solid var(--border)" }}
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 text-sm"
                    style={{ background: "var(--brand)", color: "white" }}
                    onClick={save}
                  >
                    {editing ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="surface p-5">
            <p className="label-tiny mb-1">Total Expenses</p>
            <p className="font-display text-3xl font-bold tracking-tighter">{formatINR(summary.total)}</p>
          </div>
          <div className="surface p-5">
            <p className="label-tiny mb-1">Pending</p>
            <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#F59E0B" }}>
              {formatINR(summary.by_status?.pending || 0)}
            </p>
          </div>
          <div className="surface p-5">
            <p className="label-tiny mb-1">Approved</p>
            <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#8B5CF6" }}>
              {formatINR(summary.by_status?.approved || 0)}
            </p>
          </div>
          <div className="surface p-5">
            <p className="label-tiny mb-1">Reimbursed</p>
            <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#10B981" }}>
              {formatINR(summary.by_status?.reimbursed || 0)}
            </p>
          </div>
        </div>
      )}

      <div className="surface">
        <div className="flex items-center justify-between mb-6 px-5 pt-5">
          <h2 className="font-display text-xl font-bold tracking-tight">All Expenses</h2>
          <div className="flex gap-2">
            {["all", "pending", "approved", "reimbursed"].map((f) => (
              <button
                key={f}
                className="px-3 py-1.5 text-xs uppercase tracking-widest"
                style={{
                  border: "1px solid var(--border)",
                  background: filter === f ? "var(--brand)" : "transparent",
                  color: filter === f ? "white" : "var(--text-secondary)",
                }}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left label-tiny px-5 py-3">Date</th>
                <th className="text-left label-tiny px-5 py-3">Category</th>
                <th className="text-left label-tiny px-5 py-3">Description</th>
                <th className="text-left label-tiny px-5 py-3">Client</th>
                <th className="text-left label-tiny px-5 py-3">Project</th>
                <th className="text-right label-tiny px-5 py-3">Amount</th>
                <th className="text-left label-tiny px-5 py-3">Status</th>
                <th className="text-right label-tiny px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover-surface">
                  <td className="px-5 py-3">{formatDate(e.date)}</td>
                  <td className="px-5 py-3 capitalize">{e.category}</td>
                  <td className="px-5 py-3">{e.description || "—"}</td>
                  <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{clientMap[e.client_id] || "—"}</td>
                  <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{projectMap[e.project_id] || "—"}</td>
                  <td className="px-5 py-3 text-right font-mono font-medium">
                    {formatINR(e.amount)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge value={e.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="text-xs"
                        style={{ color: "var(--brand)" }}
                        onClick={() => edit(e)}
                      >
                        Edit
                      </button>
                      <button className="opacity-60 hover:opacity-100" onClick={() => remove(e.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12" style={{ color: "var(--text-tertiary)" }}>
              No expenses found. Add your first expense to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
