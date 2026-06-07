import React from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { API_BASE } from "../lib/api";
import { FileDown, Calendar, TrendingUp } from "lucide-react";

const reports = [
  { kind: "invoices", title: "Invoices", description: "All invoices with totals, status and due dates." },
  { kind: "payments", title: "Payments", description: "Inflows including partial payments and methods." },
  { kind: "expenses", title: "Expenses", description: "All business expenses by category and status." },
  { kind: "clients", title: "Clients", description: "Master list of clients with contact details." },
  { kind: "tasks", title: "Tasks", description: "All tasks with billable amounts and time tracked." },
];

export default function Reports() {
  return (
    <div data-testid="reports-page">
      <PageHeader
        eyebrow="Export"
        title="Reports."
        description="Download CSV exports and view monthly financial reports."
      />

      {/* Monthly Reports Link */}
      <Link
        to="/reports/monthly"
        className="surface p-6 flex justify-between items-center hover-surface group mb-6"
        style={{ border: "2px solid var(--brand)" }}
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} style={{ color: "var(--brand)" }} />
            <p className="label-tiny" style={{ color: "var(--brand)" }}>FEATURED REPORT</p>
          </div>
          <h3 className="font-display text-2xl font-bold tracking-tight">Monthly Financial Reports</h3>
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            View revenue, expenses, and profit breakdown by month. Track your business performance over time.
          </p>
        </div>
        <TrendingUp size={32} style={{ color: "var(--brand)" }} className="group-hover:scale-110 transition-transform" />
      </Link>

      {/* CSV Exports */}
      <h3 className="font-display text-lg font-bold tracking-tight mb-4">CSV Exports</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reports.map((r) => (
          <a
            key={r.kind}
            href={`${API_BASE}/reports/${r.kind}.csv`}
            target="_blank"
            rel="noreferrer"
            data-testid={`download-${r.kind}`}
            className="surface p-6 flex justify-between items-center hover-surface group"
          >
            <div>
              <p className="label-tiny mb-2">CSV</p>
              <h3 className="font-display text-xl font-bold tracking-tight">{r.title}</h3>
              <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>{r.description}</p>
            </div>
            <FileDown size={24} className="opacity-50 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
    </div>
  );
}
