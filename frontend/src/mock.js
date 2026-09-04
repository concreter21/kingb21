// Mock data for SolarSafe pro Dashboard
export const currentUser = {
  name: "Marcus Weber",
  role: "Site Supervisor",
  initials: "MW",
  company: "1Komma5° Berlin",
};

export const kpiStats = [
  { key: "active_jobs", label: "Active Jobs", value: 12, delta: "+2", trend: "up", helper: "This week" },
  { key: "swms_pending", label: "SWMS Pending", value: 4, delta: "-1", trend: "down", helper: "Awaiting review" },
  { key: "open_hazards", label: "Open Hazards", value: 7, delta: "+3", trend: "up", helper: "Critical: 2" },
  { key: "compliance", label: "Compliance Rate", value: "94%", delta: "+1.2%", trend: "up", helper: "30-day avg" },
];

export const activeSites = [
  { id: "s1", name: "Residential – Prenzlauer Berg", team: 4, progress: 78, risk: "low", type: "Domestic", city: "Berlin", lat: 52.5401, lng: 13.4247 },
  { id: "s2", name: "Commercial Roof – Siemensstadt", team: 8, progress: 45, risk: "medium", type: "Commercial", city: "Berlin", lat: 52.5411, lng: 13.2617 },
  { id: "s3", name: "Warehouse Array – Hamburg Hafen", team: 6, progress: 62, risk: "high", type: "Commercial", city: "Hamburg", lat: 53.5411, lng: 9.9770 },
  { id: "s4", name: "Villa – Grunewald", team: 3, progress: 91, risk: "low", type: "Domestic", city: "Berlin", lat: 52.4839, lng: 13.2620 },
  { id: "s5", name: "School Rooftop – Munich Nord", team: 5, progress: 34, risk: "medium", type: "Commercial", city: "Munich", lat: 48.1937, lng: 11.5678 },
];

export const energyProduction = [
  { day: "Mon", solar: 320, battery: 180 },
  { day: "Tue", solar: 410, battery: 220 },
  { day: "Wed", solar: 380, battery: 200 },
  { day: "Thu", solar: 490, battery: 260 },
  { day: "Fri", solar: 520, battery: 290 },
  { day: "Sat", solar: 460, battery: 240 },
  { day: "Sun", solar: 435, battery: 225 },
];

export const batteryStatus = {
  level: 78,
  capacity: "12.4 kWh",
  status: "Discharging",
  health: 96,
  cycles: 342,
  temperature: "24°C",
};

export const systemStatus = {
  inverter: "online",
  battery: "online",
  grid: "connected",
  monitoring: "online",
  lastSync: "2 min ago",
};

export const hazards = [
  { id: "H-2401", site: "Warehouse Array – Hamburg Hafen", type: "Electrical", severity: "critical", status: "open", reportedBy: "T. Klein", date: "2h ago" },
  { id: "H-2400", site: "Commercial Roof – Siemensstadt", type: "Working at Heights", severity: "high", status: "in_review", reportedBy: "A. Novak", date: "5h ago" },
  { id: "H-2399", site: "Warehouse Array – Hamburg Hafen", type: "Weather", severity: "medium", status: "mitigated", reportedBy: "M. Weber", date: "1d ago" },
  { id: "H-2398", site: "Residential – Prenzlauer Berg", type: "Manual Handling", severity: "low", status: "closed", reportedBy: "S. Bauer", date: "2d ago" },
  { id: "H-2397", site: "School Rooftop – Munich Nord", type: "Fall Protection", severity: "high", status: "open", reportedBy: "J. Müller", date: "2d ago" },
];

export const swmsList = [
  { id: "SWMS-0142", title: "Rooftop PV Installation – 8kW Domestic", site: "Villa – Grunewald", status: "approved", updated: "Today", author: "M. Weber" },
  { id: "SWMS-0141", title: "Commercial Array Mounting – 150kW", site: "Commercial Roof – Siemensstadt", status: "pending", updated: "Yesterday", author: "A. Novak" },
  { id: "SWMS-0140", title: "Battery Storage Wiring – LFP 12.4kWh", site: "Residential – Prenzlauer Berg", status: "approved", updated: "2d ago", author: "M. Weber" },
  { id: "SWMS-0139", title: "Warehouse Ballasted Array – 400kW", site: "Warehouse Array – Hamburg Hafen", status: "draft", updated: "3d ago", author: "T. Klein" },
  { id: "SWMS-0138", title: "Inverter Commissioning – Fronius Symo", site: "School Rooftop – Munich Nord", status: "pending", updated: "4d ago", author: "S. Bauer" },
];

export const lotoLogs = [
  { id: "LOTO-881", asset: "Main Isolator – DB-A2", site: "Warehouse Array – Hamburg Hafen", status: "locked", by: "T. Klein", time: "09:14" },
  { id: "LOTO-880", asset: "DC Combiner Box 3", site: "Commercial Roof – Siemensstadt", status: "locked", by: "A. Novak", time: "08:47" },
  { id: "LOTO-879", asset: "Rooftop Isolator RS-1", site: "Villa – Grunewald", status: "released", by: "M. Weber", time: "Yesterday" },
  { id: "LOTO-878", asset: "Battery Disconnect – LFP-1", site: "Residential – Prenzlauer Berg", status: "released", by: "S. Bauer", time: "Yesterday" },
  { id: "LOTO-877", asset: "Grid Isolator – Main", site: "School Rooftop – Munich Nord", status: "locked", by: "J. Müller", time: "2d ago" },
];

export const complianceDocs = [
  { id: "DOC-201", name: "AS/NZS 5033 Compliance Certificate", site: "Villa – Grunewald", type: "Certificate", status: "valid", expires: "2027-04-12" },
  { id: "DOC-200", name: "Electrical Safety Certificate", site: "Residential – Prenzlauer Berg", type: "Certificate", status: "valid", expires: "2026-11-30" },
  { id: "DOC-199", name: "Working at Heights Training – Team A", site: "All Sites", type: "Training", status: "expiring", expires: "2026-01-15" },
  { id: "DOC-198", name: "Risk Assessment – Commercial 150kW", site: "Commercial Roof – Siemensstadt", type: "Assessment", status: "valid", expires: "2026-08-22" },
  { id: "DOC-197", name: "Insurance Certificate – Public Liability", site: "All Sites", type: "Insurance", status: "expired", expires: "2025-12-01" },
];

export const activityFeed = [
  { id: 1, actor: "T. Klein", action: "reported a critical hazard at", target: "Hamburg Hafen", time: "2h ago", type: "hazard" },
  { id: 2, actor: "A. Novak", action: "submitted SWMS-0141 for review", target: "Siemensstadt", time: "3h ago", type: "swms" },
  { id: 3, actor: "M. Weber", action: "locked out DC Combiner Box 3", target: "Siemensstadt", time: "5h ago", type: "loto" },
  { id: 4, actor: "S. Bauer", action: "approved compliance doc DOC-198", target: "Siemensstadt", time: "6h ago", type: "compliance" },
  { id: 5, actor: "J. Müller", action: "closed hazard H-2398", target: "Prenzlauer Berg", time: "1d ago", type: "hazard" },
];

export const APP_NAME = "1Komma5° SolarSafe pro";
export const APP_SUBTITLE = "Sign in to continue";

export const socialProviders = [
  { id: "google", label: "Continue with Google" },
  { id: "microsoft", label: "Continue with Microsoft" },
  { id: "facebook", label: "Continue with Facebook" },
  { id: "apple", label: "Continue with Apple" },
];
