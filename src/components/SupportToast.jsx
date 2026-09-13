import React, { useEffect, useState } from 'react';
import { SupportModal } from './tool/SupportQR';

const AUTO_MS = 9000;

/**
 * A small, centred, non-blocking popup that shows up after a file downloads
 * (ResultScreen dispatches `fq:downloaded`) inviting the visitor to support
 * the project. Auto-dismisses; closeable any time. Same pop-in/countdown
 * pattern as DesktopBridge's "you're offline" popup, so it fits without new
 * animation work — but this one runs on the web app too, not desktop-only.
 */
const SupportToast = () => {
  const [visible, setVisible] = useState(null); // { at } | null
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    const onDownloaded = () => {
      // Don't interrupt someone who already opened the QR from this toast.
      if (showQR) return;
      setVisible({ at: Date.now() });
    };
    window.addEventListener('fq:downloaded', onDownloaded);
    return () => window.removeEventListener('fq:downloaded', onDownloaded);
  }, [showQR]);

  useEffect(() => {
    if (!visible) return undefined;
    const t = window.setTimeout(() => setVisible(null), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [visible]);

  return (
    <>
      {visible && !showQR && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 pb-20 sm:items-center sm:pb-4 pointer-events-none">
          <div
            key={visible.at}
            className="pointer-events-auto w-full max-w-xs overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
            style={{ animation: 'fq-pop-in 0.2s ease-out' }}
          >
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-white text-base">
                ☕
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Your file is downloaded!</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  If FileQuick saved you time, a small UPI tip helps keep the servers running.
                </p>
                <button
                  type="button"
                  onClick={() => setShowQR(true)}
                  className="mt-2 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
                >
                  Support this project
                </button>
              </div>
              <button
                type="button"
                onClick={() => setVisible(null)}
                aria-label="Dismiss"
                className="flex-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-base leading-none"
              >
                ✕
              </button>
            </div>
            <div className="h-1 w-full bg-gray-100 dark:bg-gray-700">
              <div className="h-full bg-purple-500" style={{ animation: `fq-countdown-bar ${AUTO_MS}ms linear forwards` }} />
            </div>
          </div>
        </div>
      )}

      {showQR && <SupportModal onClose={() => { setShowQR(false); setVisible(null); }} />}
    </>
  );
};

export default SupportToast;
