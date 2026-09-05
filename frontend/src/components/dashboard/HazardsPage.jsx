import React, { useState, useRef, useEffect } from "react";
import { ShieldAlert, Plus, AlertTriangle, CheckCircle2, Clock, Eye, Camera, ImagePlus, X, Trash2, Mic, MicOff, Sparkles, Loader2 } from "lucide-react";
import axios from "axios";
import DashboardLayout from "./DashboardLayout";
import { hazards as initialHazards } from "../../mock";
import { useToast } from "../../hooks/use-toast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
  const [site, setSite] = useState("Site A – Residential");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [hazards, setHazards] = useState(initialHazards);
  const [preview, setPreview] = useState(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [structuring, setStructuring] = useState(false);
  const [voiceUnsupported, setVoiceUnsupported] = useState(false);
  const recognitionRef = useRef(null);
  const fileRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceUnsupported(true);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript + " ";
      }
      setTranscript(text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = (err) => {
      console.warn("[voice-report] recognition error:", err?.error || err);
      setListening(false);
    };
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch (err) {
        console.warn("[voice-report] stop on unmount failed:", err);
      }
    };
  }, []);

  const toggleListening = () => {
    if (voiceUnsupported) {
      toast({ title: "Voice not supported", description: "Your browser does not support speech recognition. Try Chrome.", variant: "destructive" });
      return;
    }
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      try {
        rec.stop();
      } catch (err) {
        console.warn("[voice-report] stop failed:", err);
      }
      setListening(false);
    } else {
      setTranscript("");
      try {
        rec.start();
        setListening(true);
      } catch (err) {
        toast({ title: "Mic error", description: err.message, variant: "destructive" });
      }
    }
  };

  const structureFromVoice = async () => {
    if (!transcript.trim()) {
      toast({ title: "Nothing to transcribe", description: "Speak first, then run AI.", variant: "destructive" });
      return;
    }
    setStructuring(true);
    try {
      const res = await axios.post(`${API}/hazards/from-voice`, {
        transcript,
        site,
      });
      const d = res.data;
      setSite(d.site);
      setType(d.hazard_type);
      setSeverity(d.severity);
      setDescription(d.description);
      toast({ title: "AI structured your report", description: `Severity: ${d.severity.toUpperCase()}` });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      toast({ title: "AI parse failed", description: detail, variant: "destructive" });
    } finally {
      setStructuring(false);
    }
  };

  const counts = {
    critical: hazards.filter((h) => h.severity === "critical").length,
    high: hazards.filter((h) => h.severity === "high").length,
    open: hazards.filter((h) => h.status === "open").length,
    closed: hazards.filter((h) => h.status === "closed").length,
  };

  const openModal = () => {
    setShowForm(true);
    setSeverity("medium");
    setType("");
    setDescription("");
    setPhotos([]);
    setTranscript("");
    if (recognitionRef.current && listening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("[voice-report] stop on open failed:", err);
      }
    }
  };

  const handleFiles = (files) => {
    const list = Array.from(files || []);
    list.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotos((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random()}`, name: file.name, dataUrl: e.target.result },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const submit = (e) => {
    e.preventDefault();
    const newHazard = {
      id: `H-${2402 + hazards.length - initialHazards.length}`,
      site,
      type: type || "Uncategorised",
      severity,
      status: "open",
      reportedBy: "M. Weber",
      date: "just now",
      photos,
      description,
    };
    setHazards([newHazard, ...hazards]);
    setShowForm(false);
    toast({
      title: "Hazard reported",
      description: `${photos.length} photo${photos.length === 1 ? "" : "s"} attached. Supervisors notified.`,
    });
  };

  const removeHazard = (id) => {
    if (!window.confirm("Delete this hazard from your records?")) return;
    setHazards((prev) => prev.filter((h) => h.id !== id));
    toast({ title: "Hazard deleted" });
  };

  const clearAllHazards = () => {
    if (hazards.length === 0) return;
    if (!window.confirm(`Delete all ${hazards.length} hazards?`)) return;
    setHazards([]);
    toast({ title: "All hazards cleared" });
  };

  return (
    <DashboardLayout
      title="Hazard Reporting"
      subtitle="Real-time hazard capture from the field"
      action={
        <div className="flex items-center gap-2">
          {hazards.length > 0 && (
            <button
              onClick={clearAllHazards}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-600 text-slate-600 text-[13px] font-medium transition-colors"
            >
              <Trash2 className="w-[14px] h-[14px]" />
              Clear All
            </button>
          )}
          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-medium transition-colors"
          >
            <Plus className="w-[14px] h-[14px]" />
            Report Hazard
          </button>
        </div>
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
          const hasPhotos = h.photos && h.photos.length > 0;
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
                  {hasPhotos && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                      <Camera className="w-3 h-3" />
                      {h.photos.length}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-slate-500">
                  {h.site} · Reported by {h.reportedBy} · {h.date}
                </div>
                {hasPhotos && (
                  <div className="flex gap-2 mt-2">
                    {h.photos.slice(0, 4).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPreview(p.dataUrl)}
                        className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:border-slate-400 transition-colors"
                      >
                        <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${meta.cls} flex-shrink-0`}>
                <StatusIcon className="w-3 h-3" />
                {meta.label}
              </span>
              <button
                onClick={() => removeHazard(h.id)}
                className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-600 transition-colors flex-shrink-0"
                title="Delete hazard"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Report form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[560px] max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                  <ShieldAlert className="w-[18px] h-[18px] text-rose-600" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-slate-900">Report a Hazard</h3>
                  <p className="text-[12px] text-slate-500">Capture on-site risks with photos</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {/* Voice-to-report block */}
              <div className="p-3 rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-[12px] font-semibold text-slate-900">Voice-to-Report</span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={voiceUnsupported}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold transition-colors ${
                      listening
                        ? "bg-rose-600 hover:bg-rose-700 text-white"
                        : "bg-white border border-slate-200 hover:border-slate-300 text-slate-700"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {listening ? (
                      <><MicOff className="w-3.5 h-3.5" /> Stop</>
                    ) : (
                      <><Mic className="w-3.5 h-3.5" /> {voiceUnsupported ? "Not supported" : "Speak"}</>
                    )}
                  </button>
                </div>
                <div className="min-h-[52px] p-2 bg-white rounded-md border border-slate-200 text-[12px] text-slate-700 leading-relaxed">
                  {transcript || (
                    <span className="text-slate-400 italic">
                      {listening
                        ? "Listening… say something like: 'Exposed live conductor near junction box on the north side of the Hamburg warehouse, seems high risk.'"
                        : "Tap Speak and describe the hazard. AI will fill the form for you."}
                    </span>
                  )}
                  {listening && <span className="ml-1 inline-block w-1.5 h-3 bg-rose-500 animate-pulse align-middle" />}
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={structureFromVoice}
                    disabled={!transcript.trim() || structuring}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white text-[11px] font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {structuring ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Structuring…</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /> Fill form with AI</>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium text-slate-700 mb-1 block">Site</label>
                <select
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-slate-400"
                >
                  <option>Site A – Residential</option>
                  <option>Site B – Commercial Rooftop</option>
                  <option>Site C – Warehouse Array</option>
                  <option>Site D – Villa</option>
                  <option>Site E – School Rooftop</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-slate-700 mb-1 block">Hazard type</label>
                <input
                  type="text"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
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
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] resize-none outline-none focus:border-slate-400"
                  placeholder="What happened, immediate controls in place…"
                />
              </div>

              {/* Photo uploader */}
              <div>
                <label className="text-[12px] font-medium text-slate-700 mb-1 block">
                  On-site photos <span className="text-slate-400">({photos.length} attached)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="h-24 rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center gap-1 text-slate-500"
                  >
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-[11px] font-medium">Choose files</span>
                  </button>
                  <label
                    className="h-24 rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center gap-1 text-slate-500 cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[11px] font-medium">Take photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </label>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />

                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {photos.map((p) => (
                      <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
                        <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(p.id)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-rose-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>

            <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-medium transition-colors"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo preview lightbox */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 bg-slate-900/85 backdrop-blur z-[60] flex items-center justify-center px-6 py-6 cursor-zoom-out"
        >
          <img src={preview} alt="preview" className="max-w-full max-h-full rounded-xl shadow-2xl" />
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

export default HazardsPage;
