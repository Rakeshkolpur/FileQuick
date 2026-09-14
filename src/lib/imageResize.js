const MIME = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

export const outExt = (format) => (format === 'jpeg' || format === 'jpg' ? 'jpg' : format);
export const mimeFor = (format) => MIME[format] || 'image/jpeg';
export const isLossy = (format) => mimeFor(format) !== 'image/png';

// One "download as" format list shared by every image tool that offers more
// than a plain JPG/PNG/WebP toggle (Resize Image, Remove Background, …).
// `enc` is the canvas encode format; `ext` is the file extension — kept apart
// so "JPG" and "JPEG" can be the same encoder with a different extension.
export const OUTPUT_FORMATS = [
  { value: 'jpg', label: 'JPG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'avif', label: 'AVIF' },
  { value: 'pdf', label: 'PDF' },
];
export const OUTPUT_FORMAT_MAP = {
  jpg: { enc: 'jpeg', ext: 'jpg' },
  jpeg: { enc: 'jpeg', ext: 'jpeg' },
  png: { enc: 'png', ext: 'png' },
  webp: { enc: 'webp', ext: 'webp' },
  avif: { enc: 'avif', ext: 'avif' },
  pdf: { enc: 'jpeg', ext: 'pdf' }, // a JPEG image on one PDF page
};

// The list to actually put in a <select>: drops AVIF on a browser that
// can't really encode it (Canvas silently falls back to PNG instead of
// erroring), so nothing in the UI produces a mislabeled file. Pass a
// tool's own format list to filter that instead of the shared one above.
export const availableOutputFormats = (formats = OUTPUT_FORMATS) =>
  formats.filter((f) => f.value !== 'avif' || avifSupported());

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be read. Try a JPG, PNG or WebP file.'));
    };
    img.src = url;
  });
}

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This image could not be loaded.'));
    img.src = url;
  });
}

/** Rotate a loaded image to a canvas (deg = 0/90/180/270). Returns a canvas usable as an encode source. */
export function rotateToCanvas(img, deg) {
  const d = (((deg || 0) % 360) + 360) % 360;
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  if (d === 0) {
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas;
  }
  const swap = d === 90 || d === 270;
  canvas.width = swap ? sh : sw;
  canvas.height = swap ? sw : sh;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((d * Math.PI) / 180);
  ctx.drawImage(img, -sw / 2, -sh / 2);
  return canvas;
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The browser could not export this image.'))),
      mime,
      quality,
    );
  });
}

/**
 * Crop (source px, optional) -> resize (progressive halving for big downscales).
 */
function renderCanvas(img, { cropRect, width, height, highQuality = true }) {
  const sx = cropRect ? cropRect.x : 0;
  const sy = cropRect ? cropRect.y : 0;
  const sw = cropRect ? cropRect.width : img.naturalWidth || img.width;
  const sh = cropRect ? cropRect.height : img.naturalHeight || img.height;

  let canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const targetW = Math.max(1, Math.round(width));
  const targetH = Math.max(1, Math.round(height));

  if (highQuality) {
    while (canvas.width > targetW * 2 && canvas.height > targetH * 2) {
      const next = document.createElement('canvas');
      next.width = Math.max(targetW, Math.floor(canvas.width / 2));
      next.height = Math.max(targetH, Math.floor(canvas.height / 2));
      const ctx = next.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, next.width, next.height);
      canvas = next;
    }
  }

  if (canvas.width === targetW && canvas.height === targetH) return canvas;

  const out = document.createElement('canvas');
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, targetW, targetH);
  return out;
}

/** @returns {Promise<Blob>} */
export async function encodeImage(img, {
  cropRect,
  width,
  height,
  format = 'jpeg',
  quality = 0.9,
  highQuality = true,
  background = '#ffffff',
}) {
  const mime = mimeFor(format);
  const canvas = renderCanvas(img, { cropRect, width, height, highQuality });

  if (mime === 'image/jpeg') {
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    return canvasToBlob(flat, mime, quality);
  }
  return canvasToBlob(canvas, mime, mime === 'image/png' ? undefined : quality);
}

// Back-compat alias
export const resizeImage = (img, opts) => encodeImage(img, opts);

/** Draw `img` at w×h onto a white JPEG, optionally with ± `grain` luma noise. */
async function encodeJpegGrainy(img, w, h, quality, grain = 0) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  if (grain > 0) {
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 2 * grain;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(id, 0, 0);
  }
  const blob = await canvasToBlob(c, 'image/jpeg', quality);
  return { blob, size: blob.size };
}

/**
 * Encode a JPEG that is AT OR ABOVE `targetBytes` — for forms that reject a
 * file for being *under* a minimum size. It cannot add real detail: it maxes
 * out quality, then (opt-in) enlarges the picture, then adds fine grain as a
 * last resort.
 *
 * @returns {Promise<{ blob, size, width, height, enlarged, grain, fits }>}
 */
export async function encodeAtLeastBytes(img, { targetBytes, allowEnlarge = true, maxEdge = 4000 }) {
  const W0 = img.naturalWidth || img.width;
  const H0 = img.naturalHeight || img.height;
  const mk = (w, h, enlarged, grain) => (r) => ({ ...r, width: w, height: h, enlarged, grain, fits: r.size >= targetBytes });

  // 1) native size, tune quality up to just clear the target
  const top = await encodeJpegGrainy(img, W0, H0, 0.985);
  if (top.size >= targetBytes) {
    let lo = 0.5;
    let hi = 0.985;
    let pick = top;
    for (let i = 0; i < 12; i += 1) {
      const q = (lo + hi) / 2;
      // eslint-disable-next-line no-await-in-loop
      const b = await encodeJpegGrainy(img, W0, H0, q);
      if (b.size >= targetBytes) { pick = b; hi = q; } else { lo = q; }
    }
    return mk(W0, H0, false, false)(pick);
  }

  // 2) enlarge in 1.25× steps at high quality until it clears the target,
  //    then trim the quality back down so we land just above it, not far over.
  let biggest = { ...top, width: W0, height: H0 };
  if (allowEnlarge) {
    let scale = 1;
    for (let i = 0; i < 9; i += 1) {
      scale *= 1.25;
      const w = Math.round(W0 * scale);
      const h = Math.round(H0 * scale);
      if (Math.max(w, h) > maxEdge) break;
      // eslint-disable-next-line no-await-in-loop
      const b = await encodeJpegGrainy(img, w, h, 0.95);
      biggest = { ...b, width: w, height: h };
      if (b.size >= targetBytes) {
        let lo = 0.35;
        let hi = 0.95;
        let pick = b;
        for (let k = 0; k < 12; k += 1) {
          const q = (lo + hi) / 2;
          // eslint-disable-next-line no-await-in-loop
          const t = await encodeJpegGrainy(img, w, h, q);
          if (t.size >= targetBytes) { pick = t; hi = q; } else { lo = q; }
        }
        return mk(w, h, true, false)(pick);
      }
    }
  }

  // 3) grain on the largest render we have
  const { width: gw, height: gh } = biggest;
  let pick = biggest;
  for (const amt of [4, 8, 14, 22, 32, 48]) {
    // eslint-disable-next-line no-await-in-loop
    const b = await encodeJpegGrainy(img, gw, gh, 0.95, amt);
    pick = { ...b, appliedGrain: amt };
    if (b.size >= targetBytes) break;
  }
  return mk(gw, gh, gw !== W0, true)(pick);
}

// Lowest quality we'll push to at full resolution before we'd rather shrink the
// picture instead — a downscaled image at decent quality beats a full-size one
// at quality 0.3.
const Q_FLOOR = 0.4;
// Quality we hold while searching for the right dimensions on a small target.
const Q_ANCHOR = 0.74;
// Bounds for the final quality fine-tune once the dimensions are locked in.
const Q_TUNE_LO = 0.5;
const Q_TUNE_HI = 0.95;

let _webpOk = null;
export function webpSupported() {
  if (_webpOk === null) {
    try {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      _webpOk = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch (_) {
      _webpOk = false;
    }
  }
  return _webpOk;
}

// AVIF encoding isn't in every browser yet (Canvas silently falls back to
// PNG when it isn't — no error, just the wrong file), so feature-detect it
// the same way as WebP above rather than offering a format that quietly
// produces something else.
let _avifOk = null;
export function avifSupported() {
  if (_avifOk === null) {
    try {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      _avifOk = c.toDataURL('image/avif').startsWith('data:image/avif');
    } catch (_) {
      _avifOk = false;
    }
  }
  return _avifOk;
}

/**
 * Per-format target-size search (lossy). Extracted so `auto` can race formats.
 *
 * Two knobs: JPEG/WebP quality and pixel dimensions. We spend the quality knob
 * first at full resolution; if the target is too small to reach that way and
 * `allowResize` is on, we hold quality at a clean value and search the
 * dimensions for the LARGEST picture that still fits, then fine-tune quality so
 * the file lands just under the target rather than far below it.
 */
async function targetOneFormat(img, {
  cropRect,
  W0,
  H0,
  format,
  targetBytes,
  highQuality = true,
  allowResize = false,
  tolerance = 0.015,
}) {
  const render = (w, h, q) => encodeImage(img, { cropRect, width: w, height: h, format, quality: q, highQuality });
  // "Close enough" — stop once we're within this many bytes under the target.
  const band = Math.max(400, Math.round(targetBytes * tolerance));
  const dims = (s) => [Math.max(16, Math.round(W0 * s)), Math.max(16, Math.round(H0 * s))];

  // 1) full resolution — binary-search quality down to Q_FLOOR, keep the
  //    largest blob that's still at or under the target.
  let lo = Q_FLOOR;
  let hi = 0.985;
  let best = null;
  for (let i = 0; i < 15; i += 1) {
    const q = (lo + hi) / 2;
    // eslint-disable-next-line no-await-in-loop
    const blob = await render(W0, H0, q);
    if (blob.size <= targetBytes) {
      if (!best || blob.size > best.blob.size) best = { blob, width: W0, height: H0, quality: q };
      lo = q;
    } else {
      hi = q;
    }
    if (best && targetBytes - best.blob.size <= band) break;
    if (hi - lo < 0.0025) break;
  }
  if (best) return { ...best, format, fits: true, resized: false };

  // 2) quality alone can't get there.
  if (!allowResize) {
    const floorBlob = await render(W0, H0, Q_FLOOR);
    return { blob: floorBlob, width: W0, height: H0, quality: Q_FLOOR, format, fits: false, resized: false };
  }

  // 3) hold quality at Q_ANCHOR, bracket the scale factor and home in on the
  //    biggest picture that fits. JPEG bytes track pixel count roughly
  //    linearly, so sqrt(size ratio) is a good first guess.
  const ref = await render(W0, H0, Q_ANCHOR);
  let sHi = 1;        // full size — known too big
  let sLo = 0;        // vanishingly small — always fits
  let s = Math.min(0.95, Math.sqrt(targetBytes / ref.size));
  let fit = null;
  for (let i = 0; i < 11; i += 1) {
    const [w, h] = dims(s);
    // eslint-disable-next-line no-await-in-loop
    const b = await render(w, h, Q_ANCHOR);
    if (b.size <= targetBytes) {
      fit = { blob: b, width: w, height: h, quality: Q_ANCHOR };
      sLo = s;
      if (targetBytes - b.size <= band) break;
      s = (s + sHi) / 2; // there's headroom — try a bigger picture
    } else {
      sHi = s;
      s = sLo > 0 ? (sLo + s) / 2 : Math.max(0.04, s * Math.sqrt(targetBytes / b.size) * 0.96);
    }
    if (fit && sHi - sLo < 0.015) break;
  }

  if (!fit) {
    const [w, h] = dims(Math.max(0.04, (sHi || s) * 0.7));
    const b = await render(w, h, Q_TUNE_LO);
    return { blob: b, width: w, height: h, quality: Q_TUNE_LO, format, fits: b.size <= targetBytes, resized: true };
  }

  // 4) dimensions are locked — fine-tune quality to sit just under the target.
  let qlo = Q_TUNE_LO;
  let qhi = Q_TUNE_HI;
  let tuned = fit;
  for (let i = 0; i < 8; i += 1) {
    const q = (qlo + qhi) / 2;
    // eslint-disable-next-line no-await-in-loop
    const b = await render(fit.width, fit.height, q);
    if (b.size <= targetBytes) {
      if (b.size > tuned.blob.size) tuned = { blob: b, width: fit.width, height: fit.height, quality: q };
      qlo = q;
    } else {
      qhi = q;
    }
    if (targetBytes - tuned.blob.size <= band) break;
  }
  return { ...tuned, format, fits: true, resized: tuned.width !== W0 };
}

/**
 * Encode as close as possible to (but not above) a target byte size.
 *
 * Default: tune quality only and KEEP the resolution (quality floor Q_FLOOR).
 * If the target can't be met that way, the best full-res attempt is returned
 * with `fits: false`.
 *
 * `allowResize: true`: when quality alone can't reach the target, scale the
 * picture down (holding quality near Q_ANCHOR) to the largest size that fits.
 *
 * `format: 'auto'`: encode to the target as both WebP and JPEG and return
 * whichever keeps the most quality/resolution at the requested size.
 *
 * PNG: fits by resolution only, and only when `allowResize` is on.
 *
 * @returns {Promise<{ blob, width, height, quality?, format, fits, resized }>}
 */
export async function encodeToTargetBytes(img, {
  cropRect,
  width,
  height,
  format = 'jpeg',
  targetBytes,
  highQuality = true,
  allowResize = false,
}) {
  const W0 = Math.max(1, Math.round(width));
  const H0 = Math.max(1, Math.round(height));

  if (mimeFor(format) === 'image/png') {
    const render = (w, h) => encodeImage(img, { cropRect, width: w, height: h, format: 'png', highQuality });
    let blob = await render(W0, H0);
    if (blob.size <= targetBytes || !allowResize) {
      return { blob, width: W0, height: H0, format: 'png', fits: blob.size <= targetBytes, resized: false };
    }
    let w = W0;
    let h = H0;
    let guard = 0;
    while (blob.size > targetBytes && guard < 22) {
      const scale = Math.max(0.08, Math.sqrt(targetBytes / blob.size) * 0.94);
      w = Math.max(16, Math.round(w * scale));
      h = Math.max(16, Math.round(h * scale));
      // eslint-disable-next-line no-await-in-loop
      blob = await render(w, h);
      guard += 1;
    }
    return { blob, width: w, height: h, format: 'png', fits: blob.size <= targetBytes, resized: w !== W0 };
  }

  const base = { cropRect, W0, H0, targetBytes, highQuality, allowResize };

  if (format === 'auto') {
    const formats = webpSupported() ? ['webp', 'jpeg'] : ['jpeg'];
    const results = await Promise.all(formats.map((f) => targetOneFormat(img, { ...base, format: f })));
    results.sort((a, b) => {
      if (a.fits !== b.fits) return a.fits ? -1 : 1;
      if (a.fits) {
        if (a.resized !== b.resized) return a.resized ? 1 : -1;
        const pxDiff = b.width * b.height - a.width * a.height;
        if (pxDiff) return pxDiff;
        const qDiff = (b.quality || 0) - (a.quality || 0);
        if (Math.abs(qDiff) > 0.04) return qDiff;
        return a.blob.size - b.blob.size;
      }
      return a.blob.size - b.blob.size;
    });
    return results[0];
  }

  return targetOneFormat(img, { ...base, format });
}
