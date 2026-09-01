import { useEffect } from 'react';

const SITE = 'FileQuick';
const DEFAULT_DESC = 'Free browser-based tools to resize, compress, convert, merge, sign and edit images and PDFs. Nothing is uploaded — everything runs on your device.';

// Canonical public origin (no trailing slash). Set VITE_SITE_URL on the host so
// canonical/OG URLs always point at ONE domain, whichever host the visitor hit.
const SITE_ORIGIN = (import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Keep the tab title + meta description + canonical + OG/Twitter tags in sync
 * with the current page. It's client-side (this is an SPA), which modern
 * crawlers execute — but the real win is correct titles in search snippets,
 * shared links and browser history.
 */
export function setPageMeta({ title, description, path } = {}) {
  const fullTitle = title ? `${title} — ${SITE}` : `${SITE} — All Your File Tools. One Place.`;
  const desc = description || DEFAULT_DESC;
  document.title = fullTitle;
  upsertMeta('name', 'description', desc);

  const url = SITE_ORIGIN
    ? SITE_ORIGIN + (path || (typeof window !== 'undefined' ? window.location.pathname : '/'))
    : '';
  if (url) upsertLink('canonical', url);

  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:type', 'website');
  if (url) upsertMeta('property', 'og:url', url);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', desc);
}

export function usePageMeta(meta) {
  const key = JSON.stringify(meta || {});
  useEffect(() => {
    setPageMeta(meta || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
