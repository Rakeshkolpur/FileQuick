import { PDFDocument, rgb } from 'pdf-lib';

const PT = 2.834645669; // mm -> pt
const SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a3: [841.89, 1190.55],
  a5: [419.53, 595.28],
};

function dataUrlToBytes(dataUrl) {
  const bin = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function hexToRgb(hex) {
  const h = (hex || '#ffffff').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * @param {{dataUrl:string}[]} pages  each dataUrl is image/jpeg or image/png
 * @param {{pageSize:'fit'|'a4'|'letter'|'legal'|'a3'|'a5', orientation:'auto'|'portrait'|'landscape', marginMm:number, fit:'contain'|'cover'|'actual', bg:string}} opts
 * @returns {Promise<Blob>}
 */
export async function imagesToPdf(pages, opts = {}) {
  const {
    pageSize = 'fit',
    orientation = 'auto',
    marginMm = 0,
    fit = 'contain',
    bg = '#ffffff',
  } = opts;

  const doc = await PDFDocument.create();
  const margin = marginMm * PT;

  for (let i = 0; i < pages.length; i += 1) {
    const { dataUrl } = pages[i];
    const isJpg = dataUrl.startsWith('data:image/jpeg');
    const bytes = dataUrlToBytes(dataUrl);
    // eslint-disable-next-line no-await-in-loop
    const image = isJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
    const iw = image.width;
    const ih = image.height;

    let pw;
    let ph;
    if (pageSize === 'fit') {
      pw = iw + margin * 2;
      ph = ih + margin * 2;
    } else {
      const [a, b] = SIZES[pageSize] || SIZES.a4;
      const short = Math.min(a, b);
      const long = Math.max(a, b);
      const landscape = orientation === 'landscape' || (orientation === 'auto' && iw > ih);
      pw = landscape ? long : short;
      ph = landscape ? short : long;
    }

    const page = doc.addPage([pw, ph]);
    if (bg) page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: hexToRgb(bg) });

    const availW = Math.max(1, pw - margin * 2);
    const availH = Math.max(1, ph - margin * 2);
    let scale;
    if (fit === 'cover') scale = Math.max(availW / iw, availH / ih);
    else if (fit === 'actual') scale = Math.min(availW / iw, availH / ih, 1);
    else scale = Math.min(availW / iw, availH / ih);

    const dw = iw * scale;
    const dh = ih * scale;
    page.drawImage(image, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
  }

  return new Blob([await doc.save()], { type: 'application/pdf' });
}
