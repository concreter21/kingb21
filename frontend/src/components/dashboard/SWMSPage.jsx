import React, { useState } from "react";
import { FileText, Plus, Search, Filter, Download, CheckCircle2, Clock, FileEdit } from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { swmsList } from "../../mock";
import { useToast } from "../../hooks/use-toast";

const statusMeta = {
  approved: { icon: CheckCircle2, label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { icon: Clock, label: "Pending Review", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  draft: { icon: FileEdit, label: "Draft", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

const SWMSPage = () => {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();

  const filtered = swmsList
    .filter((s) => (filter === "all" ? true : s.status === filter))
    .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()) || s.id.toLowerCase().includes(query.toLowerCase()));

  const counts = {
    all: swmsList.length,
    approved: swmsList.filter((s) => s.status === "approved").length,
    pending: swmsList.filter((s) => s.status === "pending").length,
    draft: swmsList.filter((s) => s.status === "draft").length,
  };

  return (
    <DashboardLayout
      title="Safe Work Method Statements"
      subtitle="Automated SWMS generation & approval workflow"
      action={
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium transition-colors"
        >
          <Plus className="w-[14px] h-[14px]" />
          Generate SWMS
        </button>
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
              <div className="flex justify-end">
                <button
                  onClick={() => toast({ title: "Downloaded", description: `${swms.id} PDF exported.` })}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                  title="Download PDF"
                >
                  <Download className="w-[14px] h-[14px]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[540px] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <FileText className="w-[18px] h-[18px] text-indigo-600" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900">Generate SWMS</h3>
                <p className="text-[12px] text-slate-500">AI-assisted based on job type & site risk</p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowModal(false);
                toast({ title: "SWMS generated", description: "Draft created and ready for review." });
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[12px] font-medium text-slate-700 mb-1 block">Site</label>
                <select className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-slate-400">
                  <option>Villa – Grunewald</option>
                  <option>Commercial Roof – Siemensstadt</option>
                  <option>Warehouse Array – Hamburg Hafen</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-slate-700 mb-1 block">Job Type</label>
                <select className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-slate-400">
                  <option>Rooftop PV Installation</option>
                  <option>Battery Storage Wiring</option>
                  <option>Inverter Commissioning</option>
                  <option>Warehouse Ballasted Array</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-slate-700 mb-1 block">Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] resize-none outline-none focus:border-slate-400"
                  placeholder="Specific hazards, PPE requirements…"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium transition-colors"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SWMSPage;
