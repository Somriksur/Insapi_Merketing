import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Folders,
  Wallet,
  FileText,
  TrendingUp,
  Settings as SettingsIcon,
  FileDown,
  Coins,
  Receipt,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { Sun, Moon } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/projects", label: "Projects", icon: Folders },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/credits", label: "Credits", icon: Coins },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: TrendingUp },
  { to: "/reports", label: "Reports", icon: FileDown },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const LOGO_URL = "https://res.cloudinary.com/ds2xh85dt/image/upload/v1779656917/ChatGPT_Image_May_25_2026_02_37_24_AM_m8b5km.png";

export default function Sidebar() {
  const { theme, toggle } = useTheme();
  return (
    <aside
      data-testid="app-sidebar"
      className="w-60 shrink-0 h-screen sticky top-0 flex flex-col"
      style={{ background: "var(--bg-page)", borderRight: "1px solid var(--border)" }}
    >
      <div className="px-5 pt-6 pb-8 flex items-center gap-3">
        <div
          className="w-9 h-9 flex items-center justify-center"
          style={{ background: "white", border: "1px solid var(--border)" }}
        >
          <img src={LOGO_URL} alt="Insapi Marketing" className="w-7 h-7 object-contain" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display font-bold text-base tracking-tight">Insapi Marketing</span>
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
            Workspace
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-0.5">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-testid={`nav-${label.toLowerCase()}`}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                isActive
                  ? "text-white"
                  : "",
              ].join(" ")
            }
            style={({ isActive }) => ({
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              background: isActive ? "var(--bg-surface-hover)" : "transparent",
              borderLeft: isActive ? "2px solid var(--brand)" : "2px solid transparent",
            })}
          >
            <Icon size={16} strokeWidth={1.6} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-5">
        <button
          data-testid="theme-toggle"
          onClick={toggle}
          className="flex items-center gap-2 px-3 py-2 text-xs w-full"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        <p className="mt-3 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
          v1.0 · Insapi Marketing Workspace
        </p>
      </div>
    </aside>
  );
}
