import React, { useState } from "react";
import { Lock, Unlock, Plus, KeyRound } from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { lotoLogs } from "../../mock";
import { useToast } from "../../hooks/use-toast";

const LOTOPage = () => {
  const [logs, setLogs] = useState(lotoLogs);
  const { toast } = useToast();

  const toggleStatus = (id) => {
    setLogs((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, status: l.status === "locked" ? "released" : "locked" } : l
      )
    );
    const target = logs.find((l) => l.id === id);
    toast({
      title: target.status === "locked" ? "Isolator released" : "Isolator locked",
      description: `${target.asset} · ${target.site}`,
    });
  };

  const lockedCount = logs.filter((l) => l.status === "locked").length;

  return (
    <DashboardLayout
      title="Lockout / Tagout"
      subtitle="Isolation register & tag control"
      action={
        <button
          onClick={() => toast({ title: "New tag issued", description: "Blank tag ready for on-site scan." })}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium transition-colors"
        >
          <Plus className="w-[14px] h-[14px]" />
          Issue Tag
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-[14px] h-[14px] text-amber-600" />
            <span className="text-[11px] font-medium text-slate-500 uppercase">Currently Locked</span>
          </div>
          <div className="text-[24px] font-semibold text-slate-900">{lockedCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Unlock className="w-[14px] h-[14px] text-emerald-600" />
            <span className="text-[11px] font-medium text-slate-500 uppercase">Released Today</span>
          </div>
          <div className="text-[24px] font-semibold text-slate-900">{logs.length - lockedCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-[14px] h-[14px] text-indigo-600" />
            <span className="text-[11px] font-medium text-slate-500 uppercase">Active Tags</span>
          </div>
          <div className="text-[24px] font-semibold text-slate-900">{logs.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-[14px] font-semibold text-slate-900">Isolation Register</h3>
        </div>
        <div className="hidden md:grid grid-cols-[110px_1.2fr_1.2fr_120px_100px_120px] gap-4 px-5 py-3 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
          <div>Tag ID</div>
          <div>Asset</div>
          <div>Site</div>
          <div>Locked By</div>
          <div>Time</div>
          <div className="text-right">Action</div>
        </div>
        {logs.map((log) => (
          <div
            key={log.id}
            className="grid grid-cols-1 md:grid-cols-[110px_1.2fr_1.2fr_120px_100px_120px] gap-2 md:gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors items-center"
          >
            <div className="text-[12px] font-mono font-semibold text-slate-900">{log.id}</div>
            <div className="flex items-center gap-2">
              {log.status === "locked" ? (
                <Lock className="w-[14px] h-[14px] text-amber-600 flex-shrink-0" />
              ) : (
                <Unlock className="w-[14px] h-[14px] text-emerald-600 flex-shrink-0" />
              )}
              <span className="text-[13px] font-medium text-slate-900">{log.asset}</span>
            </div>
            <div className="text-[12px] text-slate-600 truncate">{log.site}</div>
            <div className="text-[12px] text-slate-700">{log.by}</div>
            <div className="text-[11px] text-slate-500">{log.time}</div>
            <div className="flex justify-start md:justify-end">
              <button
                onClick={() => toggleStatus(log.id)}
                className={`h-8 px-3 rounded-lg text-[11px] font-medium transition-colors ${
                  log.status === "locked"
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                {log.status === "locked" ? "Release" : "Re-lock"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default LOTOPage;
