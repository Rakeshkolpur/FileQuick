# FileQuick

All your file tools in one place — resize, compress, convert, merge, sign and
edit images and PDFs. **Most tools run entirely in the browser**, so files never
leave the visitor's device.

## What's in the box

**Image** — resize, crop, compress, convert (JPG/PNG/WebP/PDF), remove background.

**PDF (browser-only)** — merge, split, rotate, crop pages, add watermark, add
page numbers, organize, remove pages, extract pages / images / text (with OCR),
editor, fill & sign, image ↔ PDF, text ↔ PDF.

**PDF (conversion server)** — Word / PowerPoint / Excel → PDF and back, unlock,
protect, compress.

## Tech

- **Frontend:** React 18 + Vite 5 + Tailwind v4 + React Router 6. Client-side
  PDF work uses `pdf-lib` and `pdfjs-dist`; OCR uses `tesseract.js`; background
  removal uses `@imgly/background-removal` (WASM).
- **Conversion server:** `server/` — a small Flask app that shells out to
  **LibreOffice** (Office ↔ PDF) and uses PyMuPDF / pdf2docx / python-pptx /
  openpyxl / pikepdf. Stateless; every file is deleted right after the response.

## Local development

```bash
npm install
npm run dev          # frontend on http://localhost:5173
npm run server       # conversion server on http://localhost:5000 (optional)
npm start            # both at once
```

The conversion server needs Python 3.10+ and LibreOffice installed:

```bash
pip install -r server/requirements.txt
# Windows:  winget install TheDocumentFoundation.LibreOffice
# Debian:   apt-get install libreoffice-writer libreoffice-impress libreoffice-calc
```

Without it, the ~25 browser-only tools work fine; the server-backed ones show an
"engine offline" badge.

## Deployment

**Frontend** → Vercel, Netlify or Cloudflare Pages. Connect this repo; every push
to `main` rebuilds and deploys. Config is included (`vercel.json`,
`public/_redirects`). Set:

- `SITE_URL` — your domain, e.g. `https://filequick.app` (used by the sitemap)
- `VITE_API_URL` — the conversion server's URL (below)

**Conversion server** → Render, Railway, Fly.io or a VPS. `server/Dockerfile`
bundles LibreOffice + fonts. Set `ALLOWED_ORIGINS` to your site's domain. See
[`server/README.md`](server/README.md).

## Scripts

| command | what it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | regenerate `sitemap.xml` / `robots.txt`, then build to `dist/` |
| `npm run server` | run the conversion server |
| `npm run lint` | ESLint |
| `npm run seo` | regenerate `sitemap.xml` / `robots.txt` only |

## Contact

mju646139@gmail.com · Tarnaka, Hyderabad, India
