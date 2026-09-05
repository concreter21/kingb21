// Fresh start — no seed data. Users create their own records.
export const currentUser = {
  name: "Site Supervisor",
  role: "Supervisor",
  initials: "SS",
  company: "SolarSafe pro",
};

// Empty by default — populated by users at runtime
export const kpiStats = [
  { key: "active_jobs", label: "Active Jobs", value: 0, delta: "—", trend: "up", helper: "This week" },
  { key: "swms_pending", label: "SWMS Pending", value: 0, delta: "—", trend: "up", helper: "Awaiting review" },
  { key: "open_hazards", label: "Open Hazards", value: 0, delta: "—", trend: "up", helper: "Critical: 0" },
  { key: "compliance", label: "Compliance Rate", value: "—", delta: "—", trend: "up", helper: "30-day avg" },
];

export const activeSites = [];
export const energyProduction = [
  { day: "Mon", solar: 0, battery: 0 },
  { day: "Tue", solar: 0, battery: 0 },
  { day: "Wed", solar: 0, battery: 0 },
  { day: "Thu", solar: 0, battery: 0 },
  { day: "Fri", solar: 0, battery: 0 },
  { day: "Sat", solar: 0, battery: 0 },
  { day: "Sun", solar: 0, battery: 0 },
];
export const batteryStatus = {
  level: 0,
  capacity: "— kWh",
  status: "Standby",
  health: 100,
  cycles: 0,
  temperature: "—",
};
export const systemStatus = {
  inverter: "offline",
  battery: "offline",
  grid: "disconnected",
  monitoring: "offline",
  lastSync: "never",
};

export const hazards = [];
export const swmsList = [];
export const lotoLogs = [];
export const complianceDocs = [];
export const activityFeed = [];

export const APP_NAME = "SolarSafe pro";
export const APP_SUBTITLE = "Sign in to continue";

export const socialProviders = [
  { id: "google", label: "Continue with Google" },
  { id: "microsoft", label: "Continue with Microsoft" },
  { id: "facebook", label: "Continue with Facebook" },
  { id: "apple", label: "Continue with Apple" },
];

// Generic English site placeholders for the AI Risk Assessor / Risk Watch dropdowns
export const defaultSiteOptions = [
  "Site A – Residential",
  "Site B – Commercial Rooftop",
  "Site C – Warehouse Array",
  "Site D – Villa",
  "Site E – School Rooftop",
];

export const defaultJobOptions = [
  "Rooftop PV Installation",
  "Commercial Array Mounting",
  "Battery Storage Wiring",
  "Warehouse Ballasted Array",
  "Inverter Commissioning",
];
