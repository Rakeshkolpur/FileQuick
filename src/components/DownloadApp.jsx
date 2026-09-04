import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LuHardDriveDownload, LuWifiOff, LuInfinity, LuRefreshCw, LuFolderClock, LuShieldCheck, LuMonitor,
} from 'react-icons/lu';
import { usePageMeta } from '../lib/seo';
import { DESKTOP, hasAcceptedEula, setEulaAccepted } from '../lib/desktopApp';

const DownloadGlyph = ({ className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4" />
  </svg>
);

const PERKS = [
  { Icon: LuInfinity, title: 'No file-size limits', text: 'The web app caps PDFs at 50 MB to protect your browser tab. The desktop app has no cap — batch huge scans and long PDFs.' },
  { Icon: LuWifiOff, title: 'Fully offline', text: 'Every tool runs on your machine. Once installed it needs no internet at all — work on a plane, in a vault, anywhere.' },
  { Icon: LuFolderClock, title: 'Your files, kept', text: 'Results are saved into a FileQuick folder on your PC with a history you can reopen later. Nothing leaves your computer.' },
  { Icon: LuRefreshCw, title: 'Automatic updates', text: 'When we ship a new version you get a quiet notification inside the app — one click to update, whenever suits you.' },
  { Icon: LuShieldCheck, title: 'Same privacy promise', text: 'No account, no telemetry, no uploads. The desktop build only ever contacts GitHub to check for a newer version.' },
  { Icon: LuHardDriveDownload, title: 'Every tool bundled', text: 'All the image and PDF tools — plus the ones that need extra libraries — are packaged in, no server required.' },
];

const DownloadApp = () => {
  usePageMeta({
    title: 'Download FileQuick for Desktop',
    description: 'Install FileQuick on Windows for unlimited file sizes, fully offline tools, local file history and automatic updates. Free, no account.',
  });

  const [agreed, setAgreed] = useState(hasAcceptedEula());
  const canDownload = agreed && DESKTOP.available;

  const onToggle = (e) => {
    setAgreed(e.target.checked);
    setEulaAccepted(e.target.checked);
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* hero */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-[13px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
          <LuMonitor className="h-3.5 w-3.5" /> Windows app
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          FileQuick for Desktop
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
          The same tools you use here, installed on your PC — no file-size limits, no internet needed,
          and a local history of everything you make. Free, and still no account.
        </p>
      </div>

      {/* download card */}
      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              FileQuick {DESKTOP.version} <span className="font-medium text-gray-400">·</span>{' '}
              <span className="font-medium text-gray-500 dark:text-gray-400">{DESKTOP.sizeLabel}</span>
            </p>
            <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">{DESKTOP.platform}</p>
          </div>

          {canDownload ? (
            <a
              href={DESKTOP.downloadUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-green-600/25 hover:bg-green-700"
            >
              <DownloadGlyph />
              Download for Windows
            </a>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-gray-200 px-6 py-3 text-sm font-semibold text-gray-400 dark:bg-gray-700 dark:text-gray-500"
            >
              <DownloadGlyph />
              Download for Windows
            </span>
          )}
        </div>

        {/* terms gate */}
        <label className="mt-5 flex items-start gap-3 text-[13px] text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={agreed}
            onChange={onToggle}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
          />
          <span>
            I agree to the{' '}
            <Link to="/terms-of-service" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Terms of Service
            </Link>{' '}
            and the desktop app licence. FileQuick is provided free and as-is, processes files only on
            this device, and checks GitHub for updates.
          </span>
        </label>

        {!DESKTOP.available && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            The first Windows build is on the way. Meanwhile every tool works right here in your browser —{' '}
            <Link to="/" className="font-semibold underline">open the tools</Link>. You can also{' '}
            <a href={DESKTOP.releasesUrl} className="font-semibold underline" target="_blank" rel="noreferrer">
              watch the releases page
            </a>.
          </p>
        )}
        {DESKTOP.available && !agreed && (
          <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">Tick the box above to enable the download.</p>
        )}
      </div>

      {/* perks */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {PERKS.map((p) => (
          <div key={p.title} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
              <p.Icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <h2 className="mt-3 text-[15px] font-bold text-gray-900 dark:text-white">{p.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{p.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl bg-gray-50 p-4 text-[13px] text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
        <p>
          <span className="font-semibold text-gray-900 dark:text-white">System requirements:</span>{' '}
          Windows 10 or 11 (64-bit), ~250 MB free disk space. macOS and Linux builds are planned.
        </p>
        <p className="mt-2">
          Prefer not to install anything? The{' '}
          <Link to="/" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">web version</Link>{' '}
          does everything except the size limit and offline use — and needs zero setup.
        </p>
      </div>
    </div>
  );
};

export default DownloadApp;
