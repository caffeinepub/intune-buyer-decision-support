import { cn } from "@/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart2,
  FileBarChart,
  Home,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Scissors,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/style-analysis", icon: BarChart2, label: "Style Analysis" },
  { to: "/markdown", icon: Scissors, label: "Markdown Module" },
  { to: "/rebuy-size", icon: RefreshCw, label: "Re-buy & Size Planning" },
  { to: "/reports", icon: FileBarChart, label: "Reports" },
];

export function Sidebar() {
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 flex flex-col z-40"
      style={{ background: "#0f172a" }}
    >
      {/* Logo */}
      <div
        className="px-6 py-6 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex flex-col items-start gap-1">
          <img
            src="/assets/uploads/image-1-1.png"
            alt="INTUNE"
            className="h-9 w-auto rounded"
            style={{ background: "white", padding: "2px 8px" }}
          />
          <p
            className="text-xs leading-tight"
            style={{ color: "rgba(148,163,184,1)" }}
          >
            Buyer DSS
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p
          className="text-xs font-semibold uppercase tracking-widest px-3 mb-3"
          style={{ color: "rgba(100,116,139,1)" }}
        >
          Navigation
        </p>
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              data-ocid={`nav.${item.label.toLowerCase().replace(/[^a-z0-9]/g, "_")}.link`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive ? "text-white" : "hover:text-white",
              )}
              style={{
                background: isActive ? "oklch(0.82 0.18 88)" : "transparent",
                color: isActive ? "#1a1a1a" : "rgba(148,163,184,1)",
              }}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer with logout */}
      <div
        className="px-3 py-4 border-t"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="px-3 mb-3">
          <p
            className="text-xs font-semibold"
            style={{ color: "rgba(148,163,184,1)" }}
          >
            Shoppers Stop
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(71,85,105,1)" }}>
            Re-buy Optimization
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          data-ocid="sidebar.logout.button"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-red-900/30"
          style={{ color: "rgba(148,163,184,1)" }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
