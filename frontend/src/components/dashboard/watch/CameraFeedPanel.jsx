import React from "react";
import { Camera, Play, Square, Sparkles, Loader2, AlertTriangle } from "lucide-react";

const severityStyles = {
  low: { border: "border-emerald-300", pill: "bg-emerald-100 text-emerald-800", ring: "ring-emerald-400" },
  medium: { border: "border-amber-300", pill: "bg-amber-100 text-amber-800", ring: "ring-amber-400" },
  high: { border: "border-orange-300", pill: "bg-orange-100 text-orange-800", ring: "ring-orange-400" },
  critical: { border: "border-rose-400", pill: "bg-rose-100 text-rose-800", ring: "ring-rose-500" },
};

const CameraFeedPanel = ({
  videoRef,
  cameraOn,
  watching,
  analysing,
  error,
  latestAlert,
  onStart,
}) => {
  const ringStyle =
    latestAlert && watching ? `ring-4 ${severityStyles[latestAlert.severity]?.ring || ""} ring-inset` : "";

  return (
    <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
          <Camera className="w-[16px] h-[16px] text-slate-600" />
          Live Feed
        </h3>
        <div className="flex items-center gap-2">
          {analysing && (
            <span className="inline-flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" /> Analysing
            </span>
          )}
          {watching && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Recording
            </span>
          )}
        </div>
      </div>

      <div className={`relative bg-slate-900 aspect-video flex items-center justify-center transition-shadow ${ringStyle}`}>
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraOn ? "" : "hidden"}`}
        />
        {!cameraOn && (
          <div className="text-center p-6">
            <Camera className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <p className="text-[13px] text-slate-300 mb-3">
              Start the watch to enable continuous AI monitoring
            </p>
            <button
              onClick={onStart}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white text-[13px] font-medium transition-opacity"
            >
              <Play className="w-[14px] h-[14px]" />
              Start Camera & Watch
            </button>
          </div>
        )}

        {watching && latestAlert && (
          <div
            className={`absolute top-3 left-3 right-3 rounded-lg backdrop-blur bg-slate-900/70 border ${severityStyles[latestAlert.severity]?.border} p-3 shadow-lg`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${severityStyles[latestAlert.severity]?.pill}`}>
                    {latestAlert.severity}
                  </span>
                  <span className="text-[10px] text-white/70">Latest</span>
                </div>
                <p className="text-[12px] text-white leading-snug">{latestAlert.alert}</p>
                {latestAlert.recommendation && (
                  <p className="text-[11px] text-white/80 mt-0.5 italic">→ {latestAlert.recommendation}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 border-t border-slate-100 text-[12px] text-rose-700 bg-rose-50 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
};

export default CameraFeedPanel;
export { severityStyles };
