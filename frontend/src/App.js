import "./App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import DashboardHome from "./components/dashboard/DashboardHome";
import SiteMapPage from "./components/dashboard/SiteMapPage";
import RiskAssessorPage from "./components/dashboard/RiskAssessorPage";
import RiskWatchPage from "./components/dashboard/RiskWatchPage";
import WatchHistoryPage from "./components/dashboard/WatchHistoryPage";
import ContactsPage from "./components/dashboard/ContactsPage";
import SettingsPage from "./components/dashboard/SettingsPage";
import AdminPage from "./components/dashboard/AdminPage";
import SWMSPage from "./components/dashboard/SWMSPage";
import HazardsPage from "./components/dashboard/HazardsPage";
import LOTOPage from "./components/dashboard/LOTOPage";
import CompliancePage from "./components/dashboard/CompliancePage";
import { Toaster } from "./components/ui/toaster";
import { SettingsProvider } from "./lib/settings";

function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }
    // Native mobile initialisation (Capacitor). No-op on web.
    import("./lib/native").then(({ initNative }) => initNative()).catch(() => {});
  }, []);

  return (
    <SettingsProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/dashboard/map" element={<SiteMapPage />} />
            <Route path="/dashboard/risk-ai" element={<RiskAssessorPage />} />
            <Route path="/dashboard/risk-watch" element={<RiskWatchPage />} />
            <Route path="/dashboard/watch-history" element={<WatchHistoryPage />} />
            <Route path="/dashboard/swms" element={<SWMSPage />} />
            <Route path="/dashboard/hazards" element={<HazardsPage />} />
            <Route path="/dashboard/loto" element={<LOTOPage />} />
            <Route path="/dashboard/compliance" element={<CompliancePage />} />
            <Route path="/dashboard/contacts" element={<ContactsPage />} />
            <Route path="/dashboard/settings" element={<SettingsPage />} />
            <Route path="/dashboard/admin" element={<AdminPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </div>
    </SettingsProvider>
  );
}

export default App;
