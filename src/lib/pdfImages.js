import { pdfjsLib } from './pdfjs';

/**
 * Pull the raster images embedded in a PDF (photos, scans, logos) out as PNG
 * blobs. This reads each page's operator list, resolves the image XObjects it
 * paints, and rasterises them at their native pixel size. Repeated images
 * (a logo on every page) are returned once.
 */

const KIND = { GRAYSCALE_1BPP: 1, RGB_24BPP: 2, RGBA_32BPP: 3 };

function imageToCanvas(img) {
  if (!img || !img.width || !img.height) return null;
  const { width, height } = img;
  if (width < 4 || height < 4) return null; // skip 1px spacers / noise

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Newer pdf.js hands back a ready-to-draw bitmap for many images.
  if (typeof ImageBitmap !== 'undefined' && img.bitmap instanceof ImageBitmap) {
    ctx.drawImage(img.bitmap, 0, 0, width, height);
    return canvas;
  }

  const data = img.data;
  if (!data) return null;

  const out = ctx.createImageData(width, height);
  const dst = out.data;

  if (img.kind === KIND.RGBA_32BPP) {
    dst.set(data.subarray(0, dst.length));
  } else if (img.kind === KIND.RGB_24BPP) {
    for (let i = 0, j = 0; j < dst.length && i + 2 < data.length; i += 3, j += 4) {
      dst[j] = data[i];
      dst[j + 1] = data[i + 1];
      dst[j + 2] = data[i + 2];
      dst[j + 3] = 255;
    }
  } else if (img.kind === KIND.GRAYSCALE_1BPP) {
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        const j = (y * width + x) * 4;
        dst[j] = v;
        dst[j + 1] = v;
        dst[j + 2] = v;
        dst[j + 3] = 255;
      }
    }
  } else if (data.length >= width * height) {
    // Unknown kind — best-effort 8bpp grayscale.
    for (let i = 0, j = 0; j < dst.length && i < data.length; i += 1, j += 4) {
      dst[j] = data[i];
      dst[j + 1] = data[i];
      dst[j + 2] = data[i];
      dst[j + 3] = 255;
    }
  } else {
    return null;
  }

  ctx.putImageData(out, 0, 0);
  return canvas;
}

function fingerprint(canvas) {
  try {
    const s = 9;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const cx = c.getContext('2d');
    cx.drawImage(canvas, 0, 0, s, s);
    const d = cx.getImageData(0, 0, s, s).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 1) {
      h ^= d[i];
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  } catch (_) {
    return Math.random().toString(36);
  }
}

async function resolveImage(page, name) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (!done) {
        done = true;
        resolve(v || null);
      }
    };
    try {
      if (page.objs.has(name)) {
        finish(page.objs.get(name));
        return;
      }
    } catch (_) { /* fall through */ }
    try {
      page.objs.get(name, finish);
    } catch (_) {
      finish(null);
    }
    setTimeout(() => finish(null), 6000);
  });
}

export async function extractImages(pdf, { onProgress, signal } = {}) {
  const OPS = pdfjsLib.OPS;
  const wanted = new Set(
    [OPS.paintImageXObject, OPS.paintImageXObjectRepeat, OPS.paintInlineImageXObject].filter(
      (v) => v != null,
    ),
  );

  const results = [];
  const seen = new Set();

  for (let p = 1; p <= pdf.numPages; p += 1) {
    if (signal?.aborted) break;
    let page;
    try {
      // eslint-disable-next-line no-await-in-loop
      page = await pdf.getPage(p);
      // eslint-disable-next-line no-await-in-loop
      const { fnArray, argsArray } = await page.getOperatorList();

      for (let i = 0; i < fnArray.length; i += 1) {
        if (!wanted.has(fnArray[i])) continue;
        const args = argsArray[i];
        let img = null;
        if (fnArray[i] === OPS.paintInlineImageXObject) {
          img = args[0];
        } else if (typeof args[0] === 'string') {
          // eslint-disable-next-line no-await-in-loop
          img = await resolveImage(page, args[0]);
        }
        const canvas = imageToCanvas(img);
        if (!canvas) continue;

        const sig = `${canvas.width}x${canvas.height}:${fingerprint(canvas)}`;
        if (seen.has(sig)) continue;
        seen.add(sig);

        // eslint-disable-next-line no-await-in-loop
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        if (!blob) continue;
        results.push({
          id: sig,
          page: p,
          width: canvas.width,
          height: canvas.height,
          blob,
          size: blob.size,
          url: URL.createObjectURL(blob),
        });
      }
    } catch (_) {
      /* skip unreadable page */
    } finally {
      try { page?.cleanup?.(); } catch (_) { /* noop */ }
    }
    onProgress?.(p, pdf.numPages);
  }

  return results;
}
