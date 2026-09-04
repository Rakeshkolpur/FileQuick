/** "2 hours ago" style relative time for the desktop app's Recent Files. */
export function timeAgo(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  const units = [
    [60, 's'], [60, 'm'], [24, 'h'], [7, 'd'], [4.345, 'w'], [12, 'mo'], [Infinity, 'y'],
  ];
  let n = s;
  let label = 's';
  for (const [span, unit] of units) {
    if (n < span) { label = unit; break; }
    n = Math.floor(n / span);
    label = unit;
  }
  if (label === 's' && n < 10) return 'just now';
  const names = { s: 'second', m: 'minute', h: 'hour', d: 'day', w: 'week', mo: 'month', y: 'year' };
  const name = names[label];
  return `${n} ${name}${n === 1 ? '' : 's'} ago`;
}
