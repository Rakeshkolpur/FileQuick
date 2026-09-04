/** Starred file paths — a small per-device list, kept in localStorage (desktop app's Favorites page). */
const KEY = 'fq.favoriteFiles';

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};
const write = (list) => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode */ }
};

export const getFavorites = () => read();
export const isFavorite = (path) => read().includes(path);

export const toggleFavorite = (path) => {
  const list = read();
  const i = list.indexOf(path);
  if (i === -1) list.push(path); else list.splice(i, 1);
  write(list);
  window.dispatchEvent(new CustomEvent('fq:favorites-changed'));
  return list.includes(path);
};
