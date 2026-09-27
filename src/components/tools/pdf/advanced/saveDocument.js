import {
  PDFDocument, PDFName, PDFString, BlendMode, LineCapStyle, degrees,
} from 'pdf-lib';
import { createFontLoader, isStandardFamily, winAnsiSafe, parseColor } from '../../../../lib/pdfAnnotate';
import { removeTextInRegions } from '../../../../lib/pdfTextEdit';
import { ORIGINAL, isChanged } from './records';
import { norm } from './geometry';

const dataUrlBytes = (url) => {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
};

const normalizeUrl = (u) => {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return `mailto:${s}`;
  return `https://${s}`;
};

/**
 * Write every change into the original PDF:
 *  text edits (removed from the content stream, redrawn in place), placed
 *  objects, links, form fields, page rotation / deletion / blank inserts.
 *
 *  slots   – final page order: { key, kind: 'orig'|'blank', index, w, h, rotate0, extra, view }
 *  records – text records (any slot; unchanged ones are skipped)
 *  objects – placed objects, geometry in page points, top-left origin
 *  resolveOriginal(base) – the PDF's own font for a record, { fk, bytes } | null
 */
export async function saveDocument({
  bytes, slots, records, objects, resolveOriginal,
}) {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const loader = createFontLoader(pdf, { local: true });
  const origCount = pdf.getPageCount();

  // 1. Page structure: drop deleted pages, add blank ones where they belong.
  const kept = new Set(slots.filter((s) => s.kind === 'orig').map((s) => s.index));
  for (let i = origCount - 1; i >= 0; i -= 1) if (!kept.has(i)) pdf.removePage(i);
  // pdf-lib's removePage() leaves its page cache stale (getPage(i) would
  // still return the removed page); insertPage() refreshes it, removePage doesn't.
  pdf.pageCache?.invalidate?.();
  slots.forEach((s, i) => { if (s.kind === 'blank') pdf.insertPage(i, [s.w, s.h]); });

  // 2. Fonts.
  const embeddedOrig = new Map();
  const fontFor = async (r, text) => {
    if (r.family === ORIGINAL) {
      const o = await resolveOriginal(r.origBase);
      if (o && [...text].every((ch) => /\s/.test(ch) || o.fk.hasGlyphForCodePoint(ch.codePointAt(0)))) {
        try {
          if (!embeddedOrig.has(r.origBase)) {
            await loader.ensureFontkit();
            // Whole font, not re-subset: PDF-embedded fonts are already subsets.
            embeddedOrig.set(r.origBase, await pdf.embedFont(o.bytes, { subset: false }));
          }
          return { font: embeddedOrig.get(r.origBase), str: text };
        } catch { /* fall back to the matched family */ }
      }
    }
    const fam = r.family === ORIGINAL ? r.fallbackFamily : r.family;
    const bold = r.family === ORIGINAL ? r.origBold : r.bold;
    const italic = r.family === ORIGINAL ? r.origItalic : r.italic;
    const font = await loader.getFont(fam, bold, italic);
    const str = loader.isStd(font) && isStandardFamily(fam) ? winAnsiSafe(text) : text;
    if (loader.covers(font, str)) return { font, str };
    // Characters this font can't draw (e.g. Hindi in Arial's standard
    // version): use a Unicode font installed on the device, else Calibri.
    for (const alt of ['Nirmala UI', 'Segoe UI', 'Calibri']) {
      // eslint-disable-next-line no-await-in-loop
      const f = await loader.getFont(alt, bold, italic);
      if (loader.covers(f, text)) return { font: f, str: text };
    }
    return { font: await loader.getFont('Calibri', bold, italic), str: text };
  };

  const form = objects.some((o) => o.type === 'field-text' || o.type === 'field-check') ? pdf.getForm() : null;
  const usedNames = new Set();
  const fieldName = (want, fallback) => {
    const base = String(want || fallback).trim().replace(/[.\s]+/g, '_') || fallback;
    let name = base;
    let n = 2;
    while (usedNames.has(name) || (form && form.getFieldMaybe(name))) { name = `${base}_${n}`; n += 1; }
    usedNames.add(name);
    return name;
  };

  const changed = records.filter(isChanged);
  let covered = 0;
  let count = 0;

  // 3. Content, page by page (final order).
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const page = pdf.getPage(i);
    const [vx, , , vt] = slot.view;
    const recs = changed.filter((r) => r.slot === slot.key);
    const objs = objects.filter((o) => o.slot === slot.key);
    count += recs.length + objs.length;

    // Text: remove the old glyphs from the content stream, then redraw.
    const regions = recs.filter((r) => r.kind === 'line')
      .map((r) => ({ id: r.id, x0: r.x0, x1: r.x1, y: r.y, size: r.origSize }));
    const matched = regions.length ? removeTextInRegions(pdf, i, regions) : new Set();
    for (const r of recs) {
      if (r.kind === 'line' && !matched.has(r.id)) {
        covered += 1;
        page.drawRectangle({
          x: r.x0 - 1, y: r.y - r.origSize * 0.32, width: r.x1 - r.x0 + 2, height: r.origSize * 1.27, color: parseColor(r.bg),
        });
      }
      const text = r.text.replace(/\s+$/, '');
      if (!text.trim()) continue;
      // eslint-disable-next-line no-await-in-loop
      const { font, str } = await fontFor(r, text);
      page.drawText(str, { x: r.x0, y: r.y, size: r.size, font, color: parseColor(r.color) });
    }

    // Objects, in the order they were placed.
    for (const o of objs) {
      const X = vx + o.x;
      const Yb = vt - (o.y + o.h);
      const Yt = vt - o.y;
      const color = parseColor(o.color || '#000000');
      const lw = o.width || 1;
      switch (o.type) {
        case 'whiteout':
          page.drawRectangle({ x: X, y: Yb, width: o.w, height: o.h, color });
          break;
        case 'highlight':
          page.drawRectangle({
            x: X, y: Yb, width: o.w, height: o.h, color, opacity: 0.4, blendMode: BlendMode.Multiply,
          });
          break;
        case 'underline':
          page.drawLine({ start: { x: X, y: Yb + lw / 2 }, end: { x: X + o.w, y: Yb + lw / 2 }, thickness: lw, color });
          break;
        case 'strike':
          page.drawLine({ start: { x: X, y: Yb + o.h / 2 }, end: { x: X + o.w, y: Yb + o.h / 2 }, thickness: lw, color });
          break;
        case 'rect':
          page.drawRectangle({
            x: X + lw / 2,
            y: Yb + lw / 2,
            width: Math.max(0.1, o.w - lw),
            height: Math.max(0.1, o.h - lw),
            borderColor: color,
            borderWidth: lw,
            color: o.fill ? parseColor(o.fill) : undefined,
          });
          break;
        case 'ellipse':
          page.drawEllipse({
            x: X + o.w / 2,
            y: Yb + o.h / 2,
            xScale: Math.max(0.1, o.w / 2 - lw / 2),
            yScale: Math.max(0.1, o.h / 2 - lw / 2),
            borderColor: color,
            borderWidth: lw,
            color: o.fill ? parseColor(o.fill) : undefined,
          });
          break;
        case 'line': {
          const up = o.dir === 'up';
          page.drawLine({
            start: { x: X, y: up ? Yb : Yt },
            end: { x: X + o.w, y: up ? Yt : Yb },
            thickness: lw,
            color,
            lineCap: LineCapStyle.Round,
          });
          break;
        }
        case 'pen': {
          const sx = o.w / o.pw;
          const sy = o.h / o.ph;
          const d = o.points
            .map(([px, py], k) => `${k ? 'L' : 'M'}${(px * sx).toFixed(2)} ${(py * sy).toFixed(2)}`)
            .join(' ');
          page.drawSvgPath(d, {
            x: X, y: Yt, borderColor: color, borderWidth: lw * Math.sqrt(sx * sy), borderLineCap: LineCapStyle.Round,
          });
          break;
        }
        case 'image': {
          const raw = dataUrlBytes(o.src);
          // eslint-disable-next-line no-await-in-loop
          const img = /^data:image\/jpe?g/i.test(o.src) ? await pdf.embedJpg(raw) : await pdf.embedPng(raw);
          page.drawImage(img, { x: X, y: Yb, width: o.w, height: o.h });
          break;
        }
        case 'link': {
          const url = normalizeUrl(o.url);
          if (!url) break;
          const annot = pdf.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [X, Yb, X + o.w, Yt],
            Border: [0, 0, 0],
            A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
          });
          page.node.addAnnot(pdf.context.register(annot));
          break;
        }
        case 'field-text': {
          const f = form.createTextField(fieldName(o.name, 'text'));
          f.addToPage(page, {
            x: X, y: Yb, width: o.w, height: o.h, borderWidth: 1, borderColor: parseColor('#0ea5e9'), backgroundColor: parseColor('#ffffff'),
          });
          break;
        }
        case 'field-check': {
          const f = form.createCheckBox(fieldName(o.name, 'checkbox'));
          f.addToPage(page, {
            x: X, y: Yb, width: o.w, height: o.h, borderWidth: 1, borderColor: parseColor('#0ea5e9'), backgroundColor: parseColor('#ffffff'),
          });
          break;
        }
        default:
          break;
      }
    }

    const rot = norm((slot.rotate0 || 0) + (slot.extra || 0));
    if (slot.extra || slot.kind === 'blank') page.setRotation(degrees(rot));
  }

  if (form) {
    try { form.updateFieldAppearances(); } catch { /* keep going — viewers can rebuild them */ }
    pdf.catalog.getOrCreateAcroForm().dict.set(PDFName.of('NeedAppearances'), pdf.context.obj(true));
  }

  const out = await pdf.save();
  return {
    bytes: out,
    count,
    covered,
    // only the fonts the user actually picked (not the Unicode rescue fonts)
    fallbacks: [...loader.fallbacks].filter((f) => changed.some((r) => r.family === f)),
  };
}
