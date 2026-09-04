import React, { useEffect, useRef, useState } from "react";
import {
  Camera, Play, Square, ShieldAlert, Radio, Bell, BellOff,
  AlertTriangle, Loader2, X, VolumeX, Volume2, CheckCircle2,
} from "lucide-react";
import axios from "axios";
import DashboardLayout from "./DashboardLayout";
import { useToast } from "../../hooks/use-toast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const siteOptions = [
  "Villa – Grunewald",
  "Commercial Roof – Siemensstadt",
  "Warehouse Array – Hamburg Hafen",
  "Residential – Prenzlauer Berg",
  "School Rooftop – Munich Nord",
];

const jobOptions = [
  "Rooftop PV Installation",
  "Commercial Array Mounting",
  "Battery Storage Wiring",
  "Warehouse Ballasted Array",
  "Inverter Commissioning",
];

const severityStyles = {
  low: { border: "border-emerald-300", pill: "bg-emerald-100 text-emerald-800", ring: "ring-emerald-400" },
  medium: { border: "border-amber-300", pill: "bg-amber-100 text-amber-800", ring: "ring-amber-400" },
  high: { border: "border-orange-300", pill: "bg-orange-100 text-orange-800", ring: "ring-orange-400" },
  critical: { border: "border-rose-400", pill: "bg-rose-100 text-rose-800", ring: "ring-rose-500" },
};

const INTERVAL_MS = 8000;

// Short beep using WebAudio
const playBeep = (severity) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const freq = severity === "critical" ? 880 : severity === "high" ? 660 : 520;
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    if (severity === "critical") {
      // second pulse
      setTimeout(() => playBeep("high"), 350);
    }
  } catch (_) {}
};

const RiskWatchPage = () => {
  const { toast } = useToast();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const inFlightRef = useRef(false);
  const alertsRef = useRef([]);

  const [cameraOn, setCameraOn] = useState(false);
  const [watching, setWatching] = useState(false);
  const [site, setSite] = useState(siteOptions[0]);
  const [jobType, setJobType] = useState(jobOptions[0]);
  const [alerts, setAlerts] = useState([]); // { id, severity, alert, recommendation, timestamp }
  const [framesAnalysed, setFramesAnalysed] = useState(0);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [lastCheckAt, setLastCheckAt] = useState(null);

  useEffect(() => {
    return () => {
      stopWatch();
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep alertsRef in sync so the interval callback can read latest without stale closure
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      setError(`Camera error: ${err.message}. Please allow camera access.`);
      toast({ title: "Camera blocked", description: err.message, variant: "destructive" });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const captureFrame = () => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const scale = Math.min(1, 720 / Math.max(w, h));
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  };

  const analyseFrame = async () => {
    if (inFlightRef.current) return;
    const frame = captureFrame();
    if (!frame) return;
    inFlightRef.current = true;
    setAnalysing(true);
    try {
      const recent = alertsRef.current.slice(0, 5).map((a) => a.alert);
      const res = await axios.post(`${API}/risk/watch`, {
        image: frame,
        site,
        job_type: jobType,
        recent_alerts: recent,
      }, { timeout: 30000 });
      setFramesAnalysed((n) => n + 1);
      setLastCheckAt(new Date());
      const d = res.data;
      if (d.has_hazard && d.severity !== "none") {
        const newAlert = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          severity: d.severity,
          alert: d.alert,
          recommendation: d.recommendation,
          timestamp: d.timestamp,
          snapshot: frame,
        };
        setAlerts((prev) => [newAlert, ...prev].slice(0, 30));
        if (soundOn) playBeep(d.severity);
        toast({
          title: `⚠ ${d.severity.toUpperCase()} risk detected`,
          description: d.alert,
          variant: d.severity === "critical" || d.severity === "high" ? "destructive" : undefined,
        });
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setError(detail);
    } finally {
      setAnalysing(false);
      inFlightRef.current = false;
    }
  };

  const startWatch = async () => {
    if (!cameraOn) {
      await startCamera();
    }
    setWatching(true);
    // First check quickly
    setTimeout(() => analyseFrame(), 1200);
    intervalRef.current = setInterval(analyseFrame, INTERVAL_MS);
  };

  const stopWatch = () => {
    setWatching(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const clearAlerts = () => setAlerts([]);
  const dismissAlert = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  const highest = alerts.length > 0 ? alerts[0].severity : "none";
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const highCount = alerts.filter((a) => a.severity === "high").length;

  return (
    <DashboardLayout
      title="Continuous Risk Watch"
      subtitle="Live camera stream monitored by AI — instant hazard alerts"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundOn((s) => !s)}
            className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-600 flex items-center justify-center transition-colors"
            title={soundOn ? "Mute alerts" : "Unmute alerts"}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {watching ? (
            <button
              onClick={stopWatch}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-medium transition-colors"
            >
              <Square className="w-[14px] h-[14px]" />
              Stop Watch
            </button>
          ) : (
            <button
              onClick={startWatch}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white text-[13px] font-medium transition-opacity"
            >
              <Play className="w-[14px] h-[14px]" />
              Start Watch
            </button>
          )}
        </div>
      }
    >
      {/* Job context */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-2">
          <label className="text-[11px] font-semibold text-slate-500 uppercase mb-1 block">Site</label>
          <select
            value={site}
            onChange={(e) => setSite(e.target.value)}
            disabled={watching}
            className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-slate-400 disabled:opacity-60"
          >
            {siteOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500 uppercase mb-1 block">Job type</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            disabled={watching}
            className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-slate-400 disabled:opacity-60"
          >
            {jobOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex flex-col text-[11px]">
          <span className="text-slate-500">Check interval</span>
          <span className="text-slate-900 font-semibold">Every {INTERVAL_MS / 1000}s</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Radio className={`w-[14px] h-[14px] ${watching ? "text-emerald-600" : "text-slate-400"}`} />
            <span className="text-[11px] font-medium text-slate-500 uppercase">Status</span>
          </div>
          <div className={`text-[16px] font-semibold ${watching ? "text-emerald-600" : "text-slate-700"}`}>
            {watching ? "Live monitoring" : "Idle"}
          </div>
          {lastCheckAt && (
            <div className="text-[10px] text-slate-400 mt-1">
              Last check {lastCheckAt.toLocaleTimeString()}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Frames analysed</div>
          <div className="text-[22px] font-semibold text-slate-900">{framesAnalysed}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Critical alerts</div>
          <div className="text-[22px] font-semibold text-rose-600">{criticalCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">High alerts</div>
          <div className="text-[22px] font-semibold text-orange-600">{highCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Live camera */}
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

          <div className={`relative bg-slate-900 aspect-video flex items-center justify-center transition-shadow ${
            highest !== "none" && watching ? `ring-4 ${severityStyles[highest]?.ring || ""} ring-inset` : ""
          }`}>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraOn ? "" : "hidden"}`}
            />
            {!cameraOn && (
              <div className="text-center p-6">
                <Camera className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <p className="text-[13px] text-slate-300 mb-3">Start the watch to enable continuous AI monitoring</p>
                <button
                  onClick={startWatch}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white text-[13px] font-medium transition-opacity"
                >
                  <Play className="w-[14px] h-[14px]" />
                  Start Camera & Watch
                </button>
              </div>
            )}

            {/* Overlay latest alert banner */}
            {watching && alerts.length > 0 && (
              <div className={`absolute top-3 left-3 right-3 rounded-lg backdrop-blur bg-slate-900/70 border ${severityStyles[alerts[0].severity]?.border} p-3 shadow-lg`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${severityStyles[alerts[0].severity]?.pill}`}>
                        {alerts[0].severity}
                      </span>
                      <span className="text-[10px] text-white/70">Latest</span>
                    </div>
                    <p className="text-[12px] text-white leading-snug">{alerts[0].alert}</p>
                    {alerts[0].recommendation && (
                      <p className="text-[11px] text-white/80 mt-0.5 italic">→ {alerts[0].recommendation}</p>
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

        {/* Alerts feed */}
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
                onClick={clearAlerts}
                className="text-[11px] text-slate-500 hover:text-slate-800 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[540px]">
            {alerts.length === 0 && (
              <div className="text-center py-10">
                {watching ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-[13px] font-medium text-slate-800">All clear</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      AI is watching every {INTERVAL_MS / 1000}s. Alerts appear here.
                    </p>
                  </>
                ) : (
                  <>
                    <BellOff className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-[13px] text-slate-500">Start the watch to receive alerts</p>
                  </>
                )}
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
                          onClick={() => dismissAlert(a.id)}
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
                    </div>
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

export default RiskWatchPage;
