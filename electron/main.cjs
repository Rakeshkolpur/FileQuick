/* FileQuick for Desktop — Electron main process.
 *
 * Loads the exact same web app (the Vite build in dist/), but with:
 *  - no file-size cap (the renderer checks window.fq to know it's desktop)
 *  - a real "Save to my files" that writes into Documents/FileQuick
 *  - auto-update from GitHub Releases (electron-updater)
 * Nothing is uploaded anywhere; the only network call is the update check.
 */
const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { spawn } = require('node:child_process');

// electron:dev sets VITE_DEV_SERVER_URL; anything else loads the built files.
const DEV_URL = process.env.VITE_DEV_SERVER_URL || '';
const isDev = !!DEV_URL;

// Where the user's results and a small history live — on THEIR machine only.
const outputDir = path.join(app.getPath('documents'), 'FileQuick');
const historyFile = path.join(app.getPath('userData'), 'history.json');

function ensureDirs() {
  try { fs.mkdirSync(outputDir, { recursive: true }); } catch { /* ignore */ }
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 600,
    backgroundColor: '#0b1020',
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // External links open in the real browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const here = isDev ? DEV_URL : 'file://';
    if (!url.startsWith(here)) { e.preventDefault(); shell.openExternal(url); }
  });
}

/* ---------------- IPC: files ---------------- */

ipcMain.handle('fq:get-info', () => ({
  version: app.getVersion(),
  outputDir,
  platform: process.platform,
}));

ipcMain.handle('fq:save-file', async (_e, { name, data }) => {
  ensureDirs();
  const safe = String(name || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 180) || 'file';
  let target = path.join(outputDir, safe);
  // don't clobber — add " (2)", " (3)" …
  const ext = path.extname(target);
  const stem = target.slice(0, target.length - ext.length);
  for (let i = 2; fs.existsSync(target); i += 1) target = `${stem} (${i})${ext}`;
  await fsp.writeFile(target, Buffer.from(data));
  await appendHistory({ name: path.basename(target), path: target, at: Date.now() });
  return { path: target };
});

ipcMain.handle('fq:open-output-folder', async () => {
  ensureDirs();
  await shell.openPath(outputDir);
});

ipcMain.handle('fq:reveal', async (_e, filePath) => {
  if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});

ipcMain.handle('fq:history', async () => readHistory());

async function readHistory() {
  try { return JSON.parse(await fsp.readFile(historyFile, 'utf8')); } catch { return []; }
}
async function appendHistory(entry) {
  const list = await readHistory();
  list.unshift(entry);
  await fsp.writeFile(historyFile, JSON.stringify(list.slice(0, 200), null, 2)).catch(() => {});
}

/* ---------------- auto-update (GitHub Releases) ---------------- */

function wireUpdater() {
  if (!app.isPackaged) return; // no update feed when run unpackaged
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (channel, payload) => win && !win.isDestroyed() && win.webContents.send(channel, payload);

  autoUpdater.on('update-available', (info) => send('fq:update', { state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => send('fq:update', { state: 'none' }));
  autoUpdater.on('download-progress', (p) => send('fq:update', { state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => send('fq:update', { state: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => send('fq:update', { state: 'error', message: String(err?.message || err) }));

  ipcMain.handle('fq:check-updates', () => autoUpdater.checkForUpdates().catch(() => {}));
  ipcMain.handle('fq:install-update', () => autoUpdater.quitAndInstall());

  // one automatic check shortly after launch, then every 6 h
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

/* ---------------- local conversion engine ---------------- */
// Compress/Unlock/Protect PDF and PDF<->Word/PowerPoint/Excel don't need
// LibreOffice — just Python + a few small libraries (see server/requirements.txt).
// That engine is frozen with PyInstaller at build time (scripts + the
// desktop-release workflow) into resources/engine/filequick-engine.exe and
// shipped inside the installer, so it needs nothing installed on the user's
// machine. It binds 127.0.0.1:5000 only — matching the web app's default API
// URL — so the renderer's existing per-tool health checks pick it up with no
// code changes. Word/PowerPoint/Excel -> PDF still need real LibreOffice and
// stay "coming soon" everywhere.
let engineProc = null;

function startEngine() {
  if (!app.isPackaged) return; // dev: `npm run server` yourself if you want these tools
  const exePath = path.join(process.resourcesPath, 'engine', 'filequick-engine.exe');
  if (!fs.existsSync(exePath)) return;
  try {
    engineProc = spawn(exePath, [], {
      env: { ...process.env, PORT: '5000' },
      windowsHide: true,
      stdio: 'ignore',
    });
    engineProc.on('error', () => { engineProc = null; });
    engineProc.on('exit', () => { engineProc = null; });
  } catch {
    engineProc = null; // the 6 lightweight PDF tools just stay unavailable
  }
}

function stopEngine() {
  if (engineProc && !engineProc.killed) {
    try { engineProc.kill(); } catch { /* already gone */ }
  }
  engineProc = null;
}

/* ---------------- menu ---------------- */

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open my FileQuick folder', click: () => shell.openPath(outputDir) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    {
      label: 'Help',
      submenu: [
        { label: 'Check for updates…', click: () => { try { require('electron-updater').autoUpdater.checkForUpdates(); } catch { /* dev */ } } },
        { label: 'Visit filequik.in', click: () => shell.openExternal('https://filequik.in') },
        {
          label: 'About FileQuick',
          click: () => dialog.showMessageBox(win, {
            type: 'info', title: 'FileQuick',
            message: `FileQuick ${app.getVersion()}`,
            detail: 'All your file tools, offline. Files never leave this computer.',
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------------- lifecycle ---------------- */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(() => {
    ensureDirs();
    buildMenu();
    createWindow();
    wireUpdater();
    startEngine();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', stopEngine);
}
