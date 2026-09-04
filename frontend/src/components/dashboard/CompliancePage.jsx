import React from "react";
import { ClipboardCheck, Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Download } from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { complianceDocs } from "../../mock";
import { useToast } from "../../hooks/use-toast";

const statusStyles = {
  valid: { label: "Valid", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  expiring: { label: "Expiring", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
  expired: { label: "Expired", cls: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle },
};

const CompliancePage = () => {
  const { toast } = useToast();

  const total = complianceDocs.length;
  const valid = complianceDocs.filter((d) => d.status === "valid").length;
  const expiring = complianceDocs.filter((d) => d.status === "expiring").length;
  const expired = complianceDocs.filter((d) => d.status === "expired").length;
  const rate = Math.round((valid / total) * 100);

  return (
    <DashboardLayout
      title="Compliance Documentation"
      subtitle="Certificates, training records & audit trail"
      action={
        <button
          onClick={() => toast({ title: "Upload started", description: "Drop your PDF to attach it (demo)." })}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium transition-colors"
        >
          <Upload className="w-[14px] h-[14px]" />
          Upload Document
        </button>
      }
    >
      {/* Header stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 md:col-span-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-2">Compliance Rate</div>
          <div className="flex items-end gap-2">
            <span className="text-[32px] font-semibold text-slate-900 leading-none">{rate}%</span>
            <span className="text-[11px] text-emerald-600 font-medium mb-1">Good</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${rate}%` }}
            />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-2">Valid Documents</div>
          <div className="text-[28px] font-semibold text-emerald-600 leading-none">{valid}</div>
          <div className="text-[11px] text-slate-500 mt-2">of {total} total</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-2">Expiring Soon</div>
          <div className="text-[28px] font-semibold text-amber-600 leading-none">{expiring}</div>
          <div className="text-[11px] text-slate-500 mt-2">Within 60 days</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-2">Expired</div>
          <div className="text-[28px] font-semibold text-rose-600 leading-none">{expired}</div>
          <div className="text-[11px] text-slate-500 mt-2">Action required</div>
        </div>
      </div>

      {/* Docs table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-[14px] font-semibold text-slate-900">Document Library</h3>
        </div>
        <div className="hidden md:grid grid-cols-[100px_1.5fr_1fr_120px_120px_120px_60px] gap-4 px-5 py-3 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
          <div>ID</div>
          <div>Document</div>
          <div>Site</div>
          <div>Type</div>
          <div>Status</div>
          <div>Expires</div>
          <div></div>
        </div>
        {complianceDocs.map((doc) => {
          const meta = statusStyles[doc.status];
          const StatusIcon = meta.icon;
          return (
            <div
              key={doc.id}
              className="grid grid-cols-1 md:grid-cols-[100px_1.5fr_1fr_120px_120px_120px_60px] gap-2 md:gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors items-center"
            >
              <div className="text-[12px] font-mono font-semibold text-slate-900">{doc.id}</div>
              <div className="flex items-center gap-2">
                <FileText className="w-[14px] h-[14px] text-slate-400 flex-shrink-0" />
                <span className="text-[13px] font-medium text-slate-900 truncate">{doc.name}</span>
              </div>
              <div className="text-[12px] text-slate-600 truncate">{doc.site}</div>
              <div className="text-[12px] text-slate-700">{doc.type}</div>
              <div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border ${meta.cls}`}>
                  <StatusIcon className="w-3 h-3" />
                  {meta.label}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">{doc.expires}</div>
              <div className="flex justify-end">
                <button
                  onClick={() => toast({ title: "Downloaded", description: `${doc.id} exported.` })}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <Download className="w-[14px] h-[14px]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

export default CompliancePage;
