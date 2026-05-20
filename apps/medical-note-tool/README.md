# Medical Note Tool

Static React app for generating medical note templates in-browser only.

## HIPAA / Data Handling

- No backend, database, analytics, or API calls are used.
- Patient data is only kept in browser memory while the page is open.
- `Copy Note` copies to clipboard; `Reset Form` clears the in-memory form.
- No information is stored or transmitted by this app.

## Local Development

From the repository root:

```bash
cd apps/medical-note-tool
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

## Production Build

```bash
cd apps/medical-note-tool
npm run build
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
