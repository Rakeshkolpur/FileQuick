/** Cookie/analytics consent — one choice, remembered in localStorage. */
const KEY = 'fq.cookieConsent';

export const getConsent = () => {
  try { return localStorage.getItem(KEY); } catch { return null; } // 'accepted' | 'declined' | null
};

export const setConsent = (value) => {
  try { localStorage.setItem(KEY, value); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('fq:consent-changed', { detail: value }));
};
