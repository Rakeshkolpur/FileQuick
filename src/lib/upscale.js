// Browser-side AI photo upscaling (ESRGAN-slim via UpscalerJS + TensorFlow.js).
// Everything runs on the device — nothing is uploaded. The model (~1–5 MB) is
// fetched once on first use and then cached by the browser.

let _core = null;
const _upscalers = {}; // factor -> Upscaler instance

async function loadCore() {
  if (_core) return _core;
  const [{ default: Upscaler }] = await Promise.all([
    import('upscaler'),
    import('@tensorflow/tfjs'), // registers the WebGL backend as a side effect
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
  // Serve the weights from our own /public instead of a CDN — works offline
  // after the first load and keeps everything first-party.
  const path = `${import.meta.env.BASE_URL || '/'}models/upscale/x${factor}/model.json`.replace('//', '/');
  const model = { ...base, path, _internals: { ...base._internals, path } };
  _upscalers[factor] = new Upscaler({ model });
  return _upscalers[factor];
}

// Kick off the download early (called when the tool mounts) so the first
// "Upscale" click isn't the thing that waits on the network.
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

// ESRGAN is slow on big inputs; cap the source so a 2×/4× pass stays in the
// tens-of-seconds range and the result fits in a canvas.
const MAX_SRC_EDGE = 1200;

async function prepareSource(dataUrl) {
  const img = await loadImage(dataUrl);
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (long <= MAX_SRC_EDGE) return { src: dataUrl, w: img.naturalWidth, h: img.naturalHeight, capped: false };
  const k = MAX_SRC_EDGE / long;
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return { src: c.toDataURL('image/png'), w, h, capped: true };
}

/**
 * @param {string} dataUrl  source image as a data/object URL
 * @param {2|4} factor
 * @param {(rate:number)=>void} [onProgress]  0..1
 * @param {AbortSignal} [signal]
 * @returns {Promise<{url:string, width:number, height:number, capped:boolean}>}
 */
export async function upscaleImage(dataUrl, factor, onProgress, signal) {
  const up = await getUpscaler(factor);
  const { src, w, h, capped } = await prepareSource(dataUrl);
  onProgress?.(0);
  const url = await up.upscale(src, {
    output: 'base64',
    patchSize: 64,
    padding: 6,
    signal,
    progress: (rate) => onProgress?.(Math.max(0, Math.min(1, rate))),
  });
  onProgress?.(1);
  return { url, width: w * factor, height: h * factor, capped };
}

export const dataUrlBytes = (u) => {
  const i = u.indexOf(',');
  if (i < 0) return 0;
  const b64 = u.slice(i + 1);
  return Math.floor((b64.length * 3) / 4);
};
