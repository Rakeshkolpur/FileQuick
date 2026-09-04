import React, { useEffect, useState } from 'react';
import RecentFileRow from './RecentFileRow';
import { getHistory } from '../../lib/desktop';
import { getFavorites } from '../../lib/favorites';
import { usePageMeta } from '../../lib/seo';

const FavoritesPage = () => {
  usePageMeta({ title: 'Favorites' });
  const [files, setFiles] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => getHistory().then((all) => {
      if (!alive) return;
      const favs = new Set(getFavorites());
      setFiles(all.filter((e) => favs.has(e.path)));
    });
    load();
    window.addEventListener('fq:favorites-changed', load);
    return () => { alive = false; window.removeEventListener('fq:favorites-changed', load); };
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-extrabold text-gray-900 dark:text-white">Favorites</h1>
      <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
        {files === null ? (
          <p className="px-3 py-6 text-center text-[13px] text-gray-400 dark:text-gray-500">Loading…</p>
        ) : files.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-gray-400 dark:text-gray-500">
            Star a file in Recent Files to pin it here.
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

export default FavoritesPage;
