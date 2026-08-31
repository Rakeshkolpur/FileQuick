import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import CropModal from '../../tool/CropModal';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { zipFiles } from '../../../lib/zip';
import { encodeImage, outExt, isLossy, loadImageFromFile } from '../../../lib/imageResize';
import { transformToCanvas } from '../../../lib/imageTransform';
import { imagesToPdf } from '../../../lib/imagesToPdf';

let uid = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OUT = [
  { value: 'pdf', label: 'PDF' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];
const PDF_SIZES = [
  { value: 'fit', label: 'Fit to image' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
  { value: 'legal', label: 'Legal' },
  { value: 'a3', label: 'A3' },
  { value: 'a5', label: 'A5' },
];

const renderItemCanvas = (it) => {
  const base = transformToCanvas(it.img, { rotation: it.rotation || 0 });
  if (!it.cropRect) return base;
  const { x, y, width, height } = it.cropRect;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  c.getContext('2d').drawImage(base, x, y, width, height, 0, 0, c.width, c.height);
  return c;
};

const IconBtn = ({ title, onClick, disabled, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className="h-6 w-6 flex items-center justify-center rounded bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
  >
    {children}
  </button>
);

const stop = (e) => e.stopPropagation();

const ConvertCard = ({ item, index, isPdf, result, onRotate, onCrop, onRemove, onDownload }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  const thumb = useMemo(() => {
    if (!item.img) return null;
    const c = renderItemCanvas(item);
    const max = 240;
    const s = Math.min(1, max / Math.max(c.width, c.height));
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(c.width * s));
    t.height = Math.max(1, Math.round(c.height * s));
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    return t.toDataURL('image/png');
  }, [item.img, item.rotation, item.cropRect]);

  const [dl, setDl] = useState('idle');
  const dlClick = async () => {
    if (dl !== 'idle') return;
    setDl('working');
    await sleep(300);
    try { onDownload(); await sleep(150); } finally { setDl('done'); setTimeout(() => setDl('idle'), 1400); }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-xl border bg-white dark:bg-gray-800 p-2 cursor-grab active:cursor-grabbing touch-none select-none ${
        isDragging ? 'border-purple-400 shadow-lg' : 'border-gray-200/70 dark:border-gray-700/60'
      }`}
    >
      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center bg-checkered">
        {thumb && <img src={thumb} alt={item.file.name} className="max-w-full max-h-full object-contain pointer-events-none" />}
        {isPdf && (
          <span className="absolute bottom-1 left-1 rounded bg-purple-600 text-white text-[10px] px-1.5 py-0.5 font-medium">
            Page {index + 1}
          </span>
        )}
        {item.cropRect && !isPdf && (
          <span className="absolute bottom-1 left-1 rounded bg-purple-600 text-white text-[10px] px-1 py-0.5">Cropped</span>
        )}
        <div className="absolute top-1 right-1 flex gap-1" onPointerDown={stop}>
          <IconBtn title="Rotate left" onClick={() => onRotate(-90)}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v6h6M3 13a9 9 0 103-6.7L3 9" /></svg>
          </IconBtn>
          <IconBtn title="Rotate right" onClick={() => onRotate(90)}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7v6h-6M21 13a9 9 0 11-3-6.7L21 9" /></svg>
          </IconBtn>
          <IconBtn title="Remove" onClick={onRemove}>✕</IconBtn>
        </div>
        <div className="absolute top-1 left-1 flex gap-1" onPointerDown={stop}>
          <IconBtn title="Crop" onClick={onCrop}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14" /></svg>
          </IconBtn>
        </div>
        <span className="absolute bottom-1 right-1 h-5 w-5 rounded bg-black/40 text-white flex items-center justify-center" title="Drag to reorder">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
        </span>
      </div>
      <p className="mt-1.5 text-xs font-medium text-gray-800 dark:text-gray-100 truncate" title={item.file.name}>{item.file.name}</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">{item.w || '?'}×{item.h || '?'} · {formatBytes(item.file.size)}</p>
      {result && (
        <>
          <p className="text-[11px] text-green-600 dark:text-green-400">→ {formatBytes(result.size)}</p>
          <button
            type="button"
            onPointerDown={stop}
            onClick={dlClick}
            className="mt-1 w-full text-xs py-1 rounded-md bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-1"
          >
            {dl === 'working' ? '…' : dl === 'done' ? '✓ Saved' : `Download .${outExt(result.format)}`}
          </button>
        </>
      )}
    </div>
  );
};

const ImageConvert = () => {
  const [items, setItems] = useState([]);
  const loadToken = useRef(0);
  const addRef = useRef(null);

  const [out, setOut] = useState('pdf');
  const [quality, setQuality] = useState(90);
  const [jpgBg, setJpgBg] = useState('#ffffff');

  const [pdfSize, setPdfSize] = useState('fit');
  const [pdfOrient, setPdfOrient] = useState('auto');
  const [pdfMargin, setPdfMargin] = useState(0);
  const [pdfFit, setPdfFit] = useState('contain');
  const [pdfBg, setPdfBg] = useState('#ffffff');

  const [cropId, setCropId] = useState(null);
  const [results, setResults] = useState(null); // {kind:'pdf',blob} | {kind:'images',blobs:[]}
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const isPdf = out === 'pdf';

  const dirty = () => { setResults(null); setProgress(null); };

  const loadItem = async (file, id) => {
    try {
      const img = await loadImageFromFile(file);
      setItems((p) => p.map((it) => (it.id === id ? { ...it, img, w: img.naturalWidth, h: img.naturalHeight } : it)));
    } catch (e) {
      setItems((p) => p.map((it) => (it.id === id ? { ...it, error: e.message } : it)));
    }
  };
  const addFiles = (list) => {
    const imgs = [...list].filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) { setError('Please choose image files.'); return; }
    setError(null);
    dirty();
    const next = imgs.map((file) => ({ id: ++uid, file, img: null, w: 0, h: 0, rotation: 0 }));
    setItems((p) => [...p, ...next]);
    next.forEach((it) => loadItem(it.file, it.id));
  };
  const patchItem = (id, patch) => { setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it))); dirty(); };
  const rotateItem = (id, d) => setItems((p) => { dirty(); return p.map((it) => (it.id === id ? { ...it, rotation: (((it.rotation + d) % 360) + 360) % 360, cropRect: undefined } : it)); });
  const removeItem = (id) => { setItems((p) => p.filter((it) => it.id !== id)); dirty(); };
  const reset = () => { loadToken.current += 1; setItems([]); setResults(null); setError(null); };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setItems((p) => {
      const oldI = p.findIndex((i) => i.id === active.id);
      const newI = p.findIndex((i) => i.id === over.id);
      return oldI < 0 || newI < 0 ? p : arrayMove(p, oldI, newI);
    });
    dirty();
  };

  useEffect(() => {
    let cancelled = false;
    let pending = null;
    try { pending = sessionStorage.getItem('pendingImageUpload'); if (pending) sessionStorage.removeItem('pendingImageUpload'); } catch (_) { /* ignore */ }
    if (!pending) return undefined;
    fetch(pending).then((r) => r.blob()).then((blob) => {
      if (cancelled) return;
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      addFiles([new File([blob], `image.${ext}`, { type: blob.type })]);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = items.length > 0 && items.every((it) => it.img) && !busy;

  const run = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      if (isPdf) {
        setProgress({ done: 0, total: items.length });
        const pages = [];
        for (let i = 0; i < items.length; i += 1) {
          const c = renderItemCanvas(items[i]);
          const flat = document.createElement('canvas');
          flat.width = c.width; flat.height = c.height;
          const ctx = flat.getContext('2d');
          ctx.fillStyle = pdfBg; ctx.fillRect(0, 0, flat.width, flat.height);
          ctx.drawImage(c, 0, 0);
          pages.push({ dataUrl: flat.toDataURL('image/jpeg', 0.9) });
          setProgress({ done: i + 1, total: items.length });
        }
        // eslint-disable-next-line no-await-in-loop
        const blob = await imagesToPdf(pages, { pageSize: pdfSize, orientation: pdfOrient, marginMm: pdfMargin, fit: pdfFit, bg: pdfBg });
        setResults({ kind: 'pdf', blob, size: blob.size });
      } else {
        setProgress({ done: 0, total: items.length });
        const blobs = [];
        for (let i = 0; i < items.length; i += 1) {
          const c = renderItemCanvas(items[i]);
          // eslint-disable-next-line no-await-in-loop
          const blob = await encodeImage(c, { width: c.width, height: c.height, format: out, quality: quality / 100, background: jpgBg });
          blobs.push(blob);
          setProgress({ done: i + 1, total: items.length });
        }
        setResults({ kind: 'images', blobs });
      }
    } catch (e) {
      setError(e.message || 'Conversion failed.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const pdfName = items[0] ? `${stripExt(items[0].file.name)}${items.length > 1 ? `_+${items.length - 1}` : ''}.pdf` : 'filequick.pdf';
  const imgName = (i) => `${stripExt(items[i].file.name)}.${outExt(out)}`;

  const downloadResult = async () => {
    if (!results) return;
    if (results.kind === 'pdf') { downloadBlob(results.blob, pdfName); return; }
    if (results.blobs.length === 1) { downloadBlob(results.blobs[0], imgName(0)); return; }
    const zip = await zipFiles(results.blobs.map((b, i) => ({ name: imgName(i), blob: b })));
    downloadBlob(zip, 'converted-images.zip');
  };

  const backFromResult = () => setResults(null);

  const buttonLabel = isPdf ? 'Create PDF' : `Convert ${items.length > 1 ? `${items.length} images` : 'image'}`;

  const imagesTotal = results?.kind === 'images'
    ? results.blobs.reduce((s, b) => s + b.size, 0) : 0;

  const resultView = (busy || results) ? (
    <ResultScreen
      working={busy}
      done={!!results}
      progress={progress && progress.total ? Math.round((progress.done / progress.total) * 100) : (busy ? 0 : null)}
      workingLabel={isPdf ? 'Building your PDF…' : 'Converting your images…'}
      title={isPdf ? 'Your PDF is ready' : results?.kind === 'images' && results.blobs.length > 1 ? 'Your images are converted' : 'Your image is converted'}
      subtitle={results?.kind === 'pdf'
        ? formatBytes(results.size)
        : results?.kind === 'images'
          ? `${results.blobs.length} file${results.blobs.length > 1 ? 's' : ''} · ${formatBytes(imagesTotal)}`
          : undefined}
      fileName={results?.kind === 'pdf' ? pdfName : results?.kind === 'images' && results.blobs.length === 1 ? imgName(0) : undefined}
      fileSize={results?.kind === 'pdf' ? results.size : results?.kind === 'images' && results.blobs.length === 1 ? results.blobs[0].size : undefined}
      downloadLabel={results?.kind === 'images' && results.blobs.length > 1 ? 'Download all (ZIP)' : undefined}
      onDownload={downloadResult}
      onBack={backFromResult}
      backLabel="Back to images"
      extra={results?.kind === 'images' && results.blobs.length > 1 ? (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
          {results.blobs.map((b, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
              <span className="truncate text-gray-600 dark:text-gray-300">{imgName(i)}</span>
              <button type="button" onClick={() => downloadBlob(b, imgName(i))} className="shrink-0 text-purple-600 dark:text-purple-400 hover:underline">
                {formatBytes(b.size)} · save
              </button>
            </div>
          ))}
        </div>
      ) : null}
    />
  ) : null;

  const sidebar = (
    <>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Convert to</h3>
        <Segmented options={OUT} value={out} onChange={(v) => { setOut(v); dirty(); }} />
      </section>

      {isPdf ? (
        <section className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">PDF options</h3>
          <label className="block text-xs">
            <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Page size</span>
            <select value={pdfSize} onChange={(e) => { setPdfSize(e.target.value); dirty(); }} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2">
              {PDF_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          {pdfSize !== 'fit' && (
            <div>
              <span className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Orientation</span>
              <Segmented
                options={[{ value: 'auto', label: 'Auto' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]}
                value={pdfOrient}
                onChange={(v) => { setPdfOrient(v); dirty(); }}
              />
            </div>
          )}
          <RangeSlider label="Margin" value={pdfMargin} min={0} max={30} onChange={(v) => { setPdfMargin(v); dirty(); }} suffix=" mm" />
          <div>
            <span className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Image fit</span>
            <Segmented
              options={[{ value: 'contain', label: 'Fit' }, { value: 'cover', label: 'Fill' }, { value: 'actual', label: 'Actual' }]}
              value={pdfFit}
              onChange={(v) => { setPdfFit(v); dirty(); }}
            />
          </div>
          <label className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300">
            Page background
            <input type="color" value={pdfBg} onChange={(e) => { setPdfBg(e.target.value); dirty(); }} className="h-7 w-10 rounded cursor-pointer bg-transparent" />
          </label>
        </section>
      ) : (
        <section className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Image options</h3>
          {isLossy(out) && (
            <RangeSlider label="Quality" value={quality} min={40} max={100} onChange={(v) => { setQuality(v); dirty(); }} suffix="%" />
          )}
          {out === 'jpeg' && (
            <label className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300">
              Background (JPG has no transparency)
              <input type="color" value={jpgBg} onChange={(e) => { setJpgBg(e.target.value); dirty(); }} className="h-7 w-10 rounded cursor-pointer bg-transparent" />
            </label>
          )}
          {out === 'png' && <p className="text-xs text-gray-400 dark:text-gray-500">PNG keeps transparency, lossless.</p>}
        </section>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={run}
      disabled={!ready || busy}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {buttonLabel}
    </button>
  );

  const cropItem = cropId != null ? items.find((it) => it.id === cropId) : null;
  const cropBase = cropItem?.img ? transformToCanvas(cropItem.img, { rotation: cropItem.rotation || 0 }) : null;

  return (
    <ToolWorkspace
      file={items[0]?.file || null}
      accept="image/*"
      multiple
      formats="JPG · PNG · WebP · GIF — select one or many"
      dropTitle="Drop images to convert"
      dropHint="one or many · to PDF or another format"
      onFiles={(fs) => addFiles(fs)}
      onBack={(busy || results) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <input ref={addRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {items.length} image{items.length === 1 ? '' : 's'}{isPdf ? ' → 1 PDF' : ''}
          </p>
          {items.length > 1 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">Drag the tiles to reorder{isPdf ? ' the pages' : ''}.</p>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => addRef.current?.click()} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">Add images</button>
          <button type="button" onClick={reset} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">Start over</button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((it, i) => (
              <ConvertCard
                key={it.id}
                item={it}
                index={i}
                isPdf={isPdf}
                result={results?.kind === 'images' ? { size: results.blobs[i]?.size, format: out } : null}
                onRotate={(d) => rotateItem(it.id, d)}
                onCrop={() => setCropId(it.id)}
                onRemove={() => removeItem(it.id)}
                onDownload={() => results?.blobs?.[i] && downloadBlob(results.blobs[i], imgName(i))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {cropItem && cropBase && (
        <CropModal
          src={cropBase.toDataURL('image/png')}
          naturalWidth={cropBase.width}
          naturalHeight={cropBase.height}
          initialRect={cropItem.cropRect}
          title={`Crop · ${cropItem.file.name}`}
          onApply={(rect) => { patchItem(cropItem.id, { cropRect: rect || undefined }); setCropId(null); }}
          onClose={() => setCropId(null)}
        />
      )}
    </ToolWorkspace>
  );
};

export default ImageConvert;
