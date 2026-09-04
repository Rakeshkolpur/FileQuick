import React, { useState } from 'react';
import { LuFileText, LuImage, LuFile, LuStar, LuMoreVertical, LuFolderOpen, LuTrash2 } from 'react-icons/lu';
import { formatBytes } from '../../lib/format';
import { timeAgo } from '../../lib/timeAgo';
import { openFile, revealFile, removeHistory } from '../../lib/desktop';
import { isFavorite, toggleFavorite } from '../../lib/favorites';

const KIND = {
  pdf: ['text-rose-500 bg-rose-500/10', LuFileText],
  docx: ['text-blue-500 bg-blue-500/10', LuFileText],
  doc: ['text-blue-500 bg-blue-500/10', LuFileText],
  xlsx: ['text-emerald-500 bg-emerald-500/10', LuFileText],
  csv: ['text-emerald-500 bg-emerald-500/10', LuFileText],
  pptx: ['text-amber-500 bg-amber-500/10', LuFileText],
  jpg: ['text-violet-500 bg-violet-500/10', LuImage],
  jpeg: ['text-violet-500 bg-violet-500/10', LuImage],
  png: ['text-violet-500 bg-violet-500/10', LuImage],
  webp: ['text-violet-500 bg-violet-500/10', LuImage],
};

const RecentFileRow = ({ entry, onRemoved }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [fav, setFav] = useState(isFavorite(entry.path));
  const ext = (entry.name.split('.').pop() || '').toLowerCase();
  const [cls, Icon] = KIND[ext] || ['text-gray-400 bg-gray-400/10', LuFile];

  const remove = async () => {
    setMenuOpen(false);
    await removeHistory(entry.path);
    onRemoved?.(entry.path);
  };

  return (
    <div className="group flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${cls}`}>
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <button type="button" onClick={() => openFile(entry.path)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-white">{entry.name}</p>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          {entry.size ? `${formatBytes(entry.size)} · ` : ''}{timeAgo(entry.at)}
        </p>
      </button>
      <button
        type="button"
        onClick={() => setFav(toggleFavorite(entry.path))}
        aria-label="Favorite"
        className={fav ? 'text-amber-400' : 'text-gray-300 hover:text-gray-400 dark:text-gray-600 dark:hover:text-gray-500'}
      >
        <LuStar className="h-4 w-4" fill={fav ? 'currentColor' : 'none'} strokeWidth={2} />
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="More"
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
        >
          <LuMoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-7 z-20 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); revealFile(entry.path); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
              >
                <LuFolderOpen className="h-4 w-4" /> Show in folder
              </button>
              <button
                type="button"
                onClick={remove}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <LuTrash2 className="h-4 w-4" /> Remove from history
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RecentFileRow;
