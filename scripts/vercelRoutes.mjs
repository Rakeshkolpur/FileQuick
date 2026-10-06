/**
 * The redirects and SPA rewrites that vercel.json needs, generated from the
 * app's own redirect list (src/data/redirects.js) so the two never drift.
 * Used by scripts/sync-vercel.mjs (writes vercel.json) and
 * scripts/prerender.mjs (fails the build if vercel.json is stale).
 */
import { TOOL_ALIASES, SIZE_REDIRECTS } from '../src/data/redirects.js';

const SIZE = '(\\d+[km]b)';

export function buildRedirects() {
  return [
    // old URL shapes
    { source: '/tool', destination: '/', permanent: true },
    { source: '/tools', destination: '/', permanent: true },
    { source: '/tool/:id', destination: '/:id', permanent: true },
    { source: '/tools/:id', destination: '/:id', permanent: true },
    { source: '/category/:c(image|pdf|convert|ai)', destination: '/:c', permanent: true },
    // alternate names -> canonical page
    ...Object.entries(TOOL_ALIASES).map(([from, to]) => ({ source: `/${from}`, destination: `/${to}`, permanent: true })),
    // "<prefix>-to-<size>" families -> the canonical size page
    ...SIZE_REDIRECTS.map(({ prefixes, to }) => ({
      source: `/:p(${prefixes.join('|')})-to-:size${SIZE}`,
      destination: `/${to}:size`,
      permanent: true,
    })),
  ];
}

// Routes the app renders that have no pre-rendered file: they get the app
// shell ("/" = index.html; with cleanUrls a rewrite to "/index.html" 404s).
// Everything else that isn't a real file is a 404.
export function buildRewrites() {
  return [
    { source: '/:p(login|signup|document-tools|all-tools|recent-files|favorites|settings|convert|ai)', destination: '/' },
    // ad-hoc sizes (noindex) — the listed sizes are pre-rendered files
    { source: `/compress-:k(image|pdf)-to-:size${SIZE}`, destination: '/' },
    { source: `/:f(png|webp)-to-:size${SIZE}`, destination: '/' },
  ];
}
