import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { formatDate, formatINR } from "../lib/format";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "completed", label: "Completed" },
];

const empty = {
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
  client_id: "",
  project_id: "",
  estimated_minutes: 60,
  billable_amount: 0,
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [drag, setDrag] = useState(null);
  const [dropCol, setDropCol] = useState(null);
  const [aiTasks, setAiTasks] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const load = async () => {
    const [t, c, p] = await Promise.all([
      api.get("/tasks"),
      api.get("/clients"),
      api.get("/projects"),
    ]);
    setTasks(t.data);
    setClients(c.data);
    setProjects(p.data);
  };

  useEffect(() => {
    load();
  }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const create = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    const payload = { ...form };
    if (!payload.client_id) delete payload.client_id;
    if (!payload.project_id) delete payload.project_id;
    if (!payload.due_date) delete payload.due_date;
    await api.post("/tasks", payload);
    setOpen(false);
    setForm(empty);
    toast.success("Task created");
    load();
  };

  const move = async (id, status) => {
    await api.put(`/tasks/${id}`, { status });
    load();
  };

  const del = async (id) => {
    await api.delete(`/tasks/${id}`);
    load();
  };

  const runAI = async () => {
    setAiLoading(true);
    setAiOpen(true);
    try {
      const r = await api.get("/ai/prioritize");
      setAiTasks(r.data.tasks || []);
    } finally {
      setAiLoading(false);
    }
  };

  const onDragStart = (e, id) => {
    setDrag(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e, col) => {
    e.preventDefault();
    setDropCol(col);
  };
  const onDrop = (col) => {
    if (drag) move(drag, col);
    setDrag(null);
    setDropCol(null);
  };

  return (
    <div data-testid="tasks-page">
      <PageHeader
        eyebrow="Workflow"
        title="Tasks Kanban."
        description="Drag cards across stages. Completing tasks bumps your streak and revenue."
        actions={
          <>
            <button
              data-testid="ai-prioritize-btn"
              onClick={runAI}
              className="px-4 py-2 text-sm flex items-center gap-2"
              style={{ border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
            >
              <Sparkles size={14} className="brand-text" /> AI prioritize
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button
                  data-testid="new-task-btn"
                  className="px-4 py-2 text-sm flex items-center gap-2"
                  style={{ background: "var(--brand)", color: "white" }}
                >
                  <Plus size={14} /> New task
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }}>
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl tracking-tight">New task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="label-tiny">Title</Label>
                    <Input data-testid="task-title-input" value={form.title} onChange={(e) => upd("title", e.target.value)} />
                  </div>
                  <div>
                    <Label className="label-tiny">Description</Label>
                    <Textarea value={form.description} onChange={(e) => upd("description", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="label-tiny">Priority</Label>
                      <Select value={form.priority} onValueChange={(v) => upd("priority", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["low","medium","high","urgent"].map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="label-tiny">Due date</Label>
                      <Input type="date" value={form.due_date} onChange={(e) => upd("due_date", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="label-tiny">Client</Label>
                      <Select value={form.client_id || "_none"} onValueChange={(v) => upd("client_id", v === "_none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="label-tiny">Project</Label>
                      <Select value={form.project_id || "_none"} onValueChange={(v) => upd("project_id", v === "_none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="label-tiny">Estimated minutes</Label>
                      <Input type="number" value={form.estimated_minutes} onChange={(e) => upd("estimated_minutes", parseInt(e.target.value || 0))} />
                    </div>
                    <div>
                      <Label className="label-tiny">Billable (₹)</Label>
                      <Input type="number" value={form.billable_amount} onChange={(e) => upd("billable_amount", parseFloat(e.target.value || 0))} />
                    </div>
                  </div>
                  <button
                    data-testid="task-save-btn"
                    onClick={create}
                    className="w-full py-2 text-sm font-medium mt-2"
                    style={{ background: "var(--brand)", color: "white" }}
                  >
                    Create task
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="flex gap-4 overflow-x-auto pb-4 scroll-thin">
        {COLUMNS.map((col) => {
          const list = tasks.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              className="kanban-col"
              onDragOver={(e) => onDragOver(e, col.key)}
              onDrop={() => onDrop(col.key)}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="label-tiny">{col.label}</p>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{list.length}</span>
              </div>
              <div
                className={`flex flex-col gap-3 min-h-[120px] p-2 ${dropCol === col.key ? "drop-target" : ""}`}
                style={{ border: "1px dashed transparent" }}
              >
                {list.map((t) => {
                  const proj = projects.find((p) => p.id === t.project_id);
                  return (
                    <div
                      key={t.id}
                      data-testid={`task-card-${t.id}`}
                      draggable
                      onDragStart={(e) => onDragStart(e, t.id)}
                      className={`surface p-4 cursor-grab active:cursor-grabbing ${drag === t.id ? "dragging" : ""}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm leading-snug">{t.title}</p>
                        <button
                          data-testid={`delete-task-${t.id}`}
                          onClick={() => del(t.id)}
                          className="opacity-50 hover:opacity-100"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <StatusBadge value={t.priority} />
                        {t.due_date && (
                          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                            {formatDate(t.due_date)}
                          </span>
                        )}
                      </div>
                      {(proj || t.billable_amount) && (
                        <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                          <span className="truncate">{proj?.name || ""}</span>
                          {t.billable_amount > 0 && <span>{formatINR(t.billable_amount)}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-tight">AI Priority Order</DialogTitle>
          </DialogHeader>
          {aiLoading ? (
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Analyzing your task list…</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {aiTasks.map((t, i) => (
                <div key={t.id} className="surface-2 p-3 flex items-center gap-3">
                  <span className="font-mono text-xs brand-text">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{t.title}</p>
                    {t.ai_reason && (
                      <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{t.ai_reason}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs">{t.ai_score}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
