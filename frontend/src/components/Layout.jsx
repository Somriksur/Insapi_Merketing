import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Toaster } from "../components/ui/sonner";

export default function Layout() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="px-6 md:px-10 py-8 md:py-10 max-w-[1500px] mx-auto">
          <Outlet />
        </div>
      </main>
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            color: "var(--text-primary)",
            borderRadius: 0,
          },
        }}
      />
    </div>
  );
}
