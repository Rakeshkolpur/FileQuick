/**
 * Google Analytics 4 — loaded only after the visitor accepts the cookie
 * banner, and only when VITE_GA_MEASUREMENT_ID is set (unset = feature is
 * simply off, no banner shown either). Never runs in the desktop app.
 */
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

export const analyticsConfigured = () => !!GA_ID;

let loaded = false;

export function loadAnalytics() {
  if (loaded || !GA_ID || typeof document === 'undefined') return;
  loaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line no-inner-declarations
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  // anonymize_ip is on by default in GA4; disabling ad personalization signals
  // since this site has no ads/remarketing.
  gtag('config', GA_ID, { anonymize_ip: true, allow_google_signals: false });
}

/** Track an SPA route change (GA4 doesn't see these automatically). */
export function trackPageview(path) {
  if (!loaded || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', { page_path: path });
}
