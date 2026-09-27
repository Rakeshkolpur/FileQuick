import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { localFontBytes } from './localFonts';

// Base render scale: fabric object coordinates live in this space (CSS pixels per
// PDF point). Zoom is applied on top of it via fabric's own viewport zoom, so the
// stored coordinates never change with zoom.
export const BASE_SCALE = 1.5;

const SANS = [
  StandardFonts.Helvetica, StandardFonts.HelveticaBold,
  StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique,
];
const SERIF = [
  StandardFonts.TimesRoman, StandardFonts.TimesRomanBold,
  StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic,
];
const MONO = [
  StandardFonts.Courier, StandardFonts.CourierBold,
  StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique,
];

// Real font files, bundled and lazy-loaded (only fetched when the font is
// actually used in a save). Subsetted when safe (see subsetIsSafe), so the
// output PDF usually grows by only a few KB per font.
const EMBED = {
  Carlito: {
    regular: () => import('../assets/fonts/Carlito-Regular.ttf?url'),
    bold: () => import('../assets/fonts/Carlito-Bold.ttf?url'),
  },
  PTSerif: {
    regular: () => import('../assets/fonts/PTSerif-Regular.ttf?url'),
    bold: () => import('../assets/fonts/PTSerif-Bold.ttf?url'),
    italic: () => import('../assets/fonts/PTSerif-Italic.ttf?url'),
    boldItalic: () => import('../assets/fonts/PTSerif-BoldItalic.ttf?url'),
  },
  Crimson: {
    regular: () => import('../assets/fonts/CrimsonText-Regular.ttf?url'),
    bold: () => import('../assets/fonts/CrimsonText-Bold.ttf?url'),
    italic: () => import('../assets/fonts/CrimsonText-Italic.ttf?url'),
    boldItalic: () => import('../assets/fonts/CrimsonText-BoldItalic.ttf?url'),
  },
};

/**
 * Font choices shown in the editors — the fonts people actually pick in MS
 * Word. `stack` renders on screen (the user's own installed font when they
 * have it). In the PDF, the Advanced PDF Editor first tries the user's real
 * installed font (Local Font Access); otherwise it's written with `std` (a
 * metric-compatible PDF base family — Arial↔Helvetica, Times New Roman↔Times
 * are identical) or `embed` (a bundled look-alike font file). `bold` forces
 * the bold look-alike for fonts that are only ever heavy (Arial Black, Impact).
 */
const FONTS = {
  // sans-serif
  Aptos: { embed: 'Carlito', stack: 'Aptos, Calibri, Carlito, "Segoe UI", sans-serif' },
  Arial: { std: SANS, stack: 'Arial, Helvetica, "Liberation Sans", sans-serif' },
  'Arial Black': { std: SANS, bold: true, stack: '"Arial Black", "Arial Bold", Arial, sans-serif' },
  'Arial Narrow': { std: SANS, stack: '"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif' },
  Calibri: { embed: 'Carlito', stack: 'Calibri, Carlito, "Segoe UI", sans-serif' },
  Candara: { embed: 'Carlito', stack: 'Candara, Calibri, Carlito, sans-serif' },
  'Century Gothic': { std: SANS, stack: '"Century Gothic", "URW Gothic", Futura, Arial, sans-serif' },
  'Comic Sans MS': { embed: 'Carlito', stack: '"Comic Sans MS", "Comic Neue", Carlito, cursive' },
  Corbel: { embed: 'Carlito', stack: 'Corbel, Calibri, Carlito, sans-serif' },
  'Franklin Gothic Medium': { std: SANS, stack: '"Franklin Gothic Medium", "Franklin Gothic", "Arial Narrow", Arial, sans-serif' },
  Helvetica: { std: SANS, stack: 'Helvetica, Arial, sans-serif' },
  Impact: { std: SANS, bold: true, stack: 'Impact, "Arial Black", Arial, sans-serif' },
  'Lucida Sans': { embed: 'Carlito', stack: '"Lucida Sans", "Lucida Sans Unicode", "Lucida Grande", Carlito, sans-serif' },
  'Nirmala UI': { embed: 'Carlito', stack: '"Nirmala UI", "Segoe UI", Carlito, sans-serif' },
  'Segoe UI': { embed: 'Carlito', stack: '"Segoe UI", Carlito, Arial, sans-serif' },
  Tahoma: { embed: 'Carlito', stack: 'Tahoma, Carlito, Verdana, sans-serif' },
  'Trebuchet MS': { embed: 'Carlito', stack: '"Trebuchet MS", Carlito, Verdana, sans-serif' },
  Verdana: { embed: 'Carlito', stack: 'Verdana, Carlito, Geneva, sans-serif' },
  // serif
  'Book Antiqua': { embed: 'PTSerif', stack: '"Book Antiqua", "PT Serif", Palatino, serif' },
  'Bookman Old Style': { embed: 'PTSerif', stack: '"Bookman Old Style", Bookman, "PT Serif", serif' },
  Cambria: { embed: 'PTSerif', stack: 'Cambria, "PT Serif", Georgia, serif' },
  Century: { embed: 'PTSerif', stack: 'Century, "Century Schoolbook", "PT Serif", serif' },
  Constantia: { embed: 'PTSerif', stack: 'Constantia, Cambria, "PT Serif", serif' },
  Garamond: { embed: 'Crimson', stack: 'Garamond, "Crimson Text", "EB Garamond", "Times New Roman", serif' },
  Georgia: { embed: 'PTSerif', stack: 'Georgia, "PT Serif", "Times New Roman", serif' },
  'Palatino Linotype': { embed: 'PTSerif', stack: '"Palatino Linotype", "PT Serif", Palatino, serif' },
  Rockwell: { embed: 'PTSerif', stack: 'Rockwell, "Roboto Slab", "PT Serif", serif' },
  'Times New Roman': { std: SERIF, stack: '"Times New Roman", Times, "Liberation Serif", serif' },
  // monospace
  Consolas: { std: MONO, stack: 'Consolas, "Courier New", monospace' },
  'Courier New': { std: MONO, stack: '"Courier New", Courier, monospace' },
  'Lucida Console': { std: MONO, stack: '"Lucida Console", Consolas, "Courier New", monospace' },
};

/** Alphabetical — every family the editors offer. */
export const FONT_LIST = Object.keys(FONTS).sort((a, b) => a.localeCompare(b));

/** The handful most people reach for in Word, shown first. */
export const POPULAR_FONTS = [
  'Arial', 'Calibri', 'Times New Roman', 'Tahoma', 'Verdana', 'Cambria', 'Georgia',
  'Segoe UI', 'Century Gothic', 'Garamond', 'Book Antiqua', 'Trebuchet MS', 'Comic Sans MS', 'Courier New',
];

export const cssStack = (name) => (FONTS[name] || FONTS.Arial).stack;

export function parseColor(value) {
  if (!value || value === 'transparent') return rgb(0, 0, 0);
  if (value[0] === '#') {
    let h = value.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }
  const m = value.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const [r, g, b] = m[1].split(',').map((x) => parseFloat(x));
    return rgb((r || 0) / 255, (g || 0) / 255, (b || 0) / 255);
  }
  return rgb(0, 0, 0);
}

export function colorOpacity(value) {
  const m = value && value.match(/rgba\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(',').map((x) => parseFloat(x));
    return parts.length > 3 ? parts[3] : 1;
  }
  return 1;
}

const clr = (c) => (c && c.type ? c : undefined);

export const isStandardFamily = (name) => !!(FONTS[name] || FONTS.Arial).std;

/** Standard PDF fonts only cover WinAnsi — map common keyboard/autocorrect punctuation into it. */
export const winAnsiSafe = (s) => String(s)
  .replace(/[‘’‚′]/g, "'")
  .replace(/[“”„″]/g, '"')
  .replace(/[–—−]/g, '-')
  .replace(/…/g, '...')
  .replace(/\u00A0/g, ' ')
  .replace(/[•●]/g, '·');

// Families whose PDF look-alike is (near-)identical — no need to report them.
const TRUE_MATCH = new Set(['Arial', 'Helvetica', 'Times New Roman', 'Courier New']);

const SUBSET_SAMPLE = 'The quick brown fox jumps over the lazy dog. THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 0123456789 ,:;!?()-+/&%@#';

const concatChunks = (parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
};

/**
 * Does fontkit's subsetter (what pdf-lib uses for `subset: true`) produce a
 * valid font for these bytes? It silently corrupts some TrueType fonts
 * (Carlito: 23 of 36 sample glyphs blank). Subset a sample, re-read it, and
 * compare every glyph's outline with the original.
 */
async function subsetIsSafe(fontkit, bytes) {
  try {
    const font = fontkit.create(bytes);
    const glyphs = font.layout(SUBSET_SAMPLE).glyphs;
    const sub = font.createSubset();
    glyphs.forEach((g) => sub.includeGlyph(g));
    const data = await new Promise((resolve, reject) => {
      const parts = [];
      const stream = sub.encodeStream();
      stream.on('data', (c) => parts.push(c));
      stream.on('end', () => resolve(concatChunks(parts)));
      stream.on('error', reject);
    });
    const back = fontkit.create(data);
    return glyphs.every((g) => {
      try {
        return back.getGlyph(sub.glyphs.indexOf(g.id)).path.commands.length
          === font.getGlyph(g.id).path.commands.length;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Per-document font loader.
 *  - getFont(family, bold, italic): an embedded pdf-lib font for one of
 *    FONT_LIST. With `local: true` it first tries the user's own installed
 *    font file (exact match), else the standard/bundled look-alike.
 *  - embedBytes(bytes): embed any TrueType/OpenType font file, subsetting
 *    only when that's verified safe.
 *  - covers(font, text): can this font draw every character?
 *  - fallbacks: families that had to be written with a look-alike.
 */
export function createFontLoader(pdf, { local = false } = {}) {
  const cache = {};
  const std = new WeakSet();
  const fallbacks = new Set();
  let fontkit = null;

  const ensureFontkit = async () => {
    if (fontkit) return fontkit;
    fontkit = (await import('@pdf-lib/fontkit')).default;
    pdf.registerFontkit(fontkit);
    return fontkit;
  };

  const embedBytes = async (bytes) => {
    const fk = await ensureFontkit();
    return pdf.embedFont(bytes, { subset: await subsetIsSafe(fk, bytes) });
  };

  const getFont = async (familyName, bold, italic) => {
    const conf = FONTS[familyName] || FONTS.Arial;

    if (local && FONTS[familyName]) {
      const lkey = `local:${familyName}:${bold ? 1 : 0}${italic ? 1 : 0}`;
      if (!(lkey in cache)) {
        cache[lkey] = null;
        try {
          const got = await localFontBytes(familyName, bold, italic);
          if (got) cache[lkey] = await embedBytes(got.bytes);
        } catch { cache[lkey] = null; }
      }
      if (cache[lkey]) return cache[lkey];
      if (!TRUE_MATCH.has(familyName)) fallbacks.add(familyName);
    }

    const b = bold || !!conf.bold;
    if (conf.std) {
      const name = conf.std[(b ? 1 : 0) + (italic ? 2 : 0)];
      if (!cache[name]) {
        cache[name] = await pdf.embedFont(name);
        std.add(cache[name]);
      }
      return cache[name];
    }

    const fam = EMBED[conf.embed];
    const wantKey = b && italic ? 'boldItalic' : b ? 'bold' : italic ? 'italic' : 'regular';
    const loader = fam[wantKey] || (b && fam.bold) || (italic && fam.italic) || fam.regular;
    const key = `${conf.embed}:${wantKey in fam ? wantKey : 'regular'}`;
    if (!cache[key]) {
      const mod = await loader();
      const bytes = await fetch(mod.default).then((r) => r.arrayBuffer());
      cache[key] = await embedBytes(bytes);
    }
    return cache[key];
  };

  const isStd = (font) => std.has(font);

  const covers = (font, text) => {
    if (std.has(font)) {
      try { font.encodeText(text); return true; } catch { return false; }
    }
    const fk = font?.embedder?.font;
    if (!fk || typeof fk.hasGlyphForCodePoint !== 'function') return true;
    return [...text].every((ch) => /\s/.test(ch) || fk.hasGlyphForCodePoint(ch.codePointAt(0)));
  };

  return { getFont, embedBytes, ensureFontkit, isStd, covers, fallbacks };
}

/**
 * Bake annotation overlays into the original PDF without touching its existing
 * content. Each overlay:
 *   { index,
 *     png:    dataURL|null,           // freehand / arrows / rotated shapes — rasterised
 *     shapes: [ ... ],                // rect / ellipse / line / image — drawn as VECTOR
 *                                     //   so a white "cover" box has a perfectly crisp,
 *                                     //   seam-free edge that blends with the page
 *     texts:  [ { text, x, y, ... } ] // real selectable text
 *   }
 * Draw order per page: png (bottom) -> shapes -> texts (top).
 */
export async function bakeIntoPdf(originalBytes, overlays) {
  const pdf = await PDFDocument.load(originalBytes);
  const pages = pdf.getPages();
  const { getFont } = createFontLoader(pdf);

  for (const ov of overlays) {
    const page = pages[ov.index];
    if (!page) continue;
    const { width, height } = page.getSize();

    if (ov.png) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const img = await pdf.embedPng(ov.png);
        page.drawImage(img, { x: 0, y: 0, width, height });
      } catch (err) {
        // A broken raster layer must not lose the vector shapes / text below.
        // eslint-disable-next-line no-console
        console.warn('overlay image skipped:', err?.message);
      }
    }

    for (const s of ov.shapes || []) {
      if (s.type === 'rect') {
        page.drawRectangle({
          x: s.x, y: s.y, width: s.w, height: s.h,
          color: clr(s.fill),
          opacity: s.fillOpacity ?? 1,
          borderColor: clr(s.stroke),
          borderWidth: s.strokeWidth || 0,
          borderOpacity: s.strokeOpacity ?? 1,
        });
      } else if (s.type === 'ellipse') {
        page.drawEllipse({
          x: s.cx, y: s.cy, xScale: s.rx, yScale: s.ry,
          color: clr(s.fill),
          opacity: s.fillOpacity ?? 1,
          borderColor: clr(s.stroke),
          borderWidth: s.strokeWidth || 0,
          borderOpacity: s.strokeOpacity ?? 1,
        });
      } else if (s.type === 'line') {
        page.drawLine({
          start: { x: s.x1, y: s.y1 }, end: { x: s.x2, y: s.y2 },
          thickness: s.thickness || 1, color: clr(s.color) || rgb(0, 0, 0),
          opacity: s.opacity ?? 1,
        });
      } else if (s.type === 'image' && s.dataUrl) {
        // eslint-disable-next-line no-await-in-loop
        const img = await pdf.embedPng(s.dataUrl);
        page.drawImage(img, { x: s.x, y: s.y, width: s.w, height: s.h, opacity: s.opacity ?? 1 });
      }
    }

    for (const t of ov.texts || []) {
      if (!t.text) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        const font = await getFont(t.family, t.bold, t.italic);
        const isStd = !!(FONTS[t.family] || FONTS.Arial).std;
        let str = String(t.text);
        // Standard PDF fonts only cover WinAnsi. Map the punctuation a keyboard /
        // autocorrect commonly produces so it renders instead of throwing.
        if (isStd) str = str.replace(/[‘’‚′]/g, "'")
          .replace(/[“”„″]/g, '"')
          .replace(/[–—−]/g, '-')
          .replace(/…/g, '...')
          .replace(/\u00A0/g, ' ')
          .replace(/[•●]/g, '·');
        // Keep the line on the page even if the box was dragged near an edge.
        const y = Math.max(2, Math.min(t.y, height - t.size));
        page.drawText(str, {
          x: Math.max(1, t.x),
          y,
          size: t.size,
          font,
          color: t.color,
          opacity: t.opacity ?? 1,
          lineHeight: t.lineHeight || t.size * 1.16,
          maxWidth: t.maxWidth || undefined,
        });
      } catch (err) {
        // One bad glyph shouldn't lose the whole save — skip just this line.
        // eslint-disable-next-line no-console
        console.warn('drawText skipped a line:', err?.message, JSON.stringify(t.text).slice(0, 60));
      }
    }
  }

  return pdf.save();
}
