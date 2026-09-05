import React, { useEffect, useRef, useState } from "react";
import {
  Camera, X, Play, Square, Loader2, ShieldAlert, ListChecks, HardHat, Eye,
  Sparkles, FileDown, RefreshCw, CheckCircle2, AlertTriangle, Send,
} from "lucide-react";
import axios from "axios";
import DashboardLayout from "./DashboardLayout";
import SignaturePad from "./SignaturePad";
import { useToast } from "../../hooks/use-toast";
import { exportSWMSPdf } from "../../lib/swmsPdf";

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

const riskColors = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
};

const StepDot = ({ active, done, num, label }) => (
  <div className="flex items-center gap-2">
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border-2 transition-colors ${
        done
          ? "bg-emerald-500 border-emerald-500 text-white"
          : active
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "bg-white border-slate-200 text-slate-400"
      }`}
    >
      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : num}
    </div>
    <span className={`text-[12px] font-medium ${active || done ? "text-slate-900" : "text-slate-400"}`}>
      {label}
    </span>
  </div>
);

const RiskAssessorPage = () => {
  const { toast } = useToast();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [snapshots, setSnapshots] = useState([]); // { id, dataUrl }
  const [site, setSite] = useState(siteOptions[0]);
  const [jobType, setJobType] = useState(jobOptions[0]);
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState("");
  const [supervisorSig, setSupervisorSig] = useState(null);
  const [crewSig, setCrewSig] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const capture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    // Downscale to keep payload small
    const maxSide = 900;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    setSnapshots((prev) => [...prev, { id: Date.now(), dataUrl }]);
  };

  const removeSnapshot = (id) => setSnapshots((prev) => prev.filter((s) => s.id !== id));

  const analyze = async () => {
    if (snapshots.length === 0) {
      toast({ title: "No photos", description: "Capture at least one photo first.", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    setError("");
    setAssessment(null);
    stopCamera();
    try {
      const res = await axios.post(`${API}/risk/assess`, {
        images: snapshots.map((s) => s.dataUrl),
        site,
        job_type: jobType,
        notes,
      }, { timeout: 60000 });
      setAssessment(res.data);
      toast({ title: "Assessment ready", description: `Risk: ${res.data.risk_level.toUpperCase()}` });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setError(detail);
      toast({ title: "Analysis failed", description: detail, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const resetAll = () => {
    stopCamera();
    setSnapshots([]);
    setAssessment(null);
    setSupervisorSig(null);
    setCrewSig(null);
    setNotes("");
    setError("");
  };

  const signAndSend = () => {
    if (!assessment) return;
    if (!supervisorSig && !crewSig) {
      toast({ title: "Signature required", description: "Please sign before sending.", variant: "destructive" });
      return;
    }
    const ref = exportSWMSPdf({
      site,
      jobType,
      notes,
      aiResult: {
        summary: assessment.summary,
        hazards: assessment.hazards,
        controls: assessment.controls,
        ppe: assessment.ppe,
      },
      signatures: {
        supervisor: supervisorSig,
        crew: crewSig,
        supervisorName: "M. Weber",
        crewName: "Site Crew",
      },
    });
    toast({
      title: "SWMS signed & sent",
      description: `${ref} exported and dispatched to your client.`,
    });
  };

  // Step tracking
  const step = assessment ? 3 : snapshots.length > 0 ? 2 : 1;

  return (
    <DashboardLayout
      title="AI Risk Assessor"
      subtitle="Point the camera, snap the site, let AI draft the SWMS"
      action={
        (snapshots.length > 0 || assessment) && (
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-[13px] font-medium transition-colors"
          >
            <RefreshCw className="w-[14px] h-[14px]" />
            Start Over
          </button>
        )
      }
    >
      {/* Steps header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap items-center gap-4">
        <StepDot num={1} label="Capture Site" active={step === 1} done={step > 1} />
        <div className="flex-1 h-px bg-slate-200 hidden sm:block min-w-[20px]" />
        <StepDot num={2} label="AI Analysis" active={step === 2} done={step > 2} />
        <div className="flex-1 h-px bg-slate-200 hidden sm:block min-w-[20px]" />
        <StepDot num={3} label="Sign & Send" active={step === 3} done={false} />
      </div>

      {/* Job context */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-[11px] font-semibold text-slate-500 uppercase mb-1 block">Site</label>
          <select
            value={site}
            onChange={(e) => setSite(e.target.value)}
            disabled={analyzing}
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
            disabled={analyzing}
            className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-slate-400 disabled:opacity-60"
          >
            {jobOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500 uppercase mb-1 block">Extra context <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={analyzing}
            placeholder="e.g. steep pitch, wet surface…"
            className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-slate-400 disabled:opacity-60"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Camera panel */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
              <Camera className="w-[16px] h-[16px] text-slate-600" />
              Site Camera
            </h3>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cameraOn ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
              {cameraOn ? "● Live" : "Off"}
            </span>
          </div>

          <div className="relative bg-slate-900 aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraOn ? "" : "hidden"}`}
            />
            {!cameraOn && (
              <div className="text-center p-6">
                <Camera className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <p className="text-[13px] text-slate-300 mb-3">Start the camera to capture site photos</p>
                <button
                  onClick={startCamera}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white text-[13px] font-medium transition-opacity"
                >
                  <Play className="w-[14px] h-[14px]" />
                  Start Camera
                </button>
              </div>
            )}
            {cameraOn && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <button
                  onClick={stopCamera}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white flex items-center justify-center transition-colors"
                  title="Stop"
                >
                  <Square className="w-4 h-4" />
                </button>
                <button
                  onClick={capture}
                  className="w-14 h-14 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center transition-colors ring-4 ring-white/30"
                  title="Capture"
                >
                  <div className="w-10 h-10 rounded-full bg-rose-500" />
                </button>
                <button
                  onClick={analyze}
                  disabled={snapshots.length === 0}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Analyze"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Snapshot strip */}
          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-slate-600 font-medium">
                Captured photos ({snapshots.length})
              </span>
              {snapshots.length > 0 && !assessment && (
                <button
                  onClick={analyze}
                  disabled={analyzing}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium transition-colors disabled:opacity-60"
                >
                  {analyzing ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Run AI Analysis</>
                  )}
                </button>
              )}
            </div>
            {snapshots.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">
                No photos yet. Tap the shutter button to capture.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {snapshots.map((s) => (
                  <div key={s.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
                    <img src={s.dataUrl} alt="snapshot" className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewImg(s.dataUrl)} />
                    <button
                      onClick={() => removeSnapshot(s.id)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-rose-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Analysis panel */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-[16px] h-[16px] text-indigo-600" />
              AI Risk Assessment
            </h3>
            {assessment && (
              <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full border ${riskColors[assessment.risk_level]}`}>
                {assessment.risk_level} risk
              </span>
            )}
          </div>

          <div className="flex-1 p-5 overflow-y-auto">
            {!assessment && !analyzing && !error && (
              <div className="text-center py-10 text-slate-400">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-[13px]">Capture photos, then run analysis.</p>
                <p className="text-[11px] mt-1">The AI will identify hazards, controls & PPE automatically.</p>
              </div>
            )}

            {analyzing && (
              <div className="text-center py-10 text-slate-500">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-600" />
                <p className="text-[13px] font-medium text-slate-800">Analysing site photos…</p>
                <p className="text-[11px] mt-1">GPT-4o Vision is inspecting each frame.</p>
              </div>
            )}

            {error && !analyzing && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[12px] text-rose-700 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            {assessment && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-semibold uppercase text-slate-500 mb-1">Summary</div>
                  <p className="text-[12px] text-slate-700 leading-relaxed">{assessment.summary}</p>
                </div>

                {assessment.observations?.length > 0 && (
                  <div>
                    <div className="text-[12px] font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                      <Eye className="w-[14px] h-[14px] text-slate-600" />
                      What AI observed
                    </div>
                    <ul className="space-y-1">
                      {assessment.observations.map((o, i) => (
                        <li key={i} className="text-[12px] text-slate-700 flex gap-2">
                          <span className="text-slate-400">›</span><span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <div className="text-[12px] font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-[14px] h-[14px] text-rose-600" />
                    Hazards
                  </div>
                  <ul className="space-y-1">
                    {assessment.hazards.map((h, i) => (
                      <li key={i} className="text-[12px] text-slate-700 flex gap-2">
                        <span className="text-rose-500">•</span><span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-[12px] font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                    <ListChecks className="w-[14px] h-[14px] text-emerald-600" />
                    Controls
                  </div>
                  <ul className="space-y-1">
                    {assessment.controls.map((c, i) => (
                      <li key={i} className="text-[12px] text-slate-700 flex gap-2">
                        <span className="text-emerald-500">✓</span><span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-[12px] font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                    <HardHat className="w-[14px] h-[14px] text-amber-600" />
                    Required PPE
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {assessment.ppe.map((p, i) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sign & Send section */}
      {assessment && (
        <div className="mt-5 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-[18px] h-[18px] text-emerald-600" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Review, Sign & Send</h3>
              <p className="text-[12px] text-slate-500">The AI has drafted your SWMS – sign to authorise and dispatch.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <SignaturePad label="Site Supervisor Signature" onChange={setSupervisorSig} />
            <SignaturePad label="Crew Member Signature" onChange={setCrewSig} />
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end pt-2 border-t border-slate-100">
            <button
              onClick={() => exportSWMSPdf({
                site, jobType, notes,
                aiResult: {
                  summary: assessment.summary,
                  hazards: assessment.hazards,
                  controls: assessment.controls,
                  ppe: assessment.ppe,
                },
                signatures: supervisorSig || crewSig ? {
                  supervisor: supervisorSig, crew: crewSig,
                  supervisorName: "M. Weber", crewName: "Site Crew",
                } : null,
              })}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-[13px] font-medium transition-colors"
            >
              <FileDown className="w-[14px] h-[14px]" />
              Download PDF
            </button>
            <button
              onClick={signAndSend}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium transition-colors"
            >
              <Send className="w-[14px] h-[14px]" />
              Sign & Send SWMS
            </button>
          </div>
        </div>
      )}

      {/* Photo preview */}
      {previewImg && (
        <div onClick={() => setPreviewImg(null)} className="fixed inset-0 bg-slate-900/85 backdrop-blur z-[60] flex items-center justify-center p-6 cursor-zoom-out">
          <img src={previewImg} alt="preview" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </DashboardLayout>
  );
};

export default RiskAssessorPage;
