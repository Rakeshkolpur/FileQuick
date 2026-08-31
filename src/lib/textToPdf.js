import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a5: [419.53, 595.28],
};

const FONT_SETS = {
  mono: { regular: StandardFonts.Courier, bold: StandardFonts.CourierBold },
  sans: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold },
  serif: { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold },
};

const MM = 2.834645669;

/** Anything the StandardFonts (WinAnsi) can't render, after our sanitising pass. */
// eslint-disable-next-line no-control-regex
export const UNSUPPORTED_RE = /[^\x09\x0A\x0C\x20-\x7E\xA0-\xFF]/;

// Fancy Unicode punctuation / spacing a plain-text file tends to carry, mapped to
// plain ASCII the built-in PDF fonts can actually draw. Written with \u escapes
// so this source file stays pure ASCII.
const SUBS = [
  [/[\u2018\u2019\u201A\u2032\u2035]/g, "'"],
  [/[\u201C\u201D\u201E\u2033\u2036]/g, '"'],
  [/[\u2013\u2014\u2212\u2015]/g, '-'],
  [/\u2026/g, '...'],
  [/[\u2022\u25CF\u25AA\u00B7\u2043]/g, '-'],
  [/\u200B|\u200C|\u200D|\uFEFF/g, ''],
  [/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' '],
];

export function sanitizeText(input) {
  let s = String(input).replace(/\r\n?/g, '\n');
  for (const [re, to] of SUBS) s = s.replace(re, to);
  return s;
}

function encodeSafe(text, font) {
  try {
    font.encodeText(text);
    return text;
  } catch (_) {
    let out = '';
    for (const ch of text) {
      try {
        font.encodeText(ch);
        out += ch;
      } catch (_e) {
        out += ch === '\t' ? '    ' : '?';
      }
    }
    return out;
  }
}

function wrapLine(line, font, size, maxWidth) {
  const width = (t) => font.widthOfTextAtSize(t, size);
  if (line === '' || width(line) <= maxWidth) return [line];

  const indent = (line.match(/^[ \t]*/) || [''])[0].replace(/\t/g, '    ');
  const tokens = line.match(/\s+|\S+/g) || [line];
  const out = [];
  let cur = '';

  const hardBreak = (tok) => {
    let chunk = '';
    for (const ch of tok) {
      if (chunk === '' || width(chunk + ch) <= maxWidth) chunk += ch;
      else { out.push(chunk); chunk = ch; }
    }
    return chunk;
  };

  for (const tok of tokens) {
    const cand = cur + tok;
    if (cur === '' || width(cand) <= maxWidth) {
      cur = width(cand) > maxWidth && cur === '' ? hardBreak(tok) : cand;
    } else {
      out.push(cur.replace(/\s+$/, ''));
      const next = (/^\s/.test(tok) ? '' : indent) + tok.replace(/^\s+/, '');
      cur = width(next) > maxWidth ? hardBreak(next) : next;
    }
  }
  if (cur !== '') out.push(cur.replace(/\s+$/, ''));
  return out.length ? out : [''];
}

/**
 * Render plain text into a PDF, entirely in the browser.
 *
 * opts: { pageSize, orientation, family, fontSize, marginMm, lineSpacing,
 *         pageNumbers, title }
 */
export async function textToPdf(text, opts = {}) {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
    family = 'mono',
    fontSize = 11,
    marginMm = 18,
    lineSpacing = 1.4,
    pageNumbers = false,
    title = '',
  } = opts;

  const doc = await PDFDocument.create();
  const set = FONT_SETS[family] || FONT_SETS.mono;
  const font = await doc.embedFont(set.regular);
  const boldFont = await doc.embedFont(set.bold);

  let [w, h] = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
  if (orientation === 'landscape') [w, h] = [h, w];

  const margin = Math.max(12, marginMm * MM);
  const maxWidth = w - margin * 2;
  const step = fontSize * lineSpacing;
  const footerRoom = pageNumbers ? 22 : 0;
  const bottom = margin + footerRoom;

  const clean = sanitizeText(text);
  const source = clean.length ? clean : ' ';

  // wrapped output stream: string lines, with `null` = forced page break (\f)
  const stream = [];
  source.split('\n').forEach((para) => {
    para.split('\f').forEach((seg, i) => {
      if (i > 0) stream.push(null);
      wrapLine(seg, font, fontSize, maxWidth).forEach((l) => stream.push(l));
    });
  });

  let page = doc.addPage([w, h]);
  let y = h - margin;
  let pageNo = 1;

  const stampFooter = () => {
    if (!pageNumbers) return;
    const label = String(pageNo);
    const tw = font.widthOfTextAtSize(label, 9);
    page.drawText(label, { x: (w - tw) / 2, y: margin - 4, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  };
  const nextPage = () => {
    stampFooter();
    page = doc.addPage([w, h]);
    y = h - margin;
    pageNo += 1;
  };

  if (title.trim()) {
    const t = encodeSafe(sanitizeText(title.trim()), boldFont);
    page.drawText(t, { x: margin, y: y - (fontSize + 3), size: fontSize + 3, font: boldFont, color: rgb(0, 0, 0) });
    y -= step + (fontSize + 3);
  }

  for (const line of stream) {
    if (line === null) { nextPage(); continue; }
    if (y - fontSize < bottom) nextPage();
    if (line !== '') {
      try {
        page.drawText(encodeSafe(line, font), {
          x: margin,
          y: y - fontSize,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
      } catch (_) { /* skip an un-renderable line rather than fail the whole PDF */ }
    }
    y -= step;
  }
  stampFooter();

  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
