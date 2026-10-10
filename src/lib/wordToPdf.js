/**
 * Word <-> PDF for tools that work on pages (Remove Pages …): a Word file has
 * no fixed pages until it is laid out, so it is converted to a PDF first —
 * with the same engine and font handling as the Word to PDF tool — and, if
 * the user wants, the edited PDF is turned back into a .docx afterwards.
 */
import { api } from './api';
import { isDesktop } from './desktop';
import { requestLocalFonts } from './localFonts';
import { canEmbedFonts, embedLocalFonts } from './docxFonts';
import { renderDocx, docxSectionsToPdf } from './docxToPdf';
import { cleanDocxFonts } from './pdfToWord';
import { SERVER_UPLOAD_MB } from './fileValidation';
import { stripExt } from './format';

export const WORD_ACCEPT = '.docx,.doc,.odt,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.oasis.opendocument.text,application/rtf,text/rtf';

export const isWordFile = (f) => !!f && /\.(docx?|odt|rtf)$/i.test(f.name || '');

const isDocx = (f) => /\.docx$/i.test(f?.name || '');

async function readError(blob, fallback) {
  try { return JSON.parse(await blob.text()).error || fallback; } catch { return fallback; }
}

/** Lay a .docx out in the browser (approximate) — used only when the server is unreachable. */
async function docxInBrowser(file) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:900px';
  document.body.appendChild(host);
  try {
    const sections = await renderDocx(await file.arrayBuffer(), host, host);
    const blob = await docxSectionsToPdf(sections, { scale: 2 });
    return blob.arrayBuffer();
  } finally {
    host.remove();
  }
}

/**
 * Convert a Word document to PDF bytes.
 * @param {File} file
 * @param {{ onStep?: (label: string) => void }} [opts]
 * @returns {Promise<{ bytes: ArrayBuffer, engine: 'libreoffice' | 'browser' }>}
 */
export async function wordToPdfBytes(file, { onStep } = {}) {
  let upload = file;
  // Pack the user's installed fonts into the .docx so the pages match Word
  // (works once the browser has font permission; otherwise the server's
  // look-alike fonts are used).
  if (isDocx(file) && !isDesktop() && canEmbedFonts()) {
    onStep?.('Packing your fonts…');
    requestLocalFonts();
    try { upload = (await embedLocalFonts(file)).blob; } catch { upload = file; }
  }

  onStep?.('Converting your Word document…');
  const fd = new FormData();
  fd.append('file', upload, file.name);
  try {
    const res = await api.post('/convert/word-to-pdf', fd, { responseType: 'blob', timeout: 240000 });
    const blob = res.data;
    if (!blob || (blob.type && !blob.type.includes('pdf'))) {
      throw new Error(await readError(blob, 'The converter returned something that isn’t a PDF.'));
    }
    return { bytes: await blob.arrayBuffer(), engine: 'libreoffice' };
  } catch (e) {
    if (e?.response?.status === 413) throw new Error(`This Word file is too large (limit ${SERVER_UPLOAD_MB.convert} MB).`);
    if (e?.response?.data instanceof Blob) throw new Error(await readError(e.response.data, 'Could not convert this Word document.'));
    if (e?.response || !isDocx(file)) {
      throw new Error(e?.response
        ? (e.message || 'Could not convert this Word document.')
        : 'The Word converter isn’t responding right now — please try again in a moment, or save the document as PDF and upload that.');
    }
    // the engine is unreachable — lay the .docx out in the browser instead
    onStep?.('Laying out the pages in your browser…');
    return { bytes: await docxInBrowser(file), engine: 'browser' };
  }
}

/**
 * Turn PDF bytes back into a .docx (same engine as the PDF to Word tool).
 * @returns {Promise<Blob>}
 */
export async function pdfToDocxBlob(pdfBytes, name) {
  const fd = new FormData();
  fd.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), `${stripExt(name || 'document')}.pdf`);
  let res;
  try {
    res = await api.post('/convert/pdf-to-word', fd, { responseType: 'blob', timeout: 300000 });
  } catch (e) {
    if (e?.response?.data instanceof Blob) throw new Error(await readError(e.response.data, 'Could not make the Word file.'));
    throw new Error(e?.response ? 'Could not make the Word file.' : 'The converter isn’t responding right now — download the PDF instead, or try again shortly.');
  }
  const blob = res.data;
  if (!blob || /json|text/.test(blob.type || '')) throw new Error(await readError(blob, 'The converter didn’t return a Word document.'));
  return cleanDocxFonts(blob);
}
