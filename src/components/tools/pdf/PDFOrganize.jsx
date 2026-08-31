import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { stripExt } from '../../../lib/format';
import { openPdf, renderThumbnail } from '../../../lib/pdfjs';

let uid = 0;
const norm = (deg) => ((deg % 360) + 360) % 360;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const A4 = [595.28, 841.89];

/* ---------- little icons ---------- */
const Ico = ({ d, className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const RotL = (p) => <Ico d="M3 7v6h6M3 13a9 9 0 103-6.7L3 9" {...p} />;
const RotR = (p) => <Ico d="M21 7v6h-6M21 13a9 9 0 11-3-6.7L21 9" {...p} />;
const Dup = (p) => <Ico d="M8 8h10v10M8 8H6a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-2M8 8V6a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2" {...p} />;
const Del = (p) => <Ico d="M19 7l-.9 12.1A2 2 0 0116.1 21H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M4 7h16m-5 0V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3" {...p} />;
const stop = (e) => e.stopPropagation();

/* ---------- one page tile ---------- */
const PageTile = ({ page, position, letter, multiSource, selected, width, onToggle, onRotate, onDuplicate, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.uid });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width,
    zIndex: isDragging ? 40 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const w = page.pw || 1;
  const h = page.ph || Math.SQRT2;
  const swap = page.rotation === 90 || page.rotation === 270;
  const frameAspect = swap ? h / w : w / h;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => onToggle(e.shiftKey, e.metaKey || e.ctrlKey)}
      className={`group relative shrink-0 rounded-xl border bg-white dark:bg-gray-800 p-2 cursor-grab active:cursor-grabbing touch-none select-none transition-shadow ${
        selected
          ? 'border-purple-500 ring-2 ring-purple-500/40'
          : isDragging
            ? 'border-purple-400 shadow-xl'
            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md'
      }`}
    >
      <div
        className="relative w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900 ring-1 ring-black/5"
        style={{ aspectRatio: String(frameAspect) }}
      >
        {page.blank ? (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 m-1 rounded">
            Blank page
          </div>
        ) : page.thumb ? (
          <img
            src={page.thumb}
            alt={`Page ${position}`}
            draggable={false}
            className="absolute inset-0 m-auto max-w-none"
            style={
              swap
                ? { height: `${frameAspect * 100}%`, width: 'auto', transform: `rotate(${page.rotation}deg)` }
                : { width: '100%', height: 'auto', transform: `rotate(${page.rotation}deg)` }
            }
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
          </div>
        )}

        {/* selection check */}
        <span
          onClick={(e) => { stop(e); onToggle(e.shiftKey, e.metaKey || e.ctrlKey); }}
          onPointerDown={stop}
          className={`absolute top-1.5 left-1.5 h-5 w-5 rounded-md flex items-center justify-center text-white text-[11px] cursor-pointer transition-colors ${
            selected ? 'bg-purple-600' : 'bg-black/30 group-hover:bg-black/50'
          }`}
        >
          {selected ? '✓' : ''}
        </span>

        {multiSource && (
          <span className="absolute top-1.5 right-1.5 h-5 min-w-5 px-1 rounded bg-black/55 text-white text-[10px] font-bold flex items-center justify-center">
            {letter}
          </span>
        )}

        {page.rotation !== 0 && !page.blank && (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/55 text-white text-[10px] px-1 py-0.5">
            {page.rotation}°
          </span>
        )}

        {/* hover actions */}
        <div
          className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onPointerDown={stop}
          onClick={stop}
        >
          {!page.blank && (
            <>
              <button type="button" title="Rotate left" onClick={() => onRotate(-90)} className="h-6 w-6 flex items-center justify-center rounded bg-black/55 text-white hover:bg-black/75">
                <RotL className="h-3.5 w-3.5" />
              </button>
              <button type="button" title="Rotate right" onClick={() => onRotate(90)} className="h-6 w-6 flex items-center justify-center rounded bg-black/55 text-white hover:bg-black/75">
                <RotR className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button type="button" title="Duplicate" onClick={onDuplicate} className="h-6 w-6 flex items-center justify-center rounded bg-black/55 text-white hover:bg-black/75">
            <Dup className="h-3.5 w-3.5" />
          </button>
          <button type="button" title="Delete" onClick={onDelete} className="h-6 w-6 flex items-center justify-center rounded bg-red-600/90 text-white hover:bg-red-600">
            <Del className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span className="font-semibold text-gray-700 dark:text-gray-200">{position}</span>
        <span className="truncate">{page.blank ? 'blank' : `p.${page.srcIndex + 1}`}</span>
      </div>
    </div>
  );
};

/* ---------- main ---------- */
const PDFOrganize = () => {
  const [sources, setSources] = useState([]); // {id,name,bytes,doc,pageCount}
  const [pages, setPages] = useState([]); // {uid,sourceId,srcIndex,rotation,thumb,pw,ph,blank,blankSize}
  const [selected, setSelected] = useState(() => new Set());
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {blob,size,count}
  const [error, setError] = useState(null);
  const [thumbW, setThumbW] = useState(150);
  const [scope, setScope] = useState('all'); // 'all' | 'selected'
  const [activeId, setActiveId] = useState(null);

  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; }, [pages]);
  // A built result reflects a specific scope/selection — invalidate it when either changes.
  useEffect(() => { setResult(null); }, [scope, selected]);
  const lastClick = useRef(null);
  const thumbToken = useRef(0);
  const addRef = useRef(null);

  const multiSource = sources.length > 1;
  const hasFile = sources.length > 0;

  /* ---- history-aware mutation ---- */
  const apply = useCallback((next) => {
    setHistory((h) => [...h.slice(-49), pagesRef.current]);
    setFuture([]);
    setResult(null);
    setPages(typeof next === 'function' ? next(pagesRef.current) : next);
  }, []);

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      setFuture((f) => [pagesRef.current, ...f].slice(0, 50));
      setPages(h[h.length - 1]);
      setResult(null);
      return h.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (!f.length) return f;
      setHistory((h) => [...h.slice(-49), pagesRef.current]);
      setPages(f[0]);
      setResult(null);
      return f.slice(1);
    });
  };

  /* ---- thumbnails ---- */
  const renderThumbs = useCallback(async (doc, list, token) => {
    for (const pg of list) {
      if (token !== thumbToken.current) return;
      try {
        // eslint-disable-next-line no-await-in-loop
        const t = await renderThumbnail(doc, pg.srcIndex + 1, 320);
        if (token !== thumbToken.current) return;
        setPages((prev) => prev.map((p) => (p.uid === pg.uid ? { ...p, thumb: t.dataUrl, pw: t.width, ph: t.height } : p)));
      } catch (_) { /* keep placeholder */ }
    }
  }, []);

  /* ---- add files ---- */
  const addFiles = useCallback(async (fileList) => {
    const pdfs = [...fileList].filter(
      (f) => f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'),
    );
    if (!pdfs.length) { setError('Please choose PDF files.'); return; }
    setError(null);
    setLoading(true);
    if (pagesRef.current.length) {
      setHistory((h) => [...h.slice(-49), pagesRef.current]);
      setFuture([]);
    }
    try {
      for (const file of pdfs) {
        // eslint-disable-next-line no-await-in-loop
        const bytes = await file.arrayBuffer();
        // eslint-disable-next-line no-await-in-loop
        const doc = await openPdf(bytes);
        const sourceId = ++uid;
        const source = { id: sourceId, name: file.name || 'document.pdf', bytes, doc, pageCount: doc.numPages };
        const fresh = Array.from({ length: doc.numPages }, (_, i) => ({
          uid: ++uid, sourceId, srcIndex: i, rotation: 0, thumb: null, pw: 0, ph: 0,
        }));
        setSources((p) => [...p, source]);
        setPages((p) => {
          const merged = [...p, ...fresh];
          pagesRef.current = merged;
          return merged;
        });
        setResult(null);
        const token = ++thumbToken.current;
        renderThumbs(doc, fresh, token);
      }
    } catch (e) {
      setError(e?.message?.includes('password')
        ? 'That PDF is password-protected. Unlock it first.'
        : 'Could not read that PDF — it may be damaged.');
    } finally {
      setLoading(false);
    }
  }, [renderThumbs]);

  const reset = () => {
    thumbToken.current += 1;
    sources.forEach((s) => { try { s.doc.destroy?.(); } catch (_) { /* noop */ } });
    setSources([]);
    setPages([]);
    pagesRef.current = [];
    setSelected(new Set());
    setHistory([]);
    setFuture([]);
    setResult(null);
    setError(null);
    setScope('all');
  };

  /* ---- selection ---- */
  const orderedIds = useMemo(() => pages.map((p) => p.uid), [pages]);
  const toggleSelect = (uidv, index, shift, meta) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastClick.current != null) {
        const a = Math.min(lastClick.current, index);
        const b = Math.max(lastClick.current, index);
        for (let i = a; i <= b; i += 1) next.add(orderedIds[i]);
      } else if (meta) {
        next.has(uidv) ? next.delete(uidv) : next.add(uidv);
      } else if (next.has(uidv) && next.size === 1) {
        next.clear();
      } else {
        next.clear();
        next.add(uidv);
      }
      return next;
    });
    lastClick.current = index;
  };
  const selectAll = () => setSelected(new Set(orderedIds));
  const clearSel = () => setSelected(new Set());
  const invertSel = () => setSelected((prev) => new Set(orderedIds.filter((id) => !prev.has(id))));

  /* ---- page ops ---- */
  const targetIds = () => (selected.size ? selected : null);

  const rotate = (delta, onlyId) => {
    const ids = onlyId != null ? new Set([onlyId]) : targetIds();
    apply((p) => p.map((pg) => (!ids || ids.has(pg.uid) ? { ...pg, rotation: norm(pg.rotation + delta) } : pg)));
  };
  const rotateAll = (delta) => apply((p) => p.map((pg) => ({ ...pg, rotation: norm(pg.rotation + delta) })));

  const duplicate = (id) => {
    apply((p) => {
      const i = p.findIndex((pg) => pg.uid === id);
      if (i < 0) return p;
      const copy = { ...p[i], uid: ++uid };
      return [...p.slice(0, i + 1), copy, ...p.slice(i + 1)];
    });
  };

  const removeIds = (ids) => {
    apply((p) => p.filter((pg) => !ids.has(pg.uid)));
    setSelected((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  };
  const deleteOne = (id) => removeIds(new Set([id]));
  const deleteSelected = () => { if (selected.size) removeIds(new Set(selected)); };

  const reverse = () => apply((p) => [...p].reverse());

  const resetOrder = () => {
    apply(() => {
      const byKey = new Map(pagesRef.current.filter((p) => !p.blank).map((p) => [`${p.sourceId}:${p.srcIndex}`, p]));
      const rebuilt = [];
      sources.forEach((s) => {
        for (let i = 0; i < s.pageCount; i += 1) {
          const prev = byKey.get(`${s.id}:${i}`);
          rebuilt.push({
            uid: ++uid, sourceId: s.id, srcIndex: i, rotation: 0,
            thumb: prev?.thumb || null, pw: prev?.pw || 0, ph: prev?.ph || 0,
          });
        }
      });
      return rebuilt;
    });
    setSelected(new Set());
  };

  const addBlank = () => {
    const counts = {};
    pages.forEach((p) => {
      if (p.blank || !p.pw) return;
      const k = `${Math.round(p.pw)}x${Math.round(p.ph)}`;
      counts[k] = (counts[k] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const size = top ? top[0].split('x').map(Number) : A4;
    apply((p) => [...p, {
      uid: ++uid, sourceId: null, srcIndex: 0, rotation: 0, thumb: null,
      pw: size[0], ph: size[1], blank: true, blankSize: size,
    }]);
  };

  /* ---- drag ---- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    apply((p) => {
      const from = p.findIndex((x) => x.uid === active.id);
      const to = p.findIndex((x) => x.uid === over.id);
      return from < 0 || to < 0 ? p : arrayMove(p, from, to);
    });
  };

  /* ---- build ---- */
  const outputPages = scope === 'selected' && selected.size
    ? pages.filter((p) => selected.has(p.uid))
    : pages;

  const build = async () => {
    if (!outputPages.length) return;
    setBusy(true);
    setError(null);
    try {
      const out = await PDFDocument.create();
      const cache = {};
      for (const pg of outputPages) {
        if (pg.blank) {
          out.addPage(pg.blankSize || A4);
          continue;
        }
        if (!cache[pg.sourceId]) {
          const s = sources.find((x) => x.id === pg.sourceId);
          // eslint-disable-next-line no-await-in-loop
          cache[pg.sourceId] = await PDFDocument.load(s.bytes);
        }
        // eslint-disable-next-line no-await-in-loop
        const [copied] = await out.copyPages(cache[pg.sourceId], [pg.srcIndex]);
        if (pg.rotation) {
          const base = copied.getRotation().angle || 0;
          copied.setRotation(degrees(norm(base + pg.rotation)));
        }
        out.addPage(copied);
      }
      const bytes = await out.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      setResult({ blob, size: blob.size, count: outputPages.length });
    } catch (e) {
      setError(`Could not build the PDF: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const outName = sources.length === 1
    ? `${stripExt(sources[0].name)}-organized.pdf`
    : 'organized.pdf';

  const backFromResult = () => setResult(null);

  const primaryLabel = busy
    ? 'Building…'
    : scope === 'selected' && selected.size
      ? `Save ${selected.size} selected page${selected.size > 1 ? 's' : ''}`
      : 'Organize & save';

  /* ---- sidebar ---- */
  const btn = 'flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  const sidebar = (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {pages.length} page{pages.length === 1 ? '' : 's'}
          </h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Start over
          </button>
        </div>
        <ul className="space-y-1">
          {sources.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {multiSource && (
                <span className="h-4 w-4 shrink-0 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 text-[10px] font-bold flex items-center justify-center">
                  {LETTERS[i] || '·'}
                </span>
              )}
              <span className="truncate" title={s.name}>{s.name}</span>
              <span className="ml-auto shrink-0">{s.pageCount}p</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => addRef.current?.click()} className={`${btn} w-full mt-1`}>
          + Add another PDF
        </button>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Page tools</h3>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => rotateAll(-90)} className={btn}><RotL className="h-3.5 w-3.5" /> Rotate all</button>
          <button type="button" onClick={() => rotateAll(90)} className={btn}><RotR className="h-3.5 w-3.5" /> Rotate all</button>
          <button type="button" onClick={reverse} className={btn} disabled={pages.length < 2}>Reverse order</button>
          <button type="button" onClick={resetOrder} className={btn} disabled={!hasFile}>Reset order</button>
          <button type="button" onClick={addBlank} className={`${btn} col-span-2`} disabled={!hasFile}>+ Insert blank page</button>
        </div>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Selection</h3>
          <span className="text-xs text-gray-400">{selected.size} selected</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={selectAll} className={btn} disabled={!hasFile}>All</button>
          <button type="button" onClick={invertSel} className={btn} disabled={!hasFile}>Invert</button>
          <button type="button" onClick={clearSel} className={btn} disabled={!selected.size}>None</button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">Shift-click for a range · ⌘/Ctrl-click to add.</p>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Output</h3>
        <Segmented
          options={[
            { value: 'all', label: 'All pages' },
            { value: 'selected', label: `Selected${selected.size ? ` (${selected.size})` : ''}` },
          ]}
          value={scope}
          onChange={(v) => { if (v === 'all' || selected.size) setScope(v); }}
        />
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {outputPages.length} page{outputPages.length === 1 ? '' : 's'} will be saved.
        </p>
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={undo} className={btn} disabled={!history.length}>↶ Undo</button>
          <button type="button" onClick={redo} className={btn} disabled={!future.length}>↷ Redo</button>
        </div>
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <RangeSlider label="Thumbnail size" value={thumbW} min={90} max={230} step={10} onChange={setThumbW} suffix="px" />
      </section>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={build}
      disabled={!outputPages.length || busy}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {primaryLabel}
    </button>
  );

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      title="Your PDF is ready"
      workingLabel="Building your PDF…"
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to editing"
    />
  ) : null;

  const activePage = activeId != null ? pages.find((p) => p.uid === activeId) : null;

  return (
    <ToolWorkspace
      file={hasFile ? sources[0] : null}
      accept="application/pdf"
      multiple
      formats="PDF — add one or several to merge and reorganize"
      dropTitle="Drop PDF files to organize"
      dropHint="reorder, rotate, delete or merge pages"
      paste={false}
      onFiles={(fs) => addFiles(fs)}
      onBack={(busy || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <input
        ref={addRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {pages.length} page{pages.length === 1 ? '' : 's'}
            {multiSource ? ` from ${sources.length} files` : ''}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Drag tiles to reorder · click to select.</p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/25 px-2 py-1.5">
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300 px-1">{selected.size} selected</span>
            <button type="button" title="Rotate left" onClick={() => rotate(-90)} className="h-7 w-7 flex items-center justify-center rounded-lg text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-800/40"><RotL /></button>
            <button type="button" title="Rotate right" onClick={() => rotate(90)} className="h-7 w-7 flex items-center justify-center rounded-lg text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-800/40"><RotR /></button>
            <button type="button" title="Delete selected" onClick={deleteSelected} className="h-7 w-7 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"><Del /></button>
            <button type="button" onClick={clearSel} className="h-7 px-2 text-xs rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">Clear</button>
          </div>
        )}
      </div>

      {loading && pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <div className="h-10 w-10 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
          Reading PDF…
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-3 content-start">
              {pages.map((pg, i) => (
                <PageTile
                  key={pg.uid}
                  page={pg}
                  position={i + 1}
                  letter={LETTERS[sources.findIndex((s) => s.id === pg.sourceId)] || '·'}
                  multiSource={multiSource}
                  selected={selected.has(pg.uid)}
                  width={thumbW}
                  onToggle={(shift, meta) => toggleSelect(pg.uid, i, shift, meta)}
                  onRotate={(d) => rotate(d, pg.uid)}
                  onDuplicate={() => duplicate(pg.uid)}
                  onDelete={() => deleteOne(pg.uid)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activePage ? (
              <div className="rounded-xl border-2 border-purple-400 bg-white dark:bg-gray-800 p-2 shadow-2xl" style={{ width: thumbW }}>
                <div className="w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900" style={{ aspectRatio: String((activePage.pw || 1) / (activePage.ph || Math.SQRT2)) }}>
                  {activePage.thumb && <img src={activePage.thumb} alt="" className="w-full h-auto" />}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {loading && pages.length > 0 && (
        <p className="mt-4 text-xs text-gray-400 flex items-center gap-2">
          <span className="h-3 w-3 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
          Adding more pages…
        </p>
      )}
    </ToolWorkspace>
  );
};

export default PDFOrganize;
