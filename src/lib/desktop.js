/**
 * Small bridge to the Electron shell (electron/preload.cjs exposes `window.fq`).
 * On the web everything here no-ops or falls back to a normal browser download,
 * so the same tool code runs in both.
 */

export const isDesktop = () =>
  typeof window !== 'undefined' && !!window.fq && window.fq.isDesktop === true;

/** Ask the desktop app to save a Blob — opens a native Save dialog. */
export async function saveToDesktop(blob, filename) {
  if (!isDesktop()) return null;
  const buf = new Uint8Array(await blob.arrayBuffer());
  const res = await window.fq.saveFileAs(filename || 'file', buf);
  if (res && !res.canceled) window.dispatchEvent(new CustomEvent('fq:saved', { detail: res }));
  return res; // { path } | { canceled: true }
}

export const openOutputFolder = () => isDesktop() && window.fq.openOutputFolder();
export const revealFile = (p) => isDesktop() && window.fq.reveal(p);
export const openFile = (p) => isDesktop() && window.fq.openFile(p);
export const desktopInfo = () => (isDesktop() ? window.fq.getInfo() : Promise.resolve(null));

/** Recent files this app has saved — [{ name, path, size, at }], newest first. */
export const getHistory = () => (isDesktop() ? window.fq.history() : Promise.resolve([]));
export const clearHistory = () => isDesktop() && window.fq.clearHistory();
export const removeHistory = (filePath) => isDesktop() && window.fq.removeHistory(filePath);

/** Subscribe to auto-update events. Returns an unsubscribe fn (no-op on web). */
export const onUpdate = (cb) => (isDesktop() ? window.fq.onUpdate(cb) : () => {});
export const downloadUpdate = () => isDesktop() && window.fq.downloadUpdate();
export const installUpdate = () => isDesktop() && window.fq.installUpdate();
export const checkForUpdates = () => isDesktop() && window.fq.checkForUpdates();
