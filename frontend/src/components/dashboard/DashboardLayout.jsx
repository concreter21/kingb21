import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import AgentChat from "./AgentChat";
import {
  LayoutDashboard,
  ShieldAlert,
  FileText,
  Lock,
  ClipboardCheck,
  Map,
  Sparkles,
  Radio,
  History,
  MapPin,
  Sun,
  Bell,
  Search,
  LogOut,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { currentUser } from "../../mock";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/map", label: "Site Map", icon: Map },
  { to: "/dashboard/risk-ai", label: "AI Risk Assessor", icon: Sparkles },
  { to: "/dashboard/risk-watch", label: "Risk Watch", icon: Radio },
  { to: "/dashboard/watch-history", label: "Watch History", icon: History },
  { to: "/dashboard/swms", label: "SWMS", icon: FileText },
  { to: "/dashboard/hazards", label: "Hazards", icon: ShieldAlert },
  { to: "/dashboard/loto", label: "Lockout / Tagout", icon: Lock },
  { to: "/dashboard/compliance", label: "Compliance", icon: ClipboardCheck },
  { to: "/dashboard/contacts", label: "Contact & Offices", icon: MapPin },
];

const DashboardLayout = ({ children, title, subtitle, action }) => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f6f8fb] flex font-inter">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside className={`flex flex-col w-[240px] bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-50 transition-transform duration-200 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(107,33,168,0.5)]">
            <span className="text-white font-bold text-[11px] tracking-tight">1K5°</span>
          </div>
          <div className="leading-tight flex-1">
            <div className="text-[13px] font-semibold text-slate-900">SolarSafe pro</div>
            <div className="text-[10px] text-slate-500">1KOMMA5° · Safety</div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <item.icon className="w-[16px] h-[16px]" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6b21a8] to-[#a855f7] flex items-center justify-center text-white text-[11px] font-semibold">
              {currentUser.initials}
            </div>
            <div className="flex-1 leading-tight">
              <div className="text-[12px] font-semibold text-slate-900 truncate">{currentUser.name}</div>
              <div className="text-[10px] text-slate-500 truncate">{currentUser.role}</div>
            </div>
            <button
              onClick={() => navigate("/")}
              className="text-slate-400 hover:text-slate-800 transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="w-[15px] h-[15px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-[240px] flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 -ml-1"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[16px] md:text-[18px] font-semibold text-slate-900 leading-tight truncate">{title}</h1>
              {subtitle && (
                <p className="text-[11px] md:text-[12px] text-slate-500 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 h-9 px-3 bg-slate-100 rounded-lg w-[260px]">
              <Search className="w-[14px] h-[14px] text-slate-400" />
              <input
                className="bg-transparent border-none outline-none text-[13px] text-slate-800 placeholder:text-slate-400 flex-1"
                placeholder="Search sites, SWMS, hazards…"
              />
            </div>
            <button className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors relative">
              <Bell className="w-[16px] h-[16px]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <button className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
              <Settings className="w-[16px] h-[16px]" />
            </button>
            {action}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 md:p-8 max-w-full">
          {children}
        </main>
      </div>

      {/* Floating AI assistant */}
      <AgentChat />
    </div>
  );
};

export default DashboardLayout;
