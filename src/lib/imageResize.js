const MIME = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const outExt = (format) => (format === 'jpeg' || format === 'jpg' ? 'jpg' : format);
export const mimeFor = (format) => MIME[format] || 'image/jpeg';
export const isLossy = (format) => mimeFor(format) !== 'image/png';

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

// Lowest quality we'll ever use just to hit a size while keeping full resolution.
const Q_FLOOR = 0.4;
// When we're allowed to shrink, keep quality here so the smaller image stays sharp.
const Q_KEEP = 0.6;

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

/** Per-format target-size search (lossy). Extracted so `auto` can race formats. */
async function targetOneFormat(img, {
  cropRect,
  W0,
  H0,
  format,
  targetBytes,
  highQuality = true,
  allowResize = false,
  tolerance = 0.02,
}) {
  const render = (w, h, q) => encodeImage(img, { cropRect, width: w, height: h, format, quality: q, highQuality });

  // 1) tune quality at full resolution, floor Q_FLOOR
  let lo = Q_FLOOR;
  let hi = 0.985;
  let best = null;
  for (let i = 0; i < 14; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const blob = await render(W0, H0, (lo + hi) / 2);
    const q = (lo + hi) / 2;
    if (blob.size <= targetBytes) {
      if (!best || blob.size > best.blob.size) best = { blob, width: W0, height: H0, quality: q };
      lo = q;
    } else {
      hi = q;
    }
    if (best && targetBytes - best.blob.size <= targetBytes * tolerance) break;
    if (hi - lo < 0.004) break;
  }
  if (best) return { ...best, format, fits: true, resized: false };

  // 2) can't hit target at Q_FLOOR full-res
  const floorBlob = await render(W0, H0, Q_FLOOR);
  if (!allowResize) {
    return { blob: floorBlob, width: W0, height: H0, quality: Q_FLOOR, format, fits: false, resized: false };
  }

  // 3) opt-in: shrink dimensions, keep quality >= Q_KEEP
  let w = W0;
  let h = H0;
  for (let step = 0; step < 10; step += 1) {
    // eslint-disable-next-line no-await-in-loop
    const cur = await render(w, h, Q_KEEP);
    if (cur.size <= targetBytes) {
      let flo = Q_KEEP;
      let fhi = 0.92;
      let fb = { blob: cur, width: w, height: h, quality: Q_KEEP };
      for (let i = 0; i < 7; i += 1) {
        const q = (flo + fhi) / 2;
        // eslint-disable-next-line no-await-in-loop
        const b = await render(w, h, q);
        if (b.size <= targetBytes) {
          fb = { blob: b, width: w, height: h, quality: q };
          flo = q;
        } else {
          fhi = q;
        }
      }
      return { ...fb, format, fits: true, resized: w !== W0 };
    }
    const scale = Math.max(0.15, Math.sqrt(targetBytes / cur.size) * 0.93);
    w = Math.max(24, Math.round(w * scale));
    h = Math.max(24, Math.round(h * scale));
  }
  const lastBlob = await render(w, h, Q_KEEP);
  return { blob: lastBlob, width: w, height: h, quality: Q_KEEP, format, fits: lastBlob.size <= targetBytes, resized: w !== W0 };
}

/**
 * Encode as close as possible to (but not above) a target byte size.
 *
 * Default: tune quality only and KEEP the resolution (quality floor Q_FLOOR).
 * If the target can't be met that way, the best full-res attempt is returned
 * with `fits: false`.
 *
 * `allowResize: true`: reduce dimensions (keeping quality >= Q_KEEP) until it fits.
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
