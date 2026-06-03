# Medical Note Tool

Static React app for generating medical note templates and sending SMS via a server-side RingCentral integration.

## HIPAA / Data Handling

- SMS table rows are persisted by the `medical-note-api` backend in Postgres via `DATABASE_URL`.
- If the database is unreachable, the UI keeps temporary in-memory changes for the current session.
- `Copy Note` copies to clipboard; `Reset Form` clears the in-memory form.
- SMS is sent via the `medical-note-api` backend — no RingCentral credentials are stored in the browser or embedded in client-side code.

## Local Development

The SMS feature requires the `medical-note-api` server running locally. Start it first:

```bash
cd apps/api
cp .env.example .env   # fill in your RingCentral credentials
npm install
npm run dev
```

Then start the frontend (in a separate terminal):

```bash
cd apps/medical-note-tool
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

The Vite dev server proxies `/api` requests to `http://localhost:3001` automatically, so SMS sending works out of the box once the API server is running.

## Production Build

```bash
cd apps/medical-note-tool
npm run build
```

For production deployments where the frontend and API are on different origins,
set `VITE_API_URL` at build time to the deployed API URL:

```bash
VITE_API_URL=https://medical-note-api.onrender.com npm run build
```

Build output is generated in `dist/`.

## Static Deployment

Deploy the `dist/` directory to any static host (for example GitHub Pages, Netlify, Vercel static hosting, S3 + CloudFront, or Nginx static hosting):

```bash
cd apps/medical-note-tool
npm run build
npm run preview
```

`npm run preview` is for local verification of the production build before deployment.
