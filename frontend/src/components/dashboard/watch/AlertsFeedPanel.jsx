import React from "react";
import { Bell, BellOff, CheckCircle2, X, Loader2, FileWarning } from "lucide-react";
import { severityStyles } from "./CameraFeedPanel";

const CHECK_INTERVAL_SEC = 8;

const AlertsFeedPanel = ({
  alerts,
  watching,
  onDismiss,
  onClearAll,
  onFileHazard,
}) => (
  <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
    <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
      <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
        <Bell className={`w-[16px] h-[16px] ${alerts.length > 0 ? "text-rose-600" : "text-slate-600"}`} />
        Live Alerts
        {alerts.length > 0 && (
          <span className="text-[11px] font-medium text-slate-500">({alerts.length})</span>
        )}
      </h3>
      {alerts.length > 0 && (
        <button
          onClick={onClearAll}
          className="text-[11px] text-slate-500 hover:text-slate-800 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>

    <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[540px]">
      {alerts.length === 0 && watching && (
        <div className="text-center py-10">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-[13px] font-medium text-slate-800">All clear</p>
          <p className="text-[11px] text-slate-500 mt-1">
            AI is watching every {CHECK_INTERVAL_SEC}s. Alerts appear here.
          </p>
        </div>
      )}
      {alerts.length === 0 && !watching && (
        <div className="text-center py-10">
          <BellOff className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-[13px] text-slate-500">Start the watch to receive alerts</p>
        </div>
      )}

      {alerts.map((a) => {
        const s = severityStyles[a.severity] || severityStyles.medium;
        return (
          <div
            key={a.id}
            className={`rounded-lg border ${s.border} bg-white p-3 shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex gap-3">
              {a.snapshot && (
                <img
                  src={a.snapshot}
                  alt="frame"
                  className="w-14 h-14 rounded-md object-cover border border-slate-200 flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${s.pill}`}>
                    {a.severity}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => onDismiss(a.id)}
                    className="ml-auto text-slate-300 hover:text-slate-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[12px] text-slate-800 font-medium leading-snug">
                  {a.alert}
                </p>
                {a.recommendation && (
                  <p className="text-[11px] text-slate-600 mt-1 italic">
                    → {a.recommendation}
                  </p>
                )}
                <div className="mt-2 flex justify-end">
                  {a.filed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3" /> Filed as hazard
                    </span>
                  ) : (
                    <button
                      onClick={() => onFileHazard(a)}
                      disabled={a.filing}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-slate-900 hover:bg-slate-800 px-2 py-1 rounded transition-colors disabled:opacity-60"
                    >
                      {a.filing ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Filing…</>
                      ) : (
                        <><FileWarning className="w-3 h-3" /> File as Hazard</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default AlertsFeedPanel;
