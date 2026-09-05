import React, { useState } from "react";
import { FileText, Plus, Search, Download, CheckCircle2, Clock, FileEdit, Sparkles, HardHat, ShieldAlert, ListChecks, X, FileDown, Trash2 } from "lucide-react";
import axios from "axios";
import DashboardLayout from "./DashboardLayout";
import { swmsList } from "../../mock";
import { useToast } from "../../hooks/use-toast";
import { exportSWMSPdf } from "../../lib/swmsPdf";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusMeta = {
  approved: { icon: CheckCircle2, label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { icon: Clock, label: "Pending Review", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  draft: { icon: FileEdit, label: "Draft", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

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

const SWMSPage = () => {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [site, setSite] = useState(siteOptions[0]);
  const [jobType, setJobType] = useState(jobOptions[0]);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");
  const [model, setModel] = useState("openai");
  const [items, setItems] = useState(swmsList);
  const { toast } = useToast();

  const filtered = items
    .filter((s) => (filter === "all" ? true : s.status === filter))
    .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()) || s.id.toLowerCase().includes(query.toLowerCase()));

  const counts = {
    all: items.length,
    approved: items.filter((s) => s.status === "approved").length,
    pending: items.filter((s) => s.status === "pending").length,
    draft: items.filter((s) => s.status === "draft").length,
  };

  const removeItem = (id) => {
    if (!window.confirm("Delete this SWMS from your library?")) return;
    setItems((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "SWMS deleted" });
  };

  const clearAll = () => {
    if (items.length === 0) return;
    if (!window.confirm(`Delete all ${items.length} SWMS entries?`)) return;
    setItems([]);
    toast({ title: "All SWMS cleared" });
  };

  const openModal = () => {
    setShowModal(true);
    setAiResult(null);
    setAiError("");
    setNotes("");
  };

  const closeModal = () => {
    setShowModal(false);
    setAiResult(null);
    setGenerating(false);
    setAiError("");
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setAiError("");
    setAiResult(null);
    try {
      const res = await axios.post(`${API}/swms/generate`, {
        site,
        job_type: jobType,
        notes,
        model_provider: model,
      });
      setAiResult(res.data);
      toast({ title: "SWMS drafted", description: "AI generated hazards, controls & PPE." });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setAiError(detail);
      toast({ title: "Generation failed", description: detail, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = () => {
    toast({ title: "Draft saved", description: "SWMS saved to your library." });
    closeModal();
  };

  const handleExportPdf = () => {
    if (!aiResult) return;
    try {
      const ref = exportSWMSPdf({ site, jobType, notes, aiResult });
      toast({ title: "PDF exported", description: `${ref} downloaded successfully.` });
    } catch (err) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout
      title="Safe Work Method Statements"
      subtitle="AI-assisted SWMS generation & approval workflow"
      action={
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-600 text-slate-600 text-[13px] font-medium transition-colors"
            >
              <Trash2 className="w-[14px] h-[14px]" />
              Clear All
            </button>
          )}
          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium transition-colors"
          >
            <Sparkles className="w-[14px] h-[14px]" />
            Generate with AI
          </button>
        </div>
      }
    >
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {[
          { key: "all", label: "All" },
          { key: "approved", label: "Approved" },
          { key: "pending", label: "Pending" },
          { key: "draft", label: "Draft" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`h-8 px-3 rounded-lg text-[12px] font-medium transition-colors ${
              filter === tab.key
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {tab.label} <span className="opacity-70">({counts[tab.key]})</span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2 h-9 px-3 bg-white border border-slate-200 rounded-lg w-[280px] max-w-full">
          <Search className="w-[14px] h-[14px] text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-[13px] flex-1 min-w-0"
            placeholder="Search SWMS…"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-[110px_1fr_200px_140px_100px_60px] gap-4 px-5 py-3 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          <div>ID</div>
          <div>Title</div>
          <div>Site</div>
          <div>Status</div>
          <div>Updated</div>
          <div></div>
        </div>
        {filtered.length === 0 && (
          <div className="p-10 text-center text-[13px] text-slate-500">No SWMS matching filters.</div>
        )}
        {filtered.map((swms) => {
          const meta = statusMeta[swms.status];
          const StatusIcon = meta.icon;
          return (
            <div
              key={swms.id}
              className="grid grid-cols-1 md:grid-cols-[110px_1fr_200px_140px_100px_60px] gap-2 md:gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors items-center"
            >
              <div className="text-[12px] font-mono font-semibold text-slate-900">{swms.id}</div>
              <div>
                <div className="text-[13px] font-medium text-slate-900">{swms.title}</div>
                <div className="text-[11px] text-slate-500">by {swms.author}</div>
              </div>
              <div className="text-[12px] text-slate-600 truncate">{swms.site}</div>
              <div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border ${meta.cls}`}>
                  <StatusIcon className="w-3 h-3" />
                  {meta.label}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">{swms.updated}</div>
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => {
                    try {
                      const ref = exportSWMSPdf({
                        site: swms.site,
                        jobType: swms.title,
                        notes: "",
                        author: swms.author,
                        aiResult: {
                          summary: `${swms.title} for site ${swms.site}. Review before use.`,
                          hazards: ["Working at heights", "Electrical shock", "Manual handling", "Weather exposure"],
                          controls: ["Fall-arrest harness with rated anchor", "Isolate & lock out DC before work", "Two-person lift for modules", "Monitor weather; stop above 40km/h wind"],
                          ppe: ["Hard hat", "Safety glasses", "Insulated gloves", "Safety boots", "Hi-vis vest"],
                        },
                      });
                      toast({ title: "PDF exported", description: `${ref} downloaded.` });
                    } catch (e) {
                      toast({ title: "Export failed", description: e.message, variant: "destructive" });
                    }
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                  title="Download PDF"
                >
                  <Download className="w-[14px] h-[14px]" />
                </button>
                <button
                  onClick={() => removeItem(swms.id)}
                  className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-[14px] h-[14px]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[640px] max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-slate-900">AI-Generated SWMS</h3>
                  <p className="text-[12px] text-slate-500">Auto-fill hazards, controls & PPE using GPT</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <form onSubmit={handleGenerate} className="space-y-3">
                <div>
                  <label className="text-[12px] font-medium text-slate-700 mb-1 block">Site</label>
                  <select
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-slate-400"
                  >
                    {siteOptions.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-slate-700 mb-1 block">Job Type</label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-slate-400"
                  >
                    {jobOptions.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-slate-700 mb-1 block">
                    Site-specific notes <span className="text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] resize-none outline-none focus:border-slate-400"
                    placeholder="e.g. steep pitch roof, adjacent live overhead line…"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-slate-700 mb-1 block">AI model</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "openai", label: "GPT-4o", sub: "OpenAI" },
                      { id: "gemini", label: "Gemini", sub: "Google" },
                      { id: "anthropic", label: "Claude", sub: "Anthropic" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModel(m.id)}
                        className={`h-14 rounded-lg border text-left px-3 transition-colors ${
                          model === m.id
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="text-[12px] font-semibold leading-tight">{m.label}</div>
                        <div className={`text-[10px] ${model === m.id ? "text-white/70" : "text-slate-500"}`}>{m.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={generating}
                  className="w-full h-10 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-[13px] font-medium transition-opacity disabled:opacity-70 inline-flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-[14px] h-[14px]" />
                      Generate with GPT
                    </>
                  )}
                </button>
              </form>

              {aiError && (
                <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-[12px] text-rose-700">
                  {aiError}
                </div>
              )}

              {aiResult && (
                <div className="mt-5 space-y-4">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-semibold uppercase text-slate-500 mb-1">Summary</div>
                    <p className="text-[12px] text-slate-700 leading-relaxed">{aiResult.summary}</p>
                  </div>

                  <div>
                    <div className="text-[12px] font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                      <ShieldAlert className="w-[14px] h-[14px] text-rose-600" />
                      Identified Hazards
                    </div>
                    <ul className="space-y-1.5">
                      {aiResult.hazards?.map((h, i) => (
                        <li key={i} className="text-[12px] text-slate-700 flex gap-2">
                          <span className="text-rose-500">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-[12px] font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                      <ListChecks className="w-[14px] h-[14px] text-emerald-600" />
                      Control Measures
                    </div>
                    <ul className="space-y-1.5">
                      {aiResult.controls?.map((c, i) => (
                        <li key={i} className="text-[12px] text-slate-700 flex gap-2">
                          <span className="text-emerald-500">✓</span>
                          <span>{c}</span>
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
                      {aiResult.ppe?.map((p, i) => (
                        <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={closeModal}
                className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={!aiResult}
                className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                <FileDown className="w-[14px] h-[14px]" />
                Export PDF
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={!aiResult}
                className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SWMSPage;
