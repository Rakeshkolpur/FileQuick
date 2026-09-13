// Browser-side AI photo upscaling — ESRGAN-slim via UpscalerJS + TensorFlow.js.
// Everything runs on the device; nothing is uploaded. Weights (~0.9 MB per
// scale) are served from /public and cached by the browser after the first run.

let _core = null;
const _upscalers = {}; // factor -> Upscaler
// Some GPUs/drivers can't compile the WebGL shaders this model needs (seen as
// "Failed to link vertex and fragment shaders") — once that happens we stick
// to the CPU backend for the rest of the session rather than fail every time.
let _forceCpu = false;

async function loadCore() {
  if (_core) return _core;
  const [{ default: Upscaler }, tf] = await Promise.all([
    import('upscaler'),
    import('@tensorflow/tfjs'), // registers the WebGL backend
  ]);
  _core = { Upscaler, tf };
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

// Whether this session already had to fall back to the (slower) CPU backend
// because the GPU couldn't compile the model's WebGL shaders.
export function isCpuFallback() {
  return _forceCpu;
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
// The CPU backend has no GPU parallelism, so ESRGAN's conv layers are far
// slower and far more memory-hungry per pixel — cap much smaller there to
// avoid locking up or crashing the tab on a weaker laptop.
const CPU_CAP = { 2: 500, 4: 320 };

async function prepareSource(dataUrl, factor, useCpuCap) {
  const img = await loadImage(dataUrl);
  const cap = useCpuCap ? CPU_CAP[factor] : CAP[factor];
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
  const { tf } = await loadCore();
  if (_forceCpu && tf.getBackend() !== 'cpu') {
    await tf.setBackend('cpu');
    await tf.ready();
  }
  let { src, w, h, capped } = await prepareSource(dataUrl, factor, _forceCpu);
  onProgress?.(0);
  const opts = {
    output: 'base64',
    patchSize: 64,
    padding: 6,
    signal,
    progress: (rate) => onProgress?.(Math.max(0, Math.min(1, rate))),
  };
  let out;
  try {
    out = await up.upscale(src, opts);
  } catch (e) {
    const msg = String(e?.message || e || '');
    // The GPU/driver couldn't compile this model's shaders. 4x is a much
    // deeper network — retrying it on the CPU has been seen to lock up or
    // crash the tab on weaker laptops, so only 2x gets an automatic retry
    // (at a much smaller size); 4x just fails with a clear message.
    if (!_forceCpu && factor === 2 && /shader|webgl/i.test(msg)) {
      _forceCpu = true;
      await tf.setBackend('cpu');
      await tf.ready();
      ({ src, w, h, capped } = await prepareSource(dataUrl, factor, true));
      out = await up.upscale(src, opts);
    } else if (/shader|webgl/i.test(msg)) {
      throw new Error("Your device's graphics can't run 4× upscaling. Try 2× instead, or a different device.");
    } else {
      throw e;
    }
  }
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
