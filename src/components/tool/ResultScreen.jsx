import React, { useEffect, useState } from 'react';
import { formatBytes } from '../../lib/format';

const R = 52;
const CIRC = 2 * Math.PI * R;

/**
 * "Your file is ready" screen: a circular 0–100% progress ring that flips to a
 * green check when done, the output name/size, a Download button and a Back
 * button. Everything stays in the browser.
 *
 *   working       - still processing
 *   done          - the output is ready
 *   progress      - optional real 0..100; when omitted the ring animates itself
 *   fileName/Size - shown in a chip (optional)
 *   subtitle      - free text under the title (e.g. "12 images · 3.4 MB")
 *   downloadLabel - override the primary button text
 *   extra         - node rendered under the Download button (e.g. a per-file list)
 */
const ResultScreen = ({
  working = false,
  done = false,
  progress = null,
  title = 'Your file is ready',
  workingLabel = 'Working…',
  subtitle,
  fileName,
  fileSize,
  downloadLabel,
  onDownload,
  onBack,
  backLabel = 'Back',
  extra = null,
  note = 'The file stays on your device — nothing is uploaded.',
}) => {
  const [auto, setAuto] = useState(0);
  const [dl, setDl] = useState('idle'); // idle | working | done

  useEffect(() => {
    if (progress != null) return undefined;
    if (done) { setAuto(100); return undefined; }
    if (!working) { setAuto(0); return undefined; }
    setAuto(10);
    const id = setInterval(() => {
      setAuto((v) => (v >= 92 ? v : v + Math.max(1, Math.round((92 - v) / 9))));
    }, 170);
    return () => clearInterval(id);
  }, [working, done, progress]);

  const pct = Math.max(0, Math.min(100, Math.round(progress != null ? progress : (done ? 100 : auto))));
  const complete = done && pct >= 100;

  const handleDownload = async () => {
    if (dl !== 'idle' || !onDownload) return;
    setDl('working');
    await new Promise((r) => setTimeout(r, 350));
    try { await onDownload(); }
    finally { setDl('done'); setTimeout(() => setDl('idle'), 2200); }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center py-3 sm:py-4">
      <div className="relative h-16 w-16 sm:h-20 sm:w-20">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="9" className="stroke-gray-200 dark:stroke-gray-700" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            className={complete ? 'stroke-green-500' : 'stroke-purple-600'}
            style={{
              strokeDasharray: CIRC,
              strokeDashoffset: CIRC * (1 - pct / 100),
              transition: 'stroke-dashoffset .35s ease',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {complete ? (
            <svg className="h-7 w-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
              {pct}
              <span className="text-[10px] font-semibold">%</span>
            </span>
          )}
        </div>
      </div>

      <h3 className="mt-2.5 text-sm font-semibold text-gray-900 dark:text-white">
        {complete ? title : workingLabel}
      </h3>

      {complete && subtitle && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      )}

      {complete && fileName && (
        <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1 max-w-[min(20rem,90%)]">
          <svg className="h-3.5 w-3.5 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M8 3h6l6 6v10a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
          <span className="truncate text-xs text-gray-700 dark:text-gray-200">{fileName}</span>
          {fileSize != null && <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{formatBytes(fileSize)}</span>}
        </div>
      )}

      {complete && onDownload && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={dl !== 'idle'}
          className="mt-3 inline-flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-60 transition-opacity"
        >
          {dl === 'working' ? (
            <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg> Preparing…</>
          ) : dl === 'done' ? (
            <><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Downloaded</>
          ) : (
            <><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4" /></svg> {downloadLabel || `Download${fileSize != null ? ` · ${formatBytes(fileSize)}` : ''}`}</>
          )}
        </button>
      )}

      {complete && extra && <div className="mt-3 w-full">{extra}</div>}

      <button
        type="button"
        onClick={onBack}
        className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
        {backLabel}
      </button>

      {note && <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500 max-w-xs">{note}</p>}
    </div>
  );
};

export default ResultScreen;
