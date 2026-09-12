import React, { useEffect, useState } from 'react';
import { isDesktop, onUpdate, downloadUpdate, installUpdate, revealFile } from '../lib/desktop';

const OFFLINE_MS = 10000;

/**
 * Desktop-only chrome: a centred "update available" popup (Download -> progress
 * bar -> Restart Now), a small toast confirming a save (the Save dialog
 * itself is where the user actually picked the folder), and a small centred
 * "you're offline" popup for tools that need a network fetch the first time
 * they run (Remove Background, OCR) — auto-dismisses after 10s, closeable
 * any time. Renders nothing on the web.
 */
const DesktopBridge = () => {
  const [toast, setToast] = useState(null); // { path } | { error } | null
  const [update, setUpdate] = useState(null); // { state, version, percent } | null
  const [dismissed, setDismissed] = useState(false);
  const [offline, setOffline] = useState(null); // { tool, at } | null

  useEffect(() => {
    if (!isDesktop()) return undefined;

    const onSaved = (e) => {
      const d = e.detail || {};
      setToast(d.error ? { error: d.error } : { path: d.path });
      window.clearTimeout(onSaved._t);
      onSaved._t = window.setTimeout(() => setToast(null), 6000);
    };
    window.addEventListener('fq:saved', onSaved);
    const off = onUpdate((p) => {
      setUpdate(p);
      if (p.state === 'available') setDismissed(false);
    });
    const onOffline = (e) => setOffline(e.detail || { tool: 'This tool', at: Date.now() });
    window.addEventListener('fq:offline', onOffline);

    return () => {
      window.removeEventListener('fq:saved', onSaved);
      window.removeEventListener('fq:offline', onOffline);
      off();
    };
  }, []);

  // A fresh `at` (a new dispatch, even for the same tool) restarts the 10s clock.
  useEffect(() => {
    if (!offline) return undefined;
    const t = window.setTimeout(() => setOffline(null), OFFLINE_MS);
    return () => window.clearTimeout(t);
  }, [offline]);

  if (!isDesktop()) return null;

  const showPopup = update && !dismissed && ['available', 'downloading', 'ready'].includes(update.state);

  return (
    <>
      {/* update popup — centred, like the user asked for */}
      {showPopup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-gray-800">
            {update.state === 'available' && (
              <>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Update available</h2>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
                  FileQuick {update.version ? `v${update.version}` : ''} is ready to download.
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:text-gray-200"
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    onClick={downloadUpdate}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Download update
                  </button>
                </div>
              </>
            )}

            {update.state === 'downloading' && (
              <>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Downloading update…</h2>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
                  {typeof update.percent === 'number' ? `${update.percent}%` : 'Starting…'}
                </p>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                    style={{ width: `${Math.max(4, update.percent || 0)}%` }}
                  />
                </div>
              </>
            )}

            {update.state === 'ready' && (
              <>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Update ready</h2>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
                  FileQuick {update.version ? `v${update.version}` : ''} downloaded. Restart to finish installing.
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:text-gray-200"
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    onClick={installUpdate}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    Restart now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* save toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-[13px] text-white shadow-2xl ring-1 ring-white/10 dark:bg-gray-800">
          {toast.error ? (
            <span className="text-red-300">Couldn’t save the file: {toast.error}</span>
          ) : (
            <span className="flex items-center gap-3">
              Saved
              <button
                type="button"
                onClick={() => revealFile(toast.path)}
                className="rounded-md bg-white/10 px-2 py-1 font-semibold hover:bg-white/20"
              >
                Show in folder
              </button>
            </span>
          )}
        </div>
      )}

      {/* "you're offline" popup — small, centred, toast-like; not a blocking
          modal, so no dark backdrop and clicks pass through around it. */}
      {offline && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
          <div
            key={offline.at}
            className="pointer-events-auto w-full max-w-xs overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
            style={{ animation: 'fq-pop-in 0.2s ease-out' }}
          >
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.5a10 10 0 013.5-2.3M19 12.5a10 10 0 00-2.2-1.9M12 20h.01" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">You&rsquo;re offline</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {offline.tool} needs an internet connection the first time it runs. Connect and try again.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOffline(null)}
                aria-label="Dismiss"
                className="flex-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-base leading-none"
              >
                ✕
              </button>
            </div>
            <div className="h-1 w-full bg-gray-100 dark:bg-gray-700">
              <div
                className="h-full bg-amber-500"
                style={{ animation: `fq-countdown-bar ${OFFLINE_MS}ms linear forwards` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DesktopBridge;
