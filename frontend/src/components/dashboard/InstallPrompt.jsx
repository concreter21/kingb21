import React, { useEffect, useState } from "react";
import { Download, Share, Plus, X, Smartphone, Sparkles } from "lucide-react";
import safeStorage from "../../lib/safeStorage";

const DISMISS_KEY = "solarsafe_install_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const BANNER_DELAY_MS = 2000;
const IOS_DELAY_MS = 3000;

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const detectPlatform = () => {
  const ua = window.navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return { isIOS, isAndroid, isSafari };
};

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [platform] = useState(() => detectPlatform());
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    // Check dismiss cooldown
    const dismissedAt = parseInt(safeStorage.get(DISMISS_KEY) || "0", 10);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    // Android / Chrome / Edge — use beforeinstallprompt
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Delay so it doesn't block first paint
      setTimeout(() => setVisible(true), BANNER_DELAY_MS);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS — no native prompt, show manual guide after a delay
    if (platform.isIOS && platform.isSafari) {
      setTimeout(() => setVisible(true), IOS_DELAY_MS);
    }

    // Hide when installed
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [platform.isIOS, platform.isSafari]);

  const install = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setVisible(false);
        }
      } catch (err) {
        console.warn("[install-prompt] user prompt failed:", err);
      }
      setDeferredPrompt(null);
    } else if (platform.isIOS) {
      setShowIOSGuide(true);
    }
  };

  const dismiss = () => {
    safeStorage.set(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setShowIOSGuide(false);
  };

  if (!visible && !showIOSGuide) return null;

  return (
    <>
      {/* Compact install banner */}
      {visible && !showIOSGuide && (
        <div className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-24 z-40 md:max-w-[380px] animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 flex gap-3">
              <div className="w-11 h-11 rounded-xl bg-brand-700 flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_-2px_rgba(107,33,168,0.55)]">
                <span className="text-white font-bold text-[13px] tracking-tight leading-none">
                  1K5°
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
                  Install SolarSafe pro
                  <Sparkles className="w-3 h-3 text-brand-600" />
                </div>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                  {platform.isIOS
                    ? "Add to your home screen for one-tap access on the roof."
                    : "Get a native-app feel with offline access and instant launch."}
                </p>
              </div>
              <button
                onClick={dismiss}
                className="text-slate-400 hover:text-slate-800 p-1 -mt-1 -mr-1 flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={dismiss}
                className="flex-1 py-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={install}
                className="flex-1 py-2.5 text-[12px] font-semibold text-white bg-brand-700 hover:bg-brand-800 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS step-by-step guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur z-[70] flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 flex items-center gap-3 border-b border-slate-100">
              <div className="w-11 h-11 rounded-xl bg-brand-700 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-slate-900">Add to Home Screen</div>
                <div className="text-[11px] text-slate-500">Two taps to install on iPhone</div>
              </div>
              <button
                onClick={dismiss}
                className="text-slate-400 hover:text-slate-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="p-5 space-y-3">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[12px] font-bold flex-shrink-0">1</span>
                <div className="flex-1">
                  <p className="text-[13px] text-slate-800 leading-snug">
                    Tap the{" "}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 mx-0.5">
                      <Share className="w-3 h-3" />
                      Share
                    </span>{" "}
                    icon at the bottom of Safari.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[12px] font-bold flex-shrink-0">2</span>
                <div className="flex-1">
                  <p className="text-[13px] text-slate-800 leading-snug">
                    Scroll and choose{" "}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 mx-0.5">
                      <Plus className="w-3 h-3" />
                      Add to Home Screen
                    </span>
                    .
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[12px] font-bold flex-shrink-0">3</span>
                <div className="flex-1">
                  <p className="text-[13px] text-slate-800 leading-snug">
                    Tap <span className="font-semibold">Add</span> — SolarSafe pro will appear on your home screen with the 1K5° icon.
                  </p>
                </div>
              </li>
            </ol>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={dismiss}
                className="w-full h-10 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-[13px] font-semibold transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallPrompt;
