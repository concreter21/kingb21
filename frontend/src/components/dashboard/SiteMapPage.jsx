import React, { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import DashboardLayout from "./DashboardLayout";
import { activeSites } from "../../mock";
import { MapPin, Users, TrendingUp } from "lucide-react";

const riskColors = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
};

const riskBg = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};

const GERMANY_CENTER = [51.1657, 10.4515];
const TOOLTIP_OFFSET = [0, -8];

const SiteMapPage = () => {
  const counts = {
    low: activeSites.filter((s) => s.risk === "low").length,
    medium: activeSites.filter((s) => s.risk === "medium").length,
    high: activeSites.filter((s) => s.risk === "high").length,
  };

  return (
    <DashboardLayout
      title="Live Site Map"
      subtitle="All active job sites with real-time risk indicators"
    >
      {/* Legend / summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 uppercase mb-1">Active Sites</div>
          <div className="text-[24px] font-semibold text-slate-900">{activeSites.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase">Low Risk</div>
            <div className="text-[20px] font-semibold text-slate-900">{counts.low}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-100" />
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase">Medium Risk</div>
            <div className="text-[20px] font-semibold text-slate-900">{counts.medium}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-rose-500 ring-4 ring-rose-100 animate-pulse" />
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase">High Risk</div>
            <div className="text-[20px] font-semibold text-slate-900">{counts.high}</div>
          </div>
        </div>
      </div>

      {/* Map + list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="h-[540px] w-full">
            <MapContainer
              center={GERMANY_CENTER}
              zoom={6}
              scrollWheelZoom={true}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {activeSites.map((s) => (
                <CircleMarker
                  key={s.id}
                  center={[s.lat, s.lng]}
                  radius={12}
                  pathOptions={{
                    color: riskColors[s.risk],
                    fillColor: riskColors[s.risk],
                    fillOpacity: 0.55,
                    weight: 3,
                  }}
                >
                  <Tooltip direction="top" offset={TOOLTIP_OFFSET}>
                    <span className="font-semibold">{s.name}</span>
                  </Tooltip>
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                        {s.type} · {s.city}
                      </div>
                      <div style={{ fontSize: 11 }}>Crew: {s.team} · Progress: {s.progress}%</div>
                      <div
                        style={{
                          marginTop: 6,
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 8,
                          fontSize: 10,
                          fontWeight: 600,
                          background: riskColors[s.risk] + "22",
                          color: riskColors[s.risk],
                          textTransform: "uppercase",
                        }}
                      >
                        {s.risk} risk
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-[14px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <MapPin className="w-[16px] h-[16px] text-slate-500" />
            All Sites
          </h3>
          <div className="space-y-2 max-h-[490px] overflow-y-auto">
            {activeSites.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: riskColors[s.risk] }}
                  />
                  <span className="text-[13px] font-semibold text-slate-900 truncate">{s.name}</span>
                </div>
                <div className="text-[11px] text-slate-500 ml-4.5 mb-2">
                  {s.type} · {s.city}
                </div>
                <div className="flex items-center gap-3 ml-4.5 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {s.team}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {s.progress}%
                  </span>
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full border ${riskBg[s.risk]}`}>
                    {s.risk}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SiteMapPage;
