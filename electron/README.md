# FileQuick for Desktop (Electron)

The desktop app is the **same web build** wrapped in Electron, with three extra
powers the browser can't give:

| | Web | Desktop |
|---|---|---|
| File-size limit | 50 MB PDF / 30 MB image | none |
| Works offline | mostly (assets cached after first visit) | yes, after install |
| "Download" a result | browser download | saved into `Documents/FileQuick/` + a toast, with history |
| Updates | reload the page | auto-update from GitHub Releases, one-click restart |
| Compress/Unlock/Protect PDF, PDF↔Word/PowerPoint/Excel | "coming soon" | work offline — bundled local engine |

## Layout

```
electron/
  main.cjs      main process — window, IPC (save file / open folder / history), auto-updater, menu
  preload.cjs   contextBridge → window.fq (isDesktop, saveFile, openOutputFolder, onUpdate, …)
electron-builder.yml   packaging + GitHub Releases publish target
scripts/
  electron-dev.mjs    `npm run electron:dev`  — Vite on :5173 + Electron pointed at it
  build-desktop.mjs    ELECTRON=1 vite build   — relative asset base for file://
.github/workflows/desktop-release.yml   tag v* → build + publish the Windows installer
```

## The bundled conversion engine

Compress/Unlock/Protect PDF and PDF↔Word/PowerPoint/Excel don't actually need
LibreOffice — `server/convert_server.py` does them with plain Python libraries
(pymupdf, pikepdf, pdf2docx, python-pptx, openpyxl — see
`server/requirements.txt`). Only Word/PowerPoint/Excel **→** PDF need real
LibreOffice, which is a 300–600 MB install and stays out of scope.

The release workflow freezes `convert_server.py` with **PyInstaller**
(`--onedir --noconsole`) into a standalone `filequick-engine.exe` — no Python
needed on the end user's machine — and electron-builder copies it into
`resources/engine/` via `extraResources`. `electron/main.cjs` spawns it on
`127.0.0.1:5000` when the app starts (only when packaged; in dev, run
`npm run server` yourself if you want to test these tools) and kills it on
quit. Port 5000 matches `src/lib/api.js`'s default base URL, so every one of
those tool components — already built, already health-checking `/health` on
mount — just finds it. `src/data/tools.jsx` flips their `status` off
`'soon'` only when `window.fq.isDesktop` is true, so the web app is unaffected.

Local `electron:build` without Python set up still works — `ensure-engine-dir.mjs`
makes sure the resource folder exists (empty), so those 6 tools simply stay
"coming soon" in a locally-built package; only the CI-built release has the
real engine.

The renderer stays sandboxed (`contextIsolation`, no `nodeIntegration`,
`sandbox: true`). External links open in the real browser.

## Commands

```bash
npm run electron:compile   # esbuild -> electron-dist/{main,preload}.cjs
npm run electron:dev       # develop (Vite :5173 + Electron, hot reload)
npm run electron:build     # build release/FileQuick-Setup-<version>.exe locally
npm run electron:publish   # build + upload to the GitHub Release (needs GH_TOKEN)
```

The packaged app has been verified to run (main process loads, window
renders `dist/index.html` from the asar). Run `electron:build` on a normal
machine with GitHub reachable — the first run downloads NSIS + winCodeSign
(~few min).

## Releasing

1. Bump `version` in `package.json`.
2. `git tag vX.Y.Z && git push origin vX.Y.Z`
3. GitHub Actions builds on `windows-latest` and publishes the installer +
   `latest.yml` to the matching GitHub Release.
4. In `src/lib/desktopApp.js` set `available: true` and the version — that flips
   the `/download` button on.

Installed apps check that release feed on launch and every 6 h; a new version
downloads in the background and the in-app banner offers "Restart & install".

## Not done yet

- **Code signing.** The installer is unsigned, so Windows SmartScreen (and the
  browser's own download-reputation check) shows a one-time warning. To fix:
  add `certificateFile` / `certificatePassword` (or a CI signing step) in
  `electron-builder.yml`. The `/download` page already explains both prompts.
- **Word/PowerPoint/Excel → PDF** stay "coming soon" even on desktop — the
  real LibreOffice engine (300–600 MB) isn't bundled. Everything *from* PDF,
  plus compress/unlock/protect, works (see "the bundled conversion engine"
  above).
- **macOS / Linux** targets.
- **Fully-offline AI models.** Remove Background (IS-Net) and OCR (tessdata)
  still fetch their model once from a CDN. Bundle them into `public/` to make
  those tools work with no internet at all.

electron-builder.yml's `publish.releaseType: release` makes new builds
auto-publish (its default is a hidden draft you'd otherwise have to click
"Publish" on manually).
