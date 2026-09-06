# TK SafetyGuard — PRD

## Original Problem Statement
Clone of https://thekitchenary.base44.app — an all-in-one OHS&E management platform for The Kitchenary (Australian food manufacturer, Arndell Park, Sydney). AI-powered live risk assessments, LOTO registers, digital site access control, warehouse traffic management, AI Worker Density assessor + AI Machinery Safety assessor via device camera, autonomous risk assessment/SWMS generation, PDF export. Aligned with Australian WHS legislation.

## User Choices
- AI model: Gemini 3.1 Pro (`gemini-3.1-pro-preview`) via EMERGENT_LLM_KEY
- Photo capture: both camera and gallery
- Auth: email/password (JWT)
- Modules: all
- Branding: The Kitchenary industrial identity (black/white brutalist, knife & fork disc)

## Architecture
- Frontend: Expo Router (React Native), react-query, react-native-keyboard-controller, expo-camera, expo-image-picker, expo-print + expo-sharing (PDF), phosphor-react-native icons, Space Grotesk / IBM Plex Sans + Mono fonts.
- Backend: FastAPI + Motor (MongoDB), JWT auth (bcrypt), emergentintegrations LlmChat (Gemini vision), Emergent Object Storage for photos.
- Theme: Brutalist LIGHT — radius 0, 2pt structural borders, safety-signal colors (green/amber/red/critical).

## User Personas
- Warehouse worker: sign in/out, report incidents, run AI assessments.
- Safety officer / supervisor: manage LOTO, review assessments, export PDFs, define traffic zones.
- Contractor / visitor: induction via site access.

## Implemented (2026-09-05)- Email/password auth (register/login/me) with JWT + role selection.
- Home dashboard: live metrics (open incidents, active locks, on-site, assessments) + module hub + recent assessments.
- AI Assess: camera + gallery capture, 4 modes (Risk, SWMS, Worker Density, Machinery), Gemini vision → structured WHS assessment, photo stored to object storage.
- Assessment detail: hazard/risk register, SWMS steps, density, machinery, recommended actions, legislation refs, PDF export (expo-print/sharing).
- LOTO register: apply/release lockouts with status.
- Site access: sign in/out, on-site counter, visitor/contractor induction, access log.
- Traffic management: pedestrian/forklift/shared/loading zones with risk notes + controls.
- Incident reporting: category/severity, list, close.
- Documents history list.
- Backend tested: 21/21 passing.

## Implemented (2026-09-05, later)
- Security hardening (post-audit): role gating via OFFICER_ACCESS_CODE, LOTO/incident owner-or-privileged checks + status allowlists, file ACL + path-traversal guard, assessment visibility scoping, removed JWT fallback secret, CORS credentials off, upload size cap. Verified 33/33.
- AI Machinery assessor upgrade: equipment identification (brand/model/plate), spec cross-reference (Pass/Fail per item), warranty/insurance notes, PASS/HAZARD outcome, auto hazard-report on failure, Equipment Register screen. Verified.
- LIVE MANUAL FETCH: machinery flow identifies brand/model, then Perplexity Search API fetches the real manufacturer manual/safety-spec, Gemini cross-references cited sources; source links shown in app + PDF. Graceful fallback to model knowledge when key invalid (manual_verified flag). NOTE: current PERPLEXITY_API_KEY is a Gemini-style token (401) → running in fallback; replace with a valid `pplx-` key to activate.
- Visual polish: first-launch onboarding intro screen (branded, feature highlights, Get Started), persisted via storage.

## Implemented (2026-09-06)
- Soft-delete + Clear-all across assessments/LOTO/incidents/traffic/equipment (recoverable). Individual delete + per-module CLEAR in the UI.
- Settings screen: AI Assist toggle (gates AI Assess), Dark/Light mode toggle (persisted, full dark theme added), download-app QR, owner-only Admin Console entry.
- Admin Console (owner-only, 2FA email OTP via Resend): add users, change roles, view & restore soft-deleted items/photos. admin_otps collection + short-lived admin JWT. Verified 59/59.

## Implemented (2026-09-06, forgot password)
- Email-based password recovery at login: "Forgot password?" link → POST /api/auth/forgot-password emails a 6-digit code (Resend, 15-min), POST /api/auth/reset-password verifies and updates the password, then auto-logs in. Two-step reset screen. Non-enumerating (always 200), 5-attempt lockout, 60s cooldown.
- Hardening: admin_request_otp wrapped so email rate-limits don't 502; password reset attempts preserved across re-issues. Verified 74/74.

## Backlog
- P1: Native iOS 26 NativeTabs variant; QR-code site access scanning; assessment sign-off/approval workflow.
- P2: Multi-site support & roles/permissions; offline queue for assessments; incident photo display; enum validation + 404 on incident PATCH.
