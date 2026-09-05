# SolarSafe pro — Mobile App (iOS + Android)

The web app is wrapped with **Capacitor 7**, so the same React codebase ships as a real native app to the **Apple App Store** and **Google Play Store**.

## What is already configured

* `capacitor.config.json` — app id `com.solarsafe.pro`, brand splash, status bar, camera fullscreen, push notifications
* Native plugins installed: **Camera**, **Splash Screen**, **Status Bar**, **Network**, **Preferences (KV storage)**, **Haptics**, **Push Notifications**
* `src/lib/native.js` — thin bridge that uses native plugins when available and falls back to Web APIs on desktop
* `initNative()` is called from `App.js` on boot — hides the splash and applies the brand status bar tint

## Building the mobile app

The container has no Xcode/Android Studio, so run these on your dev machine (macOS for iOS, macOS or Linux/Windows for Android):

```bash
cd /app/frontend

# 1. One-time: build the production web bundle
yarn build

# 2. One-time: add the native shells (creates ios/ and android/ folders)
npx cap add ios
npx cap add android

# 3. Every time you change the web code:
yarn build && npx cap sync

# 4. Open the native IDE to run on device / build for release
npx cap open ios       # Xcode — needs macOS
npx cap open android   # Android Studio
```

## Store submission checklist

**Apple App Store**

- Apple Developer account (\$99/yr) → open Xcode → **Product ▸ Archive** → **Distribute App ▸ App Store Connect**
- Add app icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Update `Info.plist` with usage descriptions:
    * `NSCameraUsageDescription` — "Take on-site hazard photos and continuous risk-watch frames."
    * `NSPhotoLibraryUsageDescription` — "Attach existing photos to hazard reports."
- Fill Privacy Manifest + App Privacy report in App Store Connect
- Provide screenshots for iPhone 6.7", 6.5", 5.5" and iPad 12.9"

**Google Play Store**

- Play Console account (\$25 one-time) → Android Studio → **Build ▸ Generate Signed Bundle (AAB)**
- Add adaptive icon in `android/app/src/main/res/mipmap-anydpi-v26/`
- `AndroidManifest.xml` already carries `<uses-permission android:name="android.permission.CAMERA" />` from `@capacitor/camera`
- Data safety form: declare photos + location + optional push tokens
- Target Android 14 (SDK 34+) — Capacitor 7 defaults comply

## Compliance already in place

* Safe-area padding for the iPhone notch / dynamic island (via `env(safe-area-inset-*)`)
* 16-px inputs to prevent iOS auto-zoom on focus
* 40-px minimum tap targets on coarse pointers
* PWA manifest with maskable icons (also used as the web install fallback)
* No hard-coded secrets or debug endpoints in `server.py`
* Delete controls on every list, plus admin audit trail for restore-if-needed compliance

## What is still web-only

* Push notifications need a backend token registration endpoint (add `/api/push/register` when ready)
* Splash / app icons are placeholders — replace `resources/icon.png` (1024×1024) and run `npx @capacitor/assets generate` before shipping
* Deep-links require a `com.solarsafe.pro://` URL scheme (add in Xcode signing tab + `AndroidManifest.xml`)
