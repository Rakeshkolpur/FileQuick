import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
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
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import OpenInPdfTool from '../../tool/OpenInPdfTool';
import { formatBytes } from '../../../lib/format';
import { consumePdfHandoff } from '../../../lib/pdfHandoff';
import { openPdf, renderThumbnail } from '../../../lib/pdfjs';

let uid = 0;
const isPdf = (f) => f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf');
const isImg = (f) => f.type === 'image/jpeg' || f.type === 'image/png'
  || /\.(jpe?g|png)$/i.test(f.name || '');
const A4P = [595.28, 841.89];
const A4L = [841.89, 595.28];

const stop = (e) => e.stopPropagation();

const FileTile = ({ item, index, onRemove, onPreview }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, width: 120 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative shrink-0 rounded-xl border bg-white dark:bg-gray-800 p-1.5 select-none cursor-grab active:cursor-grabbing touch-none ${
        isDragging ? 'border-purple-400 shadow-lg' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div
        onClick={() => onPreview(item)}
        onPointerDown={stop}
        role="button"
        tabIndex={0}
        className="relative block w-full aspect-[3/4] overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900 ring-1 ring-black/5 cursor-zoom-in"
        aria-label={`Preview ${item.name}`}
      >
        {item.thumb ? (
          <img src={item.thumb} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
          </div>
        )}
        <span className="absolute top-1 left-1 h-4 min-w-4 px-1 rounded bg-black/40 text-white text-[10px] font-bold flex items-center justify-center">
          {index + 1}
        </span>
      </div>

      <button
        type="button"
        onPointerDown={stop}
        onClick={() => onRemove(item.id)}
        className="absolute top-1 right-1 h-6 w-6 grid place-items-center rounded-lg bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
        aria-label="Remove"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <p className="mt-1 truncate text-[11px] font-medium text-gray-700 dark:text-gray-200" title={item.name}>{item.name}</p>
      <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">
        {formatBytes(item.size)}
        {item.kind === 'pdf' && ` · ${item.pages}p`}
      </p>
    </div>
  );
};

const PreviewModal = ({ item, onClose }) => (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    onClick={onClose}
  >
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl"
      style={{ width: 500, height: 500, maxWidth: '100%', maxHeight: '100%' }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-2 right-2 z-10 h-8 w-8 grid place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <div className="flex-1 grid place-items-center bg-gray-100 dark:bg-gray-900 p-3">
        {item.thumb ? (
          <img src={item.thumb} alt={item.name} className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="h-8 w-8 border-4 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
        )}
      </div>
      <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-white" title={item.name}>{item.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {formatBytes(item.size)}
          {item.kind === 'pdf' && ` · ${item.pages} page${item.pages === 1 ? '' : 's'}`}
          {item.kind === 'img' && ' · image'}
        </p>
      </div>
    </div>
  </div>
);

const PDFMerge = () => {
  const [items, setItems] = useState([]); // {id,file,name,size,kind,pages,thumb}
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {blob,size,pages}
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const addRef = useRef(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { setResult(null); }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const hydrate = useCallback(async (entry) => {
    try {
      if (entry.kind === 'img') {
        const url = URL.createObjectURL(entry.file);
        setItems((p) => p.map((it) => (it.id === entry.id ? { ...it, thumb: url } : it)));
        return;
      }
      const buf = await entry.file.arrayBuffer();
      const pdf = await openPdf(buf);
      const t = await renderThumbnail(pdf, 1, 480);
      setItems((p) => p.map((it) => (it.id === entry.id
        ? { ...it, pages: pdf.numPages, thumb: t.dataUrl } : it)));
      pdf.destroy?.();
    } catch (_) {
      setItems((p) => p.map((it) => (it.id === entry.id ? { ...it, thumb: null, broken: true } : it)));
    }
  }, []);

  const addFiles = useCallback(async (list) => {
    const picked = [...list].filter((f) => isPdf(f) || isImg(f));
    if (!picked.length) {
      setError('Add PDF, JPG or PNG files.');
      return;
    }
    setError(null);
    setLoading(true);
    const fresh = picked.map((file) => ({
      id: ++uid,
      file,
      name: file.name || (isPdf(file) ? 'document.pdf' : 'image'),
      size: file.size,
      kind: isPdf(file) ? 'pdf' : 'img',
      pages: 1,
      thumb: null,
    }));
    setItems((p) => [...p, ...fresh]);
    await Promise.all(fresh.map(hydrate));
    setLoading(false);
  }, [hydrate]);

  useEffect(() => consumePdfHandoff((f) => addFiles([f]), 'document'), [addFiles]);

  const removeItem = (id) => setItems((p) => p.filter((it) => it.id !== id));
  const clearAll = () => setItems([]);
  const sortByName = () => setItems((p) => [...p].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
  const reset = () => { setItems([]); setResult(null); setError(null); };
  const backFromResult = () => setResult(null);

  const onDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    setItems((p) => {
      const from = p.findIndex((x) => x.id === active.id);
      const to = p.findIndex((x) => x.id === over.id);
      return from < 0 || to < 0 ? p : arrayMove(p, from, to);
    });
  };

  const totalPages = items.reduce((n, it) => n + (it.kind === 'pdf' ? it.pages : 1), 0);

  const merge = async () => {
    if (items.length < 2) { setError('Add at least two files to merge.'); return; }
    setBusy(true);
    setError(null);
    try {
      const out = await PDFDocument.create();
      for (const it of items) {
        // eslint-disable-next-line no-await-in-loop
        const buf = await it.file.arrayBuffer();
        if (it.kind === 'pdf') {
          // eslint-disable-next-line no-await-in-loop
          const src = await PDFDocument.load(buf);
          // eslint-disable-next-line no-await-in-loop
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((pg) => out.addPage(pg));
        } else {
          // eslint-disable-next-line no-await-in-loop
          const img = it.file.type === 'image/png'
            ? await out.embedPng(buf)
            : await out.embedJpg(buf);
          const landscape = img.width > img.height;
          const page = out.addPage(landscape ? A4L : A4P);
          const margin = 50;
          const maxW = page.getWidth() - margin * 2;
          const maxH = page.getHeight() - margin * 2;
          const scale = Math.min(maxW / img.width, maxH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, { x: (page.getWidth() - w) / 2, y: (page.getHeight() - h) / 2, width: w, height: h });
        }
      }
      const bytes = await out.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      setResult({ blob, size: blob.size, pages: out.getPageCount() });
    } catch (e) {
      setError(`Could not merge these files: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const outName = 'merged.pdf';

  const btn = 'flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  const sidebar = (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {items.length} file{items.length === 1 ? '' : 's'}
          </h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Start over
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {totalPages} page{totalPages === 1 ? '' : 's'} in the merged PDF
        </p>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button type="button" onClick={() => addRef.current?.click()} className={`${btn} w-full`}>
          + Add more files
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={sortByName} className={btn} disabled={items.length < 2}>Sort A–Z</button>
          <button type="button" onClick={clearAll} className={btn} disabled={!items.length}>Clear all</button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Drag the tiles to set the order. PDFs keep all their pages; each image becomes one A4 page.
        </p>
      </section>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={merge}
      disabled={items.length < 2 || busy || loading}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {busy ? 'Merging…' : items.length < 2 ? 'Add 2+ files' : `Merge ${items.length} files`}
    </button>
  );

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      title="Files merged"
      workingLabel="Merging your files…"
      subtitle={result ? `${items.length} files · ${result.pages} pages · ${formatBytes(result.size)}` : undefined}
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to files"
      extra={result ? <OpenInPdfTool getPdf={() => result.blob} exclude={['merge-pdf']} /> : null}
    />
  ) : null;

  const activeItem = activeId != null ? items.find((it) => it.id === activeId) : null;

  return (
    <ToolWorkspace
      file={items[0]?.file || null}
      accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
      multiple
      formats="PDF · JPG · PNG — added in the order you drop them"
      dropTitle="Drop PDFs and images to merge"
      dropHint="or click to browse — combine into one PDF"
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
        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {items.length} file{items.length === 1 ? '' : 's'} · {totalPages} page{totalPages === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Drag tiles to reorder. Click one to preview.</p>
        </div>
        <button
          type="button"
          onClick={() => addRef.current?.click()}
          className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Add files
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-3">
            {items.map((it, i) => (
              <FileTile key={it.id} item={it} index={i} onRemove={removeItem} onPreview={setPreviewItem} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeItem ? (
            <div style={{ width: 120 }} className="rounded-xl border-2 border-purple-400 bg-white dark:bg-gray-800 p-1.5 shadow-2xl">
              <div className="w-full aspect-[3/4] rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900 grid place-items-center">
                {activeItem.thumb && <img src={activeItem.thumb} alt="" className="h-full w-full object-contain" />}
              </div>
              <p className="mt-1 truncate text-[11px] font-medium text-gray-900 dark:text-white">{activeItem.name}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {loading && (
        <p className="mt-3 text-xs text-gray-400 flex items-center gap-2">
          <span className="h-3 w-3 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
          Reading files…
        </p>
      )}

      {previewItem && <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}
    </ToolWorkspace>
  );
};

export default PDFMerge;
