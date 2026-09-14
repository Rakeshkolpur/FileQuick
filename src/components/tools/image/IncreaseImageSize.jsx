import React, { useCallback, useEffect, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import ResultScreen from '../../tool/ResultScreen';
import OpenInTool from '../../tool/OpenInTool';
import { downloadBlob } from '../../tool/DownloadButton';
import { formatBytes, stripExt } from '../../../lib/format';
import { loadImageFromFile, encodeAtLeastBytes } from '../../../lib/imageResize';
import { consumeHandoff } from '../../../lib/imageHandoff';

const isImage = (f) => f && f.type.startsWith('image/');

const IncreaseImageSize = () => {
  const [item, setItem] = useState(null); // {file, img, url, w, h}
  const [targetVal, setTargetVal] = useState('50');
  const [targetUnit, setTargetUnit] = useState('KB');
  const [allowEnlarge, setAllowEnlarge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {blob,size,width,height,enlarged,grain,fits}
  const [error, setError] = useState(null);

  const urls = useRef(new Set());
  const track = (u) => { if (u) urls.current.add(u); return u; };
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const load = useCallback(async (file) => {
    if (!isImage(file)) { setError('Choose a JPG, PNG or WebP image.'); return; }
    setError(null);
    setResult(null);
    try {
      const img = await loadImageFromFile(file);
      setItem((p) => { if (p?.url) URL.revokeObjectURL(p.url); return {
        file, img, url: track(URL.createObjectURL(file)), w: img.naturalWidth, h: img.naturalHeight,
      }; });
    } catch (e) {
      setError(e.message || 'That image could not be read.');
    }
  }, []);

  useEffect(() => consumeHandoff((f) => load(f), 'photo'), [load]);
  useEffect(() => { setResult(null); }, [item, targetVal, targetUnit, allowEnlarge]);

  const reset = () => {
    setItem((p) => { if (p?.url) URL.revokeObjectURL(p.url); return null; });
    setResult(null);
    setError(null);
  };
  const backFromResult = () => setResult(null);

  const targetBytes = (targetUnit === 'MB' ? parseFloat(targetVal) * 1024 : parseFloat(targetVal)) * 1024;
  const ready = !!item && parseFloat(targetVal) > 0 && !busy;

  const run = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      if (targetBytes <= item.file.size) {
        setError(`Your image is already ${formatBytes(item.file.size)}. Pick a bigger target, or use Compress Image to make it smaller.`);
        return;
      }
      const r = await encodeAtLeastBytes(item.img, { targetBytes, allowEnlarge });
      setResult(r);
    } catch (e) {
      setError(e.message || 'Could not resize the image.');
    } finally {
      setBusy(false);
    }
  };

  const outName = item ? `${stripExt(item.file.name)}-${Math.round(targetBytes / 1024)}kb.jpg` : 'image.jpg';

  const grew = result && item ? Math.round((result.size / item.file.size) * 10) / 10 : 0;
  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      progress={busy ? 0 : null}
      workingLabel="Building a bigger file…"
      title={result?.fits ? `Now ${formatBytes(result.size)}` : `Reached ${formatBytes(result?.size || 0)}`}
      subtitle={result
        ? `${item ? `${formatBytes(item.file.size)} → ` : ''}${formatBytes(result.size)}${grew ? ` (${grew}×)` : ''} · ${result.width}×${result.height}px`
        : undefined}
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => result && downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to settings"
      note={result && !result.fits
        ? 'Could not quite reach the target even at maximum size — try a smaller target or a different source image.'
        : 'The file stays on your device — nothing is uploaded.'}
      extra={result ? (
        <div className="space-y-3 text-left">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {result.enlarged && `Enlarged to ${result.width}×${result.height}px. `}
            {result.grain && 'A faint grain was added to reach the size. '}
            {!result.enlarged && !result.grain && 'Quality was raised to reach the size. '}
          </p>
          <OpenInTool
            getImage={() => result.blob}
            exclude={['increase-image-size']}
            heading="Do more with this — send it to"
          />
        </div>
      ) : null}
    />
  ) : null;

  // Dedicated editing layout: canvas card + a settings panel on the right,
  // matching Crop Image / Resize Image's editing screen. The empty dropzone
  // and the result screen still go through <ToolWorkspace> below.
  if (item && !busy && !result) {
    return (
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="min-w-0 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[16rem]">{item.file.name}</span>
            <button
              type="button"
              onClick={reset}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Choose another
            </button>
          </div>

          <div className="rounded-xl bg-gray-100 dark:bg-gray-900 grid place-items-center p-3 min-h-[280px]">
            <img src={item.url} alt={item.file.name} className="max-h-[340px] max-w-full object-contain" />
          </div>

          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {item.w}×{item.h}px · {formatBytes(item.file.size)}
          </p>

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <OpenInTool getImage={() => item.file} exclude={['increase-image-size']} heading="Or send this image to" />
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 flex flex-col overflow-hidden lg:max-h-[calc(100vh-7rem)]">
          <div className="flex-1 lg:overflow-y-auto p-4 space-y-4">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Make it at least</h3>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={targetVal}
                  onChange={(e) => setTargetVal(e.target.value)}
                  className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
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
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={allowEnlarge} onChange={(e) => setAllowEnlarge(e.target.checked)} className="accent-blue-600" />
                Allow enlarging the photo to reach the size
              </label>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                This can&apos;t add detail that isn&apos;t there. It maxes out JPEG quality, then (if allowed)
                enlarges the picture, then adds a little grain — enough to pass a form that rejects files
                for being <em>under</em> a minimum size.
              </p>
            </section>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button
              type="button"
              onClick={run}
              disabled={!ready}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {busy ? 'Working…' : 'Increase file size'}
            </button>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <ToolWorkspace
      file={item?.file || null}
      accept="image/*"
      formats="JPG · PNG · WebP"
      dropTitle="Drop an image to make its file bigger"
      dropHint="or click to browse — for forms that need a minimum KB"
      onFiles={(fs) => load(fs[0])}
      onBack={(busy || result) ? backFromResult : reset}
      result={resultView}
    />
  );
};

export default IncreaseImageSize;
