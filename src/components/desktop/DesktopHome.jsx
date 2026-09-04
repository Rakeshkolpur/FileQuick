import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuFolderOpen, LuChevronDown } from 'react-icons/lu';
import UploadZone from '../home/UploadZone';
import RecentFileRow from './RecentFileRow';
import { getPopularTools, getToolTint } from '../../data/tools';
import { getHistory } from '../../lib/desktop';
import { usePageMeta } from '../../lib/seo';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning!';
  if (h < 17) return 'Good Afternoon!';
  return 'Good Evening!';
};

const DesktopHome = () => {
  usePageMeta(null);
  const uploadRef = useRef(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    getHistory().then(setRecent);
  }, []);

  const popular = getPopularTools().slice(0, 11);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{greeting()} 👋</h1>
          <p className="mt-0.5 text-[14px] text-gray-500 dark:text-gray-400">Welcome back! Let&apos;s get your work done.</p>
        </div>
        <button
          type="button"
          onClick={() => uploadRef.current?.openPicker()}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25 hover:bg-indigo-700"
        >
          <LuFolderOpen className="h-4 w-4" />
          Open File
          <LuChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </div>

      <UploadZone ref={uploadRef} desktop />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-gray-900 dark:text-white">
            <span aria-hidden>🔥</span> Popular Tools
          </h2>
          <Link to="/all-tools" className="text-[13px] font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            View all tools →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {popular.map((t) => (
            <Link
              key={t.id}
              to={`/${t.id}`}
              className="rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${getToolTint(t)}`}>
                <span className="h-5 w-5">{t.icon}</span>
              </span>
              <p className="mt-3 text-[13.5px] font-bold text-gray-900 dark:text-white">{t.title}</p>
              <p className="mt-0.5 line-clamp-1 text-[12px] text-gray-500 dark:text-gray-400">{t.description}</p>
            </Link>
          ))}
          <Link
            to="/all-tools"
            className="grid place-items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center transition-colors hover:border-indigo-300 dark:border-gray-600 dark:bg-white/[0.02]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-300">
              <LuFolderOpen className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <p className="mt-3 text-[13.5px] font-bold text-gray-900 dark:text-white">More Tools</p>
            <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">Explore all tools</p>
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-gray-900 dark:text-white">Recent Files</h2>
          {recent.length > 0 && (
            <Link to="/recent-files" className="text-[13px] font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              See all
            </Link>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
          {recent.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-gray-400 dark:text-gray-500">
              Nothing yet — files you save will show up here.
            </p>
          ) : (
            recent.slice(0, 5).map((entry) => (
              <RecentFileRow key={entry.path} entry={entry} onRemoved={(p) => setRecent((r) => r.filter((e) => e.path !== p))} />
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default DesktopHome;
