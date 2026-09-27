/**
 * Real in-place PDF text editing — the engine behind the Advanced PDF Editor.
 *
 * A PDF has no "text boxes": a page is a content stream of drawing operators,
 * and text is `Tj`/`TJ` operators painting glyph codes at positions computed
 * from a text matrix. To replace a line of text we:
 *
 *  1. tokenize the page's content stream,
 *  2. replay the graphics/text state (q/Q, cm, BT, Tf, Td, Tm, TJ …) to work
 *     out where every glyph lands on the page,
 *  3. rewrite only the text operators that paint glyphs inside the edited
 *     lines — each removed glyph becomes a TJ spacing number of exactly its
 *     own advance, so nothing else on the line or page moves,
 *  4. leave every other byte of the stream untouched.
 *
 * The original glyphs are genuinely gone (not hidden under a white box), so
 * coloured backgrounds, lines and images behind the text stay intact, and the
 * old text can't be copied back out. The new text is then drawn on top.
 *
 * When a font's glyph widths can't be resolved, the operator is made
 * invisible (text render mode 3) instead; if nothing on the page matched an
 * edited line at all (e.g. the text lives inside a form XObject), the caller
 * falls back to covering it.
 */
import {
  PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream,
} from 'pdf-lib';
// pdf-lib's own AFM metrics for the 14 standard PDF fonts (already installed
// as pdf-lib's dependency) — lets us measure text in fonts that ship no
// /Widths table, e.g. anything pdf-lib itself wrote with StandardFonts.
import { Font as StdFont, Encodings } from '@pdf-lib/standard-fonts';
import { FONT_LIST } from './pdfAnnotate';

/* ------------------------------ tokenizer ------------------------------ */

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);
const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

const HEXV = (c) => {
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 65 && c <= 70) return c - 55;
  if (c >= 97 && c <= 102) return c - 87;
  return -1;
};

class Lexer {
  constructor(bytes) {
    this.s = bytes;
    this.i = 0;
  }

  skipWs() {
    const { s } = this;
    while (this.i < s.length) {
      const c = s[this.i];
      if (WS.has(c)) { this.i += 1; continue; }
      if (c === 37) { // % comment
        while (this.i < s.length && s[this.i] !== 10 && s[this.i] !== 13) this.i += 1;
        continue;
      }
      break;
    }
  }

  next() {
    this.skipWs();
    const { s } = this;
    const start = this.i;
    if (start >= s.length) return null;
    const c = s[start];
    if (c === 40) return this.literal(start);
    if (c === 60) {
      if (s[start + 1] === 60) { this.i += 2; return { t: '<<', start, end: this.i }; }
      return this.hex(start);
    }
    if (c === 62 && s[start + 1] === 62) { this.i += 2; return { t: '>>', start, end: this.i }; }
    if (c === 91 || c === 93) { this.i += 1; return { t: c === 91 ? '[' : ']', start, end: this.i }; }
    if (c === 47) { // /Name, with #xx escapes
      this.i += 1;
      let n = '';
      while (this.i < s.length && !WS.has(s[this.i]) && !DELIM.has(s[this.i])) {
        if (s[this.i] === 35 && this.i + 2 < s.length) {
          const h = HEXV(s[this.i + 1]) * 16 + HEXV(s[this.i + 2]);
          if (h >= 0) { n += String.fromCharCode(h); this.i += 3; continue; }
        }
        n += String.fromCharCode(s[this.i]);
        this.i += 1;
      }
      return { t: 'name', v: n, start, end: this.i };
    }
    let w = '';
    while (this.i < s.length && !WS.has(s[this.i]) && !DELIM.has(s[this.i])) {
      w += String.fromCharCode(s[this.i]);
      this.i += 1;
    }
    if (w === '') { this.i += 1; return { t: 'junk', start, end: this.i }; }
    if (NUM_RE.test(w)) return { t: 'num', v: parseFloat(w), start, end: this.i };
    return { t: 'op', v: w, start, end: this.i };
  }

  literal(start) {
    const { s } = this;
    const out = [];
    let depth = 1;
    this.i = start + 1;
    while (this.i < s.length) {
      const c = s[this.i];
      if (c === 92) { // backslash escape
        const n = s[this.i + 1];
        this.i += 2;
        if (n === 110) out.push(10);
        else if (n === 114) out.push(13);
        else if (n === 116) out.push(9);
        else if (n === 98) out.push(8);
        else if (n === 102) out.push(12);
        else if (n === 13) { if (s[this.i] === 10) this.i += 1; } // line continuation
        else if (n === 10) { /* line continuation */ }
        else if (n >= 48 && n <= 55) {
          let v = n - 48;
          for (let k = 0; k < 2 && s[this.i] >= 48 && s[this.i] <= 55; k += 1) {
            v = v * 8 + (s[this.i] - 48);
            this.i += 1;
          }
          out.push(v & 255);
        } else if (n !== undefined) out.push(n);
        continue;
      }
      if (c === 40) depth += 1;
      else if (c === 41) {
        depth -= 1;
        if (depth === 0) { this.i += 1; break; }
      }
      out.push(c);
      this.i += 1;
    }
    return { t: 'str', v: Uint8Array.from(out), start, end: this.i };
  }

  hex(start) {
    const { s } = this;
    const out = [];
    let hi = -1;
    this.i = start + 1;
    while (this.i < s.length && s[this.i] !== 62) {
      const v = HEXV(s[this.i]);
      if (v >= 0) {
        if (hi < 0) hi = v;
        else { out.push(hi * 16 + v); hi = -1; }
      }
      this.i += 1;
    }
    if (hi >= 0) out.push(hi * 16);
    this.i += 1; // closing >
    return { t: 'hex', v: Uint8Array.from(out), start, end: this.i };
  }

  // Inline image data (BI … ID <binary> EI) — skip to the EI keyword.
  skipInlineImage() {
    const { s } = this;
    let i = this.i + 1;
    while (i < s.length - 1) {
      if (s[i] === 69 && s[i + 1] === 73 && WS.has(s[i - 1])
        && (i + 2 >= s.length || WS.has(s[i + 2]) || DELIM.has(s[i + 2]))) {
        this.i = i;
        return;
      }
      i += 1;
    }
    this.i = s.length;
  }
}

/** Content stream bytes -> [{ op, args, start, end }] (byte offsets into the stream). */
export function parseOps(bytes) {
  const lx = new Lexer(bytes);
  const ops = [];
  let args = [];
  let argStart = -1;
  const stack = [];
  let tok;
  // eslint-disable-next-line no-cond-assign
  while ((tok = lx.next())) {
    if (tok.t === '[' || tok.t === '<<') {
      if (!stack.length && argStart < 0) argStart = tok.start;
      stack.push({ kind: tok.t, items: [] });
      continue;
    }
    if (tok.t === ']' || tok.t === '>>') {
      const fr = stack.pop();
      if (!fr) continue;
      const val = { t: fr.kind === '[' ? 'arr' : 'dict', v: fr.items };
      if (stack.length) stack[stack.length - 1].items.push(val);
      else args.push(val);
      continue;
    }
    if (tok.t === 'op' && !stack.length && !['true', 'false', 'null'].includes(tok.v)) {
      ops.push({ op: tok.v, args, start: argStart < 0 ? tok.start : argStart, end: tok.end });
      if (tok.v === 'ID') lx.skipInlineImage();
      args = [];
      argStart = -1;
      continue;
    }
    if (stack.length) stack[stack.length - 1].items.push(tok);
    else {
      if (argStart < 0) argStart = tok.start;
      args.push(tok);
    }
  }
  return ops;
}

/* ------------------------------ matrices ------------------------------ */

const ID = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];
const apply = (m, x, y) => ({ x: x * m[0] + y * m[2] + m[4], y: x * m[1] + y * m[3] + m[5] });

/* ------------------------------ fonts ------------------------------ */

const num = (o) => (o instanceof PDFNumber ? o.asNumber() : null);
const nameOf = (o) => (o instanceof PDFName ? o.decodeText() : null);

/** Resources dict for a page, following /Parent inheritance. */
export function pageResources(pageNode) {
  let n = pageNode;
  for (let d = 0; n && d < 32; d += 1) {
    const r = n.lookup(PDFName.of('Resources'));
    if (r instanceof PDFDict) return r;
    const p = n.lookup(PDFName.of('Parent'));
    n = p instanceof PDFDict ? p : null;
  }
  return null;
}

const STD14 = new Set([
  'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
  'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
  'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
]);

/** "Arial,Bold" / "TimesNewRomanPS-BoldMT" / "Helvetica" -> a standard-14 name, or null. */
function standardName(base) {
  const raw = String(base || '');
  if (STD14.has(raw)) return raw;
  const n = raw.toLowerCase().replace(/[\s_-]/g, '');
  const bold = /bold/.test(n);
  const italic = /italic|oblique/.test(n);
  if (/arial|helvetica/.test(n)) return `Helvetica${bold && italic ? '-BoldOblique' : bold ? '-Bold' : italic ? '-Oblique' : ''}`;
  if (/times/.test(n)) return bold && italic ? 'Times-BoldItalic' : bold ? 'Times-Bold' : italic ? 'Times-Italic' : 'Times-Roman';
  if (/courier/.test(n)) return `Courier${bold && italic ? '-BoldOblique' : bold ? '-Bold' : italic ? '-Oblique' : ''}`;
  return null;
}

let winAnsiNames = null;
const winAnsiCodeToName = () => {
  if (!winAnsiNames) {
    winAnsiNames = new Map();
    Encodings.WinAnsi.supportedCodePoints.forEach((cp) => {
      const { code, name } = Encodings.WinAnsi.encodeUnicodeCodePoint(cp);
      if (!winAnsiNames.has(code)) winAnsiNames.set(code, name);
    });
  }
  return winAnsiNames;
};

/** Code -> width for a non-embedded standard font with no /Widths, or null. */
function standardFontWidths(fontDict) {
  const std = standardName(nameOf(fontDict.lookup(PDFName.of('BaseFont'))));
  if (!std) return null;
  let metrics;
  try { metrics = StdFont.load(std); } catch { return null; }

  // Built-in (StandardEncoding) code -> glyph name, from the AFM itself.
  const builtIn = new Map();
  metrics.CharMetrics.forEach((m) => { if (m.C >= 0) builtIn.set(m.C, m.N); });

  const encObj = fontDict.lookup(PDFName.of('Encoding'));
  let baseName = nameOf(encObj);
  const diffs = new Map();
  if (encObj instanceof PDFDict) {
    baseName = nameOf(encObj.lookup(PDFName.of('BaseEncoding')));
    const d = encObj.lookup(PDFName.of('Differences'));
    if (d instanceof PDFArray) {
      let code = 0;
      for (let i = 0; i < d.size(); i += 1) {
        const v = d.lookup(i);
        if (v instanceof PDFNumber) code = v.asNumber();
        else if (v instanceof PDFName) { diffs.set(code, v.decodeText()); code += 1; }
      }
    }
  }
  // WinAnsi and MacRoman agree below 128; StandardEncoding / none = built-in.
  const base = baseName === 'WinAnsiEncoding' || baseName === 'MacRomanEncoding' ? winAnsiCodeToName() : builtIn;

  return (c) => {
    const name = diffs.get(c) || base.get(c);
    const w = name ? metrics.getWidthOfGlyph(name) : undefined;
    return typeof w === 'number' ? w : 0;
  };
}

/**
 * How to walk a font's glyph codes: bytes per code and each code's advance
 * width. `width` is null when it can't be resolved (standard 14 fonts
 * without /Widths, non-Identity CMaps) — callers then fall back.
 */
function fontInfo(fontDict) {
  const subtype = nameOf(fontDict.lookup(PDFName.of('Subtype')));
  if (subtype === 'Type0') {
    const enc = nameOf(fontDict.lookup(PDFName.of('Encoding')));
    const descs = fontDict.lookup(PDFName.of('DescendantFonts'));
    const desc = descs instanceof PDFArray ? descs.lookup(0) : null;
    if (enc !== 'Identity-H' || !(desc instanceof PDFDict)) return { bytes: 0, width: null };
    const dw = num(desc.lookup(PDFName.of('DW'))) ?? 1000;
    const W = desc.lookup(PDFName.of('W'));
    const single = new Map();
    const ranges = [];
    if (W instanceof PDFArray) {
      let i = 0;
      while (i < W.size()) {
        const first = num(W.lookup(i));
        const nxt = W.lookup(i + 1);
        if (first === null) break;
        if (nxt instanceof PDFArray) {
          for (let j = 0; j < nxt.size(); j += 1) single.set(first + j, num(nxt.lookup(j)) ?? dw);
          i += 2;
        } else {
          ranges.push([first, num(nxt), num(W.lookup(i + 2)) ?? dw]);
          i += 3;
        }
      }
    }
    return {
      bytes: 2,
      scale: 0.001,
      width: (c) => {
        if (single.has(c)) return single.get(c);
        const r = ranges.find((x) => c >= x[0] && c <= x[1]);
        return r ? r[2] : dw;
      },
      isSpace: () => false,
    };
  }

  const widths = fontDict.lookup(PDFName.of('Widths'));
  if (!(widths instanceof PDFArray)) {
    const std = standardFontWidths(fontDict);
    return std ? { bytes: 1, scale: 0.001, width: std, isSpace: (c) => c === 32 } : { bytes: 1, width: null };
  }
  const first = num(fontDict.lookup(PDFName.of('FirstChar'))) ?? 0;
  const fd = fontDict.lookup(PDFName.of('FontDescriptor'));
  const missing = fd instanceof PDFDict ? (num(fd.lookup(PDFName.of('MissingWidth'))) ?? 0) : 0;
  const arr = [];
  for (let i = 0; i < widths.size(); i += 1) arr.push(num(widths.lookup(i)) ?? 0);
  let scale = 0.001;
  if (subtype === 'Type3') {
    const fm = fontDict.lookup(PDFName.of('FontMatrix'));
    scale = (fm instanceof PDFArray && num(fm.lookup(0))) || 0.001;
  }
  return {
    bytes: 1,
    scale,
    width: (c) => (c >= first && c < first + arr.length ? arr[c - first] : missing),
    isSpace: (c) => c === 32,
  };
}

/* ------------------------------ helpers ------------------------------ */

const fmt = (n) => {
  const s = (Math.round(n * 1000) / 1000).toFixed(3);
  return s.replace(/\.?0+$/, '') || '0';
};

const hexOf = (codes, bytes) => codes
  .map((c) => c.toString(16).padStart(bytes * 2, '0'))
  .join('');

const enc = new TextEncoder();

function concatBytes(parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
}

function readContents(page) {
  const c = page.node.lookup(PDFName.of('Contents'));
  const streams = [];
  if (c instanceof PDFArray) {
    for (let i = 0; i < c.size(); i += 1) streams.push(c.lookup(i));
  } else if (c) streams.push(c);
  if (!streams.length) return null;
  const chunks = [];
  for (const s of streams) {
    if (!(s instanceof PDFRawStream)) return null;
    chunks.push(decodePDFRawStream(s).decode());
    chunks.push(Uint8Array.of(10));
  }
  return concatBytes(chunks);
}

/**
 * Is a glyph (centre point on its baseline, in PDF user space) part of an
 * edited line? Regions: { id, x0, x1, y (baseline), size }.
 */
const inRegion = (r, x, y) => Math.abs(y - r.y) <= Math.max(1, r.size * 0.35)
  && x >= r.x0 - r.size * 0.15 && x <= r.x1 + r.size * 0.15;

/**
 * Remove the original glyphs of the given lines from one page's content.
 * Returns the ids of the regions that were matched (had glyphs removed); the
 * rest weren't found in the page stream and need a visual cover instead.
 */
export function removeTextInRegions(pdf, pageIndex, regions, { dryRun = false } = {}) {
  const matched = new Set();
  // dryRun: nothing is written; per-region glyph metrics are collected instead
  const stats = dryRun ? new Map() : null;
  if (!regions.length) return dryRun ? stats : matched;
  const page = pdf.getPage(pageIndex);

  let bytes;
  try { bytes = readContents(page); } catch { bytes = null; }
  if (!bytes) return dryRun ? stats : matched;

  const ops = parseOps(bytes);
  const resources = pageResources(page.node);
  const fontsDict = resources ? resources.lookup(PDFName.of('Font')) : null;
  const fontCache = new Map();
  const getFont = (key) => {
    if (fontCache.has(key)) return fontCache.get(key);
    let info = null;
    try {
      const d = fontsDict instanceof PDFDict ? fontsDict.lookup(PDFName.of(key)) : null;
      if (d instanceof PDFDict) info = fontInfo(d);
    } catch { info = null; }
    fontCache.set(key, info);
    return info;
  };

  let gs = { ctm: ID, Tc: 0, Tw: 0, Tz: 100, TL: 0, font: null, size: 0, Ts: 0, Tr: 0 };
  const gstack = [];
  let Tm = ID;
  let Tlm = ID;
  let tmKnown = true;
  const edits = [];

  const n = (a, i) => (a[i] && a[i].t === 'num' ? a[i].v : 0);
  const moveLine = (tx, ty) => {
    Tlm = mul([1, 0, 0, 1, tx, ty], Tlm);
    Tm = Tlm;
    tmKnown = true;
  };

  const show = (o, elements, prefix) => {
    if (!tmKnown) return;
    const f = gs.font ? getFont(gs.font) : null;
    const Th = gs.Tz / 100;
    const toUser = () => mul(Tm, gs.ctm);

    // Widths unknown: judge by where the operator starts, and make the whole
    // run invisible (render mode 3) rather than guess its glyph advances.
    if (!f || !f.width || !f.bytes || !gs.size || !Th) {
      const p = apply(toUser(), 0, 0);
      const hit = regions.find((r) => inRegion(r, p.x, p.y));
      if (hit && gs.Tr !== 3 && !dryRun) {
        matched.add(hit.id);
        edits.push({
          start: o.start,
          end: o.end,
          bytes: concatBytes([enc.encode(' 3 Tr '), bytes.subarray(o.start, o.end), enc.encode(` ${gs.Tr} Tr `)]),
        });
      }
      tmKnown = false; // advance unknown until the next explicit positioning
      return;
    }

    const out = []; // { k: 'c', codes: [] } | { k: 'n', v }
    const pushNum = (v) => {
      const last = out[out.length - 1];
      if (last && last.k === 'n') last.v += v;
      else out.push({ k: 'n', v });
    };
    const pushCode = (c) => {
      const last = out[out.length - 1];
      if (last && last.k === 'c') last.codes.push(c);
      else out.push({ k: 'c', codes: [c] });
    };

    let removed = false;
    for (const el of elements) {
      if (el.t === 'num') {
        Tm = mul([1, 0, 0, 1, (-el.v / 1000) * gs.size * Th, 0], Tm);
        pushNum(el.v);
        continue;
      }
      if (el.t !== 'str' && el.t !== 'hex') continue;
      const b = el.v;
      for (let i = 0; i + f.bytes <= b.length; i += f.bytes) {
        const code = f.bytes === 2 ? (b[i] << 8) | b[i + 1] : b[i];
        const w = f.width(code) ?? 0;
        const adv = (w * f.scale * gs.size + gs.Tc + (f.isSpace(code) ? gs.Tw : 0)) * Th;
        const c = apply(toUser(), adv / 2, 0);
        const hit = regions.find((r) => inRegion(r, c.x, c.y));
        if (hit && stats) {
          // natural = the glyph's own width, without Tc/Tw/TJ spacing
          const m = toUser();
          const st = stats.get(hit.id) || { natural: 0, minX: Infinity, maxX: -Infinity };
          st.natural += w * f.scale * gs.size * Th * Math.hypot(m[0], m[1]);
          st.minX = Math.min(st.minX, apply(m, 0, 0).x);
          st.maxX = Math.max(st.maxX, apply(m, adv, 0).x);
          if (!f.isSpace(code)) {
            // up to the last visible glyph — trailing spaces don't count
            st.inkNatural = st.natural;
            st.inkMaxX = apply(m, w * f.scale * gs.size * Th, 0).x;
          }
          stats.set(hit.id, st);
        } else if (hit) {
          matched.add(hit.id);
          removed = true;
          pushNum((-adv / (gs.size * Th)) * 1000);
        } else pushCode(code);
        Tm = mul([1, 0, 0, 1, adv, 0], Tm);
      }
    }

    if (!removed) return;
    const arr = out
      .map((e) => (e.k === 'n' ? (Math.abs(e.v) < 0.0005 ? '' : fmt(e.v)) : `<${hexOf(e.codes, f.bytes)}>`))
      .filter(Boolean)
      .join(' ');
    edits.push({ start: o.start, end: o.end, bytes: enc.encode(` ${prefix}[${arr}] TJ `) });
  };

  for (const o of ops) {
    const a = o.args;
    switch (o.op) {
      case 'q': gstack.push({ ...gs }); break;
      case 'Q': if (gstack.length) gs = gstack.pop(); break;
      case 'cm':
        if (a.length === 6) gs = { ...gs, ctm: mul(a.map((t) => t.v || 0), gs.ctm) };
        break;
      case 'BT': Tm = ID; Tlm = ID; tmKnown = true; break;
      case 'Tc': gs = { ...gs, Tc: n(a, 0) }; break;
      case 'Tw': gs = { ...gs, Tw: n(a, 0) }; break;
      case 'Tz': gs = { ...gs, Tz: n(a, 0) }; break;
      case 'TL': gs = { ...gs, TL: n(a, 0) }; break;
      case 'Ts': gs = { ...gs, Ts: n(a, 0) }; break;
      case 'Tr': gs = { ...gs, Tr: n(a, 0) }; break;
      case 'Tf':
        gs = { ...gs, font: a[0] && a[0].t === 'name' ? a[0].v : gs.font, size: n(a, 1) };
        break;
      case 'Td': moveLine(n(a, 0), n(a, 1)); break;
      case 'TD': gs = { ...gs, TL: -n(a, 1) }; moveLine(n(a, 0), n(a, 1)); break;
      case 'Tm':
        if (a.length === 6) { Tm = a.map((t) => t.v || 0); Tlm = Tm; tmKnown = true; }
        break;
      case 'T*': moveLine(0, -gs.TL); break;
      case 'Tj':
        if (a[0]) show(o, [a[0]], '');
        break;
      case 'TJ':
        if (a[0] && a[0].t === 'arr') show(o, a[0].v, '');
        break;
      case "'":
        moveLine(0, -gs.TL);
        if (a[0]) show(o, [a[0]], 'T* ');
        break;
      case '"': {
        const aw = n(a, 0);
        const ac = n(a, 1);
        gs = { ...gs, Tw: aw, Tc: ac };
        moveLine(0, -gs.TL);
        if (a[2]) show(o, [a[2]], `${fmt(aw)} Tw ${fmt(ac)} Tc T* `);
        break;
      }
      default: break;
    }
  }

  if (dryRun) return stats;
  if (!edits.length) return matched;

  edits.sort((x, y) => x.start - y.start);
  const parts = [];
  let pos = 0;
  for (const e of edits) {
    if (e.start < pos) continue; // overlapping edit — keep the first
    parts.push(bytes.subarray(pos, e.start), e.bytes);
    pos = e.end;
  }
  parts.push(bytes.subarray(pos));

  const stream = pdf.context.flateStream(concatBytes(parts));
  page.node.set(PDFName.of('Contents'), pdf.context.register(stream));
  return matched;
}

/**
 * How the original glyphs of each line were laid out: their natural width
 * (sum of glyph widths) and the actual extent. Extra space beyond the natural
 * width is justification. Map id -> { natural, minX, maxX }.
 */
export const measureLines = (pdf, pageIndex, regions) => removeTextInRegions(pdf, pageIndex, regions, { dryRun: true });

/* ------------------------------ rules (underlines) ------------------------------ */

const toHexColor = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;

function colorFrom(args) {
  const v = args.filter((t) => t.t === 'num').map((t) => t.v);
  if (v.length === 1) return [v[0], v[0], v[0]];
  if (v.length === 3) return v;
  if (v.length === 4) return [(1 - v[0]) * (1 - v[3]), (1 - v[1]) * (1 - v[3]), (1 - v[2]) * (1 - v[3])];
  return null;
}

/**
 * Replay the page's path operators and call onPaint for every painted path
 * with its subpaths in user space. Word draws underlines this way — a thin
 * filled rectangle or a stroked horizontal line under the text.
 */
function scanPaths(bytes, onPaint) {
  const ops = parseOps(bytes);
  let gs = { ctm: ID, fill: [0, 0, 0], stroke: [0, 0, 0], lw: 1 };
  const stack = [];
  let subs = [];
  let cur = null;
  const nums = (a) => a.filter((t) => t.t === 'num').map((t) => t.v);
  for (const o of ops) {
    const a = o.args;
    switch (o.op) {
      case 'q': stack.push(gs); break;
      case 'Q': if (stack.length) gs = stack.pop(); break;
      case 'cm': { const m = nums(a); if (m.length === 6) gs = { ...gs, ctm: mul(m, gs.ctm) }; break; }
      case 'w': gs = { ...gs, lw: nums(a)[0] ?? gs.lw }; break;
      case 'g': case 'rg': case 'k': case 'sc': case 'scn': { const c = colorFrom(a); if (c) gs = { ...gs, fill: c }; break; }
      case 'G': case 'RG': case 'K': case 'SC': case 'SCN': { const c = colorFrom(a); if (c) gs = { ...gs, stroke: c }; break; }
      case 're': {
        const [x, y, w, h] = nums(a);
        if (h === undefined) break;
        const p = (px, py) => apply(gs.ctm, px, py);
        subs.push({ pts: [p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h)] });
        cur = null;
        break;
      }
      case 'm': { const [x, y] = nums(a); cur = { pts: [apply(gs.ctm, x, y)] }; subs.push(cur); break; }
      case 'l': { const [x, y] = nums(a); if (cur) cur.pts.push(apply(gs.ctm, x, y)); break; }
      case 'c': case 'v': case 'y': {
        const v = nums(a);
        if (cur) { cur.curved = true; cur.pts.push(apply(gs.ctm, v[v.length - 2], v[v.length - 1])); }
        break;
      }
      case 'f': case 'F': case 'f*': case 'S': case 's': case 'B': case 'B*': case 'b': case 'b*': case 'n':
        if (subs.length && o.op !== 'n') {
          onPaint({ o, subs, fill: /^[fFbB]/.test(o.op), stroke: /^[SsbB]/.test(o.op), gs });
        }
        subs = [];
        cur = null;
        break;
      default: break;
    }
  }
}

/** A thin horizontal bar (underline-like) from one subpath, or null. */
function ruleOf(sub, paint) {
  if (sub.curved || sub.pts.length < 2) return null;
  const xs = sub.pts.map((p) => p.x);
  const ys = sub.pts.map((p) => p.y);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs);
  const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const w = x1 - x0;
  if (paint.fill && sub.pts.length >= 4) {
    const h = y1 - y0;
    if (h > 0.05 && h <= 3.5 && w >= 3 * h) return { x0, x1, y: (y0 + y1) / 2, t: h, color: toHexColor(paint.gs.fill) };
  }
  if (paint.stroke && y1 - y0 < 0.3) {
    const c = paint.gs.ctm;
    const t = Math.max(0.1, paint.gs.lw * Math.sqrt(Math.abs(c[0] * c[3] - c[1] * c[2])) || 0.1);
    if (t <= 3.5 && w >= 3 * t) return { x0, x1, y: (y0 + y1) / 2, t, color: toHexColor(paint.gs.stroke) };
  }
  return null;
}

/** Every underline-like bar drawn directly on a page: [{ x0, x1, y, t, color }]. */
export function findRules(pdf, pageIndex) {
  const out = [];
  let bytes;
  try { bytes = readContents(pdf.getPage(pageIndex)); } catch { bytes = null; }
  if (!bytes) return out;
  scanPaths(bytes, (paint) => {
    paint.subs.forEach((sp) => { const r = ruleOf(sp, paint); if (r) out.push(r); });
  });
  return out;
}

/**
 * Remove the given bars from a page (their paint operator becomes 'n', so
 * the path is simply not drawn). Only paths made entirely of target bars are
 * touched. Returns the ids of the targets removed.
 */
export function removeRules(pdf, pageIndex, targets) {
  const matched = new Set();
  if (!targets.length) return matched;
  const page = pdf.getPage(pageIndex);
  let bytes;
  try { bytes = readContents(page); } catch { bytes = null; }
  if (!bytes) return matched;
  const edits = [];
  const same = (r, t) => Math.abs(r.x0 - t.x0) < 0.75 && Math.abs(r.x1 - t.x1) < 0.75 && Math.abs(r.y - t.y) < 0.75;
  scanPaths(bytes, (paint) => {
    const hits = paint.subs.map((sp) => { const r = ruleOf(sp, paint); return r && targets.find((t) => same(r, t)); });
    if (!hits.length || hits.some((h) => !h)) return;
    hits.forEach((h) => matched.add(h.id));
    edits.push({ start: paint.o.start, end: paint.o.end });
  });
  if (!edits.length) return matched;
  const parts = [];
  let pos = 0;
  edits.sort((x, y) => x.start - y.start).forEach((e) => {
    parts.push(bytes.subarray(pos, e.start), enc.encode(' n '));
    pos = e.end;
  });
  parts.push(bytes.subarray(pos));
  page.node.set(PDFName.of('Contents'), pdf.context.register(pdf.context.flateStream(concatBytes(parts))));
  return matched;
}

/* ------------------------------ tables ------------------------------ */

/** Thin horizontal / vertical bars (and the edges of stroked boxes) from one subpath. */
function barsOf(sub, paint) {
  if (sub.curved || sub.pts.length < 2) return [];
  const xs = sub.pts.map((p) => p.x);
  const ys = sub.pts.map((p) => p.y);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs);
  const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const w = x1 - x0; const h = y1 - y0;
  const c = paint.gs.ctm;
  const lw = Math.max(0.1, paint.gs.lw * Math.sqrt(Math.abs(c[0] * c[3] - c[1] * c[2])) || 0.1);
  const out = [];
  if (paint.fill && sub.pts.length >= 4) {
    const color = toHexColor(paint.gs.fill);
    if (h > 0.05 && h <= 3.5 && w >= 3 * h) out.push({ dir: 'h', a: (y0 + y1) / 2, lo: x0, hi: x1, t: h, color });
    else if (w > 0.05 && w <= 3.5 && h >= 3 * w) out.push({ dir: 'v', a: (x0 + x1) / 2, lo: y0, hi: y1, t: w, color });
  }
  if (paint.stroke && lw <= 3.5) {
    const color = toHexColor(paint.gs.stroke);
    for (let i = 0; i + 1 < sub.pts.length + (sub.pts.length >= 4 ? 1 : 0); i += 1) {
      const p = sub.pts[i]; const q = sub.pts[(i + 1) % sub.pts.length];
      if (Math.abs(p.y - q.y) < 0.3 && Math.abs(p.x - q.x) > 2) out.push({ dir: 'h', a: p.y, lo: Math.min(p.x, q.x), hi: Math.max(p.x, q.x), t: lw, color });
      else if (Math.abs(p.x - q.x) < 0.3 && Math.abs(p.y - q.y) > 2) out.push({ dir: 'v', a: p.x, lo: Math.min(p.y, q.y), hi: Math.max(p.y, q.y), t: lw, color });
    }
  }
  return out;
}

/** Join collinear touching segments (Word draws each cell border separately). */
function mergeBars(list) {
  const s = [...list].sort((p, q) => (Math.abs(p.a - q.a) > 0.8 ? p.a - q.a : p.lo - q.lo));
  const out = [];
  s.forEach((b) => {
    const last = out[out.length - 1];
    if (last && Math.abs(last.a - b.a) <= 0.8 && b.lo <= last.hi + 2) {
      last.hi = Math.max(last.hi, b.hi);
      last.t = Math.max(last.t, b.t);
    } else out.push({ ...b });
  });
  return out;
}

const cluster = (vals, tol = 1.5) => {
  const out = [];
  [...vals].sort((a, b) => a - b).forEach((v) => {
    if (out.length && v - out[out.length - 1].last <= tol) {
      const c = out[out.length - 1];
      c.sum += v; c.n += 1; c.last = v;
    } else out.push({ sum: v, n: 1, last: v });
  });
  return out.map((c) => c.sum / c.n);
};

/**
 * Ruled tables drawn on a page (grids of thin lines), in PDF user space:
 * [{ key, x0, x1, top, bottom, xs (column lines, left→right),
 *    ys (row lines, top→bottom), t, color }].
 */
export function findTables(pdf, pageIndex) {
  let bytes;
  try { bytes = readContents(pdf.getPage(pageIndex)); } catch { bytes = null; }
  if (!bytes) return [];
  const H = []; const V = [];
  scanPaths(bytes, (paint) => paint.subs.forEach((sp) => barsOf(sp, paint).forEach((b) => (b.dir === 'h' ? H : V).push(b))));
  const hs = mergeBars(H).filter((b) => b.hi - b.lo >= 20);
  const vs = mergeBars(V).filter((b) => b.hi - b.lo >= 6);
  if (hs.length < 2 || vs.length < 2) return [];

  // Connected groups of crossing / touching lines = one table each.
  const all = [...hs.map((b) => ({ ...b, dir: 'h' })), ...vs.map((b) => ({ ...b, dir: 'v' }))];
  const parent = all.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const touch = (h, v) => v.a >= h.lo - 2 && v.a <= h.hi + 2 && h.a >= v.lo - 2 && h.a <= v.hi + 2;
  all.forEach((h, i) => {
    if (h.dir !== 'h') return;
    all.forEach((v, j) => { if (v.dir === 'v' && touch(h, v)) parent[find(i)] = find(j); });
  });
  const groups = new Map();
  all.forEach((b, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(b);
  });

  const tables = [];
  groups.forEach((g) => {
    const gh = g.filter((b) => b.dir === 'h');
    const gv = g.filter((b) => b.dir === 'v');
    const xs = cluster(gv.map((b) => b.a));
    const ys = cluster(gh.map((b) => b.a)).reverse();
    if (xs.length < 2 || ys.length < 2 || (xs.length < 3 && ys.length < 3)) return; // a lone box isn't a table
    const ts = g.map((b) => b.t).sort((a, b) => a - b);
    const colors = new Map();
    g.forEach((b) => colors.set(b.color, (colors.get(b.color) || 0) + 1));
    tables.push({
      key: `t${pageIndex}-${tables.length}`,
      x0: xs[0],
      x1: xs[xs.length - 1],
      top: ys[0],
      bottom: ys[ys.length - 1],
      xs,
      ys,
      t: ts[Math.floor(ts.length / 2)],
      color: [...colors.entries()].sort((a, b) => b[1] - a[1])[0][0],
    });
  });
  return tables;
}

/* ------------------------- the document's own fonts ------------------------- */

/** All fonts on every page, keyed by /BaseFont (e.g. "ABCDEF+Calibri"). */
export function collectFonts(pdf) {
  const byBase = new Map();
  pdf.getPages().forEach((page) => {
    const res = pageResources(page.node);
    const fonts = res ? res.lookup(PDFName.of('Font')) : null;
    if (!(fonts instanceof PDFDict)) return;
    fonts.keys().forEach((k) => {
      const d = fonts.lookup(k);
      if (!(d instanceof PDFDict)) return;
      const base = nameOf(d.lookup(PDFName.of('BaseFont')));
      if (base && !byBase.has(base)) byBase.set(base, d);
    });
  });
  return byBase;
}

/**
 * The font program embedded in the PDF for this font, if it's a format we can
 * re-use to draw new text (TrueType, or OpenType). Null otherwise.
 */
export function embeddedFontFile(fontDict) {
  try {
    let d = fontDict;
    if (nameOf(d.lookup(PDFName.of('Subtype'))) === 'Type0') {
      const descs = d.lookup(PDFName.of('DescendantFonts'));
      d = descs instanceof PDFArray ? descs.lookup(0) : null;
      if (!(d instanceof PDFDict)) return null;
    }
    const fd = d.lookup(PDFName.of('FontDescriptor'));
    if (!(fd instanceof PDFDict)) return null;
    const ff2 = fd.lookup(PDFName.of('FontFile2'));
    if (ff2 instanceof PDFRawStream) return decodePDFRawStream(ff2).decode();
    const ff3 = fd.lookup(PDFName.of('FontFile3'));
    if (ff3 instanceof PDFRawStream && nameOf(ff3.dict.lookup(PDFName.of('Subtype'))) === 'OpenType') {
      return decodePDFRawStream(ff3).decode();
    }
  } catch { /* unreadable font — fall back to a matched family */ }
  return null;
}

/* --------------------------- font name matching --------------------------- */

// Legacy / metric-clone names -> the editor family they stand for.
const FAMILY_HINTS = [
  [/franklingothic/, 'Franklin Gothic Medium'],
  [/bookman/, 'Bookman Old Style'],
  [/centuryschoolbook/, 'Century'],
  [/arial|arimo|liberationsans/, 'Arial'],
  [/helvetica/, 'Helvetica'],
  [/calibri|carlito/, 'Calibri'],
  [/cambria/, 'Cambria'],
  [/segoe/, 'Segoe UI'],
  [/verdana/, 'Verdana'],
  [/tahoma/, 'Tahoma'],
  [/trebuchet/, 'Trebuchet MS'],
  [/georgia/, 'Georgia'],
  [/palatino/, 'Palatino Linotype'],
  [/garamond/, 'Garamond'],
  [/times|tinos|liberationserif/, 'Times New Roman'],
  [/courier|cousine|liberationmono/, 'Courier New'],
  [/consolas/, 'Consolas'],
];

/** Strip the 6-letter subset prefix: "ABCDEF+Calibri-Bold" -> "Calibri-Bold". */
export const cleanFontName = (base) => String(base || '').replace(/^[A-Z]{6}\+/, '');

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
// Every editor family, longest first so "Arial Narrow" wins over "Arial".
const LIST_HINTS = FONT_LIST.map((f) => [squash(f), f]).sort((a, b) => b[0].length - a[0].length);

/**
 * The real family name behind a PDF font name, as installed fonts call it:
 * "ABCDEF+BookmanOldStyle-Bold" -> "Bookman Old Style",
 * "TimesNewRomanPS-BoldMT" -> "Times New Roman", "SegoeUI" -> "Segoe UI".
 */
export function realFamilyName(base) {
  let s = cleanFontName(base).split(',')[0].split('-')[0];
  s = s.replace(/(PSMT|PS|MT)$/, '');
  for (let i = 0; i < 3; i += 1) s = s.replace(/(Bold|Italic|Oblique|Regular)$/, '');
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').trim();
}

/**
 * Best editor font family + style for an original PDF font, from its name
 * and pdf.js' font flags.
 */
export function matchFamily(base, flags = {}) {
  const n = cleanFontName(base).toLowerCase().replace(/[\s_-]/g, '');
  const bold = /bold|black|heavy|semibold|demi/.test(n) || !!flags.bold || !!flags.black;
  const italic = /italic|oblique/.test(n) || !!flags.italic;
  const real = realFamilyName(base);
  let family = (LIST_HINTS.find(([k]) => k === squash(real)) || [])[1] || null;
  if (!family) { const hint = FAMILY_HINTS.find(([re]) => re.test(n)); family = hint ? hint[1] : null; }
  if (!family) family = (LIST_HINTS.find(([k]) => k.length > 4 && n.includes(k)) || [])[1] || null;
  if (!family) family = flags.isMonospace ? 'Courier New' : flags.isSerifFont ? 'Times New Roman' : 'Arial';
  // local: the exact installed family to use when the user has it
  return { family, bold, italic, local: real || family };
}

/* --------------------------- lines from pdf.js --------------------------- */

/**
 * Group pdf.js text items into editable lines (runs of horizontal text on one
 * baseline, split where a gap is wide enough to be a new column). Coordinates
 * are PDF user space: x0/x1 along the baseline y, size = font size.
 */
export function groupLines(items, pageIndex, walls = []) {
  const glyphs = [];
  items.forEach((it) => {
    if (!it.str || !it.str.trim() || !it.transform) return;
    const [a, b, c, d, e, f] = it.transform;
    const horizontal = a > 0 && d > 0 && Math.abs(b) <= Math.abs(a) * 0.02 && Math.abs(c) <= Math.abs(d) * 0.02;
    if (!horizontal) return;
    glyphs.push({ str: it.str, x: e, y: f, w: it.width, size: Math.abs(d), font: it.fontName });
  });
  glyphs.sort((p, q) => (Math.abs(p.y - q.y) > 0.5 ? q.y - p.y : p.x - q.x));

  // A table cell border between two pieces of text always separates them.
  const wallBetween = (x0, x1, y) => walls.some((w) => w.x > x0 - 0.5 && w.x < x1 + 0.5 && y >= w.y0 - 2 && y <= w.y1 + 2);

  // Pass 1 — runs on one baseline. Generous (2.5 em) so a stretched,
  // justified line isn't cut into words…
  const rows = [];
  glyphs.forEach((g) => {
    let L = null;
    for (let i = rows.length - 1; i >= 0 && i >= rows.length - 6; i -= 1) {
      const l = rows[i];
      const tol = 0.3 * Math.min(l.size, g.size);
      if (Math.abs(l.y - g.y) <= tol && g.x >= l.x1 - 0.5 * g.size
        && g.x - l.x1 <= 2.5 * Math.max(l.size, g.size) && !wallBetween(l.x1, g.x, g.y)) {
        L = l;
        break;
      }
    }
    if (L) {
      L.parts.push(g);
      L.x1 = Math.max(L.x1, g.x + g.w);
      L.size = Math.max(L.size, g.size);
    } else rows.push({ y: g.y, x1: g.x + g.w, size: g.size, parts: [g] });
  });

  // Pass 2 — …but cells of a table row (S.No | Date | Description) are
  // separate. Justified text has evenly sized gaps; columns don't. Split a
  // run wherever a gap is much wider than the run's normal word gap.
  const pieces = [];
  rows.forEach((row) => {
    const { parts } = row;
    const em = row.size;
    const gaps = parts.slice(1).map((p, i) => p.x - (parts[i].x + parts[i].w));
    const wordGaps = gaps.filter((v) => v > 0.18 * em).sort((p, q) => p - q);
    const median = wordGaps.length ? wordGaps[Math.floor(wordGaps.length / 2)] : 0;
    const max = wordGaps.length ? wordGaps[wordGaps.length - 1] : 0;
    const evenlyJustified = wordGaps.length >= 3 && max <= 1.6 * median;
    const limit = evenlyJustified ? Infinity : Math.max(1.2 * em, 1.6 * median);
    let cur = [parts[0]];
    gaps.forEach((gap, i) => {
      if (gap > limit) { pieces.push(cur); cur = []; }
      cur.push(parts[i + 1]);
    });
    pieces.push(cur);
  });

  return pieces.map((ps, i) => {
    let text = '';
    const fonts = {};
    ps.forEach((g, k) => {
      if (k) {
        const gap = g.x - (ps[k - 1].x + ps[k - 1].w);
        if (gap > 0.18 * g.size && !text.endsWith(' ') && !g.str.startsWith(' ')) text += ' ';
      }
      text += g.str;
      fonts[g.font] = (fonts[g.font] || 0) + g.str.length;
    });
    const fontName = Object.entries(fonts).sort((p, q) => q[1] - p[1])[0][0];
    return {
      id: `p${pageIndex}-l${i}`,
      page: pageIndex,
      x0: ps[0].x,
      x1: Math.max(...ps.map((g) => g.x + g.w)),
      y: ps[0].y,
      size: Math.max(...ps.map((g) => g.size)),
      text: text.replace(/\s+$/, ''),
      fontName,
    };
  });
}
