import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "../lib/format";
import { Trophy, Zap, Clock } from "lucide-react";
import { useBranding, getBrandColor } from "../lib/branding";

export default function Analytics() {
  const { branding } = useBranding();
  const brandColor = getBrandColor(branding);
  const COLORS = [brandColor, "#10B981", "#F59E0B", "#A78BFA", "#EF4444", "#22D3EE"];
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/analytics"),
      api.get("/expenses/summary"),
    ]).then(([r, e]) => {
      setData(r.data);
      setExpenses(e.data);
    });
  }, []);

  if (!data) return <p className="p-8" style={{ color: "var(--text-tertiary)" }}>Loading…</p>;

  const allTimeProfit = (data.paid_total || 0) - (expenses.total || 0);

  return (
    <div data-testid="analytics-page">
      <PageHeader
        eyebrow="Growth"
        title="Analytics."
        description="Where your revenue comes from and how productive your weeks really are."
      />

      {/* All-time summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="surface p-5" style={{ borderLeft: "3px solid #10B981" }}>
          <p className="label-tiny mt-1">All-time Revenue</p>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#10B981" }}>
            {formatINR(data.paid_total || 0)}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Total payments received</p>
        </div>
        <div className="surface p-5" style={{ borderLeft: "3px solid #EF4444" }}>
          <p className="label-tiny mt-1">All-time Expenses</p>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#EF4444" }}>
            {formatINR(expenses.total || 0)}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{expenses.count || 0} expense entries</p>
        </div>
        <div className="surface p-5" style={{ borderLeft: "3px solid #8B5CF6" }}>
          <p className="label-tiny mt-1">All-time Net Profit</p>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: allTimeProfit >= 0 ? "#8B5CF6" : "#EF4444" }}>
            {formatINR(allTimeProfit)}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Revenue minus expenses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="surface p-5">
          <Trophy size={16} style={{ color: "#F59E0B" }} />
          <p className="label-tiny mt-3">Best client</p>
          <p className="font-display text-2xl font-bold tracking-tight">
            {data.top_clients[0]?.name || "—"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {formatINR(data.top_clients[0]?.revenue || 0)} earned
          </p>
        </div>
        <div className="surface p-5">
          <Zap size={16} className="brand-text" />
          <p className="label-tiny mt-3">Highest revenue work</p>
          <p className="font-display text-2xl font-bold tracking-tight">{data.work_types[0]?.name || "—"}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{formatINR(data.work_types[0]?.revenue || 0)}</p>
        </div>
        <div className="surface p-5">
          <Clock size={16} style={{ color: "#10B981" }} />
          <p className="label-tiny mt-3">Income / hour</p>
          <p className="font-display text-2xl font-bold tracking-tight">{formatINR(data.income_per_hour)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{Math.round(data.total_minutes / 60)} hrs tracked</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="surface p-6">
          <p className="label-tiny mb-1">Last 6 months</p>
          <h3 className="font-display text-xl font-bold tracking-tight mb-5">Monthly revenue</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.monthly_revenue}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v, { compact: true, noSymbol: true })} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }}
                  formatter={(v) => [formatINR(v), "Revenue"]}
                />
                <Bar dataKey="amount" fill={brandColor} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface p-6">
          <p className="label-tiny mb-1">Last 14 days</p>
          <h3 className="font-display text-xl font-bold tracking-tight mb-5">Tasks completed</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.productivity}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(d) => new Date(d).getDate()} />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }} />
                <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface p-6">
          <p className="label-tiny mb-1">Revenue distribution</p>
          <h3 className="font-display text-xl font-bold tracking-tight mb-5">By work type</h3>
          {data.work_types.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No data yet.</p>
          ) : (
            <div className="grid grid-cols-2 items-center">
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.work_types} dataKey="revenue" nameKey="name" innerRadius={50} outerRadius={80} stroke="var(--bg-surface)">
                      {data.work_types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 0 }} formatter={(v) => formatINR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {data.work_types.map((w, i) => (
                  <div key={w.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate">{w.name}</span>
                    <span className="font-mono">{formatINR(w.revenue, { compact: true })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="surface p-6">
          <p className="label-tiny mb-1">Leaderboard</p>
          <h3 className="font-display text-xl font-bold tracking-tight mb-5">Top clients</h3>
          <div className="space-y-3">
            {data.top_clients.length === 0 && <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No data yet.</p>}
            {data.top_clients.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="font-mono text-xs w-6" style={{ color: "var(--text-tertiary)" }}>0{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="font-mono">{formatINR(c.revenue)}</span>
                  </div>
                  <div className="h-1 mt-1" style={{ background: "var(--border)" }}>
                    <div className="h-full" style={{ background: COLORS[i % COLORS.length], width: `${Math.min(100, (c.revenue / (data.top_clients[0]?.revenue || 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
