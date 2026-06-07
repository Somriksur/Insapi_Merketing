import React from "react";

export default function PageHeader({ eyebrow, title, description, actions, testid }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8" data-testid={testid}>
      <div>
        {eyebrow && <p className="label-tiny mb-3">{eyebrow}</p>}
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter">{title}</h1>
        {description && (
          <p className="mt-2 text-sm max-w-xl" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
