// Native bridge — talks to Capacitor plugins when the app runs inside a
// native shell (iOS/Android). Falls back gracefully to Web APIs on desktop.

import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/**
 * Initialise native-only side effects (status bar, splash hide, haptics warm-up).
 * Safe to call on web — becomes a no-op.
 */
export async function initNative() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#6b21a8" });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    console.warn("[native] status bar init failed:", err);
  }
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    setTimeout(() => SplashScreen.hide().catch(() => {}), 700);
  } catch (err) {
    console.warn("[native] splash hide failed:", err);
  }
}

/** Take a photo using the native camera. Returns { dataUrl, format }. */
export async function nativeCameraTakePhoto({ quality = 75 } = {}) {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    quality,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    saveToGallery: false,
    correctOrientation: true,
  });
  return { dataUrl: photo.dataUrl, format: photo.format };
}

/** Light haptic tap on supported devices; no-op on web. */
export async function tapHaptic(style = "light") {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] || ImpactStyle.Light });
  } catch (err) {
    console.warn("[native] haptic failed:", err);
  }
}

/** Subscribe to network changes. Returns unsubscribe. Web uses the online/offline events. */
export async function subscribeNetwork(cb) {
  if (!isNative()) {
    const emit = () => cb({ connected: navigator.onLine, connectionType: "unknown" });
    window.addEventListener("online", emit);
    window.addEventListener("offline", emit);
    emit();
    return () => {
      window.removeEventListener("online", emit);
      window.removeEventListener("offline", emit);
    };
  }
  const { Network } = await import("@capacitor/network");
  const status = await Network.getStatus();
  cb({ connected: status.connected, connectionType: status.connectionType });
  const listener = await Network.addListener("networkStatusChange", (s) =>
    cb({ connected: s.connected, connectionType: s.connectionType })
  );
  return () => listener.remove();
}

/**
 * Register the device for push notifications. Only runs on native.
 * Returns the device token for backend registration, or null on web.
 */
export async function registerPush() {
  if (!isNative()) return null;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return null;
    await PushNotifications.register();
    return new Promise((resolve) => {
      PushNotifications.addListener("registration", (t) => resolve(t.value));
      PushNotifications.addListener("registrationError", () => resolve(null));
      setTimeout(() => resolve(null), 5000);
    });
  } catch (err) {
    console.warn("[native] push registration failed:", err);
    return null;
  }
}

/** Native key-value storage (falls back to localStorage on web). */
export const nativeStorage = {
  async get(key) {
    if (!isNative()) return localStorage.getItem(key);
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value;
  },
  async set(key, value) {
    if (!isNative()) return localStorage.setItem(key, value);
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  },
  async remove(key) {
    if (!isNative()) return localStorage.removeItem(key);
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
  },
};
