/* electron-builder's `extraResources` errors if its source folder is missing.
 * The real conversion engine (PyInstaller-frozen server/convert_server.py) is
 * only built in CI (needs Python) — see .github/workflows/desktop-release.yml.
 * For a local `electron:build` without Python set up, make sure an (empty)
 * engine-dist/filequick-engine/ exists so packaging still succeeds; the app
 * just skips starting the engine when the exe isn't there (see main.cjs),
 * so those 6 tools stay "coming soon" in a locally-built test package. */
import { mkdirSync } from 'node:fs';

mkdirSync('engine-dist/filequick-engine', { recursive: true });
