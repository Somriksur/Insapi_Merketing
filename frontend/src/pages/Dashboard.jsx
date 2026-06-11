import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatINR, formatDate } from "../lib/format";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles, ArrowUpRight, Clock, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { useBranding, getBrandColor } from "../lib/branding";
import LogoMark from "../components/LogoMark";

export default function Dashboard() {
  const { branding } = useBranding();
  const brandColor = getBrandColor(branding);
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);

  const load = async () => {
    const [d, inv, tk] = await Promise.all([
      api.get("/dashboard"),
      api.get("/invoices"),
      api.get("/tasks"),
    ]);
    setStats(d.data);
    setRecentInvoices(inv.data.slice(0, 5));
    setRecentTasks(tk.data.slice(0, 6));
  };

  const loadAI = async () => {
    setLoadingAI(true);
    try {
      const [ins, fc, sum] = await Promise.all([
        api.get("/ai/insights"),
        api.get("/ai/forecast"),
        api.get("/ai/summary"),
      ]);
      setInsights(ins.data.insights || []);
      setForecast(fc.data);
      setAiSummary(sum.data.summary || "");
    } finally {
      setLoadingAI(false);
    }
  };

  useEffect(() => {
    load();
    loadAI();
  }, []);

  if (!stats) {
    return (
      <div className="h-[60vh] flex items-center justify-center" style={{ color: "var(--text-tertiary)" }}>
        Loading…
      </div>
    );
  }

  const monthName = new Date().toLocaleString("en-US", { month: "long" });

  return (
    <div className="flex flex-col gap-10" data-testid="dashboard-page">
      <PageHeader
        eyebrow={`${monthName} · ${branding.name || "Insapi Marketing"}`}
        title="Command center."
        description="Track revenue, tasks, and clients in one editorial dashboard."
        actions={
          <div className="flex items-center gap-4">
            <LogoMark settings={branding} className="w-10 h-10" />
            <Link
              to="/invoices/new"
              data-testid="new-invoice-quick"
              className="px-5 py-2.5 text-sm font-medium"
              style={{ background: "var(--brand)", color: "white" }}
            >
              New Invoice
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiCard
          testid="kpi-daily"
          label="Today"
          value={stats.daily_revenue}
          sub={`Target ${formatINR(stats.daily_target)} · ${stats.daily_pct}%`}
          progress={stats.daily_pct}
          accent="var(--brand)"
        />
        <KpiCard
          testid="kpi-monthly"
          label={`${monthName} Revenue`}
          value={stats.monthly_revenue}
          sub={`Target ${formatINR(stats.monthly_target)} · ${stats.monthly_pct}%`}
          progress={stats.monthly_pct}
          accent="#10B981"
        />
        <KpiCard
          testid="kpi-profit"
          label={`${monthName} Net Profit`}
          value={stats.net_profit ?? (stats.monthly_revenue - (stats.monthly_expenses || 0))}
          sub={`Revenue ${formatINR(stats.monthly_revenue)} − Expenses ${formatINR(stats.monthly_expenses || 0)}`}
          accent="#8B5CF6"
        />
        <KpiCard
          testid="kpi-expenses"
          label={`${monthName} Expenses`}
          value={stats.monthly_expenses || 0}
          sub={`All-time expenses ${formatINR(stats.total_expenses || 0)}`}
          accent="#EF4444"
        />
        <KpiCard
          testid="kpi-partial"
          label="Pending Payments"
          value={stats.partial_amount + stats.pending_amount}
          sub={`${stats.partial_payments_count} partial · Outstanding`}
          accent="#F59E0B"
        />
        <KpiCard
          testid="kpi-overdue"
          label="Overdue"
          value={stats.overdue_amount}
          sub={`${stats.pending_tasks} tasks pending`}
          accent="#EF4444"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="surface p-6 lg:col-span-2 animate-rise">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="label-tiny mb-1">Last 7 days</p>
              <h3 className="font-display text-2xl font-bold tracking-tight">Revenue trend</h3>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="inline-block w-2 h-2" style={{ background: "var(--brand)" }} />
              Daily inflow
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={stats.trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="brandFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={brandColor} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={brandColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                  }
                  stroke="var(--text-tertiary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--text-tertiary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatINR(v, { compact: true, noSymbol: true })}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 0,
                    color: "var(--text-primary)",
                  }}
                  formatter={(v) => [formatINR(v), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke={brandColor}
                  strokeWidth={2}
                  fill="url(#brandFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className="surface p-6 animate-rise relative overflow-hidden"
          style={{ borderColor: "rgba(29,78,216,0.4)" }}
          data-testid="ai-insights-card"
        >
          <div className="absolute -top-8 -right-8 w-32 h-32" style={{ background: "var(--brand-muted)", filter: "blur(40px)" }} />
          <div className="flex items-center gap-2 mb-4 relative">
            <Sparkles size={16} className="brand-text" />
            <p className="label-tiny" style={{ color: "var(--brand)" }}>AI Insights</p>
          </div>
          {loadingAI ? (
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Thinking…</p>
          ) : (
            <ul className="space-y-3 relative">
              {insights.map((it, i) => (
                <li key={i} className="text-sm flex gap-2 leading-relaxed">
                  <span className="font-mono text-xs" style={{ color: "var(--brand)" }}>0{i + 1}</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          )}
          {forecast && (
            <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="label-tiny mb-2">Month-end forecast</p>
              <p className="font-display text-3xl font-bold tracking-tighter">
                {formatINR(forecast.predicted_total)}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                {forecast.note}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="surface p-6">
          <div className="flex items-center gap-3 mb-2">
            <Flame size={16} style={{ color: "#F59E0B" }} />
            <p className="label-tiny">Streak</p>
          </div>
          <p className="font-display text-5xl font-bold tracking-tighter">{stats.streak_days}</p>
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            consecutive days completing tasks
          </p>
        </div>
        <div className="surface p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock size={16} style={{ color: "var(--brand)" }} />
            <p className="label-tiny">Tasks today</p>
          </div>
          <p className="font-display text-5xl font-bold tracking-tighter">
            {stats.tasks_completed_today}
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            {stats.tasks_completed_week} this week · {stats.completion_pct}% all-time
          </p>
        </div>
        <div className="surface p-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={16} className="brand-text" />
            <p className="label-tiny">Weekly summary</p>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {aiSummary || "Generating your weekly recap…"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl font-bold tracking-tight">Recent invoices</h3>
            <Link to="/invoices" className="text-xs flex items-center gap-1" style={{ color: "var(--brand)" }}>
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {recentInvoices.length === 0 && (
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No invoices yet.</p>
            )}
            {recentInvoices.map((inv) => (
              <Link
                key={inv.id}
                to={`/invoices/${inv.id}`}
                className="flex items-center justify-between py-3 hover-surface px-2"
              >
                <div>
                  <p className="font-mono text-xs">{inv.number}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {formatDate(inv.issue_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display font-medium">{formatINR(inv.total)}</span>
                  <StatusBadge value={inv.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl font-bold tracking-tight">Today's tasks</h3>
            <Link to="/tasks" className="text-xs flex items-center gap-1" style={{ color: "var(--brand)" }}>
              Open Kanban <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-2 px-3 surface-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{t.title}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {t.due_date ? `Due ${formatDate(t.due_date)}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <StatusBadge value={t.priority} />
                  <StatusBadge value={t.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
