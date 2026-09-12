import React, { Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react';
import FileDropzone from '../../tool/FileDropzone';
import { downloadBlob } from '../../tool/DownloadButton';
import OpenInTool from '../../tool/OpenInTool';
import { ToolBackContext } from '../../ToolWrapper';
import { formatBytes } from '../../../lib/format';
import { zipFiles } from '../../../lib/zip';
import { loadImageFromFile, encodeToTargetBytes } from '../../../lib/imageResize';
import { cutoutBackground, compositeOnColor } from '../../../lib/backgroundRemoval';
import MatteBrush from '../../tool/MatteBrush';

const CropDialog = React.lazy(() => import('../../tool/CropDialog'));

// Plain backgrounds accepted by most official photo specs.
const BG_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Off-white', value: '#f4f4f5' },
  { name: 'Light blue', value: '#dbeafe' },
  { name: 'Blue', value: '#2f6fb3' },
  { name: 'Grey', value: '#e5e7eb' },
];

/**
 * Photo + signature resizer for Indian exam / job application forms. Auto
 * centre-crops to the required shape, resizes to the pixel size and squeezes
 * the JPEG under the KB limit — all in the browser, nothing uploaded.
 *
 * Specs are common starting points; portals tweak them year to year, so the
 * UI always tells people to check the official notification.
 */

// { w, h } in px, { min, max } in KB
const PRESETS = [
  {
    key: 'ssc', name: 'SSC (CGL / CHSL / MTS / GD)',
    photo: { w: 200, h: 230, min: 20, max: 50 },
    sign: { w: 140, h: 60, min: 10, max: 20 },
  },
  {
    key: 'upsc', name: 'UPSC (Civil Services / NDA / CDS)',
    photo: { w: 350, h: 450, min: 20, max: 300 },
    sign: { w: 350, h: 150, min: 20, max: 300 },
  },
  {
    key: 'ibps', name: 'IBPS / SBI / Bank exams',
    photo: { w: 200, h: 230, min: 20, max: 50 },
    sign: { w: 140, h: 60, min: 10, max: 20 },
  },
  {
    key: 'rrb', name: 'RRB / Railway (NTPC / Group D / ALP)',
    photo: { w: 320, h: 240, min: 15, max: 40 },
    sign: { w: 160, h: 60, min: 10, max: 30 },
  },
  {
    key: 'nta', name: 'NTA (JEE Main / NEET / CUET)',
    photo: { w: 300, h: 400, min: 10, max: 200 },
    sign: { w: 300, h: 130, min: 4, max: 30 },
  },
  {
    key: 'passport', name: 'Passport size (3.5 × 4.5 cm, 300 DPI)',
    photo: { w: 413, h: 531, min: 20, max: 240 },
    sign: { w: 413, h: 155, min: 10, max: 60 },
  },
  {
    key: 'custom', name: 'Custom size',
    photo: { w: 200, h: 230, min: 10, max: 50 },
    sign: { w: 140, h: 60, min: 5, max: 20 },
  },
];

const specLine = (s) => `${s.w}×${s.h}px · ${s.min}–${s.max} KB · JPG`;

function centerCropRect(iw, ih, arW, arH) {
  const target = arW / arH;
  if (iw / ih > target) {
    const w = ih * target;
    return { x: (iw - w) / 2, y: 0, width: w, height: ih };
  }
  const h = iw / target;
  return { x: 0, y: (ih - h) / 2, width: iw, height: h };
}

async function fit(img, spec) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const cropRect = centerCropRect(iw, ih, spec.w, spec.h);
  const r = await encodeToTargetBytes(img, {
    cropRect,
    width: spec.w,
    height: spec.h,
    format: 'jpeg',
    targetBytes: spec.max * 1024,
    allowResize: false,
  });
  const kb = r.blob.size / 1024;
  return {
    blob: r.blob,
    size: r.blob.size,
    w: spec.w,
    h: spec.h,
    url: URL.createObjectURL(r.blob),
    // under max is what matters; flag if we couldn't even reach that
    ok: kb <= spec.max + 0.5,
    small: kb < spec.min,
  };
}

const Slot = ({ label, hint, item, previewUrl, onPick, onCrop, onClear, children }) => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
      {item && (
        <button type="button" onClick={onClear} className="text-xs text-gray-400 hover:text-red-500">
          Remove
        </button>
      )}
    </div>
    {item ? (
      <>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-24 w-24 shrink-0 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-900 overflow-hidden">
            <img src={previewUrl || item.url} alt={label} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0 text-xs text-gray-500 dark:text-gray-400">
            <p className="truncate text-gray-700 dark:text-gray-200 font-medium">{item.file.name}</p>
            <p>{item.w}×{item.h}px · {formatBytes(item.file.size)}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button type="button" onClick={onCrop} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-2 py-1 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                Crop
              </button>
              <button type="button" onClick={onPick} className="rounded-lg px-2 py-1 font-medium text-purple-600 dark:text-purple-400 hover:underline">
                Change file
              </button>
            </div>
          </div>
        </div>
        {children}
      </>
    ) : (
      <div className="mt-3">
        <FileDropzone
          accept="image/*"
          compact
          paste={false}
          title={`Add ${label.toLowerCase()}`}
          hint={hint}
          onFiles={(fs) => onPick(fs[0])}
        />
      </div>
    )}
  </div>
);

const ResultCard = ({ label, spec, res, onDownload }) => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
      <span
        className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
          !res.ok
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            : res.small
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        }`}
      >
        {!res.ok ? 'Over limit' : res.small ? 'Below min' : 'Within limits'}
      </span>
    </div>
    <div className="mt-3 flex items-center gap-3">
      <div className="h-28 w-28 shrink-0 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-900 overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700">
        <img src={res.url} alt={label} className="max-h-full max-w-full object-contain" />
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
        <p><span className="text-gray-700 dark:text-gray-200 font-medium">{res.w}×{res.h}px</span> · {(res.size / 1024).toFixed(1)} KB</p>
        <p>Needs {specLine(spec)}</p>
        <button
          type="button"
          onClick={onDownload}
          className="mt-1.5 inline-flex rounded-lg bg-purple-600 px-3 py-1.5 text-white font-medium hover:bg-purple-700"
        >
          Download
        </button>
      </div>
    </div>
  </div>
);

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

const ExamPhotoResizer = () => {
  const [presetKey, setPresetKey] = useState('ssc');
  const [custom, setCustom] = useState(PRESETS.find((p) => p.key === 'custom'));
  const [photo, setPhoto] = useState(null); // {file,img,url,w,h}
  const [sign, setSign] = useState(null);
  const [out, setOut] = useState(null); // {photo?, sign?}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cropFor, setCropFor] = useState(null); // 'photo' | 'sign'

  // photo background replacement
  const [bgOn, setBgOn] = useState(false);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [cutout, setCutout] = useState(null); // {img,url} transparent PNG of the photo
  const [bgBusy, setBgBusy] = useState(false);
  const [bgPct, setBgPct] = useState(0);
  const [bgPreview, setBgPreview] = useState(null); // data URL of photo on the chosen colour
  const [showBrush, setShowBrush] = useState(false);

  const photoInput = useRef(null);
  const signInput = useRef(null);
  const registerBack = useContext(ToolBackContext);

  const preset = presetKey === 'custom' ? custom : PRESETS.find((p) => p.key === presetKey);

  const clearOut = () => setOut((prev) => {
    if (prev?.photo?.url) URL.revokeObjectURL(prev.photo.url);
    if (prev?.sign?.url) URL.revokeObjectURL(prev.sign.url);
    return null;
  });

  // Revoke every object URL we made when the tool unmounts.
  const urls = useRef(new Set());
  const track = (u) => { if (u) urls.current.add(u); return u; };
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const dropCutout = useCallback(() => {
    setCutout((c) => { if (c?.url) URL.revokeObjectURL(c.url); return null; });
    setBgPreview((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setShowBrush(false);
  }, []);

  const handleBrushApply = (newImg, newUrl) => {
    setCutout((c) => {
      if (c?.url) URL.revokeObjectURL(c.url);
      return { img: newImg, url: track(newUrl) };
    });
    setShowBrush(false);
  };

  const reset = useCallback(() => {
    setPhoto((p) => { if (p?.url) URL.revokeObjectURL(p.url); return null; });
    setSign((s) => { if (s?.url) URL.revokeObjectURL(s.url); return null; });
    dropCutout();
    setBgOn(false);
    clearOut();
    setError(null);
  }, [dropCutout]);

  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(photo || sign ? reset : null);
    return () => registerBack(null);
  }, [photo, sign, reset, registerBack]);

  useEffect(() => clearOut(), [presetKey, custom, photo, sign, bgOn, bgColor]);

  const setImage = (which, file, img) => {
    const entry = { file, img, url: track(URL.createObjectURL(file)), w: img.naturalWidth, h: img.naturalHeight };
    if (which === 'photo') {
      setPhoto((p) => { if (p?.url) URL.revokeObjectURL(p.url); return entry; });
      dropCutout(); // a new/cropped photo invalidates the old cutout
    } else {
      setSign((s) => { if (s?.url) URL.revokeObjectURL(s.url); return entry; });
    }
  };

  const pick = (which) => async (file) => {
    if (!file) return;
    try {
      const img = await loadImageFromFile(file);
      setImage(which, file, img);
      setError(null);
    } catch (e) {
      setError(e.message || 'That image could not be read.');
    }
  };

  // Apply a crop (PNG blob from CropDialog) back onto the photo or signature.
  const applyCrop = async (blob) => {
    const which = cropFor;
    setCropFor(null);
    try {
      const img = await loadImageFromFile(blob);
      const file = new File([blob], `${which === 'photo' ? 'photo' : 'signature'}-cropped.png`, { type: 'image/png' });
      setImage(which, file, img);
    } catch (e) {
      setError(e.message || 'Could not apply the crop.');
    }
  };

  // Run @imgly background removal once for the current photo; cache the cutout.
  const ensureCutout = useCallback(async () => {
    if (!photo || cutout) return cutout;
    setBgBusy(true);
    setBgPct(0);
    try {
      const png = await cutoutBackground(photo.file, (f) => setBgPct(Math.round(f * 100)), { hq: true, refine: true });
      const img = await loadImageFromFile(png);
      const entry = { img, url: track(URL.createObjectURL(png)) };
      setCutout(entry);
      return entry;
    } finally {
      setBgBusy(false);
    }
  }, [photo, cutout]);

  const toggleBg = async () => {
    if (bgOn) { setBgOn(false); return; }
    setError(null);
    try {
      await ensureCutout();
      setBgOn(true);
    } catch (e) {
      setError(e.message || 'Background removal failed — try again or skip it.');
    }
  };

  // If the photo is swapped or cropped while "replace background" is on, redo
  // the cutout for the new image.
  useEffect(() => {
    if (!bgOn || !photo || cutout || bgBusy) return;
    ensureCutout().catch((e) => {
      setBgOn(false);
      setError(e.message || 'Background removal failed — try again or skip it.');
    });
  }, [bgOn, photo, cutout, bgBusy, ensureCutout]);

  // Keep the little photo-slot preview showing the chosen background.
  useEffect(() => {
    if (!bgOn || !cutout) { setBgPreview(null); return undefined; }
    let dead = false;
    compositeOnColor(cutout.img, bgColor).toBlob((b) => {
      if (dead || !b) return;
      setBgPreview((u) => { if (u) URL.revokeObjectURL(u); return track(URL.createObjectURL(b)); });
    }, 'image/jpeg', 0.9);
    return () => { dead = true; };
  }, [bgOn, bgColor, cutout]);

  const run = async () => {
    if (!photo) return;
    setBusy(true);
    setError(null);
    clearOut();
    try {
      const photoSrc = bgOn && cutout ? compositeOnColor(cutout.img, bgColor) : photo.img;
      const result = {};
      result.photo = await fit(photoSrc, preset.photo);
      if (sign) result.sign = await fit(sign.img, preset.sign);
      setOut(result);
    } catch (e) {
      setError(e.message || 'Could not process the images.');
    } finally {
      setBusy(false);
    }
  };

  const dlName = (kind) => `${kind}-${presetKey}.jpg`;
  const downloadBoth = async () => {
    const files = [];
    if (out.photo) files.push({ name: dlName('photo'), blob: out.photo.blob });
    if (out.sign) files.push({ name: dlName('signature'), blob: out.sign.blob });
    if (files.length === 1) { downloadBlob(files[0].blob, files[0].name); return; }
    downloadBlob(await zipFiles(files), `exam-photo-${presetKey}.zip`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => { pick('photo')(e.target.files[0]); e.target.value = ''; }} />
      <input ref={signInput} type="file" accept="image/*" className="hidden" onChange={(e) => { pick('sign')(e.target.files[0]); e.target.value = ''; }} />

      <header className="mb-4">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Exam Photo &amp; Signature Resizer
        </h1>
        <p className="mt-1 text-[13px] md:text-sm text-gray-500 dark:text-gray-400">
          Resize a photo and signature to the exact pixel size and KB limit that Indian exam and
          job-application forms ask for. Runs in your browser — nothing is uploaded.
        </p>
      </header>

      {/* preset picker */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPresetKey(p.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                presetKey === p.key
                  ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-purple-300'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {presetKey === 'custom' ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {['photo', 'sign'].map((k) => (
              <div key={k} className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3">
                <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {k === 'photo' ? 'Photo' : 'Signature'}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {numField('W px', custom[k].w, (v) => setCustom((c) => ({ ...c, [k]: { ...c[k], w: +v || 1 } })))}
                  {numField('H px', custom[k].h, (v) => setCustom((c) => ({ ...c, [k]: { ...c[k], h: +v || 1 } })))}
                  {numField('Min KB', custom[k].min, (v) => setCustom((c) => ({ ...c, [k]: { ...c[k], min: +v || 0 } })))}
                  {numField('Max KB', custom[k].max, (v) => setCustom((c) => ({ ...c, [k]: { ...c[k], max: +v || 1 } })))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Photo needs <strong className="text-gray-700 dark:text-gray-200">{specLine(preset.photo)}</strong> ·
            {' '}Signature needs <strong className="text-gray-700 dark:text-gray-200">{specLine(preset.sign)}</strong>
          </p>
        )}
        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
          Always confirm the numbers against the official notification — portals change them.
        </p>
      </div>

      {/* inputs */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Slot
          label="Photo"
          hint="a clear, front-facing photo"
          item={photo}
          previewUrl={bgOn ? bgPreview : null}
          onCrop={() => setCropFor('photo')}
          onPick={photo ? () => photoInput.current?.click() : pick('photo')}
          onClear={() => { setPhoto((p) => { if (p?.url) URL.revokeObjectURL(p.url); return null; }); dropCutout(); setBgOn(false); }}
        >
          <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={bgOn} onChange={toggleBg} disabled={bgBusy} className="accent-purple-600" />
              Remove &amp; replace the background
            </label>
            {bgBusy && (
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Cutting out the background… {bgPct}%</p>
            )}
            {bgOn && !bgBusy && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {BG_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.name}
                    onClick={() => setBgColor(c.value)}
                    className={`h-6 w-6 rounded-full border ${bgColor === c.value ? 'ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-gray-900' : 'border-gray-300 dark:border-gray-600'}`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <label className="relative h-6 w-6 overflow-hidden rounded-full border border-gray-300 dark:border-gray-600" title="Custom colour">
                  <span className="pointer-events-none absolute inset-0" style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} />
                  <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="absolute -inset-2 cursor-pointer opacity-0" />
                </label>
              </div>
            )}
            {bgOn && !bgBusy && (
              <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">White or light blue is what most official forms accept.</p>
            )}
            {bgOn && !bgBusy && cutout && (
              <button
                type="button"
                onClick={() => setShowBrush(true)}
                className="mt-2 w-full text-[11px] font-medium py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                ✏️ Touch up edges (erase / restore)
              </button>
            )}
          </div>
        </Slot>
        <Slot
          label="Signature"
          hint="sign on white paper, then photograph it"
          item={sign}
          onCrop={() => setCropFor('sign')}
          onPick={sign ? () => signInput.current?.click() : pick('sign')}
          onClear={() => setSign((s) => { if (s?.url) URL.revokeObjectURL(s.url); return null; })}
        >
          <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
            Tip: crop tight around the signature so it isn&apos;t tiny after resizing.
          </p>
        </Slot>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={!photo || busy}
        className="mt-4 w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {busy ? 'Preparing…' : 'Prepare for the form'}
      </button>

      {/* results */}
      {out && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ready to upload</h2>
            <button
              type="button"
              onClick={downloadBoth}
              className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-purple-300"
            >
              {out.sign ? 'Download both' : 'Download'}
            </button>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <ResultCard label="Photo" spec={preset.photo} res={out.photo} onDownload={() => downloadBlob(out.photo.blob, dlName('photo'))} />
            {out.sign && (
              <ResultCard label="Signature" spec={preset.sign} res={out.sign} onDownload={() => downloadBlob(out.sign.blob, dlName('signature'))} />
            )}
          </div>
          {(!out.photo.ok || (out.sign && !out.sign.ok)) && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Couldn&apos;t get under the KB limit at the required pixel size — the source image is very
              detailed. Try a plainer background or a slightly smaller custom size.
            </p>
          )}
          <div className="mt-5">
            <OpenInTool
              getImage={() => out.photo.blob}
              exclude={['exam-photo-resizer']}
              heading="Do more with the photo — send it to"
            />
          </div>
        </div>
      )}

      {cropFor && (
        <Suspense fallback={null}>
          <CropDialog
            src={cropFor === 'photo' ? photo?.url : sign?.url}
            onApply={applyCrop}
            onClose={() => setCropFor(null)}
          />
        </Suspense>
      )}

      {showBrush && cutout && photo?.img && (
        <MatteBrush original={photo.img} cutout={cutout.img} onApply={handleBrushApply} onClose={() => setShowBrush(false)} />
      )}
    </div>
  );
};

export default ExamPhotoResizer;
