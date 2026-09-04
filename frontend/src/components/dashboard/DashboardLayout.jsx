import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldAlert,
  FileText,
  Lock,
  ClipboardCheck,
  Map,
  Sun,
  Bell,
  Search,
  LogOut,
  Settings,
} from "lucide-react";
import { currentUser } from "../../mock";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/map", label: "Site Map", icon: Map },
  { to: "/dashboard/swms", label: "SWMS", icon: FileText },
  { to: "/dashboard/hazards", label: "Hazards", icon: ShieldAlert },
  { to: "/dashboard/loto", label: "Lockout / Tagout", icon: Lock },
  { to: "/dashboard/compliance", label: "Compliance", icon: ClipboardCheck },
];

const DashboardLayout = ({ children, title, subtitle, action }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f6f8fb] flex font-inter">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-[240px] bg-white border-r border-slate-200 fixed inset-y-0 left-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-full bg-[#6b21a8] flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(107,33,168,0.5)]">
            <span className="text-white font-bold text-[11px] tracking-tight">1K5°</span>
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-slate-900">SolarSafe pro</div>
            <div className="text-[10px] text-slate-500">Safety Platform</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-5 md:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-[18px] font-semibold text-slate-900 leading-tight truncate">{title}</h1>
              {subtitle && (
                <p className="text-[12px] text-slate-500 truncate">{subtitle}</p>
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
    </div>
  );
};

export default DashboardLayout;
