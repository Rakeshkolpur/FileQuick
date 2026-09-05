import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConsent, setConsent } from '../lib/consent';
import { analyticsConfigured, loadAnalytics } from '../lib/analytics';

/**
 * Simple cookie/analytics consent banner. Only appears when analytics is
 * actually configured (VITE_GA_MEASUREMENT_ID set) — nothing to consent to
 * otherwise. A prior "accepted" choice silently re-loads analytics on
 * every visit; no banner shown again either way once a choice is made.
 */
const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!analyticsConfigured()) return;
    const choice = getConsent();
    if (choice === 'accepted') loadAnalytics();
    else if (!choice) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => { setConsent('accepted'); loadAnalytics(); setVisible(false); };
  const decline = () => { setConsent('declined'); setVisible(false); };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 p-4 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-gray-600 dark:text-gray-300">
          We use a little analytics to see which tools people find useful — nothing about your files, ever.{' '}
          <Link to="/privacy-policy" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Privacy Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={decline}
            className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-[13px] font-semibold text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:text-gray-200"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-indigo-700"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
