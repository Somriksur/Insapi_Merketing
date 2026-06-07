import React from "react";
import { cls } from "../lib/format";

const map = {
  // task / project
  todo: { label: "To Do", bg: "rgba(255,255,255,0.05)", text: "var(--text-secondary)" },
  in_progress: { label: "In Progress", bg: "rgba(29,78,216,0.18)", text: "#60A5FA" },
  review: { label: "Review", bg: "rgba(245,158,11,0.18)", text: "#F59E0B" },
  completed: { label: "Completed", bg: "rgba(16,185,129,0.18)", text: "#10B981" },
  Active: { label: "Active", bg: "rgba(29,78,216,0.18)", text: "#60A5FA" },
  Pending: { label: "Pending", bg: "rgba(255,255,255,0.05)", text: "var(--text-secondary)" },
  Delivered: { label: "Delivered", bg: "rgba(16,185,129,0.18)", text: "#10B981" },
  Completed: { label: "Completed", bg: "rgba(16,185,129,0.18)", text: "#10B981" },
  Delayed: { label: "Delayed", bg: "rgba(239,68,68,0.18)", text: "#EF4444" },
  // payments
  pending: { label: "Pending", bg: "rgba(255,255,255,0.05)", text: "var(--text-secondary)" },
  partial: { label: "Partial", bg: "rgba(245,158,11,0.18)", text: "#F59E0B" },
  paid: { label: "Paid", bg: "rgba(16,185,129,0.18)", text: "#10B981" },
  overdue: { label: "Overdue", bg: "rgba(239,68,68,0.18)", text: "#EF4444" },
  // invoices
  draft: { label: "Draft", bg: "rgba(255,255,255,0.05)", text: "var(--text-secondary)" },
  sent: { label: "Sent", bg: "rgba(29,78,216,0.18)", text: "#60A5FA" },
  viewed: { label: "Viewed", bg: "rgba(168,85,247,0.18)", text: "#A78BFA" },
  // priority
  low: { label: "Low", bg: "rgba(255,255,255,0.05)", text: "var(--text-secondary)" },
  medium: { label: "Medium", bg: "rgba(29,78,216,0.18)", text: "#60A5FA" },
  high: { label: "High", bg: "rgba(245,158,11,0.18)", text: "#F59E0B" },
  urgent: { label: "Urgent", bg: "rgba(239,68,68,0.18)", text: "#EF4444" },
};

export default function StatusBadge({ value, className }) {
  const m = map[value] || { label: String(value || ""), bg: "rgba(255,255,255,0.05)", text: "var(--text-secondary)" };
  return (
    <span
      className={cls("inline-flex items-center px-2 py-1 text-[10px] uppercase tracking-widest font-medium", className)}
      style={{ background: m.bg, color: m.text }}
    >
      {m.label}
    </span>
  );
}
