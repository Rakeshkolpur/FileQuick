import * as pdfjsLib from 'pdfjs-dist';

// The worker file is shipped in /public (identical to the installed pdfjs-dist
// build). Serving it as a static asset avoids CDN dependencies and version drift.
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // BASE_URL is '/' on the web and './' in the desktop (file://) build.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL || '/'}pdf.worker.min.js`;
}

export { pdfjsLib };

/**
 * Load a PDF into pdf.js. Accepts an ArrayBuffer / Uint8Array; the buffer is
 * copied because pdf.js may detach (transfer) it to the worker.
 */
export async function openPdf(data) {
  let src;
  if (data instanceof ArrayBuffer) src = new Uint8Array(data.slice(0));
  else if (ArrayBuffer.isView(data)) src = new Uint8Array(data.slice().buffer);
  else src = data;
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
