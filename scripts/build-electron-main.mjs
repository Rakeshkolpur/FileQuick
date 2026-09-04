/* Bundle the Electron main + preload into electron-dist/ with esbuild.
 * This keeps `electron-updater` (and its tree) inline, so the packaged app
 * needs NO node_modules — the installer stays small and builds fast. */
import esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('electron-dist', { recursive: true });
// The app-window icon (Windows taskbar while running). The installer/exe
// icon itself comes from electron-builder's `win.icon: build/icon.png`.
copyFileSync('build/icon.png', 'electron-dist/icon.png');

await esbuild.build({
  entryPoints: {
    main: 'electron/main.cjs',
    preload: 'electron/preload.cjs',
  },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outdir: 'electron-dist',
  outExtension: { '.js': '.cjs' },
  external: ['electron'], // provided by the runtime
  minify: false,
  sourcemap: false,
  logLevel: 'info',
});
