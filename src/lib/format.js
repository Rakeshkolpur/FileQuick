export const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export const pct = (from, to) => {
  if (!from) return 0;
  return Math.round((1 - to / from) * 100);
};

export const stripExt = (name = '') => name.replace(/\.[^/.]+$/, '');
