import React, { useEffect, useRef, useState } from "react";
import {
  Camera, Play, Square, Radio, Loader2,
  VolumeX, Volume2,
} from "lucide-react";
import axios from "axios";
import DashboardLayout from "./DashboardLayout";
import CameraFeedPanel from "./watch/CameraFeedPanel";
import AlertsFeedPanel from "./watch/AlertsFeedPanel";
import { useToast } from "../../hooks/use-toast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const siteOptions = [
  "Site A – Residential",
  "Site B – Commercial Rooftop",
  "Site C – Warehouse Array",
  "Site D – Villa",
  "Site E – School Rooftop",
];

const jobOptions = [
  "Rooftop PV Installation",
  "Commercial Array Mounting",
  "Battery Storage Wiring",
  "Warehouse Ballasted Array",
  "Inverter Commissioning",
];

const INTERVAL_MS = 8000;

const BEEP_FREQS = { critical: 880, high: 660, medium: 520, low: 440 };
const beepFrequency = (severity) => BEEP_FREQS[severity] || 520;

// Short beep using WebAudio
const playBeep = (severity) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = beepFrequency(severity);
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
  } catch (err) {
    console.warn("[risk-watch] beep failed:", err);
  }
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
          filed: false,
          filing: false,
        };
        // Persist to backend history
        try {
          const logRes = await axios.post(`${API}/watch/log`, {
            site,
            job_type: jobType,
            severity: d.severity,
            alert: d.alert,
            recommendation: d.recommendation || "",
            snapshot_b64: frame,
          });
          newAlert.serverId = logRes.data.id;
        } catch (logErr) {
          console.warn("[risk-watch] log persistence failed:", logErr?.message || logErr);
        }
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

  const fileHazard = async (a) => {
    if (!a.serverId) {
      toast({ title: "Not synced yet", description: "Alert wasn't logged to server. Try again in a moment.", variant: "destructive" });
      return;
    }
    setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, filing: true } : x)));
    try {
      const res = await axios.post(`${API}/hazards`, {
        site,
        hazard_type: a.alert.length > 60 ? a.alert.slice(0, 60) + "…" : a.alert,
        severity: a.severity,
        description: `${a.alert}${a.recommendation ? `\n\nRecommendation: ${a.recommendation}` : ""}`,
        snapshot_b64: a.snapshot,
        source: "watch",
        watch_alert_id: a.serverId,
      });
      setAlerts((prev) =>
        prev.map((x) =>
          x.id === a.id ? { ...x, filed: true, filing: false, hazardId: res.data.id } : x
        )
      );
      toast({ title: "Hazard filed", description: "Full record created with the snapshot attached." });
    } catch (err) {
      setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, filing: false } : x)));
      toast({
        title: "File failed",
        description: err.response?.data?.detail || err.message,
        variant: "destructive",
      });
    }
  };

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
        <CameraFeedPanel
          videoRef={videoRef}
          cameraOn={cameraOn}
          watching={watching}
          analysing={analysing}
          error={error}
          latestAlert={alerts[0] || null}
          onStart={startWatch}
        />
        <AlertsFeedPanel
          alerts={alerts}
          watching={watching}
          onDismiss={dismissAlert}
          onClearAll={clearAlerts}
          onFileHazard={fileHazard}
        />
      </div>
    </DashboardLayout>
  );
};

export default RiskWatchPage;
