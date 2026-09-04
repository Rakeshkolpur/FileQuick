import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import FileDropzone from '../../tool/FileDropzone';
import Lightbox from '../../tool/Lightbox';
import { downloadBlob } from '../../tool/DownloadButton';
import { ToolBackContext } from '../../ToolWrapper';
import { stripExt } from '../../../lib/format';
import { cutoutBackground, preloadBackgroundModel } from '../../../lib/backgroundRemoval';
import { consumeHandoff } from '../../../lib/imageHandoff';

const DPI = 300;
const mmToPx = (mm) => Math.round((mm / 25.4) * DPI);
const IN = 25.4;

// Photo specs (country → print size in mm). Head guide follows the common rule:
// centred, ~72% of the frame height, a little more room below than above.
const SPECS = [
  { id: 'in', name: 'India · 35 × 45 mm', w: 35, h: 45 },
  { id: 'us', name: 'US / OCI visa · 51 × 51 mm (2 × 2")', w: 51, h: 51, head: 0.62, top: 0.14 },
  { id: 'sch', name: 'UK / Schengen / EU · 35 × 45 mm', w: 35, h: 45 },
  { id: 'au', name: 'Australia · 35 × 45 mm', w: 35, h: 45 },
  { id: 'ca', name: 'Canada · 50 × 70 mm', w: 50, h: 70, head: 0.55, top: 0.1 },
  { id: 'cn', name: 'China · 33 × 48 mm', w: 33, h: 48 },
  { id: 'custom', name: 'Custom size…', w: 35, h: 45 },
];

const BGS = [
  { id: 'white', label: 'White', value: '#ffffff' },
  { id: 'offwhite', label: 'Off-white', value: '#f3f2ee' },
  { id: 'grey', label: 'Light grey', value: '#dfe3e6' },
  { id: 'blue', label: 'Sky blue', value: '#c5d7ea' },
  { id: 'lightblue', label: 'Pale blue', value: '#dce9f4' },
  { id: 'red', label: 'Red', value: '#c9433a' },
];

const PAPERS = [
  { id: '4x6', name: '4 × 6 in', w: 6 * IN, h: 4 * IN },
  { id: '5x7', name: '5 × 7 in', w: 7 * IN, h: 5 * IN },
  { id: 'a4', name: 'A4', w: 210, h: 297 },
  { id: 'letter', name: 'US Letter', w: 8.5 * IN, h: 11 * IN },
];

const GAP_MM = 3;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// how many spec-sized photos fit on a paper (tries both paper orientations)
function gridFor(spec, paper) {
  const opt = (pw, ph) => {
    const cols = Math.floor((pw + GAP_MM) / (spec.w + GAP_MM));
    const rows = Math.floor((ph + GAP_MM) / (spec.h + GAP_MM));
    return { cols: Math.max(0, cols), rows: Math.max(0, rows), pw, ph };
  };
  const a = opt(paper.w, paper.h);
  const b = opt(paper.h, paper.w);
  return a.cols * a.rows >= b.cols * b.rows ? a : b;
}

const PassportPhotoMaker = () => {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [cutout, setCutout] = useState(null);
  const [cutoutUrl, setCutoutUrl] = useState(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [bgBusy, setBgBusy] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);

  const [bg, setBg] = useState('#ffffff');
  const [specIdx, setSpecIdx] = useState(0);
  const [custom, setCustom] = useState({ w: 35, h: 45 });
  const [paperIdx, setPaperIdx] = useState(0);
  const [copies, setCopies] = useState(null); // null = fill the sheet

  const [scale, setScale] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [cellUrl, setCellUrl] = useState(null); // rendered single-photo preview

  const urls = useRef([]);
  const drag = useRef(null);
  const loadTok = useRef(0);
  const registerBack = useContext(ToolBackContext);

  useEffect(() => { preloadBackgroundModel(); }, []);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const spec = useMemo(() => (
    specIdx === SPECS.length - 1
      ? { id: 'custom', name: 'Custom', w: clamp(custom.w, 20, 100), h: clamp(custom.h, 20, 100) }
      : SPECS[specIdx]
  ), [specIdx, custom.w, custom.h]);
  const paper = PAPERS[paperIdx];
  const grid = useMemo(() => gridFor(spec, paper), [spec, paper]);
  const perSheet = grid.cols * grid.rows;
  const wantCopies = copies == null ? perSheet : clamp(copies, 1, perSheet);

  const src = removeBg && cutout ? cutout : img;
  const srcUrl = removeBg && cutout ? cutoutUrl : imgUrl;

  const PREVIEW_W = 240;
  const previewH = Math.round((PREVIEW_W * spec.h) / spec.w);
  const baseScale = useMemo(
    () => (src ? Math.max(PREVIEW_W / src.naturalWidth, previewH / src.naturalHeight) : 1),
    [src, previewH],
  );
  const headTop = spec.top ?? 0.12;   // gap above the head, fraction of height
  const headH = spec.head ?? 0.72;    // head height, fraction of height

  const reset = () => {
    loadTok.current += 1;
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setFile(null); setImg(null); setImgUrl(null); setCutout(null); setCutoutUrl(null);
    setRemoveBg(true); setError(null); setCellUrl(null);
    setScale(100); setOffset({ x: 0, y: 0 });
  };

  const started = !!file;
  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(started ? reset : null);
    return () => registerBack(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerBack, started]);

  const loadFromUrl = (url) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Could not read this image.'));
    im.src = url;
  });

  const handleFile = async (f) => {
    if (!f || !f.type.startsWith('image/')) { setError('Please choose a photo (JPG, PNG, WebP).'); return; }
    const t = ++loadTok.current;
    reset();
    loadTok.current = t;
    setError(null); setFile(f);
    const url = URL.createObjectURL(f);
    urls.current.push(url);
    try {
      const im = await loadFromUrl(url);
      if (t !== loadTok.current) return;
      setImg(im); setImgUrl(url);
      runCutout(f, t);
    } catch (e) {
      if (t === loadTok.current) setError(e.message);
    }
  };
  useEffect(() => consumeHandoff((f) => handleFile(f), 'photo'), []); // eslint-disable-line react-hooks/exhaustive-deps

  const runCutout = async (f, tok) => {
    setBgBusy(true); setBgProgress(0);
    try {
      // hq model + edge refinement — matters for fine hair on a passport photo
      const png = await cutoutBackground(f, (p) => setBgProgress(p), { hq: true, refine: true });
      if (tok !== loadTok.current) return;
      const cu = await loadFromUrl(URL.createObjectURL(png));
      urls.current.push(cu.src);
      setCutout(cu); setCutoutUrl(cu.src);
    } catch {
      if (tok === loadTok.current) { setRemoveBg(false); setError('Background removal failed — using the original photo.'); }
    } finally {
      if (tok === loadTok.current) setBgBusy(false);
    }
  };

  // ---- pointer drag ----
  const onDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  };
  const onUp = () => { drag.current = null; };

  const imgStyle = src ? {
    width: src.naturalWidth * baseScale,
    height: src.naturalHeight * baseScale,
    transform: `translate(-50%,-50%) translate(${offset.x}px, ${offset.y}px) scale(${scale / 100})`,
  } : {};

  // ---- render one passport photo to a canvas ----
  const renderCell = (px) => {
    const S = px || mmToPx(spec.w);
    const H = Math.round((S * spec.h) / spec.w);
    const c = document.createElement('canvas');
    c.width = S; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = removeBg && cutout ? bg : '#ffffff';
    ctx.fillRect(0, 0, S, H);
    if (src) {
      const k = S / PREVIEW_W;
      const dw = src.naturalWidth * baseScale * (scale / 100) * k;
      const dh = src.naturalHeight * baseScale * (scale / 100) * k;
      ctx.save();
      ctx.translate(S / 2 + offset.x * k, H / 2 + offset.y * k);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
    return c;
  };

  // debounced live preview of the single cell
  useEffect(() => {
    if (!src) { setCellUrl(null); return undefined; }
    const t = setTimeout(() => {
      try { setCellUrl(renderCell(320).toDataURL('image/png')); } catch { /* ignore */ }
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, bg, removeBg, cutout, scale, offset, specIdx, custom.w, custom.h]);

  const buildSheet = () => {
    const cols = grid.cols;
    const rows = grid.rows;
    const pw = grid.pw;
    const ph = grid.ph;
    const W = mmToPx(pw);
    const H = mmToPx(ph);
    const cw = mmToPx(spec.w);
    const ch = mmToPx(spec.h);
    const gap = mmToPx(GAP_MM);
    const gridW = cols * cw + (cols - 1) * gap;
    const gridH = rows * ch + (rows - 1) * gap;
    const ox = Math.round((W - gridW) / 2);
    const oy = Math.round((H - gridH) / 2);

    const cell = renderCell(cw);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    let n = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (n >= wantCopies) break;
        const x = ox + col * (cw + gap);
        const y = oy + r * (ch + gap);
        ctx.drawImage(cell, x, y, cw, ch);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
        n += 1;
      }
    }
    return c;
  };

  const dl = async (canvas, name) => {
    setBusy(true);
    try {
      const blob = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
      downloadBlob(blob, name);
    } finally { setBusy(false); }
  };

  const base = file ? stripExt(file.name) : 'passport';
  const downloadOne = () => dl(renderCell(mmToPx(spec.w)), `${base}-${spec.w}x${spec.h}mm.png`);
  const downloadSheet = () => dl(buildSheet(), `${base}-sheet-${paper.id}-${wantCopies}up.png`);

  // ---- upload screen ----
  if (!file) {
    return (
      <div className="mx-auto max-w-2xl">
        <FileDropzone
          accept="image/*"
          onFiles={(fs) => handleFile(fs[0])}
          title="Upload your photo"
          hint="a plain head-and-shoulders selfie works — good even light, neutral face"
          formats="JPG · PNG · WebP — background swap, correct sizing and a printable sheet, in your browser"
        />
        {error && <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* left — single photo editor */}
      <div className="flex flex-col items-center">
        <div className="mb-3 flex w-full max-w-[420px] items-center justify-between gap-2 text-[13px]">
          <span className="truncate font-medium text-gray-900 dark:text-white">{file.name}</span>
          <button type="button" onClick={reset} className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300">
            Change photo
          </button>
        </div>

        <div
          className="relative overflow-hidden rounded-lg border border-gray-300 shadow-sm dark:border-gray-600"
          style={{ width: PREVIEW_W, height: previewH }}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="absolute inset-0" style={{ background: removeBg && cutout ? bg : '#ffffff' }} />
          {src && (
            <img
              src={srcUrl}
              alt=""
              draggable={false}
              onPointerDown={onDown}
              className="absolute left-1/2 top-1/2 max-w-none cursor-grab select-none touch-none active:cursor-grabbing"
              style={imgStyle}
            />
          )}
          {/* head guide */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
            <ellipse
              cx="50"
              cy={(headTop + headH / 2) * 100}
              rx={headH * 100 * 0.36}
              ry={headH * 50}
              fill="none"
              stroke="rgba(139,92,246,0.9)"
              strokeWidth="1.2"
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {bgBusy && (
            <div className="absolute inset-0 grid place-items-center bg-white/70 dark:bg-gray-900/70">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
                <p className="mt-2 text-[11px] text-gray-500">
                  {bgProgress < 0.9 ? 'Removing background…' : 'Refining hair edges…'} {Math.round(bgProgress * 100)}%
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">Drag to position · keep eyes level, head inside the oval</p>

        <div className="mt-3 w-full max-w-[320px] space-y-2">
          <label className="flex items-center gap-3 text-[12px] text-gray-500 dark:text-gray-400">
            <span className="w-10 shrink-0">Zoom</span>
            <input type="range" min={60} max={260} value={scale} onChange={(e) => setScale(+e.target.value)} className="w-full accent-purple-600" />
            {scale !== 100 && <button type="button" onClick={() => { setScale(100); setOffset({ x: 0, y: 0 }); }} className="shrink-0 text-[11px] text-gray-400 hover:text-gray-600">reset</button>}
          </label>
        </div>
      </div>

      {/* right — controls + sheet */}
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 lg:sticky lg:top-24">
        {/* background */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-400">Background</p>
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={removeBg} disabled={bgBusy || !cutout} onChange={(e) => setRemoveBg(e.target.checked)} className="accent-purple-600" />
              Remove &amp; replace
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BGS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => { setBg(b.value); setRemoveBg(true); }}
                disabled={!cutout}
                title={b.label}
                className={`h-7 w-7 rounded-lg border-2 transition-transform disabled:opacity-40 ${bg === b.value && removeBg ? 'border-purple-600 scale-110' : 'border-black/10 dark:border-white/20'}`}
                style={{ background: b.value }}
              />
            ))}
            <label className={`grid h-7 w-7 place-items-center rounded-lg border-2 border-dashed border-gray-300 text-[10px] text-gray-400 dark:border-gray-600 ${!cutout ? 'opacity-40' : 'cursor-pointer'}`}>
              +
              <input type="color" value={bg} disabled={!cutout} onChange={(e) => { setBg(e.target.value); setRemoveBg(true); }} className="sr-only" />
            </label>
          </div>
          {!cutout && !bgBusy && <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Background couldn’t be removed — the original photo is used.</p>}
        </div>

        {/* size */}
        <div>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Photo size</p>
          <select
            value={specIdx}
            onChange={(e) => setSpecIdx(+e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] dark:border-gray-700 dark:bg-gray-900"
          >
            {SPECS.map((s, i) => <option key={s.id} value={i}>{s.name}</option>)}
          </select>
          {spec.id === 'custom' && (
            <div className="mt-2 flex items-center gap-2 text-[12px] text-gray-500">
              <input type="number" min={20} max={100} value={custom.w} onChange={(e) => setCustom((c) => ({ ...c, w: +e.target.value }))} className="w-16 rounded border border-gray-200 px-2 py-1 dark:border-gray-700 dark:bg-gray-900" />
              <span>×</span>
              <input type="number" min={20} max={100} value={custom.h} onChange={(e) => setCustom((c) => ({ ...c, h: +e.target.value }))} className="w-16 rounded border border-gray-200 px-2 py-1 dark:border-gray-700 dark:bg-gray-900" />
              <span>mm</span>
            </div>
          )}
        </div>

        {/* sheet */}
        <div>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Print sheet</p>
          <div className="flex gap-1.5">
            {PAPERS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setPaperIdx(i); setCopies(null); }}
                className={`flex-1 rounded-lg border px-1.5 py-1 text-[11px] font-medium ${paperIdx === i ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] text-gray-500 dark:text-gray-400">
            <span>{grid.cols} × {grid.rows} = {perSheet} per sheet</span>
            <label className="flex items-center gap-1.5">
              Copies
              <input
                type="number"
                min={1}
                max={perSheet}
                value={wantCopies}
                onChange={(e) => setCopies(clamp(+e.target.value || 1, 1, perSheet))}
                className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-right dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
          </div>

          {/* live sheet preview */}
          <div
            className="mx-auto mt-2 grid gap-[2px] rounded border border-gray-200 bg-white p-1 shadow-inner dark:border-gray-700"
            style={{
              gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
              width: 200,
              aspectRatio: `${grid.pw} / ${grid.ph}`,
            }}
          >
            {Array.from({ length: perSheet }).map((_, i) => (
              <div key={i} className="overflow-hidden bg-gray-100 dark:bg-gray-700" style={{ aspectRatio: `${spec.w} / ${spec.h}`, opacity: i < wantCopies ? 1 : 0.15 }}>
                {cellUrl && <img src={cellUrl} alt="" className="h-full w-full object-cover" />}
              </div>
            ))}
          </div>
        </div>

        {/* downloads */}
        <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700">
          <button
            type="button"
            onClick={downloadSheet}
            disabled={busy || !src}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 disabled:opacity-50"
          >
            {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            Download sheet · {wantCopies} photos
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadOne}
              disabled={busy || !src}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-[13px] font-semibold text-gray-700 hover:border-purple-300 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
            >
              One photo
            </button>
            <button
              type="button"
              onClick={() => cellUrl && setLightbox({ src: cellUrl, caption: `${spec.w} × ${spec.h} mm · ${mmToPx(spec.w)} × ${mmToPx(spec.h)} px @ ${DPI} DPI` })}
              disabled={!cellUrl}
              className="rounded-xl border border-gray-200 px-3 py-2 text-[13px] font-semibold text-gray-700 hover:border-purple-300 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
            >
              Preview
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">{DPI} DPI · prints true to size · nothing is uploaded</p>
        </div>
        {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {lightbox && <Lightbox src={lightbox.src} caption={lightbox.caption} onClose={() => setLightbox(null)} />}
    </div>
  );
};

export default PassportPhotoMaker;
