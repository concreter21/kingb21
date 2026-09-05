import React, { createContext, useContext, useEffect, useState } from "react";
import safeStorage from "./safeStorage";

const KEY = "solarsafe_settings";
const ADMIN_TOKEN_KEY = "solarsafe_admin_token";

const defaultSettings = {
  darkMode: false,
  aiAssistantEnabled: true,
  defaultRecipientEmail: "",
  brandColor: "#6b21a8",
  logoText: "1K5°",
  appName: "SolarSafe pro",
};

const SettingsContext = createContext({
  settings: defaultSettings,
  update: () => {},
  reset: () => {},
  adminToken: null,
  setAdminToken: () => {},
});

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => ({
    ...defaultSettings,
    ...(safeStorage.getJSON(KEY) || {}),
  }));
  const [adminToken, setAdminTokenState] = useState(() => safeStorage.get(ADMIN_TOKEN_KEY));

  useEffect(() => {
    safeStorage.setJSON(KEY, settings);
    // Apply dark mode class
    const root = document.documentElement;
    if (settings.darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
    // Apply brand color as CSS variable
    root.style.setProperty("--brand-color", settings.brandColor);
  }, [settings]);

  const update = (patch) => setSettings((prev) => ({ ...prev, ...patch }));
  const reset = () => setSettings(defaultSettings);

  const setAdminToken = (t) => {
    setAdminTokenState(t);
    if (t) safeStorage.set(ADMIN_TOKEN_KEY, t);
    else safeStorage.remove(ADMIN_TOKEN_KEY);
  };

  return (
    <SettingsContext.Provider value={{ settings, update, reset, adminToken, setAdminToken }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
