/* Bridges a tiny, safe API into the web app. The renderer stays sandboxed —
 * it can ask the main process to save a file or check for updates, nothing more.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fq', {
  isDesktop: true,

  getInfo: () => ipcRenderer.invoke('fq:get-info'),

  // data: ArrayBuffer | Uint8Array from a Blob the tool produced
  saveFile: (name, data) => ipcRenderer.invoke('fq:save-file', { name, data }),
  openOutputFolder: () => ipcRenderer.invoke('fq:open-output-folder'),
  reveal: (filePath) => ipcRenderer.invoke('fq:reveal', filePath),
  openFile: (filePath) => ipcRenderer.invoke('fq:open-file', filePath),
  history: () => ipcRenderer.invoke('fq:history'),
  clearHistory: () => ipcRenderer.invoke('fq:clear-history'),
  removeHistory: (filePath) => ipcRenderer.invoke('fq:remove-history', filePath),

  checkForUpdates: () => ipcRenderer.invoke('fq:check-updates'),
  downloadUpdate: () => ipcRenderer.invoke('fq:download-update'),
  installUpdate: () => ipcRenderer.invoke('fq:install-update'),
  onUpdate: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('fq:update', listener);
    return () => ipcRenderer.removeListener('fq:update', listener);
  },
});
