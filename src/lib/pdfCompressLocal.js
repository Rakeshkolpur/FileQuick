/**
 * Compress a PDF's images right here in the browser.
 *
 * Measured on the live server, a 45 MB PDF compresses in about 4 s but takes
 * minutes to upload on mobile data, so most of the wait was the upload. Nearly
 * all of a big PDF's bytes are images, and a browser can shrink those itself:
 * no upload, no server, and it keeps working if the server is down.
 *
 * Text, fonts, links and forms are left exactly as they are. An image is only
 * replaced when the browser can reproduce it faithfully: anything else (CMYK,
 * inverted, masks, unusual colour spaces) stays untouched. Same size/quality
 * settings as the server's COMPRESS_LEVELS (server/convert_server.py).
 */
import { loadPdfLib } from './pdfLib';
import { rgbaFromRaw, scaledSize } from './pdfImageCodec';

export const LOCAL_LEVELS = {
  medium: { cap: 1700, quality: 62 },
  strong: { cap: 1100, quality: 45 },
};

const MIN_IMAGE_BYTES = 20 * 1024; // not worth a re-encode
const MAX_PIXELS = 40e6; //           a phone can run out of memory decoding more
const MIN_GAIN = 0.9; //              replace only if at least 10% smaller
const WORKER_TIMEOUT_MS = 60000;

/** 1 or 3 channels for colour spaces a canvas reproduces; null for the rest. */
function channelsOf(cs, lib) {
  const { PDFName, PDFArray, PDFRawStream, PDFNumber } = lib;
  if (cs instanceof PDFName) {
    const n = String(cs);
    if (n === '/DeviceRGB') return 3;
    if (n === '/DeviceGray') return 1;
    return null;
  }
  if (cs instanceof PDFArray && cs.size() >= 2) {
    const kind = String(cs.lookup(0));
    if (kind === '/CalRGB') return 3;
    if (kind === '/CalGray') return 1;
    if (kind === '/ICCBased') {
      const profile = cs.lookup(1);
      if (profile instanceof PDFRawStream) {
        const n = profile.dict.lookup(PDFName.of('N'));
        const v = n instanceof PDFNumber ? n.asNumber() : 0;
        if (v === 1 || v === 3) return v;
      }
    }
  }
  return null;
}

/** Channel count and EXIF rotation from a JPEG's headers (null if unreadable). */
function jpegInfo(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let rotated = false;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; } // eslint-disable-line no-continue
    const m = b[i + 1];
    if (m === 0xff) { i += 1; continue; } // eslint-disable-line no-continue
    const len = (b[i + 2] << 8) + b[i + 3];
    if (m === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
      rotated = exifRotated(b, i + 10, len - 8);
    }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { channels: b[i + 9], rotated };
    }
    i += 2 + len;
  }
  return null;
}

function exifRotated(b, tiff, size) {
  if (size < 14) return false;
  const le = b[tiff] === 0x49;
  const u16 = (o) => (le ? b[o] + (b[o + 1] << 8) : (b[o] << 8) + b[o + 1]);
  const u32 = (o) => (le ? u16(o) + u16(o + 2) * 65536 : u16(o) * 65536 + u16(o + 2));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > tiff + size) return false;
  const n = u16(ifd);
  for (let k = 0; k < n; k += 1) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > tiff + size) return false;
    if (u16(e) === 0x0112) return u16(e + 8) !== 1;
  }
  return false;
}

/** Everything that decides whether this image can be replaced safely. */
function planImage(ref, stream, masks, lib) {
  const { PDFName, PDFArray, PDFDict, PDFNumber, PDFBool } = lib;
  const d = stream.dict;
  const get = (k) => d.lookup(PDFName.of(k));
  if (String(get('Subtype')) !== '/Image') return null;
  if (masks.has(ref.toString())) return null; // a transparency mask, not a picture
  if (get('ImageMask') instanceof PDFBool && get('ImageMask').asBoolean()) return null;
  if (get('Decode') || get('Mask') instanceof PDFArray) return null;
  const smask = get('SMask');
  if (smask && smask.dict && smask.dict.lookup(PDFName.of('Matte'))) return null;

  let filter = get('Filter');
  if (filter instanceof PDFArray) {
    if (filter.size() !== 1) return null;
    filter = filter.lookup(0);
  }
  const num = (k) => { const v = get(k); return v instanceof PDFNumber ? v.asNumber() : 0; };
  const w = num('Width');
  const h = num('Height');
  const size = stream.getContents().length;
  if (!w || !h || w * h > MAX_PIXELS || size < MIN_IMAGE_BYTES) return null;

  const channels = channelsOf(get('ColorSpace'), lib);
  if (!channels) return null;

  if (String(filter) === '/DCTDecode') {
    const info = jpegInfo(stream.getContents());
    if (!info || info.channels !== channels || info.rotated) return null;
    return { ref, stream, w, h, size, kind: 'jpeg' };
  }
  if (String(filter) === '/FlateDecode' && num('BitsPerComponent') === 8) {
    let parms = get('DecodeParms');
    if (parms instanceof PDFArray) parms = parms.lookup(0);
    let predictor = 1;
    if (parms instanceof PDFDict) {
      const n = (k) => { const v = parms.lookup(PDFName.of(k)); return v instanceof PDFNumber ? v.asNumber() : null; };
      predictor = n('Predictor') || 1;
      if (predictor !== 1 && predictor < 10) return null; // TIFF predictor
      if (predictor >= 10 && ((n('Colors') || 1) !== channels || (n('BitsPerComponent') || 8) !== 8 || (n('Columns') || 1) !== w)) return null;
    }
    return { ref, stream, w, h, size, kind: 'flate', channels, predictor };
  }
  return null; // JPEG 2000, JBIG2, CCITT, 1-bit, palette: usually small already
}

/** Fallback for browsers without worker canvases: same job on the main thread. */
async function reencodeOnPage(plan, { cap, quality }, lib) {
  const bmp = plan.kind === 'jpeg'
    ? await createImageBitmap(new Blob([plan.stream.getContents()], { type: 'image/jpeg' }))
    : await createImageBitmap(new ImageData(rgbaFromRaw(lib.decodePDFRawStream(plan.stream).decode(), plan), plan.w, plan.h));
  const { W, H } = scaledSize(plan.w, plan.h, cap);
  const canvas = document.createElement('canvas');
  try {
    if (bmp.width !== plan.w || bmp.height !== plan.h) return null; // not what the PDF says it is
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, W, H);
  } finally {
    bmp.close();
  }
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality / 100));
  return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), w: W, h: H } : null;
}

const canUseWorkers = () => typeof Worker !== 'undefined'
  && typeof OffscreenCanvas !== 'undefined'
  && typeof OffscreenCanvas.prototype.convertToBlob === 'function'
  && typeof DecompressionStream !== 'undefined';

/** A few at once, but never so many that a small phone runs out of memory. */
function poolSize() {
  const cores = navigator.hardwareConcurrency || 2;
  const memory = navigator.deviceMemory || 4;
  return Math.max(1, Math.min(cores - 1, 3, memory <= 2 ? 1 : 3));
}

/** Resolves with the new image, or null if the worker couldn't do this one. */
function reencodeInWorker(worker, plan, { cap, quality }) {
  return new Promise((resolve) => {
    let timer = null;
    const done = (out) => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      resolve(out);
    };
    // A worker that broke or hung never answers again: stop using it.
    const giveUp = () => { worker.dead = true; done(null); };
    timer = setTimeout(giveUp, WORKER_TIMEOUT_MS);
    worker.onmessage = ({ data }) => done(data.failed ? null : data);
    worker.onerror = giveUp;
    // slice(): the stream is a view into the whole file, and posting a view
    // would copy the entire file to the worker each time.
    const bytes = plan.stream.getContents().slice();
    worker.postMessage({
      id: 0, kind: plan.kind, bytes, w: plan.w, h: plan.h, channels: plan.channels, predictor: plan.predictor, cap, quality,
    }, [bytes.buffer]);
  });
}

/**
 * @param {File|Blob} file
 * @param {{cap:number, quality:number}} settings  see LOCAL_LEVELS
 * @param {(done:number, total:number) => void} [onProgress]
 * @returns {Promise<{blob:Blob, pages:number, images:number, replaced:number, untouched:number}>}
 *   Rejects on anything it can't handle (encrypted PDF, out of memory…): the
 *   caller then sends the file to the server instead.
 */
export async function compressPdfInBrowser(file, settings, onProgress) {
  const lib = await loadPdfLib();
  const { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } = lib;
  const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const ctx = doc.context;
  const objects = ctx.enumerateIndirectObjects();

  // Masks are images too, but must stay greyscale masks: leave them alone.
  const masks = new Set();
  objects.forEach(([, obj]) => {
    if (!(obj instanceof PDFRawStream)) return;
    ['SMask', 'Mask'].forEach((k) => {
      const m = obj.dict.get(PDFName.of(k));
      if (m instanceof PDFRef) masks.add(m.toString());
    });
  });

  const plans = [];
  let untouched = 0; // bytes of sizeable images this browser can't safely redo (CMYK…)
  objects.forEach(([ref, obj]) => {
    if (!(obj instanceof PDFRawStream)) return;
    const plan = planImage(ref, obj, masks, lib);
    if (plan) plans.push(plan);
    else if (String(obj.dict.lookup(PDFName.of('Subtype'))) === '/Image' && !masks.has(ref.toString())) {
      const size = obj.getContents().length;
      if (size >= MIN_IMAGE_BYTES) untouched += size;
    }
  });

  let replaced = 0;
  let finished = 0;
  let next = 0;
  onProgress?.(0, plans.length);

  // Each runner owns one worker and takes the next image when it's free.
  const runner = async (worker) => {
    while (next < plans.length) {
      const plan = plans[next];
      next += 1;
      let out = null;
      try {
        /* eslint-disable no-await-in-loop */
        if (worker && !worker.dead) out = await reencodeInWorker(worker, plan, settings);
        if (!out) out = await reencodeOnPage(plan, settings, lib);
        /* eslint-enable no-await-in-loop */
      } catch { out = null; } // this image stays as it was
      if (out && out.bytes.length < plan.size * MIN_GAIN) {
        const d = plan.stream.dict.clone(ctx);
        d.set(PDFName.of('Width'), PDFNumber.of(out.w));
        d.set(PDFName.of('Height'), PDFNumber.of(out.h));
        d.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
        d.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB')); // a browser's JPEG is always RGB
        d.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        d.delete(PDFName.of('DecodeParms'));
        ctx.assign(plan.ref, PDFRawStream.of(d, out.bytes));
        replaced += 1;
      }
      finished += 1;
      onProgress?.(finished, plans.length);
    }
  };

  const workers = [];
  if (canUseWorkers() && plans.length) {
    try {
      for (let i = 0; i < poolSize(); i += 1) {
        workers.push(new Worker(new URL('./pdfImage.worker.js', import.meta.url), { type: 'module' }));
      }
    } catch { /* no workers here: the page does it */ }
  }
  try {
    await Promise.all(workers.length ? workers.map(runner) : [runner(null)]);
  } finally {
    workers.forEach((w) => w.terminate());
  }

  const bytes = await doc.save({ updateFieldAppearances: false, useObjectStreams: true });
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    pages: doc.getPageCount(),
    images: plans.length,
    replaced,
    untouched,
  };
}
