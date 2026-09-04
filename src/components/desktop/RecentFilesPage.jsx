import React, { useEffect, useState } from 'react';
import RecentFileRow from './RecentFileRow';
import { getHistory, clearHistory } from '../../lib/desktop';
import { usePageMeta } from '../../lib/seo';

const RecentFilesPage = () => {
  usePageMeta({ title: 'Recent Files' });
  const [files, setFiles] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getHistory().then((list) => { setFiles(list); setLoaded(true); });
  }, []);

  const onClearAll = async () => {
    await clearHistory();
    setFiles([]);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Recent Files</h1>
        {files.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="flex items-center gap-1.5 text-[13px] font-medium text-red-500 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
        {!loaded ? (
          <p className="px-3 py-6 text-center text-[13px] text-gray-400 dark:text-gray-500">Loading…</p>
        ) : files.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-gray-400 dark:text-gray-500">
            Nothing yet — files you save from any tool will show up here.
          </p>
        ) : (
          files.map((entry) => (
            <RecentFileRow key={entry.path} entry={entry} onRemoved={(p) => setFiles((r) => r.filter((e) => e.path !== p))} />
          ))
        )}
      </div>
    </div>
  );
};

export default RecentFilesPage;
