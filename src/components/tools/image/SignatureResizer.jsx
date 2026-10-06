import React, { Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react';
import FileDropzone from '../../tool/FileDropzone';
import { downloadBlob } from '../../tool/DownloadButton';
import { ToolBackContext } from '../../ToolWrapper';
import { formatBytes } from '../../../lib/format';
import { loadImageFromFile, encodeToTargetBytes } from '../../../lib/imageResize';
import { encodeForForm, prepareInk } from '../../../lib/formPrep';
import { FORM_SPECS, specLine } from '../../../data/formSpecs';

const CropDialog = React.lazy(() => import('../../tool/CropDialog'));

/**
 * Signature (and thumb impression) resizer for online forms: photograph or
 * scan the signature, and it trims the empty paper, turns the paper pure
 * white, fits it into the form's pixel size and lands the file inside the
 * form's KB window. Runs in the browser — nothing is uploaded.
 */

// What the output is for. Exam targets come from the shared spec list.
const TARGETS = [
  ...FORM_SPECS
    .filter((s) => !['passport', 'custom'].includes(s.key))
    .map((s) => ({ key: s.key, label: s.short, spec: s.sign, note: s.note })),
  {
    key: 'thumb', label: 'Thumb impression', kind: 'thumb',
    spec: FORM_SPECS.find((s) => s.key === 'ibps').thumb,
    note: 'Left thumb impression in the IBPS / SBI format: 240 × 240 px, 20–50 KB. Press your thumb on a blue or black ink pad, then on white paper.',
  },
  { key: 'kb', label: 'Only a KB limit' },
  { key: 'custom', label: 'Custom size' },
];

const KB_CHOICES = [10, 20, 50, 100];

const chip = (active) => `rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
  active
    ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'
    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-purple-300'
}`;

const numField = (label, value, onChange) => (
  <label className="block text-xs">
    <span className="block mb-1 text-gray-500 dark:text-gray-400">{label}</span>
    <input
      type="number"
      min="1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-1.5"
    />
  </label>
);

/** Encode with only an upper KB limit, keeping the trimmed signature's shape. */
async function encodeUnderKB(src, kb) {
  const sw = src.naturalWidth || src.width;
  const sh = src.naturalHeight || src.height;
  // A signature never needs more than ~600 px across for a form.
  const k = Math.min(1, 600 / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  const r = await encodeToTargetBytes(src, {
    width: w, height: h, format: 'jpeg', targetBytes: kb * 1000, allowResize: true,
  });
  return { blob: r.blob, size: r.blob.size, w: r.width, h: r.height, ok: r.fits, small: false, padded: false };
}

const SignatureResizer = ({ presetKey = 'ssc', heading, intro } = {}) => {
  const [target, setTarget] = useState(presetKey);
  useEffect(() => { setTarget(presetKey); }, [presetKey]);
  const [custom, setCustom] = useState({ w: 140, h: 60, min: 10, max: 20 });
  const [kbLimit, setKbLimit] = useState(20);
  const [trim, setTrim] = useState(true);
  const [clean, setClean] = useState(true);

  const [src, setSrc] = useState(null); // { file, img, url }
  const [out, setOut] = useState(null); // { blob, url, size, w, h, ok, small, padded }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const fileInput = useRef(null);
  const registerBack = useContext(ToolBackContext);

  const t = TARGETS.find((x) => x.key === target) || TARGETS[0];
  const spec = target === 'custom' ? custom : t.spec;

  const reset = useCallback(() => {
    setSrc((s) => { if (s?.url) URL.revokeObjectURL(s.url); return null; });
    setOut((o) => { if (o?.url) URL.revokeObjectURL(o.url); return null; });
    setError(null);
  }, []);

  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(src ? reset : null);
    return () => registerBack(null);
  }, [src, reset, registerBack]);

  const pick = async (file) => {
    if (!file) return;
    try {
      const img = await loadImageFromFile(file);
      setSrc((s) => { if (s?.url) URL.revokeObjectURL(s.url); return { file, img, url: URL.createObjectURL(file) }; });
      setError(null);
    } catch (e) {
      setError(e.message || 'That image could not be read.');
    }
  };

  const applyCrop = async (blob) => {
    setCropOpen(false);
    try {
      const img = await loadImageFromFile(blob);
      const file = new File([blob], 'signature-cropped.png', { type: 'image/png' });
      setSrc((s) => { if (s?.url) URL.revokeObjectURL(s.url); return { file, img, url: URL.createObjectURL(file) }; });
    } catch (e) {
      setError(e.message || 'Could not apply the crop.');
    }
  };

  // Re-render the result whenever the image or any setting changes.
  const runTok = useRef(0);
  useEffect(() => {
    if (!src) return undefined;
    const tok = ++runTok.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const prepared = (trim || clean)
          ? prepareInk(src.img, { trim, clean, keepSolid: t.kind === 'thumb' }).canvas
          : src.img;
        const r = target === 'kb'
          ? await encodeUnderKB(prepared, Math.max(1, Number(kbLimit) || 20))
          : await encodeForForm(prepared, {
            w: Math.max(1, Math.round(spec.w)),
            h: Math.max(1, Math.round(spec.h)),
            min: Math.max(0, Number(spec.min) || 0),
            max: Math.max(1, Number(spec.max) || 1),
          }, { fit: 'contain' });
        if (tok !== runTok.current) return;
        setOut((o) => {
          if (o?.url) URL.revokeObjectURL(o.url);
          return { ...r, url: URL.createObjectURL(r.blob) };
        });
      } catch (e) {
        if (tok === runTok.current) setError(e.message || 'Could not process the image.');
      } finally {
        if (tok === runTok.current) setBusy(false);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [src, target, custom, kbLimit, trim, clean]); // eslint-disable-line react-hooks/exhaustive-deps

  // free the last result's object URL when the tool unmounts
  const outUrl = useRef(null);
  useEffect(() => { outUrl.current = out?.url || null; }, [out]);
  useEffect(() => () => { if (outUrl.current) URL.revokeObjectURL(outUrl.current); }, []);

  const kind = t.kind === 'thumb' ? 'thumb-impression' : 'signature';
  const dlName = `${kind}-${target}-${out?.w || ''}x${out?.h || ''}.jpg`;

  const status = !out ? null : !out.ok
    ? ['bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', 'Over the limit']
    : out.small
      ? ['bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', 'Below the minimum']
      : ['bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', 'Ready to upload'];

  return (
    <div className="mx-auto max-w-5xl">
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />

      <header className="mb-4">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {heading || 'Signature Resizer'}
        </h1>
        <p className="mt-1 text-[13px] md:text-sm text-gray-500 dark:text-gray-400">
          {intro || 'Photograph or scan your signature — it trims the empty paper, makes the background pure white and resizes it to the exact pixels and KB your form needs. Nothing is uploaded.'}
        </p>
      </header>

      {/* what is it for */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Resize for</p>
        <div className="flex flex-wrap gap-2">
          {TARGETS.map((x) => (
            <button key={x.key} type="button" onClick={() => setTarget(x.key)} className={chip(target === x.key)}>
              {x.label}
            </button>
          ))}
        </div>

        {target === 'custom' && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-md">
            {numField('Width px', custom.w, (v) => setCustom((c) => ({ ...c, w: +v || 1 })))}
            {numField('Height px', custom.h, (v) => setCustom((c) => ({ ...c, h: +v || 1 })))}
            {numField('Min KB', custom.min, (v) => setCustom((c) => ({ ...c, min: +v || 0 })))}
            {numField('Max KB', custom.max, (v) => setCustom((c) => ({ ...c, max: +v || 1 })))}
          </div>
        )}
        {target === 'kb' && (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            {KB_CHOICES.map((kb) => (
              <button key={kb} type="button" onClick={() => setKbLimit(kb)} className={chip(Number(kbLimit) === kb)}>
                Under {kb} KB
              </button>
            ))}
            <div className="w-28">{numField('Other (KB)', kbLimit, (v) => setKbLimit(v))}</div>
          </div>
        )}
        {spec && target !== 'kb' && target !== 'custom' && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Output: <strong className="text-gray-700 dark:text-gray-200">{specLine(spec)}</strong>
            {t.note && <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">{t.note}</span>}
          </p>
        )}
        {target !== 'kb' && (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
            Always confirm the numbers against the official notification — portals change them.
          </p>
        )}
      </div>

      {!src ? (
        <div className="mt-4">
          <FileDropzone
            accept="image/*"
            onFiles={(fs) => pick(fs[0])}
            title={t.kind === 'thumb' ? 'Drop a photo of your thumb impression' : 'Drop a photo or scan of your signature'}
            hint="JPG, PNG or WebP — or click to browse"
          />
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Tip: sign with a black or blue pen on plain white paper and photograph it from straight above in good light.
            The empty paper and shadows are cleaned up automatically.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {/* source + options */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Your image</h2>
              <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-red-500">Remove</button>
            </div>
            <div className="mt-3 h-40 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-900 overflow-hidden">
              <img src={src.url} alt="Original upload" className="max-h-full max-w-full object-contain" />
            </div>
            <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
              {src.file.name} · {src.img.naturalWidth}×{src.img.naturalHeight}px · {formatBytes(src.file.size)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <button type="button" onClick={() => setCropOpen(true)} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-2.5 py-1 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                Crop
              </button>
              <button type="button" onClick={() => fileInput.current?.click()} className="rounded-lg px-2.5 py-1 font-medium text-purple-600 dark:text-purple-400 hover:underline">
                Change image
              </button>
            </div>
            <div className="mt-4 space-y-2.5 border-t border-gray-200 dark:border-gray-700 pt-3">
              <label className="flex items-start gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} className="mt-0.5 accent-purple-600" />
                <span>Trim the empty paper<span className="block font-normal text-[11px] text-gray-400 dark:text-gray-500">So the ink fills the box instead of looking tiny.</span></span>
              </label>
              <label className="flex items-start gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} className="mt-0.5 accent-purple-600" />
                <span>Pure white background<span className="block font-normal text-[11px] text-gray-400 dark:text-gray-500">Removes shadows and grey paper; ink keeps its colour.</span></span>
              </label>
            </div>
          </div>

          {/* result */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Result</h2>
              {busy ? (
                <span className="text-[11px] text-gray-400">Updating…</span>
              ) : status && (
                <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${status[0]}`}>{status[1]}</span>
              )}
            </div>
            <div className="mt-3 min-h-40 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-900 p-4">
              {out ? (
                <img
                  src={out.url}
                  alt="Resized result"
                  className="max-w-full shadow ring-1 ring-gray-200 dark:ring-gray-700"
                  style={{ width: Math.min(out.w * 2, 520), imageRendering: 'auto' }}
                />
              ) : (
                <span className="text-xs text-gray-400">Preparing…</span>
              )}
            </div>
            {out && (
              <>
                <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">
                  <strong>{out.w}×{out.h}px</strong> · <strong>{(out.size / 1024).toFixed(1)} KB</strong> · JPG
                </p>
                {target !== 'kb' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Needs {specLine(spec)}</p>
                )}
                {out.padded && (
                  <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                    Topped up to the minimum file size — the picture itself is unchanged.
                  </p>
                )}
                {!out.ok && (
                  <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                    Couldn&apos;t get under the limit at this pixel size — keep &ldquo;Pure white background&rdquo; on, or crop tighter.
                  </p>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => downloadBlob(out.blob, dlName)}
                  className="mt-3 w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50"
                >
                  Download JPG
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {cropOpen && src && (
        <Suspense fallback={null}>
          <CropDialog src={src.url} onApply={applyCrop} onClose={() => setCropOpen(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default SignatureResizer;
