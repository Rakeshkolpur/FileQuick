# FileQuick for Desktop (Electron)

The desktop app is the **same web build** wrapped in Electron, with three extra
powers the browser can't give:

| | Web | Desktop |
|---|---|---|
| File-size limit | 50 MB PDF / 30 MB image | none |
| Works offline | mostly (assets cached after first visit) | yes, after install |
| "Download" a result | browser download | saved into `Documents/FileQuick/` + a toast, with history |
| Updates | reload the page | auto-update from GitHub Releases, one-click restart |

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

The renderer stays sandboxed (`contextIsolation`, no `nodeIntegration`,
`sandbox: true`). External links open in the real browser.

## Commands

```bash
npm run electron:dev       # develop (hot reload)
npm run electron:build     # build release/FileQuick-Setup-<version>.exe locally
npm run electron:publish   # build + upload to the GitHub Release (needs GH_TOKEN)
```

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

- **Code signing.** The installer is unsigned, so Windows SmartScreen shows a
  one-time "unknown publisher" prompt. To fix: add `certificateFile` /
  `certificatePassword` (or a CI signing step) in `electron-builder.yml`.
- **macOS / Linux** targets.
- **Fully-offline AI models.** Remove Background (IS-Net) and OCR (tessdata)
  still fetch their model once from a CDN. Bundle them into `public/` to make
  those tools work with no internet at all.
