# moc

## Render deployment

This repository deploys as **two Render services**:

1. **Frontend (Static Site)**
   - Root directory: `apps/medical-note-tool`
   - Build command: `yarn && yarn build` (as defined in `render.yaml`)
   - Publish directory: `dist`
   - Required env var: `VITE_API_URL` (set to your API service URL, for example `https://medical-note-api.onrender.com`)

2. **API (Web Service)**
   - Root directory: `apps/api` (**do not deploy the repository root as the API service**)
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Required env vars:
     - `RINGCENTRAL_JWT`
     - `RINGCENTRAL_CLIENT_ID`
     - `RINGCENTRAL_CLIENT_SECRET`
     - `RINGCENTRAL_FROM_NUMBER`
     - `CORS_ORIGIN` (set to your frontend URL, for example `https://moc-29lo.onrender.com`)

If you deploy from the repo root as a single web service, the API startup will fail because this repo is not configured to run as one combined root service.
