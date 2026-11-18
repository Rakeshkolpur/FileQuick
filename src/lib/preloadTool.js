import { MOBILE_TOOL_IDS, getAllTools, getToolById } from '../data/tools';

/**
 * Fetch a tool's code ahead of time, so opening it right after an upload is
 * instant instead of waiting for its chunks. The browser keeps the module, and
 * ToolWrapper's React.lazy (same `tool.load`) then resolves straight away.
 *
 * `warm` (default on): let the tool's module warm what it opens next (the PDF
 * Editor fetches its full editor). The background preload below skips that.
 */
const started = new Map(); // id -> promise

export function preloadTool(...ids) {
  return Promise.all(ids.map((id) => loadOne(id, true)));
}

function loadOne(id, warm) {
  const tool = getToolById(id);
  if (!tool?.load) return Promise.resolve();
  let p = started.get(id);
  if (!p) {
    p = tool.load().catch((e) => { started.delete(id); throw e; }); // a failed fetch can retry later
    started.set(id, p);
  }
  return p.then((m) => { if (warm) m?.warm?.(); }).catch(() => {});
}

const slowOrSaving = () => {
  const conn = navigator.connection;
  return !!(conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || ''));
};

/** Run `fn` once the page has loaded and the browser is idle. Returns a cleanup fn. */
function whenIdle(fn) {
  let idleId = null;
  let timer = null;
  const run = () => {
    if (window.requestIdleCallback) idleId = window.requestIdleCallback(fn, { timeout: 2000 });
    else timer = setTimeout(fn, 1000);
  };
  const onLoad = () => { timer = setTimeout(run, 300); };
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });
  return () => {
    window.removeEventListener('load', onLoad);
    clearTimeout(timer);
    if (idleId != null) window.cancelIdleCallback?.(idleId);
  };
}

/** Preload a few tools once the page is idle. Skipped on Data Saver and 2G. */
export function preloadWhenIdle(...ids) {
  if (typeof window === 'undefined' || slowOrSaving()) return () => {};
  return whenIdle(() => { preloadTool(...ids); });
}

/**
 * Fetch every tool's code in the background, most-used first, one tool at a
 * time, starting right after the page loads.
 *
 * Why: on some connections the link to the site's host silently dies after a
 * few seconds idle, and the browser then waits ~20 s before opening a new one.
 * The first tool a visitor opened after reading the page for a while sat on
 * "loading" for those 20 s, just to fetch a few KB of code. Fetched while the
 * connection is still fresh, opening a tool needs no network at all.
 *
 * Phones get the tools they're shown (MOBILE_TOOL_IDS, ~220 KB gz, once —
 * the browser caches it); bigger screens get them all (~480 KB gz).
 */
export function preloadAllToolsInBackground() {
  if (typeof window === 'undefined' || slowOrSaving()) return () => {};
  let cancelled = false;
  const phone = window.matchMedia?.('(max-width: 767px)').matches;
  const rest = phone ? [] : getAllTools().filter((t) => t.status !== 'soon').map((t) => t.id);
  const ids = [...new Set([...MOBILE_TOOL_IDS, ...rest])];
  const stop = whenIdle(async () => {
    for (const id of ids) {
      if (cancelled) return;
      // eslint-disable-next-line no-await-in-loop
      await loadOne(id, false);
    }
  });
  return () => { cancelled = true; stop(); };
}
