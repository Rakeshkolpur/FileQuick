/**
 * The fonts installed on the user's own computer (Local Font Access API,
 * Chrome/Edge 103+ and the desktop app). Lets a PDF be written with the real
 * Arial / Tahoma / Century Gothic the user sees on screen instead of a
 * look-alike. Nothing leaves the device — the font file is read locally and
 * embedded into the user's own PDF, the same thing Word's "embed fonts" does.
 *
 * The browser asks permission once. `requestLocalFonts()` must be started from
 * a click (user activation); if it's unsupported or refused, callers fall
 * back to a matched bundled font.
 */

let listPromise = null;

export const localFontsSupported = () => typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function';

/** Kick off (or reuse) the permission prompt + font list. Call from a click handler. */
export function requestLocalFonts() {
  if (!localFontsSupported()) return Promise.resolve([]);
  if (!listPromise) {
    listPromise = window.queryLocalFonts().catch(() => {
      listPromise = null; // denied / dismissed — allow a later retry
      return [];
    });
  }
  return listPromise;
}

const isBold = (style) => /bold|black|heavy/i.test(style);
const isItalic = (style) => /italic|oblique/i.test(style);

/**
 * Font file bytes for an installed family in the wanted style, or null.
 * `exact` is false when the family lacks that style (e.g. no Bold) and the
 * nearest one was returned instead.
 */
export async function localFontBytes(family, bold, italic) {
  const list = await requestLocalFonts();
  const want = String(family).toLowerCase();
  const candidates = list.filter((f) => String(f.family).toLowerCase() === want);
  if (!candidates.length) return null;
  const score = (f) => (isBold(f.style) === !!bold ? 2 : 0)
    + (isItalic(f.style) === !!italic ? 1 : 0)
    + (/^(regular|normal|roman|book)$/i.test(f.style) ? 0.1 : 0);
  const pick = [...candidates].sort((a, b) => score(b) - score(a))[0];
  try {
    const bytes = new Uint8Array(await (await pick.blob()).arrayBuffer());
    // A .ttc collection (Cambria, MS Gothic …) holds several fonts — pull
    // out the one we want as a normal standalone font file.
    const isTtc = bytes[0] === 0x74 && bytes[1] === 0x74 && bytes[2] === 0x63 && bytes[3] === 0x66;
    const out = isTtc ? ttcSubfont(bytes, pick.postscriptName) : bytes;
    if (!out) return null;
    return { bytes: out, exact: score(pick) >= 3, name: pick.postscriptName };
  } catch {
    return null;
  }
}

/* ---------------------- font collections (.ttc) ---------------------- */

const tag4 = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

function tableDir(dv, bytes, off) {
  const n = dv.getUint16(off + 4);
  const recs = [];
  for (let t = 0; t < n; t += 1) {
    const r = off + 12 + t * 16;
    recs.push({
      tag: tag4(bytes, r), sum: dv.getUint32(r + 4), offset: dv.getUint32(r + 8), length: dv.getUint32(r + 12),
    });
  }
  return { version: dv.getUint32(off), recs };
}

/** PostScript name (name ID 6) of the font whose table directory is at `off`. */
function postscriptNameAt(dv, bytes, off) {
  const name = tableDir(dv, bytes, off).recs.find((r) => r.tag === 'name');
  if (!name) return '';
  const base = name.offset;
  const count = dv.getUint16(base + 2);
  const strings = base + dv.getUint16(base + 4);
  for (let i = 0; i < count; i += 1) {
    const r = base + 6 + i * 12;
    if (dv.getUint16(r + 6) !== 6) continue;
    const platform = dv.getUint16(r);
    const len = dv.getUint16(r + 8);
    const at = strings + dv.getUint16(r + 10);
    let s = '';
    if (platform === 3 || platform === 0) {
      for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(dv.getUint16(at + k));
    } else {
      for (let k = 0; k < len; k += 1) s += String.fromCharCode(bytes[at + k]);
    }
    if (s) return s;
  }
  return '';
}

/** Rebuild one font of a .ttc collection as a standalone .ttf/.otf. */
export function ttcSubfont(bytes, postscriptName) {
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const num = dv.getUint32(8);
    const offsets = Array.from({ length: num }, (_, i) => dv.getUint32(12 + i * 4));
    const off = offsets.find((o) => postscriptNameAt(dv, bytes, o) === postscriptName) ?? offsets[0];
    if (off == null) return null;
    const { version, recs } = tableDir(dv, bytes, off);
    const n = recs.length;
    const pad4 = (x) => (x + 3) & ~3;
    let size = 12 + 16 * n;
    const placed = recs.map((r) => { const at = size; size += pad4(r.length); return { ...r, at }; });
    const out = new Uint8Array(size);
    const ov = new DataView(out.buffer);
    const es = Math.floor(Math.log2(n));
    ov.setUint32(0, version);
    ov.setUint16(4, n);
    ov.setUint16(6, (2 ** es) * 16);
    ov.setUint16(8, es);
    ov.setUint16(10, n * 16 - (2 ** es) * 16);
    placed.forEach((r, t) => {
      const o = 12 + t * 16;
      for (let k = 0; k < 4; k += 1) out[o + k] = r.tag.charCodeAt(k);
      ov.setUint32(o + 4, r.sum);
      ov.setUint32(o + 8, r.at);
      ov.setUint32(o + 12, r.length);
      out.set(bytes.subarray(r.offset, r.offset + r.length), r.at);
    });
    return out;
  } catch {
    return null;
  }
}
