import { getToolById } from '../data/tools';

/**
 * Fetch a tool's code ahead of time, so opening it right after an upload is
 * instant instead of waiting for its chunks. The browser keeps the module, and
 * ToolWrapper's React.lazy (same `tool.load`) then resolves straight away.
 */
const started = new Set();

export function preloadTool(...ids) {
  for (const id of ids) {
    if (started.has(id)) continue;
    const tool = getToolById(id);
    if (!tool?.load) continue;
    started.add(id);
    tool.load().catch(() => started.delete(id)); // a failed fetch can retry later
  }
}

/**
 * Preload once the page has finished loading and the browser is idle, so the
 * first paint never competes with it. Skipped on Data Saver connections.
 * Returns a cleanup fn for useEffect.
 */
export function preloadWhenIdle(...ids) {
  if (typeof window === 'undefined') return () => {};
  if (navigator.connection?.saveData) return () => {};
  let idleId = null;
  let timer = null;
  const run = () => {
    if (window.requestIdleCallback) idleId = window.requestIdleCallback(() => preloadTool(...ids), { timeout: 2000 });
    else timer = setTimeout(() => preloadTool(...ids), 1000);
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
