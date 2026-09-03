// Browser-side AI photo upscaling — ESRGAN-slim via UpscalerJS + TensorFlow.js.
// Everything runs on the device; nothing is uploaded. Weights (~0.9 MB per
// scale) are served from /public and cached by the browser after the first run.

let _core = null;
const _upscalers = {}; // factor -> Upscaler

async function loadCore() {
  if (_core) return _core;
  const [{ default: Upscaler }] = await Promise.all([
    import('upscaler'),
    import('@tensorflow/tfjs'), // registers the WebGL backend
  ]);
  _core = { Upscaler };
  return _core;
}

async function getUpscaler(factor) {
  if (_upscalers[factor]) return _upscalers[factor];
  const { Upscaler } = await loadCore();
  const base =
    factor === 4
      ? (await import('@upscalerjs/esrgan-slim/4x')).default
      : (await import('@upscalerjs/esrgan-slim/2x')).default;
  const path = `${import.meta.env.BASE_URL || '/'}models/upscale/x${factor}/model.json`.replace(/\/{2,}/g, '/');
  const model = { ...base, path, _internals: { ...base._internals, path } };
  _upscalers[factor] = new Upscaler({ model });
  return _upscalers[factor];
}

// warm the network fetch so the first "Upscale" click isn't the wait
export function preloadUpscaleModel(factor = 2) {
  getUpscaler(factor).catch(() => {});
}

const loadImage = (src) =>
  new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Could not read this image.'));
    im.src = src;
  });

// Cap the source so a pass stays quick and the result fits in a canvas.
const CAP = { 2: 1200, 4: 700 };

async function prepareSource(dataUrl, factor) {
  const img = await loadImage(dataUrl);
  const cap = CAP[factor];
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (long <= cap) return { src: dataUrl, w: img.naturalWidth, h: img.naturalHeight, capped: false };
  const k = cap / long;
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return { src: c.toDataURL('image/png'), w, h, capped: true };
}

// mild GPU-only finishing touch (one draw, no per-pixel JS)
async function polish(dataUrl) {
  const img = await loadImage(dataUrl);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.filter = 'contrast(1.07) saturate(1.06)';
  ctx.drawImage(img, 0, 0);
  ctx.filter = 'none';
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

/**
 * @param {string} dataUrl source image (data/object URL)
 * @param {2|4} factor
 * @param {(rate:number)=>void} [onProgress] 0..1
 * @param {AbortSignal} [signal]
 * @returns {Promise<{blobUrl:string,bytes:number,width:number,height:number,capped:boolean}>}
 */
export async function upscaleImage(dataUrl, factor, onProgress, signal) {
  const up = await getUpscaler(factor);
  const { src, w, h, capped } = await prepareSource(dataUrl, factor);
  onProgress?.(0);
  const out = await up.upscale(src, {
    output: 'base64',
    patchSize: 64,
    padding: 6,
    signal,
    progress: (rate) => onProgress?.(Math.max(0, Math.min(1, rate))),
  });
  onProgress?.(1);
  let blob;
  try {
    blob = await polish(out);
  } catch {
    blob = await fetch(out).then((r) => r.blob());
  }
  return {
    blobUrl: URL.createObjectURL(blob),
    bytes: blob.size,
    width: w * factor,
    height: h * factor,
    capped,
  };
}
