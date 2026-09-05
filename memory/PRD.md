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

## Implemented (2026-09-05)
- Email/password auth (register/login/me) with JWT + role selection.
- Home dashboard: live metrics (open incidents, active locks, on-site, assessments) + module hub + recent assessments.
- AI Assess: camera + gallery capture, 4 modes (Risk, SWMS, Worker Density, Machinery), Gemini vision → structured WHS assessment, photo stored to object storage.
- Assessment detail: hazard/risk register, SWMS steps, density, machinery, recommended actions, legislation refs, PDF export (expo-print/sharing).
- LOTO register: apply/release lockouts with status.
- Site access: sign in/out, on-site counter, visitor/contractor induction, access log.
- Traffic management: pedestrian/forklift/shared/loading zones with risk notes + controls.
- Incident reporting: category/severity, list, close.
- Documents history list.
- Backend tested: 21/21 passing.

## Backlog
- P1: Native iOS 26 NativeTabs variant; QR-code site access scanning; assessment sign-off/approval workflow.
- P2: Multi-site support & roles/permissions; offline queue for assessments; incident photo display; enum validation + 404 on incident PATCH.
