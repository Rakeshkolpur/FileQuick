import React, {
  useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  LuChevronRight, LuChevronUp, LuChevronDown,
} from 'react-icons/lu';
import FileDropzone from '../../tool/FileDropzone';
import ResultScreen from '../../tool/ResultScreen';
import OpenInPdfTool from '../../tool/OpenInPdfTool';
import { ToolBackContext } from '../../ToolWrapper';
import { downloadBlob } from '../../tool/DownloadButton';
import { PDF_RENDER_MB, screenFiles, rejectionMessage } from '../../../lib/fileValidation';
import { stripExt } from '../../../lib/format';
import { consumePdfHandoff } from '../../../lib/pdfHandoff';
import { openPdf } from '../../../lib/pdfjs';
import { cssStack } from '../../../lib/pdfAnnotate';
import { requestLocalFonts } from '../../../lib/localFonts';
import {
  collectFonts, embeddedFontFile, matchFamily, cleanFontName, measureLines, findRules, findTables,
} from '../../../lib/pdfTextEdit';
import { FloatingChanges } from './advanced/ChangesPanel';
import PageView, { InsertButton } from './advanced/PageView';
import {
  MainToolbar, FloatingBar, TextFormat, ObjectFormat,
} from './advanced/Toolbar';
import SignatureModal from './advanced/SignatureModal';
import { saveDocument } from './advanced/saveDocument';
import {
  ORIGINAL, TOOL_DEFAULTS, TOOL_HINTS, TOOL_LABELS, isChanged, baseY,
  emptyCells, tableRowHeights, CELL_PAD_Y, LINE_H,
} from './advanced/records';
import { textWidth } from './advanced/measure';
import { norm } from './advanced/geometry';

const MAX_FIT = 1.8;
const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];

let seq = 0;
const NO_TABLES = []; // stable empty list (used as an effect dependency)

/** Does a font (fontkit) have every character of the text? */
const coversAll = (fk, text) => [...text].every((ch) => /\s/.test(ch) || fk.hasGlyphForCodePoint(ch.codePointAt(0)));
const uid = (p) => { seq += 1; return `${p}-${seq}`; };

/** Read an image file into a PDF-embeddable data URL (JPEG stays JPEG, else PNG). */
function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const jpg = /jpe?g/i.test(file.type);
      resolve({ src: c.toDataURL(jpg ? 'image/jpeg' : 'image/png', 0.92), w: c.width, h: c.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read.')); };
    img.src = url;
  });
}

const PDFTextEditor = () => {
  const registerBack = useContext(ToolBackContext);
  const [file, setFile] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const [objects, setObjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setToolState] = useState('select');
  const [defaults, setDefaults] = useState(TOOL_DEFAULTS);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [width, setWidth] = useState(900);
  const [origFonts, setOrigFonts] = useState({}); // base -> { family, label }
  const [signatures, setSignatures] = useState([]);
  const [sigModal, setSigModal] = useState(null);
  const [histLen, setHistLen] = useState(0);
  const [curPage, setCurPage] = useState(0);
  const [hint, setHint] = useState(null);
  const toolbarRef = useRef(null);

  const docRef = useRef(null); // { bytes, pdfjs, fonts }
  const fontCache = useRef(new Map());
  const els = useRef(new Map());
  const scrollRef = useRef(null);
  const history = useRef([]);
  const lastTag = useRef(null);
  const gen = useRef(0);

  const editsRef = useRef(edits);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const objectsRef = useRef(objects);
  const slotsRef = useRef(slots);
  const activeRef = useRef(activeId);
  const selectedRef = useRef(selectedId);
  editsRef.current = edits;
  objectsRef.current = objects;
  slotsRef.current = slots;
  activeRef.current = activeId;
  selectedRef.current = selectedId;

  /* ---- open ---- */
  const resetState = () => {
    setEdits({});
    setObjects([]);
    setActiveId(null);
    setSelectedId(null);
    setToolState('select');
    setZoom(1);
    setResult(null);
    history.current = [];
    lastTag.current = null;
    setHistLen(0);
  };

  const open = async (f) => {
    setError(null);
    setLoading(true);
    resetState();
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
      docRef.current = {
        bytes, pdfjs, lib, fonts: collectFonts(lib), rules: new Map(), tables: new Map(), origSlots: null,
      };
      fontCache.current = new Map();
      setOrigFonts({});
      const list = [];
      for (let i = 1; i <= pdfjs.numPages; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const p = await pdfjs.getPage(i);
        const vp = p.getViewport({ scale: 1, rotation: 0 });
        list.push({
          key: `o${i - 1}`, kind: 'orig', index: i - 1, w: vp.width, h: vp.height, rotate0: norm(p.rotate || 0), extra: 0, view: vp.viewBox,
        });
      }
      docRef.current.origSlots = list;
      setFile(f);
      setSlots(list);
    } catch (e) {
      setError(e?.message || 'Could not open this PDF.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => consumePdfHandoff((f) => open(f), 'document'), []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setFile(null);
    setSlots([]);
    resetState();
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
  }, [file, result, saving]);

  const scaleFor = useCallback((s) => {
    const boxW = norm(s.rotate0 + s.extra) % 180 ? s.h : s.w;
    const fit = Math.min(MAX_FIT, Math.max(0.3, (width - 32) / boxW));
    return fit * zoom;
  }, [width, zoom]);

  /* ---- history ---- */
  const pushHistory = useCallback((tag = null) => {
    if (tag && tag === lastTag.current) return;
    lastTag.current = tag;
    history.current.push({ edits: editsRef.current, objects: objectsRef.current, slots: slotsRef.current });
    if (history.current.length > 150) history.current.shift();
    setHistLen(history.current.length);
  }, []);

  const undo = useCallback(() => {
    const snap = history.current.pop();
    if (!snap) return;
    lastTag.current = null;
    gen.current += 1;
    const g = gen.current;
    setActiveId(null);
    setSelectedId(null);
    window.getSelection()?.removeAllRanges();
    const ed = {};
    Object.values(snap.edits).forEach((r) => { ed[r.id] = { ...r, gen: g, caret: null }; });
    setEdits(ed);
    setObjects(snap.objects);
    setSlots(snap.slots);
    setHistLen(history.current.length);
  }, []);

  /* ---- the PDF's own fonts ---- */
  const resolveOriginal = useCallback((base, style = {}) => {
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
        // Registered with its real weight/style: CSS then selects it as-is
        // (no faux bold) and characters it lacks fall back in the same style.
        const face = new FontFace(family, bytes, { weight: style.bold ? '700' : '400', style: style.italic ? 'italic' : 'normal' });
        await face.load();
        document.fonts.add(face);
        // "Carlito-Bold-7888" -> "Carlito Bold"
        const label = cleanFontName(base).replace(/[,-]/g, ' ').replace(/\s+\d{3,}$/, '').trim();
        setOrigFonts((m) => ({ ...m, [base]: { family, label, fk } }));
        return { family, fk, bytes, label };
      } catch {
        return null;
      }
    })();
    fontCache.current.set(base, job);
    return job;
  }, []);

  /**
   * What the line is drawn with — the same choice the save makes: the PDF's
   * own font while it has every character typed, else the user's installed
   * copy of the same family (e.g. "Bookman Old Style"), else a look-alike.
   */
  const fontCssFor = useCallback((r) => {
    const o = r.origBase && origFonts[r.origBase];
    const fam = r.family === ORIGINAL ? r.fallbackFamily : r.family;
    const local = r.localFamily && fam === r.fallbackFamily
      && !cssStack(fam).toLowerCase().includes(r.localFamily.toLowerCase()) ? `"${r.localFamily}", ` : '';
    if (r.family === ORIGINAL && o && coversAll(o.fk, r.text)) return `"${o.family}", ${local}${cssStack(fam)}`;
    return `${local}${cssStack(fam)}`;
  }, [origFonts]);

  /* ---- text records ---- */
  const patch = useCallback((id, p) => setEdits((m) => (m[id] ? { ...m, [id]: { ...m[id], ...p } } : m)), []);

  const deactivate = useCallback(() => {
    const cur = activeRef.current;
    if (cur) {
      setEdits((m) => {
        const r = m[cur];
        if (!r || isChanged(r)) return m;
        const next = { ...m };
        delete next[cur];
        return next;
      });
      setActiveId(null);
      const sel = window.getSelection();
      const el = els.current.get(cur);
      if (sel && el && el.contains(sel.anchorNode)) sel.removeAllRanges();
    }
    lastTag.current = null;
  }, []);

  /** Click on the page background: ends editing / selection. True if anything was active. */
  const onBackground = useCallback(() => {
    const had = !!(activeRef.current || selectedRef.current);
    deactivate();
    setSelectedId(null);
    return had;
  }, [deactivate]);

  const setTool = useCallback((t) => {
    deactivate();
    setSelectedId(null);
    setToolState(t);
  }, [deactivate]);

  const activateRec = useCallback((id) => {
    if (activeRef.current && activeRef.current !== id) deactivate();
    setSelectedId(null);
    setActiveId(id);
  }, [deactivate]);

  const activateLine = async (line, caret) => {
    if (editsRef.current[line.id]) { activateRec(line.id); return; }
    // Ask for the computer's fonts now (this is a click), so the saved line
    // can use the real installed font — e.g. Bookman Old Style Bold.
    requestLocalFonts();
    deactivate();
    setSelectedId(null);
    const meta = line.meta || {};
    const m = matchFamily(meta.name, meta);
    const orig = await resolveOriginal(meta.name, m);
    const useOrig = !!(orig && coversAll(orig.fk, line.text));
    const size = Math.round(line.size * 10) / 10;
    const { lib, rules } = docRef.current;

    // Justified? Compare the glyphs' own widths with how wide the line
    // really is — Word's "Justify" puts the difference into the spaces.
    const spaces = (line.text.match(/ /g) || []).length;
    let origWidth = line.x1 - line.x0;
    let origExtra = 0;
    let justify = false;
    if (spaces) {
      let st = null;
      try {
        st = measureLines(lib, line.page, [{ id: 'm', x0: line.x0, x1: line.x1, y: line.y, size: line.size }]).get('m');
      } catch { st = null; }
      if (st && st.inkNatural > 0 && Number.isFinite(st.inkMaxX)) {
        origWidth = st.inkMaxX - line.x0;
        origExtra = (st.inkMaxX - st.minX - st.inkNatural) / spaces;
        justify = origExtra > line.size * 0.04;
      } else {
        const css = useOrig ? `"${orig.family}", ${cssStack(m.family)}` : `"${m.local}", ${cssStack(m.family)}`;
        origExtra = (origWidth - textWidth(line.text, css, line.size, m.bold, m.italic)) / spaces;
        justify = origExtra > line.size * 0.1;
      }
    }

    // Centred on the page (a heading)? Then it stays centred as it changes.
    const view = slotsRef.current.find((sl) => sl.key === line.slot)?.view;
    const cx = (line.x0 + line.x1) / 2;
    const centred = !justify && !!view
      && Math.abs(cx - (view[0] + view[2]) / 2) < 3
      && line.x0 - view[0] > 36
      && line.x1 - line.x0 < 0.8 * (view[2] - view[0]);

    // Underlined? Word draws the underline as a separate thin bar.
    if (!rules.has(line.page)) {
      let found = [];
      try { found = findRules(lib, line.page); } catch { found = []; }
      rules.set(line.page, found);
    }
    const under = rules.get(line.page).filter((u) => u.t <= line.size * 0.2 + 0.3
      && u.y < line.y - line.size * 0.01 && u.y > line.y - line.size * 0.45
      && u.x1 > line.x0 + 0.5 && u.x0 < line.x1 - 0.5
      && u.x0 > line.x0 - line.size && u.x1 < line.x1 + line.size);
    const covered = under.reduce((n, u) => n + Math.min(u.x1, line.x1) - Math.max(u.x0, line.x0), 0);
    const hasUl = under.length > 0 && covered >= 0.5 * (line.x1 - line.x0);
    const ul = hasUl ? {
      offsetEm: (line.y - under.reduce((n, u) => n + u.y, 0) / under.length) / line.size,
      tEm: Math.max(...under.map((u) => u.t)) / line.size,
      color: under[0].color,
    } : null;
    const rec = {
      id: line.id,
      kind: 'line',
      slot: line.slot,
      x0: line.x0,
      x1: line.x1,
      y: line.y,
      origSize: line.size,
      size,
      origText: line.text,
      text: line.text,
      family: useOrig ? ORIGINAL : m.family,
      fallbackFamily: m.family,
      localFamily: m.local,
      origBase: meta.name,
      origBold: m.bold,
      origItalic: m.italic,
      bold: useOrig ? false : m.bold,
      italic: useOrig ? false : m.italic,
      color: line.color || '#000000',
      bg: line.bg || '#ffffff',
      justify,
      align: centred ? 'center' : 'left',
      cx,
      ax: centred ? cx : line.x0,
      by: line.y,
      origWidth,
      origExtra,
      underline: hasUl,
      ul,
      ulRules: hasUl ? under : null,
      caret,
      gen: gen.current,
    };
    rec.init = {
      family: rec.family, bold: rec.bold, italic: rec.italic, size: rec.size, color: rec.color, underline: hasUl, align: rec.align, justify,
    };
    setEdits((mm) => ({ ...mm, [line.id]: rec }));
    setActiveId(line.id);
  };

  const addText = useCallback((slotKey, x, y, caret) => {
    const d = defaults.text;
    const id = uid('new');
    const rec = {
      id,
      kind: 'new',
      slot: slotKey,
      x0: x,
      x1: x,
      y,
      align: 'left',
      ax: x,
      by: y,
      origSize: d.size,
      size: d.size,
      origText: '',
      text: '',
      family: d.family,
      fallbackFamily: d.family,
      bold: d.bold,
      italic: d.italic,
      underline: !!d.underline,
      color: d.color,
      bg: '#ffffff',
      caret,
      gen: gen.current,
    };
    rec.init = {
      family: rec.family, bold: rec.bold, italic: rec.italic, size: rec.size, color: rec.color, underline: false, align: 'left',
    };
    setEdits((m) => ({ ...m, [id]: rec }));
    setActiveId(id);
  }, [defaults.text]);

  const onText = useCallback((id, text) => {
    pushHistory(`text:${id}`);
    patch(id, { text });
  }, [patch, pushHistory]);

  /* ---- move / align / duplicate ---- */
  const marginsRef = useRef({});
  const onMargins = useCallback((key, m) => { marginsRef.current[key] = m; }, []);
  const moveRec = useCallback((id, p) => patch(id, p), [patch]);
  const beginMoveRec = useCallback(() => pushHistory(), [pushHistory]);

  /** Left / centre / right of the page (left & right = the page's text margins). */
  const alignRec = (id, a) => {
    const r = editsRef.current[id];
    const sl = r && slotsRef.current.find((x) => x.key === r.slot);
    if (!sl) return;
    const v = sl.view;
    const m = marginsRef.current[sl.key] || { left: v[0] + 72, right: v[2] - 72 };
    pushHistory();
    if (a === 'justify') {
      // An originally justified line keeps its own width; others fill margin to margin.
      if (r.init.justify) patch(id, { justify: true, align: 'left', ax: r.x0 });
      else patch(id, { justify: true, align: 'left', ax: m.left, origWidth: m.right - m.left, origExtra: 0 });
      return;
    }
    const ax = a === 'center' ? (v[0] + v[2]) / 2 : a === 'right' ? m.right : m.left;
    patch(id, { align: a, ax, justify: false });
  };

  const duplicateRec = (id) => {
    const r = editsRef.current[id];
    if (!r) return;
    pushHistory();
    deactivate();
    const nid = uid('new');
    const by = baseY(r) - r.size * 1.4;
    const copy = {
      ...r,
      id: nid,
      kind: 'new',
      y: by,
      by,
      x1: r.x0,
      origText: '',
      ulRules: null,
      caret: null,
      gen: gen.current,
    };
    copy.init = { ...r.init, align: copy.align };
    setEdits((m) => ({ ...m, [nid]: copy }));
    setActiveId(nid);
  };
  const duplicateRef = useRef(duplicateRec);
  duplicateRef.current = duplicateRec;

  const clipboard = useRef(null);
  const pasteObject = (src, dx = 12, dy = 12) => {
    if (!src) return;
    pushHistory();
    const id = uid('obj');
    const sl = slotsRef.current.find((x) => x.key === src.slot) || slotsRef.current[0];
    const copy = {
      ...src, id, slot: sl.key, x: Math.min(src.x + dx, sl.w - src.w), y: Math.min(src.y + dy, sl.h - src.h),
    };
    setObjects((list) => [...list, copy]);
    setSelectedId(id);
    clipboard.current = copy;
  };

  const registerEl = useCallback((id, el) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }, []);

  const toggleStyle = useCallback((id, key) => {
    const r = editsRef.current[id];
    if (!r) return;
    pushHistory();
    if (key === 'underline') {
      patch(id, { underline: !r.underline });
      return;
    }
    if (r.family === ORIGINAL) {
      // The PDF's own font can't be restyled — switch to its matched family.
      patch(id, {
        family: r.fallbackFamily,
        bold: key === 'bold' ? !r.origBold : r.origBold,
        italic: key === 'italic' ? !r.origItalic : r.origItalic,
      });
    } else patch(id, { [key]: !r[key] });
  }, [patch, pushHistory]);

  const onKey = useCallback((id, e) => {
    const r = editsRef.current[id];
    if (!r) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && ['b', 'i', 'u'].includes(k)) {
      e.preventDefault(); // stop the browser inserting <b>/<i> markup
      toggleStyle(id, k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline');
      return;
    }
    if (mod && k === 'd') { e.preventDefault(); duplicateRef.current(id); return; }
    if (e.key === 'Escape') { e.preventDefault(); deactivate(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      pushHistory();
      const nid = uid('new');
      const rec = {
        ...r,
        id: nid,
        kind: 'new',
        y: baseY(r) - r.size * 1.25,
        by: baseY(r) - r.size * 1.25,
        x1: r.x0,
        origText: '',
        text: '',
        caret: null,
        justify: false,
        ulRules: null,
        gen: gen.current,
      };
      rec.init = {
        family: rec.family, bold: rec.bold, italic: rec.italic, size: rec.size, color: rec.color, underline: false, align: rec.align,
      };
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
  }, [deactivate, pushHistory, toggleStyle]);

  /* ---- objects ---- */
  const createObject = useCallback((slotKey, o) => {
    pushHistory();
    const id = uid('obj');
    let obj = { id, slot: slotKey, ...o };
    if (o.type === 'table') {
      const d = defaultsRef.current.table;
      const sl = slotsRef.current.find((x) => x.key === slotKey);
      const minH = Math.round((d.size * LINE_H + 2 * CELL_PAD_Y) * 10) / 10;
      const W = o.w > 20 ? o.w : Math.min(d.cols * 90, (sl ? sl.w : 600) - o.x - 36);
      const rowH = Array(d.rows).fill(o.h > 10 ? Math.max(minH, o.h / d.rows) : minH);
      obj = {
        id,
        slot: slotKey,
        type: 'table',
        x: o.x,
        y: o.y,
        colW: Array(d.cols).fill(Math.max(20, W / d.cols)),
        rowH,
        cells: emptyCells(d.rows, d.cols),
        family: d.family,
        local: null,
        size: d.size,
        color: d.color,
        border: d.border,
        bw: d.bw,
        headerBold: d.headerBold,
        w: Math.max(20, W / d.cols) * d.cols,
        h: rowH.reduce((a, b) => a + b, 0),
      };
      setTimeout(() => document.querySelector(`[data-obj-id="${id}"] [contenteditable]`)?.focus(), 80);
    }
    if (o.type === 'field-text' || o.type === 'field-check') {
      const n = objectsRef.current.filter((x) => x.type === o.type).length + 1;
      obj.name = `${o.type === 'field-text' ? 'Text' : 'Checkbox'} ${n}`;
    }
    setObjects((list) => [...list, obj]);
    setSelectedId(id);
    // placed once — back to the Select cursor so the next click doesn't add another
    if (['table', 'link', 'field-text', 'field-check'].includes(o.type)) setToolState('select');
  }, [pushHistory]);

  const changeObject = useCallback((id, p) => setObjects((list) => list.map((o) => (o.id === id ? { ...o, ...p } : o))), []);

  const editObject = useCallback((id, p) => {
    pushHistory(`obj:${id}:${Object.keys(p).join()}`);
    changeObject(id, p);
  }, [changeObject, pushHistory]);

  const deleteObject = useCallback((id) => {
    pushHistory();
    setObjects((list) => list.filter((o) => o.id !== id));
    setSelectedId(null);
  }, [pushHistory]);

  const selectObject = useCallback((id) => {
    if (activeRef.current) deactivate();
    setSelectedId(id);
  }, [deactivate]);

  const beginObjectEdit = useCallback(() => pushHistory(), [pushHistory]);

  /* ---- tables ---- */
  const tableFocus = useRef(null); // { id, r, c } — the cell being typed in
  const updateTable = useCallback((id, fn) => setObjects((list) => list.map((o) => {
    if (o.id !== id) return o;
    const n = fn(o);
    if (!n) return o;
    return { ...n, w: n.colW.reduce((a, b) => a + b, 0), h: tableRowHeights(n).reduce((a, b) => a + b, 0) };
  })), []);

  const tableProps = useMemo(() => ({
    fontCssFor: (o) => (o.local && o.local !== o.family && !cssStack(o.family).toLowerCase().includes(o.local.toLowerCase())
      ? `"${o.local}", ${cssStack(o.family)}` : cssStack(o.family)),
    onCellText: (id, r, c, text) => {
      pushHistory(`cell:${id}:${r}:${c}`);
      updateTable(id, (o) => ({ ...o, cells: o.cells.map((row, i) => (i === r ? row.map((t, j) => (j === c ? text : t)) : row)) }));
    },
    onCellFocus: (id, r, c) => {
      tableFocus.current = { id, r, c };
      if (activeRef.current) deactivate();
      if (selectedRef.current !== id) setSelectedId(id);
    },
    onAddRow: (id) => {
      pushHistory();
      updateTable(id, (o) => ({
        ...o,
        rowH: [...o.rowH, o.rowH[o.rowH.length - 1]],
        rowAuto: null,
        cells: [...o.cells, Array(o.colW.length).fill('')],
      }));
      setSelectedId(id);
    },
    onAddCol: (id) => {
      pushHistory();
      updateTable(id, (o) => ({
        ...o,
        colW: [...o.colW, o.colW[o.colW.length - 1]],
        rowAuto: null,
        cells: o.cells.map((row) => [...row, '']),
      }));
      setSelectedId(id);
    },
    onMeasure: (id, heights) => updateTable(id, (o) => ({ ...o, rowAuto: heights })),
  }), [pushHistory, updateTable, deactivate]);

  const tableAction = (id, action) => {
    if (action === 'addRow') { tableProps.onAddRow(id); return; }
    if (action === 'addCol') { tableProps.onAddCol(id); return; }
    const o = objectsRef.current.find((x) => x.id === id);
    if (!o) return;
    const foc = tableFocus.current && tableFocus.current.id === id ? tableFocus.current : null;
    if (action === 'delRow') {
      if (o.cells.length <= 1) { deleteObject(id); return; }
      const r = foc ? Math.min(foc.r, o.cells.length - 1) : o.cells.length - 1;
      pushHistory();
      updateTable(id, (t) => ({
        ...t, rowH: t.rowH.filter((_, i) => i !== r), rowAuto: null, cells: t.cells.filter((_, i) => i !== r),
      }));
    } else if (action === 'delCol') {
      if (o.colW.length <= 1) { deleteObject(id); return; }
      const c = foc ? Math.min(foc.c, o.colW.length - 1) : o.colW.length - 1;
      pushHistory();
      updateTable(id, (t) => ({
        ...t, colW: t.colW.filter((_, j) => j !== c), rowAuto: null, cells: t.cells.map((row) => row.filter((_, j) => j !== c)),
      }));
    }
    tableFocus.current = null;
  };

  /** Ruled tables already in the PDF page (cached). */
  const tablesFor = (slot) => {
    if (slot.kind !== 'orig' || !docRef.current) return NO_TABLES;
    const cache = docRef.current.tables;
    if (!cache.has(slot.index)) {
      let found = [];
      try { found = findTables(docRef.current.lib, slot.index); } catch { found = []; }
      cache.set(slot.index, found);
    }
    return cache.get(slot.index);
  };

  /** "+" on an existing table: continue it with a row below / a column on the right. */
  const attachTable = useCallback((slotKey, t, dir, sample) => {
    const src = `${t.key}:${dir}`;
    const existing = objectsRef.current.find((o) => o.slot === slotKey && o.src === src);
    if (existing) {
      if (dir === 'bottom') tableProps.onAddRow(existing.id); else tableProps.onAddCol(existing.id);
      return;
    }
    const sl = slotsRef.current.find((x) => x.key === slotKey);
    if (!sl) return;
    const v = sl.view;
    const m = sample ? matchFamily(sample.meta?.name, sample.meta || {}) : { family: 'Arial', local: null };
    const size = sample ? Math.round(sample.size * 2) / 2 : 11;
    const rowsH = t.ys.slice(0, -1).map((y, i) => y - t.ys[i + 1]);
    const colsW = t.xs.slice(0, -1).map((x, i) => t.xs[i + 1] - x);
    const minH = Math.round((size * LINE_H + 2 * CELL_PAD_Y) * 10) / 10;
    const lastH = Math.max(minH, rowsH[rowsH.length - 1] || minH);
    const base = {
      type: 'table',
      attach: dir,
      src,
      family: m.family,
      local: m.local || null,
      size,
      color: sample?.color || '#000000',
      border: t.color,
      bw: t.t,
      headerBold: false,
    };
    const obj = dir === 'bottom'
      ? {
        ...base, x: t.x0 - v[0], y: v[3] - t.bottom, colW: colsW, rowH: [lastH], cells: emptyCells(1, colsW.length),
      }
      : {
        // never past the page edge: at most the space left on the right
        ...base,
        x: t.x1 - v[0],
        y: v[3] - t.top,
        colW: [Math.max(36, Math.min(colsW[colsW.length - 1] || 80, v[2] - t.x1 - 18))],
        rowH: rowsH,
        cells: emptyCells(rowsH.length, 1),
      };
    obj.w = obj.colW.reduce((a, b) => a + b, 0);
    obj.h = obj.rowH.reduce((a, b) => a + b, 0);
    pushHistory();
    const id = uid('obj');
    setObjects((list) => [...list, { id, slot: slotKey, ...obj }]);
    if (activeRef.current) deactivate();
    setSelectedId(id);
    setTimeout(() => document.querySelector(`[data-obj-id="${id}"] [contenteditable]`)?.focus(), 80);
  }, [pushHistory, tableProps, deactivate]);

  /** Put an image on the page the user is looking at, in the middle of the view. */
  const placeImage = useCallback((src, pxW, pxH, maxW) => {
    const holder = scrollRef.current;
    if (!holder) return;
    let best = null;
    holder.querySelectorAll('[data-slot]').forEach((el) => {
      const pg = el.querySelector('[data-fq-page]');
      if (!pg) return;
      const r = pg.getBoundingClientRect();
      const vis = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (!best || vis > best.vis) best = { key: el.dataset.slot, r, vis };
    });
    if (!best) return;
    const slot = slotsRef.current.find((s) => s.key === best.key);
    if (!slot) return;
    const scale = scaleFor(slot);
    const w = Math.min(maxW, slot.w * 0.6);
    const h = w * (pxH / pxW);
    let y = (slot.h - h) / 2;
    if (norm(slot.rotate0 + slot.extra) === 0) {
      const mid = (window.innerHeight / 2 - best.r.top) / scale;
      y = Math.max(8, Math.min(slot.h - h - 8, mid - h / 2));
    }
    createObject(slot.key, { type: 'image', src, x: (slot.w - w) / 2, y, w, h });
  }, [createObject, scaleFor]);

  const onImage = async (f) => {
    const { accepted, rejected } = screenFiles([f], { accept: 'image/png,image/jpeg,image/webp' });
    if (!accepted.length) { setError(rejectionMessage(rejected)); return; }
    try {
      const img = await imageToDataUrl(accepted[0]);
      placeImage(img.src, img.w, img.h, 220);
    } catch (e) {
      setError(e.message);
    }
  };

  const onSignature = (sig) => {
    setSigModal(null);
    const s = { id: uid('sig'), ...sig };
    setSignatures((list) => [s, ...list].slice(0, 6));
    placeImage(s.src, s.w, s.h, 160);
  };

  /* ---- pages ---- */
  const pageAction = useCallback((key, action) => {
    if (action === 'zoomIn') { setZoom((z) => ZOOMS.find((v) => v > z + 0.001) || z); return; }
    if (action === 'zoomOut') { setZoom((z) => [...ZOOMS].reverse().find((v) => v < z - 0.001) || z); return; }
    deactivate();
    setSelectedId(null);
    pushHistory();
    if (action === 'delete') {
      setSlots((list) => (list.length > 1 ? list.filter((s) => s.key !== key) : list));
    } else if (action === 'rotL' || action === 'rotR') {
      setSlots((list) => list.map((s) => (s.key === key ? { ...s, extra: norm(s.extra + (action === 'rotR' ? 90 : -90)) } : s)));
    }
  }, [deactivate, pushHistory]);

  const insertPage = useCallback((beforeKey) => {
    deactivate();
    pushHistory();
    setSlots((list) => {
      const at = beforeKey ? list.findIndex((s) => s.key === beforeKey) : list.length;
      const ref = list[Math.max(0, Math.min(list.length - 1, at === -1 ? list.length - 1 : at))];
      const upright = ref && norm(ref.rotate0 + ref.extra) % 180 ? { w: ref.h, h: ref.w } : { w: ref?.w || 595, h: ref?.h || 842 };
      const blank = {
        key: uid('b'), kind: 'blank', index: -1, w: upright.w, h: upright.h, rotate0: 0, extra: 0, view: [0, 0, upright.w, upright.h],
      };
      const next = [...list];
      next.splice(at === -1 ? list.length : at, 0, blank);
      return next;
    });
  }, [deactivate, pushHistory]);

  const pasteObjectRef = useRef(null);
  pasteObjectRef.current = pasteObject;

  /* ---- global keys + outside clicks ---- */
  useEffect(() => {
    if (!file || result || saving) return undefined;
    const onKeyDown = (e) => {
      const t = e.target;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        undo();
        return;
      }
      if (typing || sigModal) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'c' && selectedRef.current) {
        clipboard.current = objectsRef.current.find((o) => o.id === selectedRef.current) || null;
        return;
      }
      if (mod && k === 'v' && clipboard.current) { e.preventDefault(); pasteObjectRef.current(clipboard.current); return; }
      if (mod && k === 'd' && selectedRef.current) {
        e.preventDefault();
        pasteObjectRef.current(objectsRef.current.find((o) => o.id === selectedRef.current));
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current) {
        e.preventDefault();
        deleteObject(selectedRef.current);
      } else if (e.key === 'Escape') {
        if (selectedRef.current) setSelectedId(null);
        else setToolState('select');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [file, result, saving, undo, deleteObject, sigModal]);

  useEffect(() => {
    if (!activeId && !selectedId) return undefined;
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('[data-fq-keep],[data-fq-page]')) return;
      deactivate();
      setSelectedId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [activeId, selectedId, deactivate]);

  /* ---- tool hint ---- */
  useEffect(() => {
    if (!file || result) return undefined;
    setHint(TOOL_HINTS[tool] || null);
    const t = window.setTimeout(() => setHint(null), 4000);
    return () => window.clearTimeout(t);
  }, [tool, file, result]);

  /* ---- page navigator ---- */
  useEffect(() => {
    if (!file || result) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.setTimeout(() => {
        raf = 0;
        const holder = scrollRef.current;
        if (!holder) return;
        const mid = window.innerHeight / 2;
        let best = 0;
        let bestD = Infinity;
        holder.querySelectorAll('[data-slot]').forEach((el, i) => {
          const r = el.getBoundingClientRect();
          const d = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0;
          if (d < bestD) { bestD = d; best = i; }
        });
        setCurPage(best);
      }, 80);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(raf); };
  }, [file, result, slots.length]);

  const goToPage = (i) => {
    const el = scrollRef.current?.querySelectorAll('[data-slot]')[i];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ---- changes / save ---- */
  const changedRecs = useMemo(() => Object.values(edits).filter(isChanged), [edits]);
  const liveKeys = useMemo(() => new Set(slots.map((s) => s.key)), [slots]);
  const pageChanges = useMemo(() => {
    const origN = docRef.current?.pdfjs?.numPages || 0;
    return slots.filter((s) => s.kind === 'blank' || s.extra).length + Math.max(0, origN - slots.filter((s) => s.kind === 'orig').length);
  }, [slots]);
  const liveObjects = objects.filter((o) => liveKeys.has(o.slot));
  const totalChanges = changedRecs.filter((r) => liveKeys.has(r.slot)).length + liveObjects.length + pageChanges;

  useEffect(() => {
    if (!totalChanges || result) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [totalChanges, result]);

  const editScroll = useRef(0);
  // The result screen is short — show it from the top, not at the footer.
  useEffect(() => { if (saving) window.scrollTo({ top: 0 }); }, [saving]);
  const save = async () => {
    editScroll.current = window.scrollY;
    // Ask for the computer's own fonts while we still have the click
    // (so Arial / Tahoma / Century Gothic are written with the real font).
    const fontsReady = requestLocalFonts();
    deactivate();
    setSelectedId(null);
    setSaving(true);
    setError(null);
    try {
      await fontsReady;
      const out = await saveDocument({
        bytes: docRef.current.bytes,
        slots: slotsRef.current,
        records: Object.values(editsRef.current),
        objects: objectsRef.current,
        resolveOriginal,
      });
      setResult({
        blob: new Blob([out.bytes], { type: 'application/pdf' }),
        size: out.bytes.length,
        count: out.count + pageChanges,
        covered: out.covered,
        fallbacks: out.fallbacks,
      });
    } catch (e) {
      setError(`Couldn't save: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  /* ---- render ---- */
  const active = activeId ? edits[activeId] : null;
  const selected = selectedId ? objects.find((o) => o.id === selectedId) : null;
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
            title="Drop a PDF to edit it"
            hint="edit existing text, add text, images, signatures, links, form fields, shapes & more"
            formats="Edits the PDF's real text in its own font — no white boxes"
          />
        )}
        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  if (saving || result) {
    const notes = [];
    if (result?.covered) notes.push(`${result.covered} line${result.covered === 1 ? '' : 's'} couldn't be removed from the PDF's text layer and ${result.covered === 1 ? 'was' : 'were'} covered instead.`);
    if (result?.fallbacks?.length) notes.push(`${result.fallbacks.join(', ')} isn't installed on this device (or font access was blocked), so a close look-alike font was used.`);
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-200/70 bg-white px-4 py-3 dark:border-gray-700/60 dark:bg-gray-800">
        <ResultScreen
          working={saving}
          done={!!result}
          title="Your PDF is edited"
          workingLabel="Applying your changes…"
          subtitle={result ? `${result.count} change${result.count === 1 ? '' : 's'} applied` : undefined}
          fileName={outName}
          fileSize={result?.size}
          onDownload={() => downloadBlob(result.blob, outName)}
          onBack={() => {
            setResult(null);
            setTimeout(() => window.scrollTo({ top: editScroll.current }), 60);
          }}
          backLabel="Back to editing"
          note={notes.length ? notes.join(' ') : 'Original text was changed in the PDF itself, not hidden under boxes. The file never left your device.'}
          extra={result ? <OpenInPdfTool getPdf={() => result.blob} exclude={['pdf-editor']} /> : null}
        />
      </div>
    );
  }

  const originalLabel = active && active.origBase && origFonts[active.origBase] ? origFonts[active.origBase].label : null;

  // Styling a brand-new line also sets the style for the next new text.
  const learnText = (p) => {
    if (active && active.kind === 'new') setDefaults((d) => ({ ...d, text: { ...d.text, ...p } }));
  };
  /* ---- changes panel ---- */
  const origN = docRef.current?.pdfjs?.numPages || 0;
  const changeItems = [];
  slots.forEach((sl, i) => {
    const pageLabel = `Page ${i + 1}`;
    if (sl.kind === 'blank') {
      changeItems.push({
        key: `ins:${sl.key}`, kind: 'inserted', icon: 'inserted', tint: 'page', pageLabel, title: 'Inserted blank page', removeLabel: 'Remove this page', slot: sl.key, pos: i,
      });
    }
    if (sl.extra) {
      changeItems.push({
        key: `rot:${sl.key}`, kind: 'rotate', icon: 'rotate', tint: 'page', pageLabel, title: 'Rotated page', sub: `${sl.extra}°`, removeLabel: 'Undo rotation', slot: sl.key, pos: i,
      });
    }
    Object.values(edits).filter((r) => r.slot === sl.key && isChanged(r)).forEach((r) => {
      changeItems.push({
        key: r.id,
        kind: 'text',
        icon: 'text',
        tint: 'text',
        pageLabel,
        title: r.kind === 'line' ? (r.text.trim() ? 'Edited text' : 'Deleted text') : 'New text',
        sub: r.text.trim() || null,
        was: r.kind === 'line' && r.text !== r.origText ? r.origText : null,
        removeLabel: r.kind === 'line' ? 'Undo this edit' : 'Delete this text',
        id: r.id,
      });
    });
    objects.filter((o) => o.slot === sl.key).forEach((o) => {
      let sub = null;
      if (o.type === 'table') sub = `${o.cells.length} × ${o.colW.length}${o.attach ? ' · continues a table' : ''}`;
      else if (o.type === 'link') sub = o.url || 'no address yet';
      else if (o.type === 'field-text' || o.type === 'field-check') sub = o.name;
      changeItems.push({
        key: o.id,
        kind: 'obj',
        icon: o.type,
        tint: o.type === 'table' ? 'table' : 'obj',
        pageLabel,
        title: o.type === 'image' && o.w < 200 && o.h < 90 ? 'Image / signature' : (TOOL_LABELS[o.type] || 'Object'),
        sub,
        removeLabel: 'Delete',
        id: o.id,
      });
    });
  });
  const keptIdx = new Set(slots.filter((sl) => sl.kind === 'orig').map((sl) => sl.index));
  for (let i = 0; i < origN; i += 1) {
    if (!keptIdx.has(i)) {
      changeItems.push({
        key: `del:${i}`, kind: 'deleted', icon: 'deleted', tint: 'page', pageLabel: 'Deleted pages', title: `Original page ${i + 1}`, removeLabel: 'Restore this page', index: i,
      });
    }
  }

  const pickChange = (it) => {
    if (it.kind === 'text') {
      els.current.get(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      activateRec(it.id);
    } else if (it.kind === 'obj') {
      document.querySelector(`[data-obj-id="${it.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      selectObject(it.id);
    } else if (it.pos != null) goToPage(it.pos);
  };
  const removeChange = (it) => {
    pushHistory();
    if (it.kind === 'text') {
      if (activeRef.current === it.id) setActiveId(null);
      setEdits((m) => {
        const next = { ...m };
        delete next[it.id];
        return next;
      });
    } else if (it.kind === 'obj') {
      setObjects((list) => list.filter((o) => o.id !== it.id));
      if (selectedRef.current === it.id) setSelectedId(null);
    } else if (it.kind === 'rotate') {
      setSlots((list) => list.map((sl) => (sl.key === it.slot ? { ...sl, extra: 0 } : sl)));
    } else if (it.kind === 'inserted') {
      setSlots((list) => list.filter((sl) => sl.key !== it.slot));
    } else if (it.kind === 'deleted') {
      const orig = docRef.current.origSlots[it.index];
      setSlots((list) => {
        const at = list.findIndex((sl) => sl.kind === 'orig' && sl.index > it.index);
        const next = [...list];
        next.splice(at === -1 ? list.length : at, 0, { ...orig, extra: 0 });
        return next;
      });
    }
  };
  const restack = (it, d) => {
    pushHistory();
    setObjects((list) => {
      const i = list.findIndex((o) => o.id === it.id);
      if (i < 0) return list;
      let j = i + d;
      while (j >= 0 && j < list.length && list[j].slot !== list[i].slot) j += d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const setRec = (p, tag) => {
    pushHistory(tag);
    patch(active.id, p);
    learnText(p);
  };

  return (
    <div className="flex flex-col">
      {/* toolbar — one slim row */}
      <div
        ref={toolbarRef}
        data-fq-keep=""
        className="sticky top-16 z-30 mb-5 rounded-2xl border border-gray-200/70 bg-white/85 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-gray-700/70 dark:bg-gray-800/85"
      >
        <MainToolbar
          fileName={file.name}
          pages={slots.length}
          tool={tool}
          setTool={setTool}
          onImage={onImage}
          onSign={(t) => setSigModal(t)}
          signatures={signatures}
          onUseSignature={(sg) => placeImage(sg.src, sg.w, sg.h, 160)}
          onUndo={undo}
          canUndo={histLen > 0}
          onChooseAnother={reset}
          onPickTable={(r, c) => {
            setDefaults((d) => ({ ...d, table: { ...d.table, rows: r, cols: c } }));
            setTool('table');
          }}
        />
      </div>

      {active && (
        <FloatingBar getAnchor={() => els.current.get(active.id)?.parentElement} avoidRef={toolbarRef}>
          <TextFormat
            rec={active}
            onAlign={(a) => alignRec(active.id, a)}
            onDuplicate={() => duplicateRec(active.id)}
            originalLabel={originalLabel}
            onFont={(v) => {
              const p = v === ORIGINAL
                ? { family: ORIGINAL, bold: false, italic: false }
                : {
                  family: v,
                  bold: active.family === ORIGINAL ? active.origBold : active.bold,
                  italic: active.family === ORIGINAL ? active.origItalic : active.italic,
                };
              setRec(p);
            }}
            onSize={(size) => setRec({ size }, `size:${active.id}`)}
            onToggle={(k) => {
              toggleStyle(active.id, k);
              if (active.kind === 'new') learnText({ [k]: !active[k] });
            }}
            onColor={(color) => setRec({ color }, `color:${active.id}`)}
            onClear={() => {
              pushHistory();
              const el = els.current.get(active.id);
              if (el) el.textContent = '';
              patch(active.id, { text: '' });
            }}
            onRevert={() => {
              pushHistory();
              const { id } = active;
              setActiveId(null);
              setEdits((m) => {
                const next = { ...m };
                delete next[id];
                return next;
              });
            }}
          />
        </FloatingBar>
      )}
      {!active && selected && (
        <FloatingBar getAnchor={() => document.querySelector(`[data-obj-id="${selected.id}"]`)} avoidRef={toolbarRef}>
          <ObjectFormat
            obj={selected}
            onChange={(p) => {
              editObject(selected.id, p);
              // the next one drawn with this tool looks the same
              const keep = {};
              ['color', 'width', 'fill', 'family', 'size', 'border', 'bw', 'headerBold'].forEach((k) => { if (k in p) keep[k] = p[k]; });
              if (Object.keys(keep).length && defaults[selected.type]) {
                setDefaults((d) => ({ ...d, [selected.type]: { ...d[selected.type], ...keep } }));
              }
            }}
            onDelete={() => deleteObject(selected.id)}
            onDuplicate={() => pasteObject(selected)}
            onTable={(a) => tableAction(selected.id, a)}
          />
        </FloatingBar>
      )}

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

      <div ref={scrollRef} className="overflow-x-auto rounded-2xl bg-gray-100 px-2 pb-28 pt-4 sm:px-4 dark:bg-gray-900/60">
        <div className="space-y-8">
          {slots.map((s, i) => (
            <PageView
              key={s.key}
              pdfjs={docRef.current.pdfjs}
              slot={s}
              scale={scaleFor(s)}
              number={i + 1}
              canDelete={slots.length > 1}
              tool={tool}
              defaults={defaults}
              records={Object.values(edits).filter((r) => r.slot === s.key)}
              objects={objects.filter((o) => o.slot === s.key)}
              activeId={activeId}
              selectedId={selectedId}
              fontCssFor={fontCssFor}
              onActivateLine={activateLine}
              onActivateRec={activateRec}
              onText={onText}
              onKey={onKey}
              registerEl={registerEl}
              onAddText={addText}
              onCreate={createObject}
              onSelect={selectObject}
              onChangeObj={changeObject}
              onBeginEdit={beginObjectEdit}
              onBackground={onBackground}
              onAction={pageAction}
              onInsert={insertPage}
              onMoveRec={moveRec}
              onBeginMoveRec={beginMoveRec}
              onMargins={onMargins}
              tables={tablesFor(s)}
              onAttachTable={attachTable}
              tableProps={tableProps}
            />
          ))}
          <div data-fq-keep="" className="flex justify-center">
            <InsertButton onClick={() => insertPage(null)} />
          </div>
        </div>
      </div>

      {/* changes / layers — a small floating window the user can drag anywhere */}
      <FloatingChanges
        items={changeItems}
        activeKey={activeId || selectedId}
        onPick={pickChange}
        onRemove={removeChange}
        onRaise={(it) => restack(it, 1)}
        onLower={(it) => restack(it, -1)}
      />

      {/* page navigator */}
      {slots.length > 1 && (
        <div data-fq-keep="" className="fixed bottom-5 left-4 z-30 flex items-center gap-1 rounded-full border border-gray-200 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
          <button type="button" aria-label="Previous page" disabled={curPage <= 0} onClick={() => goToPage(curPage - 1)} className="grid h-8 w-8 place-items-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700">
            <LuChevronUp className="h-4 w-4" />
          </button>
          <span className="min-w-[4.5rem] text-center text-sm font-medium tabular-nums text-gray-700 dark:text-gray-200">
            {`${curPage + 1} / ${slots.length}`}
          </span>
          <button type="button" aria-label="Next page" disabled={curPage >= slots.length - 1} onClick={() => goToPage(curPage + 1)} className="grid h-8 w-8 place-items-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700">
            <LuChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* apply */}
      <div data-fq-keep="" className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center">
        <button
          type="button"
          disabled={!totalChanges}
          onClick={save}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-7 py-3 text-base font-semibold text-white shadow-xl shadow-green-600/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none"
        >
          Apply changes
          {totalChanges > 0 && (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold tabular-nums">{totalChanges}</span>
          )}
          <LuChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* what the chosen tool does — shows briefly, then fades */}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 transition-all duration-300 ${hint ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
        aria-live="polite"
      >
        <span className="rounded-full bg-gray-900/85 px-4 py-2 text-center text-[13px] font-medium text-white shadow-lg backdrop-blur dark:bg-white/90 dark:text-gray-900">
          {hint || TOOL_HINTS.text}
        </span>
      </div>

      {sigModal && <SignatureModal initialTab={sigModal} onDone={onSignature} onClose={() => setSigModal(null)} />}
    </div>
  );
};

export default PDFTextEditor;
