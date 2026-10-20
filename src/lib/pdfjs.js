// The worker (~290 KB gz) is emitted as a hashed asset, so browsers cache it for
// good (immutable /assets) instead of re-checking a /public file on every visit.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

// pdf.js (~95 KB gz) is fetched on first use, not with the tool, so a PDF
// tool's upload screen appears straight away; warmPdfjs() starts the download
// in the background meanwhile, so it's normally ready by the time a file is picked.
let pending = null;

export const loadPdfjs = () => {
  if (!pending) {
    pending = import('pdfjs-dist').then((pdfjsLib) => {
      if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      }
      return pdfjsLib;
    }).catch((e) => { pending = null; throw e; });
  }
  return pending;
};

let workerWarmed = false;

/**
 * Start fetching pdf.js and its worker without waiting (call as soon as a PDF
 * is likely: a PDF tool opened, a PDF picked on the home page). Opening a PDF
 * needs both — ~385 KB on a first visit — and the worker otherwise only starts
 * downloading after pdf.js has arrived, so the two used to load one after the
 * other while the screen looked empty.
 */
export const warmPdfjs = () => {
  loadPdfjs().catch(() => {});
  if (!workerWarmed && typeof fetch === 'function') {
    workerWarmed = true;
    fetch(workerUrl).catch(() => { workerWarmed = false; }); // lands in the HTTP cache
  }
};

/**
 * Load a PDF into pdf.js. Accepts an ArrayBuffer / Uint8Array; the buffer is
 * copied because pdf.js may detach (transfer) it to the worker.
 */
export async function openPdf(data) {
  let src;
  if (data instanceof ArrayBuffer) src = new Uint8Array(data.slice(0));
  else if (ArrayBuffer.isView(data)) src = new Uint8Array(data.slice().buffer);
  else src = data;
  const pdfjsLib = await loadPdfjs();
  return pdfjsLib.getDocument({ data: src, isEvalSupported: false }).promise;
}

/** Render one page (1-based) to a fresh canvas at the given scale. */
export async function renderPageToCanvas(pdf, pageNumber, { scale = 1, rotation } = {}) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

/**
 * Render a page to a JPEG data URL sized to roughly `targetWidth` CSS px.
 * Returns the thumbnail plus the page's displayed (rotation-aware) size in pt.
 */
export async function renderThumbnail(pdf, pageNumber, targetWidth = 240) {
  const page = await pdf.getPage(pageNumber);
  const unit = page.getViewport({ scale: 1 });
  const scale = Math.min(2, Math.max(0.15, targetWidth / unit.width));
  const canvas = await renderPageToCanvas(pdf, pageNumber, { scale });
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.72),
    width: unit.width,
    height: unit.height,
  };
}
