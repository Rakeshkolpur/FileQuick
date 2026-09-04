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

/**
 * Inject a <script type="application/ld+json"> for the current page (FAQ,
 * breadcrumbs, etc.) and clean it up on unmount. `id` keeps it unique so a
 * re-render or a second page doesn't stack duplicates.
 */
export function useJsonLd(id, data) {
  const json = data ? JSON.stringify(data) : '';
  useEffect(() => {
    if (!json) return undefined;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = `ld-${id}`;
    el.textContent = json;
    document.head.querySelector(`#ld-${id}`)?.remove();
    document.head.appendChild(el);
    return () => el.remove();
  }, [id, json]);
}

/** FAQPage schema from a [{ q, a }] list. */
export const faqJsonLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});
