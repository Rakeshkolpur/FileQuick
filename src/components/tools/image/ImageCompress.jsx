import React, { useCallback, useEffect, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { zipFiles } from '../../../lib/zip';
import {
  loadImageFromFile,
  encodeImage,
  encodeToTargetBytes,
  outExt,
  webpSupported,
} from '../../../lib/imageResize';

let uid = 0;
const isImage = (f) => f && f.type.startsWith('image/');

// What a source file compresses to. PNG is lossless — quality can't shrink it,
// so we move it to WebP (or JPG where WebP is unsupported).
const targetFormat = (type) => {
  if (type === 'image/png') return webpSupported() ? 'webp' : 'jpeg';
  if (type === 'image/webp') return 'webp';
  return 'jpeg';
};

const ImageCompress = () => {
  const [items, setItems] = useState([]); // {id,file,img,w,h}
  const [mode, setMode] = useState('quality'); // 'quality' | 'target'
  const [quality, setQuality] = useState(70);
  const [targetVal, setTargetVal] = useState('');
  const [targetUnit, setTargetUnit] = useState('KB');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null); // [{name, blob, size, from}]
  const [error, setError] = useState(null);
  const addRef = useRef(null);
  const loadTok = useRef(0);
  const itemsRef = useRef(items);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { setResults(null); }, [items, mode, quality, targetVal, targetUnit]);

  const loadItem = useCallback(async (entry, tok) => {
    try {
      const img = await loadImageFromFile(entry.file);
      if (tok !== loadTok.current) return;
      const preview = URL.createObjectURL(entry.file);
      setItems((p) => p.map((it) => (it.id === entry.id
        ? { ...it, img, preview, w: img.naturalWidth, h: img.naturalHeight } : it)));
    } catch (e) {
      setItems((p) => p.map((it) => (it.id === entry.id ? { ...it, error: e.message } : it)));
    }
  }, []);

  const addFiles = useCallback(async (list) => {
    const imgs = [...list].filter(isImage);
    if (!imgs.length) { setError('Choose JPG, PNG or WebP images.'); return; }
    setError(null);
    setLoading(true);
    const tok = ++loadTok.current;
    const fresh = imgs.map((file) => ({ id: ++uid, file, img: null, w: 0, h: 0 }));
    setItems((p) => [...p, ...fresh]);
    await Promise.all(fresh.map((e) => loadItem(e, tok)));
    setLoading(false);
  }, [loadItem]);

  useEffect(() => () => { itemsRef.current.forEach((it) => it.preview && URL.revokeObjectURL(it.preview)); }, []);

  const removeItem = (id) => setItems((p) => {
    const gone = p.find((it) => it.id === id);
    if (gone?.preview) URL.revokeObjectURL(gone.preview);
    return p.filter((it) => it.id !== id);
  });
  const reset = () => {
    loadTok.current += 1;
    itemsRef.current.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
    setItems([]); setResults(null); setError(null);
  };
  const backFromResult = () => setResults(null);

  const ready = items.length > 0 && items.every((it) => it.img) && !busy
    && (mode === 'quality' || parseFloat(targetVal) > 0);

  const compressOne = async (it) => {
    const fmt = targetFormat(it.file.type);
    const name = `${stripExt(it.file.name)}-min.${outExt(fmt)}`;
    if (mode === 'target') {
      const bytes = (targetUnit === 'MB' ? parseFloat(targetVal) * 1024 : parseFloat(targetVal)) * 1024;
      const r = await encodeToTargetBytes(it.img, {
        width: it.w, height: it.h, format: 'auto', targetBytes: bytes, allowResize: false,
      });
      return { name: `${stripExt(it.file.name)}-min.${outExt(r.format)}`, blob: r.blob, size: r.blob.size, from: it.file.size, fits: r.fits };
    }
    const blob = await encodeImage(it.img, {
      width: it.w, height: it.h, format: fmt, quality: quality / 100,
    });
    return { name, blob, size: blob.size, from: it.file.size, fits: true };
  };

  const run = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: items.length });
    try {
      const out = [];
      for (let i = 0; i < items.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        out.push(await compressOne(items[i]));
        setProgress({ done: i + 1, total: items.length });
      }
      setResults(out);
    } catch (e) {
      setError(e.message || 'Compression failed.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const totalFrom = items.reduce((s, it) => s + it.file.size, 0);
  const totalTo = results ? results.reduce((s, r) => s + r.size, 0) : 0;
  const saved = totalFrom && totalTo ? Math.max(0, Math.round((1 - totalTo / totalFrom) * 100)) : 0;
  const single = items.length === 1;

  const downloadAll = async () => {
    if (!results) return;
    if (results.length === 1) { downloadBlob(results[0].blob, results[0].name); return; }
    const zip = await zipFiles(results.map((r) => ({ name: r.name, blob: r.blob })));
    downloadBlob(zip, 'compressed-images.zip');
  };

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
        <p className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(totalFrom)} total</p>
      </section>

      <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Compress by</h3>
        <Segmented
          options={[{ value: 'quality', label: 'Quality' }, { value: 'target', label: 'Target size' }]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'quality' ? (
          <>
            <RangeSlider label="Quality" value={quality} min={20} max={95} step={5} onChange={setQuality} suffix="%" />
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Lower = smaller file. 60–75% is usually indistinguishable from the original. Dimensions stay the same.
            </p>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={targetVal}
                onChange={(e) => setTargetVal(e.target.value)}
                placeholder="e.g. 200"
                className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <select
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="KB">KB</option>
                <option value="MB">MB</option>
              </select>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Quality is lowered until each image fits. Dimensions are kept — use Resize Image if you also want fewer pixels.
            </p>
          </>
        )}
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <button type="button" onClick={() => addRef.current?.click()} className="w-full text-xs font-medium py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
          + Add more images
        </button>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          PNGs are saved as WebP (PNG can&apos;t be quality-compressed). JPG and WebP keep their format.
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
      onClick={run}
      disabled={!ready}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {busy ? 'Compressing…' : `Compress ${items.length > 1 ? `${items.length} images` : 'image'}`}
    </button>
  );

  const resultView = (busy || results) ? (
    <ResultScreen
      working={busy}
      done={!!results}
      progress={progress && progress.total ? Math.round((progress.done / progress.total) * 100) : (busy ? 0 : null)}
      workingLabel="Compressing…"
      title={saved > 0 ? `${saved}% smaller` : 'Compressed'}
      subtitle={results
        ? `${formatBytes(totalFrom)} → ${formatBytes(totalTo)}${results.length > 1 ? ` · ${results.length} files` : ''}`
        : undefined}
      fileName={results && results.length === 1 ? results[0].name : undefined}
      fileSize={results && results.length === 1 ? results[0].size : undefined}
      downloadLabel={results && results.length > 1 ? 'Download all (ZIP)' : undefined}
      onDownload={downloadAll}
      onBack={backFromResult}
      backLabel="Back to settings"
      note="Same dimensions, smaller file. Everything runs in your browser."
      extra={results && results.length > 1 ? (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
              <span className="truncate text-gray-600 dark:text-gray-300">{r.name}</span>
              <button type="button" onClick={() => downloadBlob(r.blob, r.name)} className="shrink-0 text-purple-600 dark:text-purple-400 hover:underline">
                {formatBytes(r.from)} → {formatBytes(r.size)}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    />
  ) : null;

  return (
    <ToolWorkspace
      file={items[0]?.file || null}
      accept="image/*"
      multiple
      formats="JPG · PNG · WebP — one or many"
      dropTitle="Drop images to compress"
      dropHint="or click to browse — same size, smaller file"
      onFiles={(fs) => addFiles(fs)}
      onBack={(busy || results) ? backFromResult : reset}
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
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {items.length} image{items.length === 1 ? '' : 's'} · {formatBytes(totalFrom)}
        </p>
        <button
          type="button"
          onClick={() => addRef.current?.click()}
          className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Add images
        </button>
      </div>

      {loading && items.every((it) => !it.img) ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="h-9 w-9 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
          Reading images…
        </div>
      ) : (
        <ul className={single ? '' : 'grid grid-cols-2 sm:grid-cols-3 gap-3'}>
          {items.map((it) => (
            <li key={it.id} className={`relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden ${single ? 'flex items-center gap-4 p-3' : ''}`}>
              <div className={single ? 'h-24 w-24 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 grid place-items-center' : 'aspect-square bg-gray-100 dark:bg-gray-900 grid place-items-center'}>
                {it.preview ? (
                  <img src={it.preview} alt={it.file.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="h-5 w-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
                )}
              </div>
              <div className={single ? 'min-w-0' : 'px-2 py-1.5'}>
                <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{it.file.name}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {formatBytes(it.file.size)}{it.w ? ` · ${it.w}×${it.h}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                className="absolute top-1.5 right-1.5 h-6 w-6 grid place-items-center rounded-lg bg-black/40 text-white hover:bg-black/60"
                aria-label="Remove"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ToolWorkspace>
  );
};

export default ImageCompress;
