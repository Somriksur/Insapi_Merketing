export const formatINR = (n, opts = {}) => {
  const v = Number(n) || 0;
  const noSymbol = opts.noSymbol;
  const compact = opts.compact;
  if (compact && Math.abs(v) >= 100000) {
    return `${noSymbol ? "" : "₹"}${(v / 100000).toFixed(1)}L`;
  }
  if (compact && Math.abs(v) >= 1000) {
    return `${noSymbol ? "" : "₹"}${(v / 1000).toFixed(1)}k`;
  }
  return `${noSymbol ? "" : "₹"}${v.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
};

export const formatDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const cls = (...xs) => xs.filter(Boolean).join(" ");
