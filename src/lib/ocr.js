/**
 * Browser OCR via Tesseract. The library (UMD build), its worker and the wasm
 * core are all served from /public/tesseract as plain static assets — importing
 * tesseract.js as a module makes Vite inline its worker and OCR then dies with
 * "Cannot read properties of undefined (reading 'TessBaseAPI')".
 *
 * Language models (English ~10 MB; Hindi, Telugu, Kannada, Tamil … a few MB
 * each) are fetched once from the tessdata CDN and cached by the browser. They
 * are public data; no user content is uploaded.
 */
import { requireOnlineForTool } from './desktop';

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

/**
 * Languages the OCR can read. Indian documents nearly always mix in English,
 * so every Indian language is read together with English.
 */
export const OCR_LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'hin+eng', label: 'Hindi · हिन्दी' },
  { code: 'mar+eng', label: 'Marathi · मराठी' },
  { code: 'tel+eng', label: 'Telugu · తెలుగు' },
  { code: 'kan+eng', label: 'Kannada · ಕನ್ನಡ' },
  { code: 'tam+eng', label: 'Tamil · தமிழ்' },
  { code: 'mal+eng', label: 'Malayalam · മലയാളം' },
  { code: 'ben+eng', label: 'Bengali · বাংলা' },
  { code: 'guj+eng', label: 'Gujarati · ગુજરાતી' },
  { code: 'pan+eng', label: 'Punjabi · ਪੰਜਾਬੀ' },
  { code: 'ori+eng', label: 'Odia · ଓଡ଼ିଆ' },
  { code: 'urd+eng', label: 'Urdu · اردو' },
  { code: 'san+eng', label: 'Sanskrit · संस्कृतम्' },
  { code: 'asm+eng', label: 'Assamese · অসমীয়া' },
];

/** Unicode script of a page's text -> the OCR language for it (or null). */
const SCRIPTS = [
  [/[ऀ-ॿ]/g, 'hin+eng'], [/[ঀ-৿]/g, 'ben+eng'], [/[਀-੿]/g, 'pan+eng'],
  [/[઀-૿]/g, 'guj+eng'], [/[଀-୿]/g, 'ori+eng'], [/[஀-௿]/g, 'tam+eng'],
  [/[ఀ-౿]/g, 'tel+eng'], [/[ಀ-೿]/g, 'kan+eng'], [/[ഀ-ൿ]/g, 'mal+eng'],
  [/[؀-ۿ]/g, 'urd+eng'],
];
export function scriptLanguage(text) {
  const letters = (text || '').replace(/[\s\d\p{P}]/gu, '').length;
  if (!letters) return null;
  // every Indian script with a real share of the page (bilingual notices are
  // common: Hindi + Kannada, Telugu + Hindi …), read together with English
  const found = SCRIPTS
    .map(([re, code]) => [code.split('+')[0], (text.match(re) || []).length])
    .filter(([, n]) => n >= Math.max(5, letters * 0.08))
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
  return found.length ? [...found, 'eng'].join('+') : null;
}

/** "hin+kan+eng" -> "Hindi + Kannada" */
export function languageName(code) {
  const parts = (code || '').split('+').filter((c) => c !== 'eng');
  if (!parts.length) return 'English';
  return parts.map((c) => {
    const l = OCR_LANGUAGES.find((x) => x.code.split('+')[0] === c);
    return l ? l.label.split(' · ')[0] : c;
  }).join(' + ');
}

let workerPromise = null;
let workerLang = 'eng';
let progressCb = null;

const getWorker = () => {
  if (!workerPromise) {
    workerPromise = (async () => {
      if (!wasmSimd()) throw new Error('This browser is too old for in-browser OCR.');
      // The language file (~10 MB) comes from a CDN the first time OCR runs.
      if (!requireOnlineForTool('OCR (Extract Text)')) {
        throw new Error('You’re offline — connect to the internet the first time you use OCR.');
      }
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
      workerLang = 'eng';
      return w;
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
};

/** The worker, switched to `lang` (e.g. 'hin+eng') if it isn't already. */
const workerFor = async (lang = 'eng') => {
  const w = await getWorker();
  if (lang !== workerLang) {
    await w.loadLanguage(lang);
    await w.initialize(lang);
    workerLang = lang;
  }
  return w;
};

/** OCR a canvas / image element / blob → plain text. */
export async function ocrImage(source, onProgress) {
  progressCb = onProgress || null;
  try {
    const w = await getWorker();
    await w.setParameters({ tessedit_pageseg_mode: '6' }); // the engine's default, as before
    const { data } = await w.recognize(source);
    return (data.text || '').replace(/\n{3,}/g, '\n\n').trim();
  } finally {
    progressCb = null;
  }
}

/**
 * OCR with layout: every recognised line with its box and baseline (in the
 * source image's pixels), so the text can be rebuilt where it was.
 */
export async function ocrLines(source, onProgress, { psm = '3', minConf = 25, lang = 'eng' } = {}) {
  progressCb = onProgress || null;
  try {
    const w = await workerFor(lang);
    // 3 = find the layout on a full page; 6 = one block (a table cell)
    await w.setParameters({ tessedit_pageseg_mode: psm });
    const { data } = await w.recognize(source);
    return (data.lines || [])
      .map((l) => ({
        text: (l.text || '').replace(/\s+$/, ''),
        conf: l.confidence,
        bbox: l.bbox,
        baseline: l.baseline,
        words: (l.words || []).map((wd) => ({ text: wd.text, bbox: wd.bbox, conf: wd.confidence })),
      }))
      .filter((l) => l.text.trim() && l.conf > minConf);
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
