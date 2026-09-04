import React, { useEffect, useState } from 'react';
import { isDesktop, onUpdate, installUpdate, openOutputFolder } from '../lib/desktop';

/**
 * Desktop-only chrome: a toast when a file is saved into the FileQuick folder,
 * and a banner when an auto-update is downloading / ready. Renders nothing on
 * the web.
 */
const DesktopBridge = () => {
  const [toast, setToast] = useState(null); // { text, path } | { error }
  const [update, setUpdate] = useState(null); // { state, version, percent }

  useEffect(() => {
    if (!isDesktop()) return undefined;

    const onSaved = (e) => {
      const d = e.detail || {};
      setToast(d.error ? { error: d.error } : { path: d.path });
      window.clearTimeout(onSaved._t);
      onSaved._t = window.setTimeout(() => setToast(null), 6000);
    };
    window.addEventListener('fq:saved', onSaved);
    const off = onUpdate((p) => setUpdate(p));

    return () => {
      window.removeEventListener('fq:saved', onSaved);
      off();
    };
  }, []);

  if (!isDesktop()) return null;

  return (
    <>
      {/* update banner */}
      {update && (update.state === 'downloading' || update.state === 'ready') && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white">
          {update.state === 'downloading' ? (
            <span>Downloading update{typeof update.percent === 'number' ? ` — ${update.percent}%` : '…'}</span>
          ) : (
            <>
              <span>Update {update.version ? `${update.version} ` : ''}ready.</span>
              <button
                type="button"
                onClick={installUpdate}
                className="rounded-md bg-white/15 px-2.5 py-1 font-semibold hover:bg-white/25"
              >
                Restart &amp; install
              </button>
            </>
          )}
        </div>
      )}

      {/* save toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-[13px] text-white shadow-2xl ring-1 ring-white/10 dark:bg-gray-800">
          {toast.error ? (
            <span className="text-red-300">Couldn’t save the file: {toast.error}</span>
          ) : (
            <span className="flex items-center gap-3">
              Saved to your FileQuick folder
              <button
                type="button"
                onClick={openOutputFolder}
                className="rounded-md bg-white/10 px-2 py-1 font-semibold hover:bg-white/20"
              >
                Open folder
              </button>
            </span>
          )}
        </div>
      )}
    </>
  );
};

export default DesktopBridge;
