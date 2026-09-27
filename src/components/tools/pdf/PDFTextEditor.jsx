import React, {
  useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { PDFDocument } from 'pdf-lib';
import { LuChevronRight, LuChevronUp, LuChevronDown, LuFileText } from 'react-icons/lu';
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
  collectFonts, embeddedFontFile, matchFamily, cleanFontName,
} from '../../../lib/pdfTextEdit';
import PageView, { InsertButton } from './advanced/PageView';
import { MainToolbar, ContextBar } from './advanced/Toolbar';
import SignatureModal from './advanced/SignatureModal';
import { saveDocument } from './advanced/saveDocument';
import { ORIGINAL, TOOL_DEFAULTS, isChanged } from './advanced/records';
import { norm } from './advanced/geometry';

const MAX_FIT = 1.5;
const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];

let seq = 0;
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
  const [tool, setToolState] = useState('text');
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

  const docRef = useRef(null); // { bytes, pdfjs, fonts }
  const fontCache = useRef(new Map());
  const els = useRef(new Map());
  const scrollRef = useRef(null);
  const history = useRef([]);
  const lastTag = useRef(null);
  const gen = useRef(0);

  const editsRef = useRef(edits);
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
    setToolState('text');
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
      docRef.current = { bytes, pdfjs, fonts: collectFonts(lib) };
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
        // "Carlito-Bold-7888" -> "Carlito Bold"
        const label = cleanFontName(base).replace(/[,-]/g, ' ').replace(/\s+\d{3,}$/, '').trim();
        setOrigFonts((m) => ({ ...m, [base]: { family, label } }));
        return { family, fk, bytes, label };
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
      window.getSelection()?.removeAllRanges();
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
    deactivate();
    setSelectedId(null);
    const meta = line.meta || {};
    const m = matchFamily(meta.name, meta);
    const orig = await resolveOriginal(meta.name);
    const useOrig = !!(orig && [...line.text].every((ch) => /\s/.test(ch) || orig.fk.hasGlyphForCodePoint(ch.codePointAt(0))));
    const size = Math.round(line.size * 10) / 10;
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
      origBase: meta.name,
      origBold: m.bold,
      origItalic: m.italic,
      bold: useOrig ? false : m.bold,
      italic: useOrig ? false : m.italic,
      color: line.color || '#000000',
      bg: line.bg || '#ffffff',
      caret,
      gen: gen.current,
    };
    rec.init = { family: rec.family, bold: rec.bold, italic: rec.italic, size: rec.size, color: rec.color };
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
      origSize: d.size,
      size: d.size,
      origText: '',
      text: '',
      family: d.family,
      fallbackFamily: d.family,
      bold: d.bold,
      italic: d.italic,
      color: d.color,
      bg: '#ffffff',
      caret,
      gen: gen.current,
    };
    rec.init = { family: rec.family, bold: rec.bold, italic: rec.italic, size: rec.size, color: rec.color };
    setEdits((m) => ({ ...m, [id]: rec }));
    setActiveId(id);
  }, [defaults.text]);

  const onText = useCallback((id, text) => {
    pushHistory(`text:${id}`);
    patch(id, { text });
  }, [patch, pushHistory]);

  const registerEl = useCallback((id, el) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }, []);

  const toggleStyle = useCallback((id, key) => {
    const r = editsRef.current[id];
    if (!r) return;
    pushHistory();
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
      if (k !== 'u') toggleStyle(id, k === 'b' ? 'bold' : 'italic');
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); deactivate(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      pushHistory();
      const nid = uid('new');
      const rec = {
        ...r, id: nid, kind: 'new', y: r.y - r.size * 1.25, x1: r.x0, origText: '', text: '', caret: null, gen: gen.current,
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
  }, [deactivate, pushHistory, toggleStyle]);

  /* ---- objects ---- */
  const createObject = useCallback((slotKey, o) => {
    pushHistory();
    const id = uid('obj');
    const obj = { id, slot: slotKey, ...o };
    if (o.type === 'field-text' || o.type === 'field-check') {
      const n = objectsRef.current.filter((x) => x.type === o.type).length + 1;
      obj.name = `${o.type === 'field-text' ? 'Text' : 'Checkbox'} ${n}`;
    }
    setObjects((list) => [...list, obj]);
    setSelectedId(id);
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
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current) {
        e.preventDefault();
        deleteObject(selectedRef.current);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
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

  const save = async () => {
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
          onBack={() => setResult(null)}
          backLabel="Back to editing"
          note={notes.length ? notes.join(' ') : 'Original text was changed in the PDF itself, not hidden under boxes. The file never left your device.'}
          extra={result ? <OpenInPdfTool getPdf={() => result.blob} exclude={['edit-pdf-text']} /> : null}
        />
      </div>
    );
  }

  const originalLabel = active && active.origBase && origFonts[active.origBase] ? origFonts[active.origBase].label : null;

  return (
    <div className="flex flex-col">
      {/* toolbar */}
      <div
        data-fq-keep=""
        className="sticky top-16 z-30 mb-4 rounded-2xl border border-gray-200 bg-white/95 shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-1.5 dark:border-gray-700/70">
          <LuFileText className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="min-w-0 truncate text-sm font-medium text-gray-700 dark:text-gray-200" title={file.name}>{file.name}</span>
          <span className="text-xs text-gray-400">
            {`${slots.length} page${slots.length === 1 ? '' : 's'}`}
          </span>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {totalChanges ? `${totalChanges} change${totalChanges === 1 ? '' : 's'}` : ''}
          </span>
          <button
            type="button"
            onClick={reset}
            className="rounded-md px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
          >
            Choose another PDF
          </button>
        </div>
        <div className="px-2 py-1.5">
          <MainToolbar
            tool={tool}
            setTool={setTool}
            onImage={onImage}
            onSign={(t) => setSigModal(t)}
            signatures={signatures}
            onUseSignature={(s) => placeImage(s.src, s.w, s.h, 160)}
            onUndo={undo}
            canUndo={histLen > 0}
          />
        </div>
        <div className="border-t border-gray-100 py-1 dark:border-gray-700/70">
          <ContextBar
            tool={tool}
            active={active}
            selected={selected}
            defaults={defaults}
            originalLabel={originalLabel}
            onRec={(p) => { pushHistory(`rec:${active.id}:${Object.keys(p).join()}`); patch(active.id, p); }}
            onRecFont={(v) => {
              pushHistory();
              patch(active.id, v === ORIGINAL
                ? { family: ORIGINAL, bold: false, italic: false }
                : {
                  family: v,
                  bold: active.family === ORIGINAL ? active.origBold : active.bold,
                  italic: active.family === ORIGINAL ? active.origItalic : active.italic,
                });
            }}
            onToggleStyle={(k) => toggleStyle(active.id, k)}
            onRecClear={() => {
              pushHistory();
              const el = els.current.get(active.id);
              if (el) el.textContent = '';
              patch(active.id, { text: '' });
            }}
            onRecRevert={() => {
              pushHistory();
              const { id } = active;
              setActiveId(null);
              setEdits((m) => {
                const next = { ...m };
                delete next[id];
                return next;
              });
            }}
            onObj={editObject}
            onObjDelete={deleteObject}
            onDefaults={(t, p) => setDefaults((d) => ({ ...d, [t]: { ...d[t], ...p } }))}
          />
        </div>
      </div>

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
            />
          ))}
          <div data-fq-keep="" className="flex justify-center">
            <InsertButton onClick={() => insertPage(null)} />
          </div>
        </div>
      </div>

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
          <LuChevronRight className="h-5 w-5" />
        </button>
      </div>

      {sigModal && <SignatureModal initialTab={sigModal} onDone={onSignature} onClose={() => setSigModal(null)} />}
    </div>
  );
};

export default PDFTextEditor;
