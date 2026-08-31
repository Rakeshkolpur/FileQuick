# Conversion server

Turns Word/Office documents into PDF with **LibreOffice** — the same engine
iLovePDF, Smallpdf and Adobe's online tools use. Nobody visiting the website
installs anything; their browser just uploads the file here and gets a PDF back.

## Who needs LibreOffice?

Only **the machine that runs this server** — once. Not the website's visitors.

| Situation | Where the conversion runs | Who installs LibreOffice |
| --- | --- | --- |
| Local dev on your PC | your PC | you (already done via `winget`) |
| Deployed website | your backend host / container | your deploy (the Dockerfile does it) |
| A visitor with no server reachable | their own browser (approximate fallback) | nobody |

## Local dev

```bash
pip install -r requirements.txt          # Flask etc.
# install LibreOffice once (Windows): winget install TheDocumentFoundation.LibreOffice
python convert_server.py                  # or: npm run server   (from the repo root)
```

Run it from PowerShell / cmd / the VS Code terminal — **not** Git Bash, whose
`PATH` shadows the Windows system DLLs LibreOffice needs.

The frontend auto-detects it (`/health`) and shows **“LibreOffice engine ·
connected”**. If it's not running, the tool falls back to an in-browser
renderer and says so.

## Production (deployed site)

Build the container (LibreOffice + fonts are baked in):

```bash
docker build -t imresizer-convert ./server
docker run -p 5000:5000 imresizer-convert
```

Deploy that image anywhere that runs containers — Render, Railway, Fly.io,
Google Cloud Run, AWS ECS, a plain VPS. Then build the frontend with:

```
VITE_API_URL=https://convert.yourdomain.com
```

so the browser talks to your conversion host. That host needs a bit of RAM
(LibreOffice wants ~300–500 MB per conversion); 1 GB is comfortable for light
traffic.

### CORS

`convert_server.py` currently allows all origins (fine for dev). Before going
live, restrict it to your site's domain — set `ALLOWED_ORIGINS` and the app
passes it to `flask-cors`.

## Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/health` | – | `{ status, libreoffice, soffice, ... }` |
| POST | `/convert/word-to-pdf` | multipart, field `file` (`.docx/.doc/.odt/.rtf/.txt`) | the PDF |
| POST | `/convert/powerpoint-to-pdf` | multipart, field `file` (`.pptx/.ppt/.odp`) | the PDF |
| POST | `/convert/excel-to-pdf` | multipart, field `file` (`.xlsx/.xls/.ods/.csv`) | the PDF |
| POST | `/convert/pdf-to-word` | multipart, field `file` (`.pdf`) [+ `pages`] | the `.docx` |
| POST | `/convert/pdf-to-powerpoint` | multipart, field `file` (`.pdf`) [+ `pages`] | the `.pptx` (one slide per page) |
| POST | `/convert/pdf-to-excel` | multipart, field `file` (`.pdf`) [+ `pages`] | the `.xlsx` (detected tables) |

(Plus `/pdf/unlock`, `/pdf/protect`, `/pdf/compress`, `/pdf/fill-sign` — see `convert_server.py`.)
