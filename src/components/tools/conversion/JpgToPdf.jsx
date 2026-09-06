import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
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
import { formatBytes, stripExt } from '../../../lib/format';
import { loadImageFromFile } from '../../../lib/imageResize';
import { imagesToPdf, computePageLayout } from '../../../lib/imagesToPdf';

let uid = 0;
const isImg = (f) => f.type?.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name || '');

const PAGE_SIZES = [
  { value: 'fit', label: 'Fit to image' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
  { value: 'legal', label: 'Legal' },
  { value: 'a3', label: 'A3' },
  { value: 'a5', label: 'A5' },
];

const stop = (e) => e.stopPropagation();

const FIT_LABEL = { contain: 'Fit', cover: 'Fill', actual: 'Actual size' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Human summary of the current PDF options, e.g. "A4 · Portrait · 10 mm margin · Fill". */
const optsSummary = (opts) => {
  const size = PAGE_SIZES.find((s) => s.value === opts.pageSize)?.label || opts.pageSize;
  const bits = [size];
  if (opts.pageSize !== 'fit') {
    bits.push(cap(opts.orientation));
    if (opts.marginMm > 0) bits.push(`${opts.marginMm} mm margin`);
    bits.push(FIT_LABEL[opts.fit]);
  } else if (opts.marginMm > 0) {
    bits.push(`${opts.marginMm} mm border`);
  }
  return bits.join(' · ');
};

/**
 * The white sheet itself, drawn at the real page aspect ratio with a dashed
 * margin guide and the photo placed exactly where computePageLayout() (the
 * same function the PDF writer uses) says it will land. Anything spilling past
 * the page edge is clipped, just like in the PDF.
 */
const PageSheet = ({ item, opts, fill }) => {
  const { pw, ph, dw, dh, margin } = computePageLayout(item.w, item.h, opts);
  const portrait = ph >= pw;
  // `fill` = the parent is already sized to the page ratio (the popup), so just
  // fill it. Otherwise keep the ratio and fit inside the parent (the tiles).
  const sizeStyle = fill
    ? { width: '100%', height: '100%' }
    : { aspectRatio: `${pw} / ${ph}`, width: portrait ? 'auto' : '100%', height: portrait ? '100%' : 'auto' };

  return (
    <div
      className={`relative bg-white overflow-hidden max-w-full max-h-full ${
        fill
          ? 'rounded-lg ring-1 ring-black/10 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.45),0_0_0_6px_rgba(255,255,255,0.55)]'
          : 'shadow-[0_1px_6px_rgba(0,0,0,0.18)]'
      }`}
      style={sizeStyle}
    >
      <img
        src={item.url}
        alt={item.name}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-fill pointer-events-none"
        style={{ width: `${(dw / pw) * 100}%`, height: `${(dh / ph) * 100}%` }}
      />
      {margin > 0 && (
        <span
          className="absolute border border-dashed border-purple-400/60"
          style={{
            left: `${(margin / pw) * 100}%`,
            right: `${(margin / pw) * 100}%`,
            top: `${(margin / ph) * 100}%`,
            bottom: `${(margin / ph) * 100}%`,
          }}
        />
      )}
    </div>
  );
};

const PagePreview = ({ item, opts }) => {
  if (!item.url) {
    return (
      <div className="relative aspect-square rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="relative aspect-square rounded-lg bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center p-2 overflow-hidden">
      <PageSheet item={item} opts={opts} />
    </div>
  );
};

/**
 * Centred popup that blows one page up large so you can check how the image
 * meets the page edges. Backdrop / ✕ / Esc closes; ← → step between pages.
 */
const PagePreviewModal = ({ items, index, opts, onClose, onStep }) => {
  const item = items[index];
  const [vp, setVp] = useState(() => ({
    w: typeof window === 'undefined' ? 1024 : window.innerWidth,
    h: typeof window === 'undefined' ? 768 : window.innerHeight,
  }));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onStep(1);
      else if (e.key === 'ArrowLeft') onStep(-1);
    };
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = prev;
    };
  }, [onClose, onStep]);

  if (!item) return null;

  // Size a box to the real page ratio so the ✕ can sit exactly on the sheet's
  // top-right corner (not floating in dead space).
  const { pw, ph } = computePageLayout(item.w, item.h, opts);
  const availW = Math.min(vp.w * 0.86, 400);
  const availH = Math.min(Math.max(vp.h * 0.7, 250), 400); // 250–400px tall
  const pageAR = pw / ph;
  let boxW;
  let boxH;
  if (availW / availH > pageAR) { boxH = availH; boxW = availH * pageAR; }
  else { boxW = availW; boxH = availW / pageAR; }
  // Keep a wide page from getting too short to read.
  if (boxH < 250) { boxH = 250; boxW = Math.min(250 * pageAR, availW); }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div className="flex items-center gap-2 sm:gap-4" onClick={stop}>
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label="Previous page"
            className="hidden sm:grid h-10 w-10 flex-none place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}

        <div className="relative flex-none" style={{ width: boxW, height: boxH }}>
          <PageSheet item={item} opts={opts} fill />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="absolute -right-3 -top-3 grid h-8 w-8 place-items-center rounded-full bg-red-500 text-white shadow-md ring-2 ring-white hover:bg-red-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {items.length > 1 && (
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label="Next page"
            className="hidden sm:grid h-10 w-10 flex-none place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
          </button>
        )}
      </div>

      <div className="mt-5 max-w-[90vw] rounded-lg bg-black/50 px-3 py-1.5 text-center" onClick={stop}>
        <p className="text-sm font-medium text-white truncate">
          Page {index + 1} of {items.length} · {item.name}
        </p>
        <p className="mt-0.5 text-[12px] text-white/75">
          {item.w ? `${item.w}×${item.h}px · ` : ''}{optsSummary(opts)}
        </p>
      </div>
    </div>
  );
};

const ImageCard = ({ item, index, opts, onRemove, onZoom }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative rounded-xl border bg-white dark:bg-gray-800 p-2 cursor-grab active:cursor-grabbing touch-none select-none ${
        isDragging ? 'border-purple-400 shadow-lg' : 'border-gray-200/70 dark:border-gray-700/60'
      }`}
    >
      <div className="relative">
        <button
          type="button"
          onClick={item.url ? onZoom : undefined}
          className="block w-full cursor-zoom-in rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          aria-label={`Preview page ${index + 1} larger`}
        >
          <PagePreview item={item} opts={opts} />
        </button>
        <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-purple-600 text-white text-[10px] px-1.5 py-0.5 font-medium">
          Page {index + 1}
        </span>
        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/50 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14zM11 8v6M8 11h6" />
          </svg>
        </span>
        <button
          type="button"
          onPointerDown={stop}
          onClick={onRemove}
          className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 text-xs font-medium text-gray-800 dark:text-gray-100 truncate" title={item.name}>{item.name}</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        {item.w ? `${item.w}×${item.h} · ` : ''}{formatBytes(item.size)}
      </p>
    </div>
  );
};

const AddTile = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 flex flex-col items-center justify-center gap-2.5 transition-colors"
  >
    <span className="absolute inset-3 rounded-full border-2 border-purple-300/40 dark:border-purple-500/20 opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" />
    <span className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:scale-110 transition-transform">
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    </span>
    <span className="text-xs font-semibold text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400">
      Add images
    </span>
  </button>
);

const JpgToPdf = () => {
  const [items, setItems] = useState([]); // {id,file,name,size,url,img,w,h}
  // Default to a no-surprises result: page = the image itself, no border.
  // Everything is one control away if they want A4 / margins / Fill.
  const [pageSize, setPageSize] = useState('fit');
  const [orientation, setOrientation] = useState('auto');
  const [margin, setMargin] = useState(0);
  const [fit, setFit] = useState('contain');
  const [quality, setQuality] = useState(92);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // {done,total}
  const [result, setResult] = useState(null); // {blob,size,pages}
  const [error, setError] = useState(null);
  const [zoomIndex, setZoomIndex] = useState(null); // which page the popup shows

  const addRef = useRef(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => () => {
    itemsRef.current.forEach((it) => it.url && URL.revokeObjectURL(it.url));
  }, []);

  const dirty = () => { setResult(null); setProgress(null); };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const hydrate = useCallback(async (id, file) => {
    try {
      const img = await loadImageFromFile(file);
      setItems((p) => p.map((it) => (it.id === id
        ? { ...it, img, w: img.naturalWidth, h: img.naturalHeight } : it)));
    } catch (_) {
      setItems((p) => p.map((it) => (it.id === id ? { ...it, broken: true } : it)));
    }
  }, []);

  const addFiles = useCallback((list) => {
    const picked = [...list].filter(isImg);
    if (!picked.length) { setError('Please choose image files (JPG, PNG, WebP…).'); return; }
    setError(null);
    dirty();
    const fresh = picked.map((file) => ({
      id: ++uid,
      file,
      name: file.name || 'image',
      size: file.size,
      url: URL.createObjectURL(file),
      img: null,
      w: 0,
      h: 0,
    }));
    setItems((p) => [...p, ...fresh]);
    fresh.forEach((it) => hydrate(it.id, it.file));
  }, [hydrate]);

  const removeItem = (id) => setItems((p) => {
    const gone = p.find((it) => it.id === id);
    if (gone?.url) URL.revokeObjectURL(gone.url);
    dirty();
    return p.filter((it) => it.id !== id);
  });

  const reset = () => {
    itemsRef.current.forEach((it) => it.url && URL.revokeObjectURL(it.url));
    setItems([]);
    setResult(null);
    setError(null);
  };
  const backFromResult = () => setResult(null);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setItems((p) => {
      const from = p.findIndex((x) => x.id === active.id);
      const to = p.findIndex((x) => x.id === over.id);
      return from < 0 || to < 0 ? p : arrayMove(p, from, to);
    });
    dirty();
  };

  const ready = items.length > 0 && items.every((it) => it.img || it.broken) && !busy;

  // Passed to every page preview so the tiles mirror the current settings live.
  const layoutOpts = { pageSize, orientation, marginMm: margin, fit };

  const stepZoom = useCallback((d) => {
    setZoomIndex((n) => {
      if (n == null) return n;
      const len = itemsRef.current.length;
      return len ? (n + d + len) % len : null;
    });
  }, []);
  const closeZoom = useCallback(() => setZoomIndex(null), []);
  // Popup index can fall out of range if a page is removed while it's open.
  const zoomOpen = zoomIndex != null && zoomIndex < items.length;

  const run = async () => {
    const usable = items.filter((it) => it.img);
    if (!usable.length) { setError('None of the images could be read.'); return; }
    setBusy(true);
    setError(null);
    try {
      setProgress({ done: 0, total: usable.length });
      const pages = [];
      for (let i = 0; i < usable.length; i += 1) {
        const it = usable[i];
        const c = document.createElement('canvas');
        c.width = it.img.naturalWidth;
        c.height = it.img.naturalHeight;
        const ctx = c.getContext('2d');
        const png = it.file.type === 'image/png';
        if (!png) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(it.img, 0, 0);
        pages.push({ dataUrl: png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', quality / 100) });
        setProgress({ done: i + 1, total: usable.length });
      }
      const blob = await imagesToPdf(pages, {
        pageSize,
        orientation,
        marginMm: margin,
        fit,
        bg: '#ffffff',
      });
      setResult({ blob, size: blob.size, pages: pages.length });
    } catch (e) {
      setError(e.message || 'Could not build the PDF.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const outName = items[0]
    ? `${stripExt(items[0].name)}${items.length > 1 ? `-+${items.length - 1}` : ''}.pdf`
    : 'images.pdf';

  const sidebar = (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {items.length} image{items.length === 1 ? '' : 's'}
          </h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Start over
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">Each image becomes one page, in the order shown.</p>
      </section>

      <section className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">PDF options</h3>

        <label className="block text-xs">
          <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Page size</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(e.target.value); dirty(); }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2"
          >
            {PAGE_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>

        {pageSize !== 'fit' && (
          <div>
            <span className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Orientation</span>
            <Segmented
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'portrait', label: 'Portrait' },
                { value: 'landscape', label: 'Landscape' },
              ]}
              value={orientation}
              onChange={(v) => { setOrientation(v); dirty(); }}
            />
          </div>
        )}

        <RangeSlider label="Margin" value={margin} min={0} max={30} onChange={(v) => { setMargin(v); dirty(); }} suffix=" mm" />

        <div>
          <span className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Image fit</span>
          <Segmented
            options={[
              { value: 'contain', label: 'Fit' },
              { value: 'cover', label: 'Fill' },
              { value: 'actual', label: 'Actual' },
            ]}
            value={fit}
            onChange={(v) => { setFit(v); dirty(); }}
          />
        </div>

        <RangeSlider label="JPG quality" value={quality} min={50} max={100} onChange={(v) => { setQuality(v); dirty(); }} suffix="%" />
      </section>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={run}
      disabled={!ready}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
    >
      {busy ? 'Building…' : `Create PDF · ${items.length} page${items.length === 1 ? '' : 's'}`}
    </button>
  );

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      progress={progress && progress.total ? Math.round((progress.done / progress.total) * 100) : (busy ? 0 : null)}
      title="Your PDF is ready"
      workingLabel="Building your PDF…"
      subtitle={result ? `${result.pages} page${result.pages === 1 ? '' : 's'} · ${formatBytes(result.size)}` : undefined}
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => result && downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to images"
    />
  ) : null;

  return (
    <ToolWorkspace
      file={items[0]?.file || null}
      accept="image/*"
      multiple
      formats="JPG · PNG · WebP · GIF — pick one or many"
      dropTitle="Drop images to turn into a PDF"
      dropHint="or click to browse — combine into one PDF"
      onFiles={(fs) => addFiles(fs)}
      onBack={(busy || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <input
        ref={addRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {items.length} image{items.length === 1 ? '' : 's'} → 1 PDF
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Live preview of each page — {items.length > 1 ? 'drag to reorder. ' : ''}Dashed line = margin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => addRef.current?.click()}
          className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Add images
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
            {items.map((it, i) => (
              <ImageCard
                key={it.id}
                item={it}
                index={i}
                opts={layoutOpts}
                onRemove={() => removeItem(it.id)}
                onZoom={() => setZoomIndex(i)}
              />
            ))}
          </SortableContext>
          <AddTile onClick={() => addRef.current?.click()} />
        </div>
      </DndContext>

      {zoomOpen && (
        <PagePreviewModal
          items={items}
          index={zoomIndex}
          opts={layoutOpts}
          onClose={closeZoom}
          onStep={stepZoom}
        />
      )}
    </ToolWorkspace>
  );
};

export default JpgToPdf;
