/**
 * Parse a page-range string like "1-3, 5, 8-10" into a sorted, de-duplicated
 * array of 1-based page numbers, clamped to [1, total]. Invalid chunks are
 * ignored. Empty / blank input returns [].
 */
export function parsePageRange(spec, total) {
  if (!spec || !String(spec).trim()) return [];
  const out = new Set();
  for (const part of String(spec).split(/[,\s]+/)) {
    const s = part.trim();
    if (!s) continue;
    const m = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i += 1) if (i >= 1 && i <= total) out.add(i);
    } else if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      if (n >= 1 && n <= total) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** Turn a sorted list of page numbers into a compact string: [1,2,3,5] -> "1-3, 5". */
export function formatPageRange(pages) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts = [];
  let start = null;
  let prev = null;
  for (const n of sorted) {
    if (start === null) {
      start = n;
      prev = n;
    } else if (n === prev + 1) {
      prev = n;
    } else {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = n;
      prev = n;
    }
  }
  if (start !== null) parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(', ');
}
