import React, { useMemo, useState } from "react";
import {
  MapPin, Phone, Mail, Building2, Globe, Search, Navigation,
  Sparkles, Send, Users, Newspaper, Headphones,
} from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import DashboardLayout from "./DashboardLayout";
import { officeLocations, contactChannels } from "../../data/locations";
import { useToast } from "../../hooks/use-toast";

const channelIcons = {
  sales: Sparkles,
  support: Headphones,
  press: Newspaper,
  careers: Users,
};

const regionColors = {
  North: "#0ea5e9",
  East: "#8b5cf6",
  West: "#f59e0b",
  Central: "#10b981",
  South: "#ef4444",
  International: "#64748b",
};

const ContactsPage = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All");
  const [form, setForm] = useState({ name: "", email: "", topic: "sales", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const regions = ["All", "North", "East", "West", "Central", "South", "International"];

  const filtered = useMemo(() => {
    return officeLocations
      .filter((o) => (region === "All" ? true : o.region === region))
      .filter((o) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          o.name.toLowerCase().includes(q) ||
          o.city.toLowerCase().includes(q) ||
          o.address.toLowerCase().includes(q)
        );
      });
  }, [query, region]);

  const submitForm = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast({ title: "Missing fields", description: "Name, email and message are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setForm({ name: "", email: "", topic: "sales", message: "" });
      toast({ title: "Message sent", description: "A team member will reply within 24h (demo)." });
    }, 900);
  };

  return (
    <DashboardLayout
      title="Contact & Locations"
      subtitle="80+ regional master craftsman teams — reach the one nearest you"
    >
      {/* Contact channels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {contactChannels.map((c) => {
          const Icon = channelIcons[c.key];
          return (
            <div key={c.key} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-brand-300 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-brand-700" />
              </div>
              <div className="text-[13px] font-semibold text-slate-900">{c.label}</div>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 leading-snug">{c.description}</p>
              <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-[11px] text-slate-700 hover:text-brand-700 truncate">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{c.email}</span>
              </a>
              <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-[11px] text-slate-700 hover:text-brand-700 mt-1">
                <Phone className="w-3 h-3 flex-shrink-0" />
                <span>{c.phone}</span>
              </a>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Map */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
              <Globe className="w-[16px] h-[16px] text-brand-700" />
              Locations Map
            </h3>
            <span className="text-[11px] text-slate-500">{officeLocations.length} offices</span>
          </div>
          <div className="h-[420px]">
            <MapContainer
              center={[51.1657, 10.4515]}
              zoom={6}
              scrollWheelZoom={true}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {officeLocations.map((o) => (
                <CircleMarker
                  key={o.id}
                  center={[o.lat, o.lng]}
                  radius={o.isHQ ? 14 : 10}
                  pathOptions={{
                    color: regionColors[o.region] || "#64748b",
                    fillColor: regionColors[o.region] || "#64748b",
                    fillOpacity: o.isHQ ? 0.75 : 0.55,
                    weight: o.isHQ ? 3 : 2,
                  }}
                >
                  <Tooltip direction="top">{o.name}</Tooltip>
                  <Popup>
                    <div style={{ minWidth: 200 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        {o.name}
                        {o.isHQ && <span style={{ marginLeft: 6, fontSize: 10, background: "#6b21a8", color: "white", padding: "1px 6px", borderRadius: 4 }}>HQ</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{o.role}</div>
                      <div style={{ fontSize: 11 }}>{o.address}</div>
                      <div style={{ fontSize: 11, marginBottom: 6 }}>{o.city}, {o.country}</div>
                      <a href={`tel:${o.phone.replace(/\s/g, "")}`} style={{ fontSize: 11, display: "block", color: "#6b21a8" }}>{o.phone}</a>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Contact form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-[14px] font-semibold text-slate-900 mb-1">Send us a message</h3>
          <p className="text-[11px] text-slate-500 mb-4">We reply within one business day.</p>
          <form onSubmit={submitForm} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-slate-600 uppercase mb-1 block">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-brand-500"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 uppercase mb-1 block">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-brand-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 uppercase mb-1 block">Topic</label>
              <select
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] bg-white outline-none focus:border-brand-500"
              >
                {contactChannels.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 uppercase mb-1 block">Message</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] resize-none outline-none focus:border-brand-500"
                placeholder="How can we help?"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-[13px] font-medium transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {submitting ? "Sending…" : (<><Send className="w-3.5 h-3.5" /> Send Message</>)}
            </button>
          </form>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 h-9 px-3 bg-slate-50 rounded-lg flex-1 min-w-[220px]">
          <Search className="w-[14px] h-[14px] text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, address…"
            className="bg-transparent border-none outline-none text-[13px] flex-1 min-w-0"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`h-9 px-3 rounded-lg text-[12px] font-medium border transition-colors ${
                region === r
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Office cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-10 text-slate-500 text-[13px]">
            No offices match your search.
          </div>
        )}
        {filtered.map((o) => (
          <div key={o.id} className="bg-white rounded-xl border border-slate-200 hover:border-brand-300 hover:shadow-sm transition-all p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${regionColors[o.region]}22`, color: regionColors[o.region] }}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-slate-900 truncate flex items-center gap-1.5">
                    {o.name}
                    {o.isHQ && (
                      <span className="text-[9px] font-bold bg-brand-700 text-white px-1.5 py-0.5 rounded">HQ</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{o.role}</div>
                </div>
              </div>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${regionColors[o.region]}22`, color: regionColors[o.region] }}>
                {o.region}
              </span>
            </div>
            <div className="text-[12px] text-slate-700 mb-1 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <span>{o.address}<br />{o.city}, {o.country}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
              <a href={`tel:${o.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-brand-700">
                <Phone className="w-3 h-3" /> {o.phone}
              </a>
              <a href={`mailto:${o.email}`} className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-brand-700 truncate">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{o.email}</span>
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-brand-700 hover:text-brand-800 font-medium mt-2"
              >
                <Navigation className="w-3 h-3" /> Directions
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Legal footer */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
        <div>© {new Date().getFullYear()} 1KOMMA5° · SolarSafe pro</div>
        <div className="flex items-center gap-4">
          <a href="#" onClick={(e) => { e.preventDefault(); toast({ title: "Privacy Policy" }); }} className="hover:text-slate-800">Privacy</a>
          <a href="#" onClick={(e) => { e.preventDefault(); toast({ title: "Terms of Service" }); }} className="hover:text-slate-800">Terms</a>
          <a href="#" onClick={(e) => { e.preventDefault(); toast({ title: "Imprint" }); }} className="hover:text-slate-800">Imprint</a>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ContactsPage;
