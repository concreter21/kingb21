import React from "react";
import {
  Sun,
  Battery,
  Zap,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  FileText,
  Lock,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Wifi,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import DashboardLayout from "./DashboardLayout";
import {
  kpiStats,
  activeSites,
  energyProduction,
  batteryStatus,
  systemStatus,
  activityFeed,
  currentUser,
} from "../../mock";
import { useNavigate } from "react-router-dom";

const riskStyles = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};

const activityIcon = {
  hazard: ShieldAlert,
  swms: FileText,
  loto: Lock,
  compliance: ClipboardCheck,
};

const activityColor = {
  hazard: "bg-rose-100 text-rose-600",
  swms: "bg-indigo-100 text-indigo-600",
  loto: "bg-amber-100 text-amber-600",
  compliance: "bg-emerald-100 text-emerald-600",
};

const StatCard = ({ stat }) => {
  const TrendIcon = stat.trend === "up" ? ArrowUpRight : ArrowDownRight;
  const trendColor = stat.trend === "up" ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">
          {stat.label}
        </span>
        <span className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          {stat.delta}
        </span>
      </div>
      <div className="text-[28px] font-semibold text-slate-900 leading-none tracking-tight">
        {stat.value}
      </div>
      <div className="text-[11px] text-slate-500 mt-2">{stat.helper}</div>
    </div>
  );
};

const StatusPill = ({ label, status }) => {
  const isOnline = status === "online" || status === "connected";
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-[13px] text-slate-600">{label}</span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-rose-500"} ${isOnline ? "animate-pulse" : ""}`} />
        <span className="text-[12px] font-medium text-slate-800 capitalize">{status}</span>
      </span>
    </div>
  );
};

const DashboardHome = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout
      title={`Welcome, ${currentUser.name.split(" ")[0]}`}
      subtitle={`${currentUser.company} · Today's safety brief`}
      action={
        <button
          onClick={() => navigate("/dashboard/swms")}
          className="hidden md:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium transition-colors"
        >
          <FileText className="w-[14px] h-[14px]" />
          New SWMS
        </button>
      }
    >
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiStats.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Energy chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">
                Energy Production
              </h2>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Combined output across active installations
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                Solar (kWh)
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                Battery (kWh)
              </span>
            </div>
          </div>
          <div className="h-[240px] -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={energyProduction} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="batteryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="solar" stroke="#f59e0b" strokeWidth={2} fill="url(#solarGrad)" />
                <Area type="monotone" dataKey="battery" stroke="#6366f1" strokeWidth={2} fill="url(#batteryGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Battery + System status */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-2">
                <Battery className="w-[16px] h-[16px] text-indigo-600" />
                Battery
              </h2>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {batteryStatus.status}
              </span>
            </div>
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-[32px] font-semibold text-slate-900 leading-none">
                  {batteryStatus.level}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {batteryStatus.capacity} · {batteryStatus.temperature}
                </div>
              </div>
              <div className="text-right text-[11px]">
                <div className="text-slate-500">Health</div>
                <div className="text-slate-900 font-semibold">{batteryStatus.health}%</div>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
                style={{ width: `${batteryStatus.level}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-2">
              Cycle count: {batteryStatus.cycles}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-2">
                <Wifi className="w-[16px] h-[16px] text-emerald-600" />
                System Status
              </h2>
              <span className="text-[10px] text-slate-400">
                Synced {systemStatus.lastSync}
              </span>
            </div>
            <StatusPill label="Inverter" status={systemStatus.inverter} />
            <StatusPill label="Battery Stack" status={systemStatus.battery} />
            <StatusPill label="Grid" status={systemStatus.grid} />
            <StatusPill label="Monitoring" status={systemStatus.monitoring} />
          </div>
        </div>
      </div>

      {/* Sites + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Active Job Sites</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">Live risk & progress overview</p>
            </div>
            <button className="text-[12px] text-slate-500 hover:text-slate-900 transition-colors">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {activeSites.map((site) => (
              <div
                key={site.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                  <Sun className="w-[18px] h-[18px] text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-slate-900 truncate">
                      {site.name}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${riskStyles[site.risk]}`}>
                      {site.risk} risk
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {site.type} · {site.city} · {site.team} crew members
                  </div>
                </div>
                <div className="w-[120px] flex-shrink-0">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Progress</span>
                    <span className="font-medium text-slate-800">{site.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full transition-all duration-500"
                      style={{ width: `${site.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {activityFeed.map((item) => {
              const Icon = activityIcon[item.type];
              return (
                <div key={item.id} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activityColor[item.type]}`}>
                    <Icon className="w-[14px] h-[14px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-slate-700 leading-snug">
                      <span className="font-semibold text-slate-900">{item.actor}</span>{" "}
                      {item.action}{" "}
                      <span className="font-medium text-slate-800">{item.target}</span>
                    </p>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardHome;
