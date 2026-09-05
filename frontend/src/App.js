import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import DashboardHome from "./components/dashboard/DashboardHome";
import SiteMapPage from "./components/dashboard/SiteMapPage";
import RiskAssessorPage from "./components/dashboard/RiskAssessorPage";
import RiskWatchPage from "./components/dashboard/RiskWatchPage";
import WatchHistoryPage from "./components/dashboard/WatchHistoryPage";
import ContactsPage from "./components/dashboard/ContactsPage";
import SWMSPage from "./components/dashboard/SWMSPage";
import HazardsPage from "./components/dashboard/HazardsPage";
import LOTOPage from "./components/dashboard/LOTOPage";
import CompliancePage from "./components/dashboard/CompliancePage";
import { Toaster } from "./components/ui/toaster";

function App() {
  return (
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
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
