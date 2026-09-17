import React, { useState } from 'react';
import { LuMonitorDown } from 'react-icons/lu';
import { isDesktop } from '../../lib/desktop';
import { DESKTOP, RELEASES, releaseDownloadUrl } from '../../lib/desktopApp';

/**
 * Compact "get the Windows app" pair — a primary latest-version download
 * button plus a small version picker for anyone who wants an older build.
 * Hidden inside the desktop app itself (no point downloading it again) and
 * when no build has been published yet (see DESKTOP.available).
 */
const DownloadWidget = ({ className = '' }) => {
  const [ver, setVer] = useState(DESKTOP.version);
  if (isDesktop() || !DESKTOP.available) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <a
        href={DESKTOP.downloadUrl}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm shadow-indigo-600/25 transition-colors hover:bg-indigo-700"
      >
        <LuMonitorDown className="h-4 w-4" />
        Download for Windows
      </a>

      <div className="inline-flex items-center overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <select
          value={ver}
          onChange={(e) => setVer(e.target.value)}
          aria-label="Choose a version to download"
          className="border-0 bg-white px-2 py-2 text-[12.5px] font-medium text-gray-700 focus:outline-none dark:bg-gray-800 dark:text-gray-200"
        >
          {RELEASES.map((r) => (
            <option key={r.version} value={r.version}>
              v{r.version}{r.version === DESKTOP.version ? ' (latest)' : ''}
            </option>
          ))}
        </select>
        <a
          href={releaseDownloadUrl(ver)}
          className="border-l border-gray-200 px-3 py-2 text-[12.5px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-gray-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
        >
          Get
        </a>
      </div>
    </div>
  );
};

export default DownloadWidget;
