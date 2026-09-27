/**
 * Client-side help for PDF → Word (the layout rebuild itself runs on the
 * conversion server with pdf2docx):
 *
 *  - buildUploadPdf: only the pages the user kept are uploaded, and scanned
 *    pages can be swapped for a text-only copy rebuilt from OCR — the text
 *    sits exactly where it was, so the converter turns it into real,
 *    editable paragraphs instead of a picture.
 *  - cleanDocxFonts: PDFs name fonts by their internal PostScript names
 *    ("TimesNewRomanPSMT", "BookmanOldStyle", "Helvetica"); Word needs the
 *    family names ("Times New Roman", "Bookman Old Style", "Arial").
 */
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { realFamilyName } from './pdfTextEdit';
import { winAnsiSafe } from './pdfAnnotate';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Table grid lines in a scanned page image (px): long thin dark runs, joined
 * across neighbouring rows / columns. Only lines that form a grid are kept —
 * a vertical must touch a horizontal at both ends — so letter strokes and
 * photos don't count.
 */
export function detectRules(canvas) {
  const W = canvas.width;
  const H = canvas.height;
  const px = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const dark = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 1) {
    dark[j] = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114 < 140 ? 1 : 0;
  }
  const maxThick = Math.max(6, Math.round(Math.min(W, H) * 0.004));

  const collect = (outer, inner, at, minLen) => {
    const active = [];
    const done = [];
    for (let a = 0; a < outer; a += 1) {
      const runs = [];
      let s = -1;
      for (let b = 0; b <= inner; b += 1) {
        const on = b < inner && dark[at(a, b)];
        if (on && s < 0) s = b;
        else if (!on && s >= 0) { if (b - s >= minLen) runs.push([s, b - 1]); s = -1; }
      }
      const next = [];
      runs.forEach(([r0, r1]) => {
        const m = active.find((l) => l.a1 === a - 1 && Math.abs(l.b0 - r0) < 5 && Math.abs(l.b1 - r1) < 5);
        if (m) { m.a1 = a; m.b0 = Math.min(m.b0, r0); m.b1 = Math.max(m.b1, r1); next.push(m); } else next.push({ a0: a, a1: a, b0: r0, b1: r1 });
      });
      active.filter((l) => !next.includes(l)).forEach((l) => done.push(l));
      active.length = 0;
      active.push(...next);
    }
    done.push(...active);
    return done.filter((l) => l.a1 - l.a0 + 1 <= maxThick);
  };

  const hs = collect(H, W, (y, x) => y * W + x, Math.max(40, W * 0.04))
    .map((l) => ({ x0: l.b0, x1: l.b1, y0: l.a0, y1: l.a1 }));
  const vs = collect(W, H, (x, y) => y * W + x, Math.max(24, H * 0.01))
    .map((l) => ({ x0: l.a0, x1: l.a1, y0: l.b0, y1: l.b1 }));
  const touches = (h, x, y) => x >= h.x0 - 6 && x <= h.x1 + 6 && y >= h.y0 - 6 && y <= h.y1 + 6;
  const grid = vs.filter((v) => {
    const cx = (v.x0 + v.x1) / 2;
    return hs.some((h) => touches(h, cx, v.y0)) && hs.some((h) => touches(h, cx, v.y1));
  });
  const gridH = hs.filter((h) => grid.some((v) => touches(h, (v.x0 + v.x1) / 2, v.y0) || touches(h, (v.x0 + v.x1) / 2, v.y1)));
  return { h: gridH, v: grid };
}

const clusterPx = (vals, tol = 8) => {
  const out = [];
  [...vals].sort((a, b) => a - b).forEach((v) => {
    const c = out[out.length - 1];
    if (c && v - c.last <= tol) { c.sum += v; c.n += 1; c.last = v; } else out.push({ sum: v, n: 1, last: v });
  });
  return out.map((c) => c.sum / c.n);
};

/**
 * The cells of each detected table grid (px): [{ box, cells: [{ x0, y0, x1, y1 }] }].
 * Cells merged across a missing inner line come out as one wider cell.
 */
export function gridCells(rules) {
  const all = [...rules.h.map((l) => ({ ...l, d: 'h' })), ...rules.v.map((l) => ({ ...l, d: 'v' }))];
  const parent = all.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const touch = (h, v) => (v.x0 + v.x1) / 2 >= h.x0 - 8 && (v.x0 + v.x1) / 2 <= h.x1 + 8 && (h.y0 + h.y1) / 2 >= v.y0 - 8 && (h.y0 + h.y1) / 2 <= v.y1 + 8;
  all.forEach((a, i) => all.forEach((b, j) => {
    if (a.d === 'h' && b.d === 'v' && touch(a, b)) parent[find(i)] = find(j);
  }));
  const groups = new Map();
  all.forEach((l, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(l); });
  const tables = [];
  groups.forEach((g) => {
    const hs = g.filter((l) => l.d === 'h');
    const vs = g.filter((l) => l.d === 'v');
    if (hs.length < 2 || vs.length < 2) return;
    const xs = clusterPx(vs.map((v) => (v.x0 + v.x1) / 2));
    const ys = clusterPx(hs.map((h) => (h.y0 + h.y1) / 2));
    const cells = [];
    for (let i = 0; i + 1 < ys.length; i += 1) {
      const yT = ys[i];
      const yB = ys[i + 1];
      const bx = xs.filter((x) => vs.some((v) => Math.abs((v.x0 + v.x1) / 2 - x) < 8 && v.y0 <= yT + 8 && v.y1 >= yB - 8));
      for (let k = 0; k + 1 < bx.length; k += 1) cells.push({ x0: bx[k], x1: bx[k + 1], y0: yT, y1: yB });
    }
    if (cells.length) {
      tables.push({
        box: { x0: xs[0], x1: xs[xs.length - 1], y0: ys[0], y1: ys[ys.length - 1] }, cells,
      });
    }
  });
  return tables;
}

/** Copy of a canvas region (with a white margin, which OCR likes). */
export function cropCanvas(canvas, r, inset = 7, margin = 16) {
  const x = Math.round(r.x0 + inset);
  const y = Math.round(r.y0 + inset);
  const w = Math.max(1, Math.round(r.x1 - r.x0 - 2 * inset));
  const h = Math.max(1, Math.round(r.y1 - r.y0 - 2 * inset));
  const c = document.createElement('canvas');
  c.width = w + 2 * margin;
  c.height = h + 2 * margin;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, x, y, w, h, margin, margin, w, h);
  return { canvas: c, dx: x - margin, dy: y - margin };
}

/** The page with the table areas blanked out (tables are read cell by cell). */
export function maskTables(canvas, tables) {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  ctx.fillStyle = '#fff';
  tables.forEach((t) => ctx.fillRect(t.box.x0 - 4, t.box.y0 - 4, t.box.x1 - t.box.x0 + 8, t.box.y1 - t.box.y0 + 8));
  return c;
}

/**
 * Tighten each line's box to where its ink actually is (OCR's box for a lone
 * character can stretch to the crop's edge). Lines become one word each and
 * are marked as cell text.
 */
export function inkFit(canvas, lines) {
  const { width: W, height: H } = canvas;
  const px = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  return lines.map((l) => {
    const y0 = Math.max(0, Math.floor(l.bbox.y0));
    const y1 = Math.min(H - 1, Math.ceil(l.bbox.y1));
    let x0 = Infinity;
    let x1 = -1;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = (y * W + x) * 4;
        if (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114 < 150) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      }
    }
    const bbox = x1 >= 0 ? { ...l.bbox, x0, x1: x1 + 1 } : l.bbox;
    return {
      ...l, bbox, words: [{ text: l.text, bbox }], cell: true,
    };
  });
}

/**
 * OCR doesn't report bold. Measure it: the typical stroke thickness of each
 * line (median length of dark horizontal runs), relative to the line's
 * height. Lines clearly heavier than the page's normal text are bold.
 */
export function markBold(canvas, lines) {
  if (lines.length < 2) return lines;
  const { width: W, height: H } = canvas;
  const px = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const weight = (b) => {
    const runs = [];
    const y0 = Math.max(0, Math.floor(b.y0));
    const y1 = Math.min(H - 1, Math.ceil(b.y1));
    const x0 = Math.max(0, Math.floor(b.x0));
    const x1 = Math.min(W - 1, Math.ceil(b.x1));
    for (let y = y0; y <= y1; y += 2) {
      let run = 0;
      for (let x = x0; x <= x1; x += 1) {
        const i = (y * W + x) * 4;
        if (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114 < 130) run += 1;
        else if (run) { runs.push(run); run = 0; }
      }
      if (run) runs.push(run);
    }
    if (runs.length < 6) return null;
    runs.sort((a, b2) => a - b2);
    return runs[Math.floor(runs.length / 2)];
  };
  // Stroke thickness relative to the font size. The height above the
  // baseline (capitals, digits, tall letters ≈ 0.72 em) gives the size for
  // "REPRESENTATION", "31.05.2022" and ordinary text alike.
  const ws = lines.map((l) => {
    const run = weight(l.bbox);
    const chars = l.text.replace(/\s+/g, '').length;
    if (run == null || chars < 3) return null;
    const bl = l.baseline && Number.isFinite(l.baseline.y0) && l.baseline.has_baseline !== false
      ? (l.baseline.y0 + l.baseline.y1) / 2 : null;
    const em = bl != null && bl > l.bbox.y0
      ? (bl - l.bbox.y0) / 0.72
      : (l.bbox.x1 - l.bbox.x0) / (0.52 * chars);
    return run / Math.max(1, em);
  });
  const known = ws.filter((w) => w != null).sort((a, b) => a - b);
  if (known.length < 2) return lines;
  const normal = known[Math.floor(known.length * 0.4)];
  return lines.map((l, i) => ({ ...l, bold: ws[i] != null && ws[i] > normal * 1.35 }));
}

/** Move OCR lines from a crop's coordinates back to the page's. */
export function shiftLines(lines, dx, dy) {
  const box = (b) => b && ({
    ...b, x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0 + dy, y1: b.y1 + dy,
  });
  return lines.map((l) => ({
    ...l, bbox: box(l.bbox), baseline: box(l.baseline), words: (l.words || []).map((w) => ({ ...w, bbox: box(w.bbox) })),
  }));
}

/**
 * plan: [{ index, ocr?: { lines, pxW, pxH, ptW, ptH } }] in output order.
 * Returns the bytes of the PDF to upload.
 */
export async function buildUploadPdf(bytes, plan) {
  const src = await PDFDocument.load(bytes, { updateMetadata: false });
  const out = await PDFDocument.create();
  const keep = plan.filter((p) => !p.ocr).map((p) => p.index);
  const copied = keep.length ? await out.copyPages(src, keep) : [];
  let helv = null;
  let helvBold = null;
  let k = 0;
  const encodable = new Map();
  const safe = (s) => [...winAnsiSafe(s)].filter((ch) => {
    if (!encodable.has(ch)) {
      try { helv.encodeText(ch); encodable.set(ch, true); } catch { encodable.set(ch, false); }
    }
    return encodable.get(ch);
  }).join('');

  for (const p of plan) {
    if (!p.ocr) {
      out.addPage(copied[k]);
      k += 1;
      continue;
    }
    if (!helv) helv = await out.embedFont(StandardFonts.Helvetica);
    if (!helvBold) helvBold = await out.embedFont(StandardFonts.HelveticaBold);
    const {
      lines, pxW, ptW, ptH, rules,
    } = p.ocr;
    const s = pxW / ptW; // image px per PDF pt
    const page = out.addPage([ptW, ptH]);
    const vRules = rules ? rules.v : [];

    // Table grid: redraw a clean grid (every cell's edges, from the aligned
    // row / column positions) so the converter builds a real Word table.
    if (p.ocr.tables && p.ocr.tables.length) {
      const seen = new Set();
      const edge = (x0, y0, x1, y1) => {
        const k = [x0, y0, x1, y1].map((v) => Math.round(v)).join(',');
        if (seen.has(k)) return;
        seen.add(k);
        page.drawLine({
          start: { x: x0 / s, y: ptH - y0 / s }, end: { x: x1 / s, y: ptH - y1 / s }, thickness: 0.6, color: rgb(0, 0, 0),
        });
      };
      p.ocr.tables.forEach((t) => t.cells.forEach((c) => {
        edge(c.x0, c.y0, c.x1, c.y0);
        edge(c.x0, c.y1, c.x1, c.y1);
        edge(c.x0, c.y0, c.x0, c.y1);
        edge(c.x1, c.y0, c.x1, c.y1);
      }));
    }

    lines.forEach((l) => {
      const hasBase = l.baseline && Number.isFinite(l.baseline.y0) && l.baseline.has_baseline !== false;
      const basePx = hasBase ? (l.baseline.y0 + l.baseline.y1) / 2 : l.bbox.y1 - (l.bbox.y1 - l.bbox.y0) * 0.22;
      const crossing = vRules.filter((v) => v.y0 <= l.bbox.y1 && v.y1 >= l.bbox.y0);
      // Words, minus the "|" OCR reads off a table's vertical lines.
      const words = (l.words && l.words.length ? l.words : [{ text: l.text, bbox: l.bbox }])
        .filter((w) => l.cell || !(/^[|¦!Il1[\]]$/.test(w.text.trim()) && crossing.some((v) => w.bbox.x0 <= v.x1 + 6 && w.bbox.x1 >= v.x0 - 6)))
        .map((w) => ({ ...w, text: safe(w.text).trim() }))
        .filter((w) => w.text);
      if (!words.length) return;
      // One size for the whole line: as wide as it was, near what its height says.
      const whole = words.map((w) => w.text).join(' ');
      const boxW = (words[words.length - 1].bbox.x1 - words[0].bbox.x0) / s;
      const byHeight = ((l.bbox.y1 - l.bbox.y0) / s) * 0.72;
      const font = l.bold ? helvBold : helv;
      const unit = font.widthOfTextAtSize(whole, 1);
      const byWidth = unit > 0 ? boxW / unit : byHeight;
      const size = clamp(clamp(byWidth, byHeight * 0.65, byHeight * 1.45), 4, 72);
      // Split at table column lines so each cell's text stays in its cell.
      const segs = [];
      words.forEach((w, i) => {
        const prev = words[i - 1];
        const wall = prev && crossing.some((v) => v.x0 >= prev.bbox.x1 - 3 && v.x1 <= w.bbox.x0 + 3);
        if (!prev || wall) segs.push([w]); else segs[segs.length - 1].push(w);
      });
      segs.forEach((seg) => page.drawText(seg.map((w) => w.text).join(' '), {
        x: seg[0].bbox.x0 / s, y: ptH - basePx / s, size, font, color: rgb(0, 0, 0),
      }));
    });
  }
  return out.save();
}

// PDF / metric-clone names -> the font Word users have.
const ALIAS = {
  helvetica: 'Arial',
  arial: 'Arial',
  arimo: 'Arial',
  liberationsans: 'Arial',
  times: 'Times New Roman',
  timesroman: 'Times New Roman',
  timesnewroman: 'Times New Roman',
  tinos: 'Times New Roman',
  liberationserif: 'Times New Roman',
  courier: 'Courier New',
  couriernew: 'Courier New',
  cousine: 'Courier New',
  liberationmono: 'Courier New',
  carlito: 'Calibri',
  caladea: 'Cambria',
  symbolmt: 'Symbol',
};

export function wordFontName(name) {
  if (!name) return name;
  const base = String(name).replace(/^[A-Z]{6}\+/, '');
  const real = /\s/.test(base) ? base : (realFamilyName(base) || base);
  const key = real.toLowerCase().replace(/[^a-z]/g, '');
  return ALIAS[key] || real;
}

/** Rewrite the font names inside a .docx to real Word family names. */
export async function cleanDocxFonts(blob) {
  try {
    const zip = await JSZip.loadAsync(blob);
    const parts = Object.keys(zip.files).filter((n) => /^word\/(document|styles|fontTable|numbering|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(n));
    let changed = false;
    for (const p of parts) {
      // eslint-disable-next-line no-await-in-loop
      const xml = await zip.file(p).async('string');
      const next = xml
        .replace(/(w:(?:ascii|hAnsi|eastAsia|cs)=")([^"]+)(")/g, (m, a, n, b) => `${a}${wordFontName(n)}${b}`)
        .replace(/(<w:font w:name=")([^"]+)(")/g, (m, a, n, b) => `${a}${wordFontName(n)}${b}`);
      if (next !== xml) { zip.file(p, next); changed = true; }
    }
    if (!changed) return blob;
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  } catch {
    return blob;
  }
}
