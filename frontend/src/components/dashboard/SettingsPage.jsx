import React, { useState } from "react";
import {
  Sun, Moon, Bot, Mail, Palette, Type, Shield, Info, BookOpen,
  Smartphone, Copy, ExternalLink, Check, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import { useSettings } from "../../lib/settings";
import { useToast } from "../../hooks/use-toast";
import { isNative, platform } from "../../lib/native";

const BRAND_PRESETS = [
  { color: "#6b21a8", name: "Violet" },
  { color: "#2563eb", name: "Blue" },
  { color: "#059669", name: "Emerald" },
  { color: "#dc2626", name: "Red" },
  { color: "#ea580c", name: "Orange" },
  { color: "#0f172a", name: "Slate" },
];

const Row = ({ icon: Icon, title, description, children }) => (
  <div className="flex items-start gap-3 p-4 border-b border-slate-100 last:border-0">
    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4 text-slate-600" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[13px] font-semibold text-slate-900">{title}</div>
      {description && <div className="text-[11px] text-slate-500 mt-0.5">{description}</div>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`w-10 h-6 rounded-full transition-colors relative ${
      checked ? "bg-brand-700" : "bg-slate-300"
    }`}
  >
    <span
      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        checked ? "translate-x-4" : "translate-x-0.5"
      }`}
    />
  </button>
);

const SectionCard = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
      <h3 className="text-[12px] font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
    </div>
    {children}
  </div>
);

const SettingsPage = () => {
  const { settings, update, reset } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const apiUrl = `${process.env.REACT_APP_BACKEND_URL}/api`;

  const copyApiUrl = async () => {
    try {
      await navigator.clipboard.writeText(apiUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast({ title: "Copy failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout title="Settings" subtitle="App preferences, integrations & admin access">
      <div className="max-w-3xl space-y-5">
        {/* Appearance */}
        <SectionCard title="Appearance">
          <Row
            icon={settings.darkMode ? Moon : Sun}
            title="Dark mode"
            description="Reduce eye strain in low light."
          >
            <Toggle checked={settings.darkMode} onChange={(v) => update({ darkMode: v })} />
          </Row>
          <Row icon={Palette} title="Brand color" description="Applied across buttons, badges and highlights.">
            <div className="flex items-center gap-1.5">
              {BRAND_PRESETS.map((p) => (
                <button
                  key={p.color}
                  onClick={() => update({ brandColor: p.color })}
                  className={`w-6 h-6 rounded-full ring-2 transition-all ${
                    settings.brandColor === p.color ? "ring-slate-900 scale-110" : "ring-transparent hover:ring-slate-300"
                  }`}
                  style={{ backgroundColor: p.color }}
                  title={p.name}
                />
              ))}
            </div>
          </Row>
          <Row icon={Type} title="Logo text" description="Small text shown inside the round logo.">
            <input
              type="text"
              maxLength={5}
              value={settings.logoText}
              onChange={(e) => update({ logoText: e.target.value })}
              className="w-20 h-9 px-2 border border-slate-200 rounded-lg text-[13px] text-center outline-none focus:border-slate-400"
            />
          </Row>
          <Row icon={Type} title="App name" description="Shown in the sidebar and page titles.">
            <input
              type="text"
              value={settings.appName}
              onChange={(e) => update({ appName: e.target.value })}
              className="w-48 h-9 px-3 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-slate-400"
            />
          </Row>
        </SectionCard>

        {/* Features */}
        <SectionCard title="Features">
          <Row
            icon={Bot}
            title="AI Assistant"
            description="Enable the floating chat widget on every dashboard page."
          >
            <Toggle
              checked={settings.aiAssistantEnabled}
              onChange={(v) => update({ aiAssistantEnabled: v })}
            />
          </Row>
          <Row
            icon={Mail}
            title="Default recipient email"
            description="Address auto-filled when exporting or sending SWMS."
          >
            <input
              type="email"
              value={settings.defaultRecipientEmail}
              onChange={(e) => update({ defaultRecipientEmail: e.target.value })}
              placeholder="client@example.com"
              className="w-56 h-9 px-3 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-slate-400"
            />
          </Row>
        </SectionCard>

        {/* Info */}
        <SectionCard title="Information">
          <Row icon={BookOpen} title="API Documentation" description="OpenAPI/Swagger UI for backend endpoints.">
            <a
              href={`${process.env.REACT_APP_BACKEND_URL}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-800"
            >
              Open <ExternalLink className="w-3 h-3" />
            </a>
          </Row>
          <div className="flex items-start gap-3 p-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-slate-900">API Base URL</div>
              <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">{apiUrl}</div>
            </div>
            <button
              onClick={copyApiUrl}
              className="h-8 px-2.5 rounded-lg border border-slate-200 hover:border-slate-300 text-[11px] font-medium text-slate-700 inline-flex items-center gap-1"
            >
              {copied ? <><Check className="w-3 h-3 text-emerald-600" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <Row icon={Smartphone} title="Install on device" description="Add SolarSafe pro to your home screen.">
            <span className="text-[11px] text-slate-500">iOS: Share → Add to Home Screen. Android: Chrome menu → Install app.</span>
          </Row>
          <Row icon={Info} title="Runtime" description={isNative() ? `Native mobile app · ${platform()}` : "Progressive web app · browser"}>
            <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${isNative() ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {isNative() ? platform() : "web"}
            </span>
          </Row>
        </SectionCard>

        {/* Admin gate */}
        <SectionCard title="Administration">
          <button
            onClick={() => navigate("/dashboard/admin")}
            className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-brand-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-slate-900">Admin panel</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Manage users, review deleted records, view unfiled camera footage, customise branding. 2FA required.
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </SectionCard>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => { reset(); toast({ title: "Settings reset to defaults" }); }}
            className="h-9 px-3.5 rounded-lg bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-600 text-slate-600 text-[13px] font-medium transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
