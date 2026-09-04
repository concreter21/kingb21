import React, { useState } from "react";
import { ShieldAlert, Plus, AlertTriangle, CheckCircle2, Clock, Eye } from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { hazards } from "../../mock";
import { useToast } from "../../hooks/use-toast";

const severityStyles = {
  critical: "bg-rose-100 text-rose-800 border-rose-300",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

const statusMeta = {
  open: { label: "Open", cls: "text-rose-700 bg-rose-50", icon: AlertTriangle },
  in_review: { label: "In Review", cls: "text-amber-700 bg-amber-50", icon: Clock },
  mitigated: { label: "Mitigated", cls: "text-emerald-700 bg-emerald-50", icon: Eye },
  closed: { label: "Closed", cls: "text-slate-600 bg-slate-100", icon: CheckCircle2 },
};

const HazardsPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [severity, setSeverity] = useState("medium");
  const { toast } = useToast();

  const counts = {
    critical: hazards.filter((h) => h.severity === "critical").length,
    high: hazards.filter((h) => h.severity === "high").length,
    open: hazards.filter((h) => h.status === "open").length,
    closed: hazards.filter((h) => h.status === "closed").length,
  };

  return (
    <DashboardLayout
      title="Hazard Reporting"
      subtitle="Real-time hazard capture from the field"
      action={
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-medium transition-colors"
        >
          <Plus className="w-[14px] h-[14px]" />
          Report Hazard
        </button>
      }
    >
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase">Critical</div>
          <div className="text-[24px] font-semibold text-rose-600 mt-1">{counts.critical}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase">High</div>
          <div className="text-[24px] font-semibold text-orange-600 mt-1">{counts.high}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase">Open</div>
          <div className="text-[24px] font-semibold text-slate-900 mt-1">{counts.open}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase">Resolved</div>
          <div className="text-[24px] font-semibold text-emerald-600 mt-1">{counts.closed}</div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-slate-900">Recent Hazards</h3>
          <span className="text-[11px] text-slate-500">{hazards.length} incidents</span>
        </div>
        {hazards.map((h) => {
          const meta = statusMeta[h.status];
          const StatusIcon = meta.icon;
          return (
            <div
              key={h.id}
              className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${severityStyles[h.severity]} border`}>
                <ShieldAlert className="w-[16px] h-[16px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[12px] font-mono font-semibold text-slate-900">{h.id}</span>
                  <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${severityStyles[h.severity]}`}>
                    {h.severity}
                  </span>
                  <span className="text-[13px] font-medium text-slate-900">{h.type}</span>
                </div>
                <div className="text-[12px] text-slate-500">
                  {h.site} · Reported by {h.reportedBy} · {h.date}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${meta.cls} flex-shrink-0`}>
                <StatusIcon className="w-3 h-3" />
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Report form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[540px] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                <ShieldAlert className="w-[18px] h-[18px] text-rose-600" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900">Report a Hazard</h3>
                <p className="text-[12px] text-slate-500">Capture on-site risks immediately</p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowForm(false);
                toast({ title: "Hazard reported", description: "Supervisors have been notified." });
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[12px] font-medium text-slate-700 mb-1 block">Site</label>
                <select className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-slate-400">
                  <option>Villa – Grunewald</option>
                  <option>Warehouse Array – Hamburg Hafen</option>
                  <option>Commercial Roof – Siemensstadt</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-slate-700 mb-1 block">Hazard type</label>
                <input
                  type="text"
                  placeholder="e.g. Exposed live conductor"
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-slate-700 mb-1 block">Severity</label>
                <div className="grid grid-cols-4 gap-2">
                  {["low", "medium", "high", "critical"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={`h-9 rounded-lg text-[12px] font-medium border capitalize transition-colors ${
                        severity === s
                          ? severityStyles[s]
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium text-slate-700 mb-1 block">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] resize-none outline-none focus:border-slate-400"
                  placeholder="What happened, immediate controls in place…"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-medium transition-colors"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default HazardsPage;
