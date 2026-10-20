import { useEffect, useState } from 'react';

/**
 * The per-tool SEO copy (data/toolSeo.js, ~90 KB) is only needed on tool
 * pages, so it's fetched on demand instead of sitting in the main bundle that
 * every visitor — and every phone on a slow connection — has to download first.
 * Crawlers still get the full copy: scripts/prerender.mjs bakes it into each
 * tool page's HTML at build time.
 */
let mod = null;
let pending = null;

export const loadToolSeo = () => {
  if (!pending) {
    pending = import('../data/toolSeo')
      .then((m) => { mod = m; return m; })
      .catch((e) => { pending = null; throw e; });
  }
  return pending;
};

/** The tool's SEO entry, or null until the copy has loaded (then re-renders). */
export function useToolSeo(id) {
  const [, setLoaded] = useState(!!mod);
  useEffect(() => {
    if (mod || !id) return undefined;
    let alive = true;
    loadToolSeo().then(() => { if (alive) setLoaded(true); }).catch(() => {});
    return () => { alive = false; };
  }, [id]);
  return id && mod ? mod.getToolSeo(id) : null;
}
