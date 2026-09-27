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

/* ------------------------------------------------------------------ */
/*  Server engine: Real-ESRGAN (general-x4v3) on our conversion server  */
/*  — far better than the small in-browser model, and the page never   */
/*  freezes: the work runs as a background job and we poll progress.   */
/* ------------------------------------------------------------------ */

let _serverOk = null;
/** Does the conversion server offer AI upscaling? (checked once) */
export function serverUpscaleAvailable() {
  if (!_serverOk) {
    _serverOk = import('./api')
      .then(({ api }) => api.get('/health', { timeout: 5000 }))
      .then((r) => !!r.data?.upscale)
      .catch(() => false);
  }
  return _serverOk;
}

const abortError = () => {
  const e = new Error('Cancelled');
  e.name = 'AbortError';
  return e;
};
const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(abortError()); }, { once: true });
});

async function serverUpscale(dataUrl, factor, onProgress, signal, onStatus) {
  const { api } = await import('./api');
  const src = await fetch(dataUrl).then((r) => r.blob());
  const ext = /png/.test(src.type) ? '.png' : /webp/.test(src.type) ? '.webp' : '.jpg';
  const fd = new FormData();
  fd.append('file', src, `image${ext}`);
  fd.append('scale', String(factor));

  onStatus?.({ phase: 'upload', pct: 0 });
  const started = await api.post('/image/upscale', fd, {
    timeout: 120000,
    signal,
    onUploadProgress: (e) => { if (e.total) onStatus?.({ phase: 'upload', pct: e.loaded / e.total }); },
  });
  const { job } = started.data;
  signal?.addEventListener('abort', () => { api.delete(`/image/upscale/${job}`).catch(() => {}); }, { once: true });

  let status;
  let aiStart = 0;
  for (;;) {
    if (signal?.aborted) throw abortError();
    // eslint-disable-next-line no-await-in-loop
    await sleep(800, signal);
    // eslint-disable-next-line no-await-in-loop
    status = (await api.get(`/image/upscale/${job}`, { timeout: 20000, signal })).data;
    if (status.state === 'queued') onStatus?.({ phase: 'queued' });
    else if (status.state === 'running') {
      if (!aiStart) aiStart = Date.now();
      const p = status.progress || 0;
      const elapsed = (Date.now() - aiStart) / 1000;
      const left = p > 0.05 ? Math.max(1, Math.round((elapsed / p) * (1 - p))) : null;
      onStatus?.({ phase: 'ai', pct: p, secondsLeft: left });
      onProgress?.(p);
    } else if (status.state === 'done') break;
    else throw new Error(status.error && status.error !== 'cancelled' ? status.error : 'Upscaling was stopped.');
  }

  onStatus?.({ phase: 'download', pct: 0 });
  const res = await api.get(`/image/upscale/${job}/result`, {
    responseType: 'blob',
    timeout: 180000,
    signal,
    onDownloadProgress: (e) => { if (e.total) onStatus?.({ phase: 'download', pct: e.loaded / e.total }); },
  });
  const blob = new Blob([res.data], { type: status.mime });
  onProgress?.(1);
  return {
    blobUrl: URL.createObjectURL(blob),
    bytes: blob.size,
    width: status.outWidth,
    height: status.outHeight,
    capped: !!status.capped,
    mime: status.mime,
    engine: 'server',
  };
}

/**
 * @param {string} dataUrl source image (data/object URL)
 * @param {1|2|4} factor 1 = enhance at the same size
 * @param {(rate:number)=>void} [onProgress] 0..1
 * @param {AbortSignal} [signal]
 * @param {(s:{phase:string,pct?:number,secondsLeft?:number})=>void} [onStatus]
 * @returns {Promise<{blobUrl:string,bytes:number,width:number,height:number,capped:boolean,mime:string,engine:string}>}
 */
export async function upscaleImage(dataUrl, factor, onProgress, signal, onStatus) {
  if (await serverUpscaleAvailable()) {
    try {
      return await serverUpscale(dataUrl, factor, onProgress, signal, onStatus);
    } catch (e) {
      if (e?.name === 'AbortError' || e?.name === 'CanceledError' || signal?.aborted) throw abortError();
      // A real answer from the server (bad image, too large…) is final; only
      // an unreachable server falls back to the in-browser model.
      const unreachable = !e?.response && /network|timeout|ECONN/i.test(`${e?.message || ''} ${e?.code || ''}`);
      if (!unreachable) {
        const data = e?.response?.data;
        let msg = e?.message || 'Upscaling failed.';
        if (data instanceof Blob) {
          try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep */ }
        } else if (data?.error) msg = data.error;
        throw new Error(msg);
      }
    }
  }
  onStatus?.({ phase: 'browser' });
  if (factor === 1) return enhanceInBrowser(dataUrl, onProgress, signal);
  return browserUpscale(dataUrl, factor, onProgress, signal);
}

/** Browser fallback for "enhance": 2x with the small model, back to the original size. */
async function enhanceInBrowser(dataUrl, onProgress, signal) {
  const src = await loadImage(dataUrl);
  const up = await browserUpscale(dataUrl, 2, onProgress, signal);
  const big = await loadImage(up.blobUrl);
  const c = document.createElement('canvas');
  c.width = src.naturalWidth;
  c.height = src.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(big, 0, 0, c.width, c.height);
  URL.revokeObjectURL(up.blobUrl);
  const blob = await new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
  return {
    blobUrl: URL.createObjectURL(blob), bytes: blob.size, width: c.width, height: c.height, capped: up.capped, mime: 'image/png', engine: 'browser',
  };
}

/* ------------------------------------------------------------------ */
/*  Fallback: the small in-browser model                               */
/* ------------------------------------------------------------------ */

async function browserUpscale(dataUrl, factor, onProgress, signal) {
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
    mime: 'image/png',
    engine: 'browser',
  };
}
