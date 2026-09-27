import React, {
  useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { PDFDocument } from 'pdf-lib';
import FileDropzone from '../../tool/FileDropzone';
import ResultScreen from '../../tool/ResultScreen';
import OpenInPdfTool from '../../tool/OpenInPdfTool';
import { ToolBackContext } from '../../ToolWrapper';
import { downloadBlob } from '../../tool/DownloadButton';
import { PDF_RENDER_MB } from '../../../lib/fileValidation';
import { stripExt } from '../../../lib/format';
import { consumePdfHandoff } from '../../../lib/pdfHandoff';
import { openPdf } from '../../../lib/pdfjs';
import {
  FONT_LIST, cssStack, createFontLoader, isStandardFamily, winAnsiSafe, parseColor,
} from '../../../lib/pdfAnnotate';
import {
  groupLines, removeTextInRegions, collectFonts, embeddedFontFile, matchFamily, cleanFontName,
} from '../../../lib/pdfTextEdit';

const ORIGINAL = '__original__';
const MAX_SCALE = 1.5;

/* ------------------------------ helpers ------------------------------ */

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * Text colour + background colour of a line, read off the rendered page:
 * the most common colour on the rim around the line is the background; the
 * pixels furthest from it are the ink.
 */
function sampleColors(ctx, x, y, w, h) {
  const X = Math.max(0, Math.floor(x));
  const Y = Math.max(0, Math.floor(y));
  const W = Math.max(1, Math.min(ctx.canvas.width - X, Math.ceil(w)));
  const H = Math.max(1, Math.min(ctx.canvas.height - Y, Math.ceil(h)));
  let data;
  try { data = ctx.getImageData(X, Y, W, H).data; } catch { return { color: '#000000', bg: '#ffffff' }; }

  const counts = new Map();
  const px = (i) => [data[i], data[i + 1], data[i + 2]];
  for (let yy = 0; yy < H; yy += 1) {
    for (let xx = 0; xx < W; xx += 1) {
      if (yy > 1 && yy < H - 2 && xx > 1 && xx < W - 2) continue; // rim only
      const [r, g, b] = px((yy * W + xx) * 4);
      const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const c = counts.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      c.n += 1; c.r += r; c.g += g; c.b += b;
      counts.set(k, c);
    }
  }
  let best = null;
  counts.forEach((c) => { if (!best || c.n > best.n) best = c; });
  const bg = best ? [best.r / best.n, best.g / best.n, best.b / best.n] : [255, 255, 255];

  const dist = (r, g, b) => Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
  let max = 0;
  for (let i = 0; i < data.length; i += 4) max = Math.max(max, dist(data[i], data[i + 1], data[i + 2]));
  let ink = [0, 0, 0];
  if (max > 40) {
    let n = 0; let r = 0; let g = 0; let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (dist(data[i], data[i + 1], data[i + 2]) >= max * 0.8) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1; }
    }
    if (n) ink = [r / n, g / n, b / n];
  }
  return { color: toHex(...ink), bg: toHex(...bg) };
}

const coversText = (fk, text) => [...text].every((ch) => fk.hasGlyphForCodePoint(ch.codePointAt(0)));

const isChanged = (r) => {
  if (r.kind === 'new') return r.text.trim() !== '';
  return r.text !== r.origText
    || r.family !== r.init.family || r.bold !== r.init.bold || r.italic !== r.init.italic
    || r.size !== r.init.size || r.color !== r.init.color;
};

let newSeq = 0;

/* ------------------------------ edit block ------------------------------ */

/**
 * One edited / new line: a cover hiding the original pixels, and a
 * contentEditable span sitting exactly on the original baseline.
 */
const EditBlock = ({
  rec, scale, view, active, fontCss, onText, onKey, onActivate, registerEl,
}) => {
  const probeRef = useRef(null);
  const editRef = useRef(null);
  const [baseOff, setBaseOff] = useState(null);
  const caretDone = useRef(false);
  const fontPx = rec.size * scale;

  const measure = useCallback(() => {
    if (probeRef.current) setBaseOff(probeRef.current.offsetTop);
  }, []);
  useLayoutEffect(measure, [measure, fontCss, fontPx, rec.bold, rec.italic]);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) measure(); });
    return () => { alive = false; };
  }, [measure, fontCss]);

  // Uncontrolled: set the text once, then the browser owns the caret.
  useEffect(() => {
    if (editRef.current) editRef.current.textContent = rec.text;
    registerEl(rec.id, editRef.current);
    return () => registerEl(rec.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Place the caret once per activation (where the user clicked, else at the
  // end) — never again while they're typing, even if a font load re-measures.
  useEffect(() => {
    if (!active) { caretDone.current = false; return; }
    if (baseOff == null || caretDone.current) return;
    const el = editRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const sel = window.getSelection();
    let range = null;
    if (rec.caret && document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(rec.caret.x, rec.caret.y);
      if (r && el.contains(r.startContainer)) range = r;
    }
    caretDone.current = true;
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  }, [active, baseOff, rec.caret]);

  const left = (rec.x0 - view[0]) * scale;
  const baseY = (view[3] - rec.y) * scale;

  return (
    <>
      {rec.kind === 'line' && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: left - 1.5,
            top: baseY - rec.origSize * scale * 0.95 - 1.5,
            width: (rec.x1 - rec.x0) * scale + 3,
            height: rec.origSize * scale * 1.27 + 3,
            background: rec.bg,
          }}
        />
      )}
      <div
        data-fq-keep=""
        className={`absolute whitespace-pre rounded-[2px] ${active ? 'outline outline-2 outline-blue-500' : 'hover:outline hover:outline-1 hover:outline-blue-400/70'}`}
        style={{
          left,
          top: baseY - (baseOff ?? fontPx * 0.8),
          fontFamily: fontCss,
          fontSize: fontPx,
          fontWeight: rec.bold ? 700 : 400,
          fontStyle: rec.italic ? 'italic' : 'normal',
          color: rec.color,
          lineHeight: 'normal',
          visibility: baseOff == null ? 'hidden' : 'visible',
          minWidth: 6,
        }}
        onMouseDown={() => { if (!active) onActivate(rec.id); }}
      >
        <span ref={probeRef} style={{ display: 'inline-block', width: 0, height: 0, verticalAlign: 'baseline' }} />
        <span
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          className="outline-none"
          style={{ caretColor: '#2563eb' }}
          onInput={(e) => onText(rec.id, e.currentTarget.textContent || '')}
          onKeyDown={(e) => onKey(rec.id, e)}
          onPaste={(e) => {
            e.preventDefault();
            const t = (e.clipboardData.getData('text/plain') || '').replace(/[\r\n]+/g, ' ');
            document.execCommand('insertText', false, t);
          }}
          onDrop={(e) => e.preventDefault()}
        />
      </div>
    </>
  );
};

/* ------------------------------ page ------------------------------ */

const PageView = ({
  pdfjs, page, scale, records, activeId, mode, fontCssFor, onActivateLine, onActivate,
  onAddAt, onText, onKey, registerEl,
}) => {
  const holderRef = useRef(null);
  const canvasRef = useRef(null);
  // The first pages render straight away; later ones as they scroll near.
  const [visible, setVisible] = useState(page.index < 2);
  const [lines, setLines] = useState(null);
  const view = page.view;

  useEffect(() => {
    const el = holderRef.current;
    if (!el || visible) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    let task = null;
    (async () => {
      const p = await pdfjs.getPage(page.index + 1);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const vp = p.getViewport({ scale: scale * dpr });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      task = p.render({ canvasContext: ctx, viewport: vp });
      await task.promise;
      if (cancelled) return;

      const tc = await p.getTextContent();
      const ls = groupLines(tc.items, page.index);
      const meta = {};
      ls.forEach((l) => {
        if (!(l.fontName in meta)) {
          let o = null;
          try { if (p.commonObjs.has(l.fontName)) o = p.commonObjs.get(l.fontName); } catch { o = null; }
          meta[l.fontName] = o ? {
            name: o.name, bold: o.bold, italic: o.italic, black: o.black,
            isSerifFont: o.isSerifFont, isMonospace: o.isMonospace,
          } : {};
        }
        l.meta = meta[l.fontName];
        const s = scale * dpr;
        const x = (l.x0 - view[0]) * s;
        const top = (view[3] - l.y - l.size * 0.95) * s;
        Object.assign(l, sampleColors(ctx, x - 3, top - 3, (l.x1 - l.x0) * s + 6, l.size * 1.27 * s + 6));
      });
      if (!cancelled) setLines(ls);
    })().catch(() => { if (!cancelled) setLines([]); });
    return () => {
      cancelled = true;
      try { task?.cancel(); } catch { /* already done */ }
    };
  }, [visible, scale, pdfjs, page.index, view]);

  const editable = page.rotate % 360 === 0;
  const pageRecs = records.filter((r) => r.page === page.index);
  const taken = new Set(pageRecs.map((r) => r.id));

  const handleAdd = (e) => {
    if (mode !== 'add' || e.target.closest('[data-fq-keep]')) return;
    e.preventDefault();
    const rect = holderRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    onAddAt(page.index, view[0] + cx / scale, view[3] - (cy / scale) - 12 * 0.35);
  };

  return (
    <div
      ref={holderRef}
      className={`relative mx-auto bg-white shadow-md ring-1 ring-black/10 ${mode === 'add' && editable ? 'cursor-crosshair' : ''}`}
      style={{ width: page.w * scale, height: page.h * scale }}
      onMouseDown={editable ? handleAdd : undefined}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {visible && !lines && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
      )}

      {lines && lines.length === 0 && (
        <span className="absolute left-2 top-2 rounded bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
          No editable text on this page — it looks like a scan. Use &ldquo;Add text&rdquo; to write on it.
        </span>
      )}
      {!editable && (
        <span className="absolute left-2 top-2 rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700">
          Rotated page — text editing isn&rsquo;t available here yet.
        </span>
      )}

      {editable && mode === 'edit' && lines && lines.map((l) => (taken.has(l.id) ? null : (
        <div
          key={l.id}
          data-fq-keep=""
          title="Click to edit"
          className="absolute cursor-text rounded-[2px] hover:bg-blue-500/10 hover:outline hover:outline-1 hover:outline-blue-500/70"
          style={{
            left: (l.x0 - view[0]) * scale - 1,
            top: (view[3] - l.y - l.size * 0.95) * scale - 1,
            width: (l.x1 - l.x0) * scale + 2,
            height: l.size * 1.27 * scale + 2,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            onActivateLine(l, { x: e.clientX, y: e.clientY });
          }}
        />
      )))}

      {pageRecs.map((r) => (
        <EditBlock
          key={r.id}
          rec={r}
          scale={scale}
          view={view}
          active={activeId === r.id}
          fontCss={fontCssFor(r)}
          onText={onText}
          onKey={onKey}
          onActivate={onActivate}
          registerEl={registerEl}
        />
      ))}
    </div>
  );
};

/* ------------------------------ toolbar bits ------------------------------ */

const TB = 'inline-flex h-8 items-center justify-center rounded-md px-2 text-sm font-medium transition-colors';
const tbBtn = (on) => `${TB} ${on ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`;

/* ------------------------------ main ------------------------------ */

const PDFTextEditor = () => {
  const registerBack = useContext(ToolBackContext);
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [mode, setMode] = useState('edit');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [width, setWidth] = useState(900);
  const [origFonts, setOrigFonts] = useState({}); // base -> { family, label } for the dropdown

  const docRef = useRef(null); // { bytes, pdfjs, fonts: Map }
  const fontCache = useRef(new Map()); // base -> Promise<{ family, fk, bytes, label } | null>
  const els = useRef(new Map());
  const editsRef = useRef(edits);
  editsRef.current = edits;
  const scrollRef = useRef(null);

  /* ---- open ---- */
  const open = async (f) => {
    setError(null);
    setLoading(true);
    setResult(null);
    setEdits({});
    setActiveId(null);
    setMode('edit');
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      let lib;
      try {
        lib = await PDFDocument.load(bytes, { updateMetadata: false });
      } catch (e) {
        if (/encrypt/i.test(e?.message || '')) throw new Error('This PDF is password-protected. Unlock it first (Unlock PDF tool), then edit it here.');
        throw e;
      }
      const pdfjs = await openPdf(bytes);
      docRef.current = { bytes, pdfjs, fonts: collectFonts(lib) };
      fontCache.current = new Map();
      setOrigFonts({});
      const list = [];
      for (let i = 1; i <= pdfjs.numPages; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const p = await pdfjs.getPage(i);
        const vp = p.getViewport({ scale: 1 });
        list.push({ index: i - 1, w: vp.width, h: vp.height, rotate: p.rotate || 0, view: vp.viewBox });
      }
      setFile(f);
      setPages(list);
    } catch (e) {
      setError(e?.message || 'Could not open this PDF.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => consumePdfHandoff((f) => open(f), 'document'), []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setFile(null);
    setPages([]);
    setEdits({});
    setActiveId(null);
    setResult(null);
    setError(null);
    docRef.current = null;
  };

  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(file ? (result ? () => setResult(null) : reset) : null);
    return () => registerBack(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, result, registerBack]);

  /* ---- layout ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [file]);

  const scaleFor = useCallback((p) => Math.min(MAX_SCALE, Math.max(0.3, (width - 24) / p.w)), [width]);

  /* ---- the PDF's own fonts ---- */
  const resolveOriginal = useCallback((base) => {
    if (!base || !docRef.current) return Promise.resolve(null);
    if (fontCache.current.has(base)) return fontCache.current.get(base);
    const job = (async () => {
      const { fonts } = docRef.current;
      let dict = fonts.get(base);
      if (!dict) {
        const clean = cleanFontName(base);
        fonts.forEach((d, k) => { if (!dict && cleanFontName(k) === clean) dict = d; });
      }
      const bytes = dict ? embeddedFontFile(dict) : null;
      if (!bytes) return null;
      try {
        const { default: fontkit } = await import('@pdf-lib/fontkit');
        const fk = fontkit.create(bytes);
        if (!fk.characterSet || !fk.characterSet.length) return null;
        const family = `fqorig${fontCache.current.size}`;
        const face = new FontFace(family, bytes);
        await face.load();
        document.fonts.add(face);
        // "Carlito-Bold-7888" -> "Carlito Bold" (drop a trailing numeric tag some producers add)
        const label = cleanFontName(base).replace(/[,-]/g, ' ').replace(/\s+\d{3,}$/, '').trim();
        const entry = { family, fk, bytes, label };
        setOrigFonts((m) => ({ ...m, [base]: { family, label: entry.label } }));
        return entry;
      } catch {
        return null;
      }
    })();
    fontCache.current.set(base, job);
    return job;
  }, []);

  const fontCssFor = useCallback((r) => {
    if (r.family === ORIGINAL && origFonts[r.origBase]) {
      return `"${origFonts[r.origBase].family}", ${cssStack(r.fallbackFamily)}`;
    }
    return cssStack(r.family === ORIGINAL ? r.fallbackFamily : r.family);
  }, [origFonts]);

  /* ---- editing ---- */
  const patch = (id, p) => setEdits((m) => (m[id] ? { ...m, [id]: { ...m[id], ...p } } : m));

  const deactivate = useCallback(() => {
    setActiveId((cur) => {
      if (cur) {
        setEdits((m) => {
          const r = m[cur];
          if (!r || isChanged(r)) return m;
          const next = { ...m };
          delete next[cur];
          return next;
        });
      }
      return null;
    });
    window.getSelection()?.removeAllRanges();
  }, []);

  const activate = useCallback((id) => setActiveId(id), []);

  const activateLine = async (line, caret) => {
    if (editsRef.current[line.id]) { setActiveId(line.id); return; }
    const meta = line.meta || {};
    const m = matchFamily(meta.name, meta);
    const orig = await resolveOriginal(meta.name);
    const useOrig = !!(orig && coversText(orig.fk, line.text));
    const size = Math.round(line.size * 10) / 10;
    const rec = {
      id: line.id,
      kind: 'line',
      page: line.page,
      x0: line.x0,
      x1: line.x1,
      y: line.y,
      origSize: line.size,
      size,
      origText: line.text,
      text: line.text,
      family: useOrig ? ORIGINAL : m.family,
      fallbackFamily: m.family,
      origBase: meta.name,
      origBold: m.bold,
      origItalic: m.italic,
      bold: useOrig ? false : m.bold,
      italic: useOrig ? false : m.italic,
      color: line.color || '#000000',
      bg: line.bg || '#ffffff',
      caret,
    };
    rec.init = { family: rec.family, bold: rec.bold, italic: rec.italic, size: rec.size, color: rec.color };
    setEdits((mm) => ({ ...mm, [line.id]: rec }));
    setActiveId(line.id);
  };

  const addAt = (pageIndex, x, y) => {
    newSeq += 1;
    const id = `new-${newSeq}`;
    const rec = {
      id, kind: 'new', page: pageIndex, x0: x, x1: x, y, origSize: 12, size: 12,
      origText: '', text: '', family: 'Arial', fallbackFamily: 'Arial', bold: false, italic: false,
      color: '#000000', bg: '#ffffff',
    };
    rec.init = { family: 'Arial', bold: false, italic: false, size: 12, color: '#000000' };
    setEdits((m) => ({ ...m, [id]: rec }));
    setActiveId(id);
    setMode('edit');
  };

  const onText = useCallback((id, text) => patch(id, { text }), []);

  const registerEl = useCallback((id, el) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }, []);

  const toggleStyle = (id, key) => {
    const r = editsRef.current[id];
    if (!r) return;
    if (r.family === ORIGINAL) {
      // The PDF's own font can't be restyled — switch to its matched family.
      patch(id, {
        family: r.fallbackFamily,
        bold: key === 'bold' ? !r.origBold : r.origBold,
        italic: key === 'italic' ? !r.origItalic : r.origItalic,
      });
    } else patch(id, { [key]: !r[key] });
  };

  const onKey = useCallback((id, e) => {
    const r = editsRef.current[id];
    if (!r) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault(); // stop the browser inserting <b>/<i> markup
      if (e.key.toLowerCase() !== 'u') toggleStyle(id, e.key.toLowerCase() === 'b' ? 'bold' : 'italic');
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); deactivate(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      newSeq += 1;
      const nid = `new-${newSeq}`;
      const rec = {
        ...r,
        id: nid,
        kind: 'new',
        y: r.y - r.size * 1.25,
        x1: r.x0,
        origText: '',
        text: '',
        caret: null,
      };
      rec.init = { family: rec.family, bold: rec.bold, italic: rec.italic, size: rec.size, color: rec.color };
      setEdits((m) => ({ ...m, [nid]: rec }));
      setActiveId(nid);
      return;
    }
    if (e.key === 'Backspace' && r.kind === 'new' && !r.text) {
      e.preventDefault();
      setEdits((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
      setActiveId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deactivate]);

  // Click anywhere outside the active line / toolbar ends editing it.
  useEffect(() => {
    if (!activeId) return undefined;
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('[data-fq-keep]')) return;
      deactivate();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [activeId, deactivate]);

  const changed = useMemo(() => Object.values(edits).filter(isChanged), [edits]);

  // Don't lose unsaved edits to an accidental tab close.
  useEffect(() => {
    if (!changed.length || result) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed.length, result]);

  /* ---- save ---- */
  const save = async () => {
    deactivate();
    setSaving(true);
    setError(null);
    try {
      const recs = Object.values(editsRef.current).filter(isChanged);
      const pdf = await PDFDocument.load(docRef.current.bytes, { updateMetadata: false });
      const { getFont, ensureFontkit } = createFontLoader(pdf);
      const embeddedOrig = new Map();

      const fontFor = async (r, text) => {
        if (r.family === ORIGINAL) {
          const o = await resolveOriginal(r.origBase);
          if (o && coversText(o.fk, text)) {
            try {
              if (!embeddedOrig.has(r.origBase)) {
                await ensureFontkit();
                // Whole font, not re-subset: fontkit's subsetter corrupts some
                // TrueType fonts, and PDF-embedded fonts are usually already
                // subsets, so this adds little.
                embeddedOrig.set(r.origBase, await pdf.embedFont(o.bytes, { subset: false }));
              }
              return { font: embeddedOrig.get(r.origBase), str: text };
            } catch { /* fall through to the matched family */ }
          }
        }
        const fam = r.family === ORIGINAL ? r.fallbackFamily : r.family;
        const bold = r.family === ORIGINAL ? r.origBold : r.bold;
        const italic = r.family === ORIGINAL ? r.origItalic : r.italic;
        const font = await getFont(fam, bold, italic);
        const str = isStandardFamily(fam) ? winAnsiSafe(text) : text;
        try {
          font.encodeText(str);
          return { font, str };
        } catch {
          // Characters the standard font can't encode: try the bundled
          // Unicode-capable sans, then drop only what still can't be drawn.
          const alt = await getFont('Calibri', bold, italic);
          return { font: alt, str: text };
        }
      };

      const byPage = new Map();
      recs.forEach((r) => {
        if (!byPage.has(r.page)) byPage.set(r.page, []);
        byPage.get(r.page).push(r);
      });

      let covered = 0;
      for (const [pi, list] of byPage) {
        const page = pdf.getPage(pi);
        const regions = list.filter((r) => r.kind === 'line')
          .map((r) => ({ id: r.id, x0: r.x0, x1: r.x1, y: r.y, size: r.origSize }));
        const matched = removeTextInRegions(pdf, pi, regions);
        for (const r of list) {
          if (r.kind === 'line' && !matched.has(r.id)) {
            covered += 1;
            page.drawRectangle({
              x: r.x0 - 1,
              y: r.y - r.origSize * 0.32,
              width: r.x1 - r.x0 + 2,
              height: r.origSize * 1.27,
              color: parseColor(r.bg),
            });
          }
          const text = r.text.replace(/\s+$/, '');
          if (!text.trim()) continue;
          // eslint-disable-next-line no-await-in-loop
          const { font, str } = await fontFor(r, text);
          page.drawText(str, { x: r.x0, y: r.y, size: r.size, font, color: parseColor(r.color) });
        }
      }

      const out = await pdf.save();
      setResult({ blob: new Blob([out], { type: 'application/pdf' }), size: out.length, count: recs.length, covered });
    } catch (e) {
      setError(`Couldn't save: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  /* ---- render ---- */
  const active = activeId ? edits[activeId] : null;
  const outName = file ? `${stripExt(file.name)}-edited.pdf` : 'edited.pdf';

  if (!file) {
    return (
      <div className="mx-auto max-w-2xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            Opening your PDF…
          </div>
        ) : (
          <FileDropzone
            accept="application/pdf,.pdf"
            maxMB={PDF_RENDER_MB}
            onFiles={(fs) => open(fs[0])}
            paste={false}
            title="Drop a PDF to edit its text"
            hint="click any line and type — fix typos, change words, delete lines"
            formats="Edits the PDF's real text in its own font — no white boxes"
          />
        )}
        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  if (saving || result) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-200/70 bg-white px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800">
        <ResultScreen
          working={saving}
          done={!!result}
          title="Your PDF is edited"
          workingLabel="Rewriting the PDF text…"
          subtitle={result ? `${result.count} line${result.count === 1 ? '' : 's'} changed` : undefined}
          fileName={outName}
          fileSize={result?.size}
          onDownload={() => downloadBlob(result.blob, outName)}
          onBack={() => setResult(null)}
          backLabel="Back to editing"
          note={result && result.covered
            ? `${result.covered} line${result.covered === 1 ? '' : 's'} couldn't be removed from the PDF's text layer and ${result.covered === 1 ? 'was' : 'were'} covered instead. Everything else was edited in place.`
            : 'Original text was removed from the PDF itself, not hidden. The file stays on your device.'}
          extra={result ? <OpenInPdfTool getPdf={() => result.blob} exclude={['edit-pdf-text']} /> : null}
        />
      </div>
    );
  }

  const fontValue = active ? active.family : '';

  return (
    <div className="flex flex-col">
      {/* toolbar */}
      <div
        data-fq-keep=""
        className="sticky top-16 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
      >
        <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-700">
          <button type="button" className={tbBtn(mode === 'edit')} onClick={() => setMode('edit')}>Edit text</button>
          <button type="button" className={tbBtn(mode === 'add')} onClick={() => { deactivate(); setMode('add'); }}>+ Add text</button>
        </div>

        <span className="mx-1 hidden h-6 w-px bg-gray-200 sm:block dark:bg-gray-700" />

        <select
          disabled={!active}
          value={fontValue}
          onChange={(e) => active && patch(active.id, e.target.value === ORIGINAL
            ? { family: ORIGINAL, bold: false, italic: false }
            : { family: e.target.value, bold: active.family === ORIGINAL ? active.origBold : active.bold, italic: active.family === ORIGINAL ? active.origItalic : active.italic })}
          className="h-8 max-w-[11rem] rounded-md border border-gray-300 bg-white px-2 text-sm disabled:opacity-40 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          title="Font"
        >
          {active && active.origBase && origFonts[active.origBase] && (
            <option value={ORIGINAL}>{`Original · ${origFonts[active.origBase].label}`}</option>
          )}
          {FONT_LIST.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <input
          type="number"
          min="4"
          max="200"
          step="0.5"
          disabled={!active}
          value={active ? active.size : ''}
          onChange={(e) => active && patch(active.id, { size: Math.max(4, Math.min(200, parseFloat(e.target.value) || active.size)) })}
          className="h-8 w-16 rounded-md border border-gray-300 bg-white px-2 text-sm disabled:opacity-40 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          title="Font size (pt)"
        />

        <button
          type="button"
          disabled={!active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => active && toggleStyle(active.id, 'bold')}
          className={`${tbBtn(active && (active.family === ORIGINAL ? active.origBold : active.bold))} w-8 font-bold disabled:opacity-40`}
          title="Bold (Ctrl+B)"
        >
          B
        </button>
        <button
          type="button"
          disabled={!active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => active && toggleStyle(active.id, 'italic')}
          className={`${tbBtn(active && (active.family === ORIGINAL ? active.origItalic : active.italic))} w-8 italic disabled:opacity-40`}
          title="Italic (Ctrl+I)"
        >
          I
        </button>
        <input
          type="color"
          disabled={!active}
          value={active ? active.color : '#000000'}
          onChange={(e) => active && patch(active.id, { color: e.target.value })}
          className="h-8 w-9 cursor-pointer rounded-md border border-gray-300 bg-white p-0.5 disabled:opacity-40 dark:border-gray-600"
          title="Text colour"
        />

        <button
          type="button"
          disabled={!active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!active) return;
            const el = els.current.get(active.id);
            if (el) el.textContent = '';
            patch(active.id, { text: '' });
          }}
          className={`${TB} text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-900/20`}
          title="Delete this line's text"
        >
          Delete
        </button>
        {active && active.kind === 'line' && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const id = active.id;
              setActiveId(null);
              setEdits((m) => {
                const next = { ...m };
                delete next[id];
                return next;
              });
            }}
            className={`${TB} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700`}
            title="Put the original text back"
          >
            Revert
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-gray-500 sm:inline dark:text-gray-400">
            {changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'}` : 'Click any text to edit it'}
          </span>
          <button
            type="button"
            onClick={reset}
            className={`${TB} border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700`}
          >
            Choose another
          </button>
          <button
            type="button"
            disabled={!changed.length}
            onClick={save}
            className={`${TB} bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-white hover:opacity-95 disabled:opacity-40`}
          >
            Save PDF
          </button>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
      {mode === 'add' && (
        <p className="mb-3 text-center text-sm text-blue-700 dark:text-blue-300">Click anywhere on a page to place new text.</p>
      )}

      <div ref={scrollRef} className="space-y-5 rounded-2xl bg-gray-100 p-3 dark:bg-gray-900/60">
        {pages.map((p) => (
          <PageView
            key={p.index}
            pdfjs={docRef.current.pdfjs}
            page={p}
            scale={scaleFor(p)}
            records={Object.values(edits)}
            activeId={activeId}
            mode={mode}
            fontCssFor={fontCssFor}
            onActivateLine={activateLine}
            onActivate={activate}
            onAddAt={addAt}
            onText={onText}
            onKey={onKey}
            registerEl={registerEl}
          />
        ))}
      </div>
    </div>
  );
};

export default PDFTextEditor;
