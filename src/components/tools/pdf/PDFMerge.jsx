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
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ToolWorkspace from '../../tool/ToolWorkspace';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes } from '../../../lib/format';
import { openPdf, renderThumbnail } from '../../../lib/pdfjs';

let uid = 0;
const isPdf = (f) => f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf');
const isImg = (f) => f.type === 'image/jpeg' || f.type === 'image/png'
  || /\.(jpe?g|png)$/i.test(f.name || '');
const A4P = [595.28, 841.89];
const A4L = [841.89, 595.28];

const DragDots = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
);

const FileRow = ({ item, index, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border bg-white dark:bg-gray-800 p-2.5 ${
        isDragging ? 'border-purple-400 shadow-lg' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 touch-none"
        aria-label="Drag to reorder"
      >
        <DragDots />
      </button>

      <span className="shrink-0 w-5 text-center text-xs font-semibold text-gray-400">{index + 1}</span>

      <div className="shrink-0 h-14 w-11 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900 ring-1 ring-black/5 grid place-items-center">
        {item.thumb ? (
          <img src={item.thumb} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="h-4 w-4 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {formatBytes(item.size)}
          {item.kind === 'pdf' && ` · ${item.pages} page${item.pages === 1 ? '' : 's'}`}
          {item.kind === 'img' && ' · image'}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 h-7 w-7 grid place-items-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        aria-label="Remove"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
};

const PDFMerge = () => {
  const [items, setItems] = useState([]); // {id,file,name,size,kind,pages,thumb}
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {blob,size,pages}
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
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
      const t = await renderThumbnail(pdf, 1, 160);
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
          Drag the rows to set the order. PDFs keep all their pages; each image becomes one A4 page.
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
          <p className="text-xs text-gray-400 dark:text-gray-500">Drag rows to reorder.</p>
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
        <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <FileRow key={it.id} item={it} index={i} onRemove={removeItem} />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay>
          {activeItem ? (
            <div className="flex items-center gap-3 rounded-xl border-2 border-purple-400 bg-white dark:bg-gray-800 p-2.5 shadow-2xl">
              <DragDots className="h-4 w-4 text-gray-300" />
              <div className="h-14 w-11 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900 grid place-items-center">
                {activeItem.thumb && <img src={activeItem.thumb} alt="" className="h-full w-full object-contain" />}
              </div>
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white max-w-[12rem]">{activeItem.name}</p>
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
    </ToolWorkspace>
  );
};

export default PDFMerge;
