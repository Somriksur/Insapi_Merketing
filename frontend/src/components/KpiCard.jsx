import React from "react";
import { cls, formatINR } from "../lib/format";

export default function KpiCard({ label, value, sub, accent, format = "money", testid, progress }) {
  const formatted =
    format === "money" ? formatINR(value) : value;
  return (
    <div
      data-testid={testid}
      className="surface p-6 flex flex-col gap-3 relative overflow-hidden animate-rise"
    >
      {accent && (
        <div
          className="absolute top-0 left-0 h-[2px] w-12"
          style={{ background: accent }}
        />
      )}
      <p className="label-tiny">{label}</p>
      <p className="font-display text-4xl font-bold tracking-tighter">{formatted}</p>
      {sub && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </p>
      )}
      {typeof progress === "number" && (
        <div className="h-1 w-full" style={{ background: "var(--border)" }}>
          <div
            className="h-full transition-all"
            style={{ width: `${Math.min(100, progress)}%`, background: accent || "var(--brand)" }}
          />
        </div>
      )}
    </div>
  );
}
