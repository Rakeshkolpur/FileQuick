/**
 * Browser OCR via Tesseract. The library (UMD build), its worker and the wasm
 * core are all served from /public/tesseract as plain static assets — importing
 * tesseract.js as a module makes Vite inline its worker and OCR then dies with
 * "Cannot read properties of undefined (reading 'TessBaseAPI')".
 *
 * The English language model (~10 MB) is fetched once from the tessdata CDN and
 * cached by the browser. It is public data; no user content is uploaded.
 */
// BASE_URL is '/' on the web, './' in the desktop (file://) build.
const B = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
const WORKER_PATH = `${B}tesseract/worker.min.js`;
const LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0';
const LIB_PATH = `${B}tesseract/tesseract.min.js`;

// We ship only the SIMD core (universal in browsers since 2023). If a very old
// browser lacks it, OCR fails with a clear message rather than silently.
const wasmSimd = () => {
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
      10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ]));
  } catch (_) { return false; }
};
const CORE_PATH = `${B}tesseract/tesseract-core-simd.wasm.js`;

let libPromise = null;
const loadLib = () => {
  if (typeof window !== 'undefined' && window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = LIB_PATH;
      s.async = true;
      s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract failed to load')));
      s.onerror = () => reject(new Error('Could not load the OCR engine'));
      document.head.appendChild(s);
    }).catch((e) => { libPromise = null; throw e; });
  }
  return libPromise;
};

let workerPromise = null;
let progressCb = null;

const getWorker = () => {
  if (!workerPromise) {
    workerPromise = (async () => {
      if (!wasmSimd()) throw new Error('This browser is too old for in-browser OCR.');
      const Tesseract = await loadLib();
      const w = await Tesseract.createWorker({
        workerPath: WORKER_PATH,
        corePath: CORE_PATH,
        langPath: LANG_PATH,
        logger: (m) => {
          if (m.status === 'recognizing text' && progressCb) progressCb(m.progress || 0);
        },
      });
      // tesseract.js 3.x: the wasm core must be loaded explicitly before
      // loadLanguage/initialize, or the API is undefined.
      await w.load();
      await w.loadLanguage('eng');
      await w.initialize('eng');
      return w;
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
};

/** OCR a canvas / image element / blob → plain text. */
export async function ocrImage(source, onProgress) {
  progressCb = onProgress || null;
  try {
    const w = await getWorker();
    const { data } = await w.recognize(source);
    return (data.text || '').replace(/\n{3,}/g, '\n\n').trim();
  } finally {
    progressCb = null;
  }
}

/** Warm the engine so the first page isn't slowed by the download. */
export function preloadOcr() {
  getWorker().catch(() => {});
}

export async function terminateOcr() {
  if (!workerPromise) return;
  try {
    const w = await workerPromise;
    await w.terminate();
  } catch (_) { /* ignore */ }
  workerPromise = null;
}
