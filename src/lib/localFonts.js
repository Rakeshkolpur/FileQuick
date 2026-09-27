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
    // A .ttc collection can't be embedded as-is — fall back.
    if (bytes[0] === 0x74 && bytes[1] === 0x74 && bytes[2] === 0x63 && bytes[3] === 0x66) return null;
    return { bytes, exact: score(pick) >= 3, name: pick.postscriptName };
  } catch {
    return null;
  }
}
