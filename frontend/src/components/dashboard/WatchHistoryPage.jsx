import React, { useEffect, useState, useMemo } from "react";
import {
  History, Search, Filter, Trash2, AlertTriangle, CheckCircle2,
  FileWarning, Loader2, X, RefreshCw, CalendarClock,
} from "lucide-react";
import axios from "axios";
import DashboardLayout from "./DashboardLayout";
import { useToast } from "../../hooks/use-toast";
import { cachedGet, queuedPost } from "../../lib/offline";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const severityColors = {
  low: { pill: "bg-emerald-100 text-emerald-800", ring: "ring-emerald-200", dot: "bg-emerald-500" },
  medium: { pill: "bg-amber-100 text-amber-800", ring: "ring-amber-200", dot: "bg-amber-500" },
  high: { pill: "bg-orange-100 text-orange-800", ring: "ring-orange-200", dot: "bg-orange-500" },
  critical: { pill: "bg-rose-100 text-rose-800", ring: "ring-rose-300", dot: "bg-rose-500" },
};

const siteOptions = [
  "All sites",
  "Site A – Residential",
  "Site B – Commercial Rooftop",
  "Site C – Warehouse Array",
  "Site D – Villa",
  "Site E – School Rooftop",
];

const formatDay = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
};

const WatchHistoryPage = () => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [site, setSite] = useState("All sites");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [filing, setFiling] = useState(null); // id being filed
  const [preview, setPreview] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (site && site !== "All sites") params.site = site;
      if (severity) params.severity = severity;
      if (search.trim()) params.search = search.trim();
      const cacheKey = `watch_history_${site}_${severity}_${search.trim()}`;
      const { data, offline } = await cachedGet(cacheKey, "/watch/history", { params });
      setAlerts(data);
      if (offline) {
        toast({
          title: "Offline mode",
          description: "Showing cached alerts from your last online session.",
        });
      }
    } catch (err) {
      toast({
        title: "Failed to load history",
        description: err.response?.data?.detail || err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, severity]);

  const clearAll = async () => {
    if (!window.confirm("Delete every watch alert from history?")) return;
    try {
      await axios.delete(`${API}/watch/history`);
      setAlerts([]);
      toast({ title: "History cleared" });
    } catch (err) {
      toast({ title: "Clear failed", description: err.message, variant: "destructive" });
    }
  };

  const deleteAlert = async (id) => {
    if (!window.confirm("Delete this alert from history?")) return;
    try {
      await axios.delete(`${API}/watch/history/${id}`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Alert deleted" });
    } catch (err) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const fileAsHazard = async (alert) => {
    setFiling(alert.id);
    try {
      const result = await queuedPost("/hazards", {
        site: alert.site,
        hazard_type: alert.alert.length > 60 ? alert.alert.slice(0, 60) + "…" : alert.alert,
        severity: alert.severity,
        description: `${alert.alert}${alert.recommendation ? `\n\nRecommendation: ${alert.recommendation}` : ""}`,
        snapshot_b64: alert.snapshot_b64 || "",
        source: "watch",
        watch_alert_id: alert.id,
      });
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alert.id ? { ...a, filed_as_hazard: true, hazard_id: result.data?.id || "queued" } : a
        )
      );
      toast({
        title: result.queued ? "Queued for sync" : "Hazard filed",
        description: result.queued
          ? "You're offline — it will upload automatically once online."
          : `${result.data.hazard_type} recorded with snapshot.`,
      });
    } catch (err) {
      toast({
        title: "File failed",
        description: err.response?.data?.detail || err.message,
        variant: "destructive",
      });
    } finally {
      setFiling(null);
    }
  };

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map();
    alerts.forEach((a) => {
      const key = formatDay(a.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return Array.from(map.entries());
  }, [alerts]);

  const counts = {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    high: alerts.filter((a) => a.severity === "high").length,
    filed: alerts.filter((a) => a.filed_as_hazard).length,
  };

  return (
    <DashboardLayout
      title="Watch History"
      subtitle="Every alert captured during your shifts, with snapshots"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-600 flex items-center justify-center transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {alerts.length > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-600 text-slate-600 text-[13px] font-medium transition-colors"
            >
              <Trash2 className="w-[14px] h-[14px]" />
              Clear
            </button>
          )}
        </div>
      }
    >
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Total alerts</div>
          <div className="text-[22px] font-semibold text-slate-900">{counts.total}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Critical</div>
          <div className="text-[22px] font-semibold text-rose-600">{counts.critical}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">High</div>
          <div className="text-[22px] font-semibold text-orange-600">{counts.high}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Filed as hazard</div>
          <div className="text-[22px] font-semibold text-indigo-600">{counts.filed}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 h-9 px-3 bg-slate-50 rounded-lg flex-1 min-w-[220px]">
          <Search className="w-[14px] h-[14px] text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search alert text…"
            className="bg-transparent border-none outline-none text-[13px] flex-1 min-w-0"
          />
        </div>
        <select
          value={site}
          onChange={(e) => setSite(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-slate-400"
        >
          {siteOptions.map((o) => <option key={o}>{o}</option>)}
        </select>
        <div className="flex items-center gap-1">
          {["", "critical", "high", "medium", "low"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setSeverity(s)}
              className={`h-9 px-3 rounded-lg text-[12px] font-medium border capitalize transition-colors ${
                severity === s
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading && alerts.length === 0 && (
          <div className="p-10 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
            <p className="text-[13px]">Loading history…</p>
          </div>
        )}
        {!loading && alerts.length === 0 && (
          <div className="p-14 text-center">
            <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-slate-800">No alerts recorded yet</p>
            <p className="text-[12px] text-slate-500 mt-1">
              Start a Risk Watch session — every hazard the AI detects will land here.
            </p>
          </div>
        )}
        {alerts.length > 0 && (
          <div className="p-5 space-y-6">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <div className="flex items-center gap-3 mb-3 sticky top-0 bg-white z-10 py-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {day}
                  </div>
                  <div className="flex-1 h-px bg-slate-100" />
                  <div className="text-[11px] text-slate-400">{items.length} alerts</div>
                </div>
                <div className="relative pl-6 space-y-3">
                  {/* Timeline line */}
                  <div className="absolute left-2 top-1 bottom-1 w-px bg-slate-200" />
                  {items.map((a) => {
                    const c = severityColors[a.severity] || severityColors.medium;
                    return (
                      <div key={a.id} className="relative">
                        <span className={`absolute -left-[18px] top-3 w-3 h-3 rounded-full ${c.dot} ring-4 ring-white`} />
                        <div className={`rounded-xl border border-slate-200 hover:border-slate-300 p-3 flex gap-3 transition-colors`}>
                          {a.snapshot_b64 ? (
                            <button
                              onClick={() => setPreview(a.snapshot_b64)}
                              className={`w-20 h-20 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 ring-1 ${c.ring}`}
                            >
                              <img
                                src={a.snapshot_b64.startsWith("data:") ? a.snapshot_b64 : `data:image/jpeg;base64,${a.snapshot_b64}`}
                                alt="snapshot"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <AlertTriangle className="w-5 h-5 text-slate-400" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${c.pill}`}>
                                {a.severity}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="text-[11px] text-slate-400">·</span>
                              <span className="text-[11px] text-slate-500 truncate">{a.site}</span>
                              {a.filed_as_hazard && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Filed
                                </span>
                              )}
                            </div>
                            <p className="text-[13px] font-medium text-slate-900 leading-snug">
                              {a.alert}
                            </p>
                            {a.recommendation && (
                              <p className="text-[11px] text-slate-600 mt-1 italic">
                                → {a.recommendation}
                              </p>
                            )}
                          </div>

                          <div className="flex-shrink-0 flex items-center gap-1">
                            {a.filed_as_hazard ? (
                              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Filed
                              </span>
                            ) : (
                              <button
                                onClick={() => fileAsHazard(a)}
                                disabled={filing === a.id}
                                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-60"
                              >
                                {filing === a.id ? (
                                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Filing…</>
                                ) : (
                                  <><FileWarning className="w-3.5 h-3.5" /> File Hazard</>
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => deleteAlert(a.id)}
                              className="w-8 h-8 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors flex items-center justify-center"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 bg-slate-900/85 backdrop-blur z-[60] flex items-center justify-center p-6 cursor-zoom-out"
        >
          <img
            src={preview.startsWith("data:") ? preview : `data:image/jpeg;base64,${preview}`}
            alt="preview"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
          />
          <button
            className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            onClick={() => setPreview(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </DashboardLayout>
  );
};

export default WatchHistoryPage;
