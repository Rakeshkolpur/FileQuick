/**
 * "Failed to fetch dynamically imported module" — after a new deploy, a tab
 * that was opened on the previous build still asks for the old hashed chunk
 * files (e.g. /assets/ImageCrop-abc123.js), which the new deployment no longer
 * serves. The fix is simply to load the page again so it picks up the new
 * build. A short network blip can cause the same error, so the loader also
 * retries once before reloading.
 */

const KEY = 'fq:chunk-reload';
const GUARD_MS = 30_000; // never reload-loop: at most once per 30s

export function isChunkLoadError(err) {
  const msg = String(err?.message || err || '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading (CSS )?chunk \d+ failed/i.test(msg);
}

/** Reload the page once. Returns false when we already reloaded very recently. */
export function reloadForNewVersion() {
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch { /* storage blocked */ }
  if (Date.now() - last < GUARD_MS) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* storage blocked */ }
  window.location.reload();
  return true;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wrap a `() => import(...)` loader: retry once on a chunk error, then reload
 * the page to fetch the new build. If a reload already happened moments ago,
 * the error is passed on so the error screen can show.
 */
export function withChunkRetry(loader) {
  return async () => {
    try {
      return await loader();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;
      await wait(600);
      try {
        return await loader();
      } catch (err2) {
        if (isChunkLoadError(err2) && reloadForNewVersion()) {
          return new Promise(() => {}); // the page is reloading — keep the spinner up
        }
        throw err2;
      }
    }
  };
}

/** Catch chunk errors that happen outside the tool loader (e.g. a library a tool imports on demand). */
export function installChunkErrorReload() {
  // Vite fires this when a dynamic import's preload (JS or CSS) fails.
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadForNewVersion()) e.preventDefault();
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (isChunkLoadError(e.reason)) reloadForNewVersion();
  });
}
