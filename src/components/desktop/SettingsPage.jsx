import React, { useEffect, useState } from 'react';
import { LuFolderOpen, LuTrash2, LuRefreshCw } from 'react-icons/lu';
import { useTheme } from '../../context/ThemeContext';
import { desktopInfo, openOutputFolder, clearHistory, checkForUpdates } from '../../lib/desktop';
import { usePageMeta } from '../../lib/seo';

const Row = ({ title, text, action }) => (
  <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 last:border-0 dark:border-white/5">
    <div>
      <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{title}</p>
      {text && <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">{text}</p>}
    </div>
    {action}
  </div>
);

const Btn = (p) => (
  <button
    type="button"
    onClick={p.onClick}
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${
      p.danger
        ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10'
        : 'border-gray-200 text-gray-700 hover:border-indigo-300 dark:border-gray-600 dark:text-gray-200'
    }`}
  >
    <p.Icon className="h-3.5 w-3.5" />
    {p.children}
  </button>
);

const SettingsPage = () => {
  usePageMeta({ title: 'Settings' });
  const { dark, toggle } = useTheme();
  const [info, setInfo] = useState(null);
  const [cleared, setCleared] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => { desktopInfo().then(setInfo); }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-extrabold text-gray-900 dark:text-white">Settings</h1>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <Row
          title="Dark Mode"
          text="Switch between light and dark appearance."
          action={
            <button
              type="button"
              onClick={toggle}
              className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${dark ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform ${dark ? 'translate-x-5' : 'translate-x-0'}`} />
              <span className="sr-only">Toggle dark mode</span>
            </button>
          }
        />
        <Row
          title="Your files folder"
          text={info?.outputDir || 'Documents/FileQuick'}
          action={<Btn onClick={openOutputFolder} Icon={LuFolderOpen}>Open</Btn>}
        />
        <Row
          title="Recent files history"
          text={cleared ? 'Cleared.' : 'Remove every entry from Recent Files and Favorites.'}
          action={<Btn onClick={() => { clearHistory(); setCleared(true); }} Icon={LuTrash2} danger>Clear</Btn>}
        />
        <Row
          title="Updates"
          text={checking ? 'Checking…' : 'Check GitHub for a newer version right now.'}
          action={<Btn onClick={() => { setChecking(true); checkForUpdates(); setTimeout(() => setChecking(false), 2500); }} Icon={LuRefreshCw}>Check now</Btn>}
        />
        <Row title="Version" text={`FileQuick Desktop ${info?.version ? `v${info.version}` : ''} · ${info?.platform || ''}`} />
      </div>
    </div>
  );
};

export default SettingsPage;
