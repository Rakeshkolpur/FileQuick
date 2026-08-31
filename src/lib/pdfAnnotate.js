import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
// actually used in a save). pdf-lib subsets them, so the output PDF only grows
// by a few KB per font.
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
 * Font choices shown in the editor. `stack` renders on-canvas; the PDF is
 * written with `std` (a metric-compatible PDF base family — Arial↔Helvetica,
 * Times New Roman↔Times are identical) or `embed` (a real bundled font file).
 */
const FONTS = {
  Arial: { std: SANS, stack: 'Arial, Helvetica, "Liberation Sans", sans-serif' },
  Helvetica: { std: SANS, stack: 'Helvetica, Arial, sans-serif' },
  Calibri: { embed: 'Carlito', stack: 'Calibri, Carlito, "Segoe UI", sans-serif' },
  'Segoe UI': { embed: 'Carlito', stack: '"Segoe UI", Carlito, Arial, sans-serif' },
  Verdana: { embed: 'Carlito', stack: 'Verdana, Carlito, Geneva, sans-serif' },
  Tahoma: { embed: 'Carlito', stack: 'Tahoma, Carlito, Verdana, sans-serif' },
  'Trebuchet MS': { embed: 'Carlito', stack: '"Trebuchet MS", Carlito, Verdana, sans-serif' },
  'Times New Roman': { std: SERIF, stack: '"Times New Roman", Times, "Liberation Serif", serif' },
  Georgia: { embed: 'PTSerif', stack: 'Georgia, "PT Serif", "Times New Roman", serif' },
  Cambria: { embed: 'PTSerif', stack: 'Cambria, "PT Serif", Georgia, serif' },
  'Palatino Linotype': { embed: 'PTSerif', stack: '"Palatino Linotype", "PT Serif", Palatino, serif' },
  'Book Antiqua': { embed: 'PTSerif', stack: '"Book Antiqua", "PT Serif", Palatino, serif' },
  Garamond: { embed: 'Crimson', stack: 'Garamond, "Crimson Text", "EB Garamond", "Times New Roman", serif' },
  'Courier New': { std: MONO, stack: '"Courier New", Courier, monospace' },
  Consolas: { std: MONO, stack: 'Consolas, "Courier New", monospace' },
};

export const FONT_LIST = Object.keys(FONTS);
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
  const cache = {};
  let fontkitReady = false;

  const ensureFontkit = async () => {
    if (fontkitReady) return;
    const { default: fontkit } = await import('@pdf-lib/fontkit');
    pdf.registerFontkit(fontkit);
    fontkitReady = true;
  };

  const getFont = async (familyName, bold, italic) => {
    const conf = FONTS[familyName] || FONTS.Arial;

    if (conf.std) {
      const std = conf.std[(bold ? 1 : 0) + (italic ? 2 : 0)];
      if (!cache[std]) cache[std] = await pdf.embedFont(std);
      return cache[std];
    }

    const fam = EMBED[conf.embed];
    const wantKey = bold && italic ? 'boldItalic' : bold ? 'bold' : italic ? 'italic' : 'regular';
    const loader = fam[wantKey]
      || (bold && fam.bold) || (italic && fam.italic) || fam.regular;
    const key = `${conf.embed}:${wantKey in fam ? wantKey : 'regular'}`;
    if (!cache[key]) {
      await ensureFontkit();
      const mod = await loader();
      const bytes = await fetch(mod.default).then((r) => r.arrayBuffer());
      cache[key] = await pdf.embedFont(bytes, { subset: true });
    }
    return cache[key];
  };

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
