import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { formatINR, formatDate } from "../lib/format";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Wallet } from "lucide-react";

export default function MonthlyReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/monthly?year=${selectedYear}`);
      setReports(res.data.months || []);
    } catch (err) {
      console.error("Failed to load reports", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedYear]);

  const yearTotal = reports.reduce((acc, m) => ({
    revenue: acc.revenue + m.revenue,
    expenses: acc.expenses + m.expenses,
    profit: acc.profit + m.profit,
  }), { revenue: 0, expenses: 0, profit: 0 });

  const availableYears = [2024, 2025, 2026, 2027];

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center" style={{ color: "var(--text-tertiary)" }}>
        Loading reports…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Financial Reports"
        title="Monthly Breakdown"
        description="Track revenue, expenses, and profit month by month"
        actions={
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 text-sm"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        }
      />

      {/* Year Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} style={{ color: "#10B981" }} />
            <p className="label-tiny">Total Revenue</p>
          </div>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#10B981" }}>
            {formatINR(yearTotal.revenue)}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            {selectedYear} total income
          </p>
        </div>

        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={16} style={{ color: "#EF4444" }} />
            <p className="label-tiny">Total Expenses</p>
          </div>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: "#EF4444" }}>
            {formatINR(yearTotal.expenses)}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            {selectedYear} total costs
          </p>
        </div>

        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} style={{ color: "#8B5CF6" }} />
            <p className="label-tiny">Net Profit</p>
          </div>
          <p className="font-display text-3xl font-bold tracking-tighter" style={{ color: yearTotal.profit >= 0 ? "#8B5CF6" : "#EF4444" }}>
            {formatINR(yearTotal.profit)}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            {((yearTotal.profit / Math.max(1, yearTotal.revenue)) * 100).toFixed(1)}% profit margin
          </p>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="surface">
        <div className="px-5 pt-5 pb-4">
          <h2 className="font-display text-xl font-bold tracking-tight">Monthly Breakdown</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            Revenue, expenses, and profit for each month
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left label-tiny px-5 py-3">Month</th>
                <th className="text-right label-tiny px-5 py-3">Revenue</th>
                <th className="text-right label-tiny px-5 py-3">Expenses</th>
                <th className="text-right label-tiny px-5 py-3">Net Profit</th>
                <th className="text-right label-tiny px-5 py-3">Margin</th>
                <th className="text-left label-tiny px-5 py-3">Trend</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((month, idx) => {
                const margin = month.revenue > 0 ? ((month.profit / month.revenue) * 100).toFixed(1) : 0;
                const prevMonth = idx > 0 ? reports[idx - 1] : null;
                const trend = prevMonth ? month.profit - prevMonth.profit : 0;
                
                return (
                  <tr key={month.month} style={{ borderBottom: "1px solid var(--border)" }} className="hover-surface">
                    <td className="px-5 py-3 font-medium">{month.month}</td>
                    <td className="px-5 py-3 text-right font-mono" style={{ color: "#10B981" }}>
                      {formatINR(month.revenue)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono" style={{ color: "#EF4444" }}>
                      {formatINR(month.expenses)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-medium" style={{ color: month.profit >= 0 ? "#8B5CF6" : "#EF4444" }}>
                      {formatINR(month.profit)}
                    </td>
                    <td className="px-5 py-3 text-right" style={{ color: "var(--text-secondary)" }}>
                      {margin}%
                    </td>
                    <td className="px-5 py-3">
                      {prevMonth && (
                        <div className="flex items-center gap-1">
                          {trend > 0 ? (
                            <>
                              <TrendingUp size={14} style={{ color: "#10B981" }} />
                              <span className="text-xs" style={{ color: "#10B981" }}>
                                +{formatINR(trend)}
                              </span>
                            </>
                          ) : trend < 0 ? (
                            <>
                              <TrendingDown size={14} style={{ color: "#EF4444" }} />
                              <span className="text-xs" style={{ color: "#EF4444" }}>
                                {formatINR(trend)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>—</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)", background: "var(--bg-surface-hover)" }}>
                <td className="px-5 py-4 font-bold">Total {selectedYear}</td>
                <td className="px-5 py-4 text-right font-mono font-bold" style={{ color: "#10B981" }}>
                  {formatINR(yearTotal.revenue)}
                </td>
                <td className="px-5 py-4 text-right font-mono font-bold" style={{ color: "#EF4444" }}>
                  {formatINR(yearTotal.expenses)}
                </td>
                <td className="px-5 py-4 text-right font-mono font-bold" style={{ color: yearTotal.profit >= 0 ? "#8B5CF6" : "#EF4444" }}>
                  {formatINR(yearTotal.profit)}
                </td>
                <td className="px-5 py-4 text-right font-bold" style={{ color: "var(--text-secondary)" }}>
                  {((yearTotal.profit / Math.max(1, yearTotal.revenue)) * 100).toFixed(1)}%
                </td>
                <td className="px-5 py-4"></td>
              </tr>
            </tfoot>
          </table>

          {reports.length === 0 && (
            <div className="text-center py-12" style={{ color: "var(--text-tertiary)" }}>
              No data for {selectedYear}. Start recording payments and expenses to see reports.
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      {reports.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="surface p-5">
            <h3 className="font-display text-lg font-bold tracking-tight mb-3">Best Month</h3>
            {(() => {
              const best = reports.reduce((max, m) => m.profit > max.profit ? m : max, reports[0]);
              return (
                <div>
                  <p className="text-2xl font-bold" style={{ color: "#10B981" }}>{best.month}</p>
                  <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                    Profit: {formatINR(best.profit)} · Revenue: {formatINR(best.revenue)}
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="surface p-5">
            <h3 className="font-display text-lg font-bold tracking-tight mb-3">Average Monthly</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Revenue</span>
                <span className="font-mono font-medium">{formatINR(yearTotal.revenue / Math.max(1, reports.length))}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Expenses</span>
                <span className="font-mono font-medium">{formatINR(yearTotal.expenses / Math.max(1, reports.length))}</span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                <span className="font-medium">Profit</span>
                <span className="font-mono font-bold" style={{ color: "#8B5CF6" }}>
                  {formatINR(yearTotal.profit / Math.max(1, reports.length))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
