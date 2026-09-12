# SolarSafe

A work-health-and-safety app for solar installation crews: SWMS generation, an AI
safety assistant, voice-to-hazard-report, and photo/vision-based risk assessment.

Originally built on Emergent.sh — now fully self-hostable, no paid platform required.

## Stack

- **Frontend**: React (Create React App via craco) + Tailwind + shadcn/ui
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI**: Google Gemini (text + vision) — bring your own free API key

## 1. Get your free accounts

| Need | Where | Free tier |
|---|---|---|
| Database | https://www.mongodb.com/cloud/atlas/register | 512MB cluster, free forever |
| AI | https://aistudio.google.com/apikey | Generous free daily quota |
| Backend hosting | https://render.com | Free web service (sleeps after inactivity) |
| Frontend hosting | https://vercel.com or https://netlify.com | Free static hosting |

## 2. Local setup

**Backend:**
```bash
cd backend
cp .env.example .env      # fill in MONGO_URL and GEMINI_API_KEY
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
cp .env.example .env      # set REACT_APP_BACKEND_URL=http://localhost:8000
yarn install               # or npm install
yarn start                 # or npm start
```

## 3. Deploy for free

**Backend (Render):**
This repo includes a `render.yaml` blueprint. In the Render dashboard: New →
Blueprint → point at your GitHub repo. Render will read `render.yaml` and set up
the service — you just need to fill in `MONGO_URL` and `GEMINI_API_KEY` as secrets
in the Render dashboard (they're deliberately left blank in the blueprint).

**Frontend (Vercel or Netlify):**
Connect your GitHub repo, set the project root to `frontend/`, and set the
environment variable `REACT_APP_BACKEND_URL` to your deployed Render backend URL.
Build command: `yarn build` (or `npm run build`). Output directory: `build`.

## Notes

- The `.emergent/` folder and `@emergentbase/visual-edits` dev dependency (from the
  original Emergent.sh build) have been removed — they were platform-specific
  tooling with no effect on the running app.
- All 5 AI endpoints (`/api/swms/generate`, `/api/agent/chat`, `/api/hazards/from-voice`,
  `/api/risk/assess`, `/api/risk/watch`) now call Gemini directly via `GEMINI_API_KEY`
  instead of Emergent's metered LLM proxy.
- Mobile: the app is wrapped with Capacitor (see `frontend/MOBILE.md`) if you want
  to build native iOS/Android shells later — not required for web use.
