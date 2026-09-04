import React from 'react';
import { Link } from 'react-router-dom';
import {
  LuHardDriveDownload, LuWifiOff, LuInfinity, LuRefreshCw, LuFolderClock, LuShieldCheck, LuMonitor,
} from 'react-icons/lu';
import { usePageMeta } from '../lib/seo';
import { DESKTOP } from '../lib/desktopApp';
import { isDesktop, openOutputFolder, checkForUpdates } from '../lib/desktop';

const DownloadGlyph = ({ className = 'h-5 w-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4" />
  </svg>
);

const PERKS = [
  { Icon: LuInfinity, title: 'No file-size limits', text: 'The web app caps PDFs at 50 MB to protect your browser tab. The desktop app has no cap — batch huge scans and long PDFs.' },
  { Icon: LuWifiOff, title: 'Works offline', text: 'Every tool runs on your machine. A couple of the AI tools fetch their model once on first use, then work with no internet at all.' },
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

  const runningDesktop = isDesktop();

  if (runningDesktop) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300">
          <LuMonitor className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">You’re on the desktop app</h1>
        <p className="mt-2 text-[15px] text-gray-600 dark:text-gray-300">
          No file-size limits, everything runs offline, and your results are saved to your FileQuick
          folder. Updates arrive automatically.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={openOutputFolder}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Open my files folder
          </button>
          <button
            type="button"
            onClick={checkForUpdates}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:border-indigo-300 dark:border-gray-700 dark:text-gray-200"
          >
            Check for updates
          </button>
        </div>
      </div>
    );
  }

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
          The same tools you use here, installed on your PC — no file-size limits, works offline,
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

          {DESKTOP.available ? (
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

        <p className="mt-4 text-[12.5px] text-gray-500 dark:text-gray-400">
          By downloading you agree to the{' '}
          <Link to="/terms-of-service" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Terms of Service
          </Link>. FileQuick is free and as-is, processes files only on this device, and checks GitHub
          for updates.
        </p>

        {!DESKTOP.available && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            The first Windows build is on the way. Meanwhile every tool works right here in your browser —{' '}
            <Link to="/" className="font-semibold underline">open the tools</Link>. You can also{' '}
            <a href={DESKTOP.releasesUrl} className="font-semibold underline" target="_blank" rel="noreferrer">
              watch the releases page
            </a>.
          </p>
        )}

        {DESKTOP.available && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">The installer isn’t code-signed yet — expect two safety prompts:</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>Your browser may say the file <span className="italic">"isn't commonly downloaded"</span> — click <span className="font-semibold">Keep</span> (Chrome/Edge sometimes hide this under a <span className="font-semibold">⌄</span> arrow next to the download).</li>
              <li>Windows may show a blue <span className="italic">"Windows protected your PC"</span> screen when you run it — click <span className="font-semibold">More info → Run anyway</span>.</li>
            </ol>
            <p className="mt-1.5">
              Both happen because the app isn’t signed with a paid certificate yet, not because anything is wrong. It’s
              open source — check every line on{' '}
              <a href={DESKTOP.releasesUrl.replace('/releases', '')} className="underline" target="_blank" rel="noreferrer">GitHub</a>.
            </p>
          </div>
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
