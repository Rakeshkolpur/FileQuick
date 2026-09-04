import React, { useEffect, useState } from 'react';
import { isDesktop, onUpdate, downloadUpdate, installUpdate, revealFile } from '../lib/desktop';

/**
 * Desktop-only chrome: a centred "update available" popup (Download -> progress
 * bar -> Restart Now) and a small toast confirming a save (the Save dialog
 * itself is where the user actually picked the folder). Renders nothing on the web.
 */
const DesktopBridge = () => {
  const [toast, setToast] = useState(null); // { path } | { error } | null
  const [update, setUpdate] = useState(null); // { state, version, percent } | null
  const [dismissed, setDismissed] = useState(false);

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

    return () => {
      window.removeEventListener('fq:saved', onSaved);
      off();
    };
  }, []);

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
    </>
  );
};

export default DesktopBridge;
