# moc

## Render deployment

This repository deploys as a **single Render web service** that builds both the
frontend and the API, then serves everything from one Node process.

### How it works

- The root `package.json` `build` script installs and builds both
  `apps/medical-note-tool` (Vite) and `apps/api` (Express/TypeScript).
- The Express server serves the built Vite assets under `/` and handles API
  requests under `/api`.
- All non-API requests fall back to `index.html` so client-side routing works.
- No `CORS_ORIGIN` env var is needed because the frontend and API share the
  same origin.

### Render service settings

| Setting | Value |
|---|---|
| **Environment** | Node |
| **Root Directory** | *(leave blank — repo root)* |
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` |

### Required environment variables

Set these in the Render dashboard under **Environment**:

| Variable | Description |
|---|---|
| `RINGCENTRAL_JWT` | RingCentral JWT private-key credential |
| `RINGCENTRAL_CLIENT_ID` | RingCentral app Client ID |
| `RINGCENTRAL_CLIENT_SECRET` | RingCentral app Client Secret |
| `RINGCENTRAL_FROM_NUMBER` | SMS sender number in E.164 format (e.g. `+13055550123`) |
| `NODE_ENV` | Set to `production` (already set in `render.yaml`) |

### Local development

Start the API server first (from `apps/api`):

```bash
cd apps/api
cp .env.example .env   # fill in your RingCentral credentials
npm install
npm run dev
```

Then start the frontend dev server (from `apps/medical-note-tool`):

```bash
cd apps/medical-note-tool
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:3001`
automatically, so SMS sending works without any extra configuration.

