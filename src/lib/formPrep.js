/**
 * Preparing images for online application / exam forms: exact pixel size, a
 * file size inside a KB window (forms reject files that are too SMALL as well
 * as too big), and — for signatures and thumb impressions — the paper cleaned
 * up and the empty margins trimmed away so the ink isn't tiny after resizing.
 *
 * Everything runs on a canvas in the browser.
 */
import { encodeImage, encodeToTargetBytes } from './imageResize';

const W = (img) => img.naturalWidth || img.width;
const H = (img) => img.naturalHeight || img.height;

/* ------------------------------------------------------------------ ink */

// Work on at most this many pixels on the long edge while analysing.
const WORK_EDGE = 1200;

function otsu(values, bins = 128) {
  const hist = new Float64Array(bins);
  for (let i = 0; i < values.length; i += 1) hist[Math.min(bins - 1, Math.floor(values[i] * bins))] += 1;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < bins; i += 1) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = bins * 0.75;
  for (let i = 0; i < bins; i += 1) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thr = i; }
  }
  return (thr + 0.5) / bins;
}

/**
 * Estimate the paper brightness everywhere (a max filter over blocks, so ink
 * strokes don't pull it down, then smoothed) — dividing by it removes phone
 * shadows and uneven light.
 */
function paperMap(lum, w, h) {
  const B = Math.max(8, Math.round(Math.max(w, h) / 40));
  const gw = Math.ceil(w / B);
  const gh = Math.ceil(h / B);
  const grid = new Float32Array(gw * gh);
  for (let y = 0; y < h; y += 1) {
    const gy = Math.floor(y / B) * gw;
    for (let x = 0; x < w; x += 1) {
      const g = gy + Math.floor(x / B);
      const v = lum[y * w + x];
      if (v > grid[g]) grid[g] = v;
    }
  }
  // 3×3 smooth so the map has no block edges
  const sm = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = gx + dx;
          const y = gy + dy;
          if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
          s += grid[y * gw + x];
          n += 1;
        }
      }
      sm[gy * gw + gx] = Math.max(0.15, s / n);
    }
  }
  // bilinear sample at work-space (x, y)
  return (x, y) => {
    const fx = Math.min(gw - 1, Math.max(0, x / B - 0.5));
    const fy = Math.min(gh - 1, Math.max(0, y / B - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(gw - 1, x0 + 1);
    const y1 = Math.min(gh - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = sm[y0 * gw + x0] * (1 - tx) + sm[y0 * gw + x1] * tx;
    const b = sm[y1 * gw + x0] * (1 - tx) + sm[y1 * gw + x1] * tx;
    return a * (1 - ty) + b * ty;
  };
}

/** Bounding box of the real ink: connected components, dropping specks, the
 *  desk around the paper and other big solid blobs. */
function inkBox(mask, w, h, keepSolid = false) {
  const label = new Int32Array(w * h);
  const comps = [];
  const stack = [];
  let next = 1;
  for (let i = 0; i < w * h; i += 1) {
    if (!mask[i] || label[i]) continue;
    let area = 0;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    label[i] = next;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      area += 1;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (mask[q] && !label[q]) { label[q] = next; stack.push(q); }
        }
      }
    }
    comps.push({ area, x0, y0, x1, y1 });
    next += 1;
  }
  const keep = comps.filter((c) => {
    const bw = c.x1 - c.x0 + 1;
    const bh = c.y1 - c.y0 + 1;
    const touches = c.x0 === 0 || c.y0 === 0 || c.x1 === w - 1 || c.y1 === h - 1;
    const fill = c.area / (bw * bh);
    // desk / table edge / shadow band around the sheet
    if (touches && (bw > w * 0.5 || bh > h * 0.5)) return false;
    // solid blobs (a thumb impression is ridged, so it stays well under this)
    if (!keepSolid && fill > 0.8 && c.area > 400) return false;
    return true;
  });
  const total = keep.reduce((s, c) => s + c.area, 0);
  const minArea = Math.max(3, total * 0.004);
  let box = null;
  for (const c of keep) {
    if (c.area < minArea) continue;
    if (!box) box = { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 };
    else {
      box.x0 = Math.min(box.x0, c.x0);
      box.y0 = Math.min(box.y0, c.y0);
      box.x1 = Math.max(box.x1, c.x1);
      box.y1 = Math.max(box.y1, c.y1);
    }
  }
  return box;
}

/**
 * Clean up a photographed / scanned signature or thumb impression.
 *
 * @param {CanvasImageSource} img
 * @param {{ trim?: boolean, clean?: boolean, margin?: number, keepSolid?: boolean }} [opts]
 *   trim   crop away the empty paper around the ink
 *   clean  flatten the paper to pure white (removes shadows, grey paper, JPEG noise)
 *   margin padding kept around the ink, as a fraction of its larger side
 *   keepSolid  don't drop solid dark blobs (thumb impressions can be inky)
 * @returns {{ canvas: HTMLCanvasElement, trimmed: boolean }}
 */
export function prepareInk(img, { trim = true, clean = true, margin = 0.08, keepSolid = false } = {}) {
  const iw = W(img);
  const ih = H(img);
  const s = Math.min(1, WORK_EDGE / Math.max(iw, ih));
  const ww = Math.max(1, Math.round(iw * s));
  const wh = Math.max(1, Math.round(ih * s));

  const work = document.createElement('canvas');
  work.width = ww;
  work.height = wh;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  wctx.fillStyle = '#fff';
  wctx.fillRect(0, 0, ww, wh);
  wctx.imageSmoothingQuality = 'high';
  wctx.drawImage(img, 0, 0, ww, wh);
  const wd = wctx.getImageData(0, 0, ww, wh).data;

  const lum = new Float32Array(ww * wh);
  for (let i = 0, p = 0; i < lum.length; i += 1, p += 4) {
    lum[i] = (0.299 * wd[p] + 0.587 * wd[p + 1] + 0.114 * wd[p + 2]) / 255;
  }
  const paper = paperMap(lum, ww, wh);
  const norm = new Float32Array(ww * wh);
  for (let y = 0; y < wh; y += 1) {
    for (let x = 0; x < ww; x += 1) {
      const i = y * ww + x;
      norm[i] = Math.min(1, lum[i] / paper(x, y));
    }
  }
  // Ink threshold: Otsu on the shadow-free image, kept in a sane band so a
  // blank sheet or a heavy scribble can't push it to an extreme.
  const thr = Math.min(0.82, Math.max(0.5, otsu(norm)));

  let box = null;
  if (trim) {
    const mask = new Uint8Array(ww * wh);
    for (let i = 0; i < mask.length; i += 1) mask[i] = norm[i] < thr ? 1 : 0;
    box = inkBox(mask, ww, wh, keepSolid);
  }

  // crop rectangle in source pixels
  let cx = 0;
  let cy = 0;
  let cw = iw;
  let ch = ih;
  if (box) {
    const pad = Math.max(box.x1 - box.x0, box.y1 - box.y0) * margin;
    const x0 = Math.max(0, box.x0 - pad);
    const y0 = Math.max(0, box.y0 - pad);
    const x1 = Math.min(ww, box.x1 + 1 + pad);
    const y1 = Math.min(wh, box.y1 + 1 + pad);
    cx = Math.floor(x0 / s);
    cy = Math.floor(y0 / s);
    cw = Math.max(1, Math.min(iw - cx, Math.ceil((x1 - x0) / s)));
    ch = Math.max(1, Math.min(ih - cy, Math.ceil((y1 - y0) / s)));
  }

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d', { willReadFrequently: true });
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, cw, ch);
  octx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);

  if (clean) {
    const id = octx.getImageData(0, 0, cw, ch);
    const d = id.data;
    const lo = thr - 0.18;
    const hi = Math.min(0.97, thr + 0.1);
    for (let y = 0; y < ch; y += 1) {
      for (let x = 0; x < cw; x += 1) {
        const p = (y * cw + x) * 4;
        const bg = paper((cx + x) * s, (cy + y) * s);
        const r = Math.min(255, d[p] / bg);
        const g = Math.min(255, d[p + 1] / bg);
        const b = Math.min(255, d[p + 2] / bg);
        const n = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        // how much of this pixel is ink (1) vs paper (0)
        let t = (n - lo) / (hi - lo);
        t = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
        const a = 1 - t;
        // ink keeps its colour (blue stays blue), slightly deepened
        d[p] = 255 - a * (255 - r * 0.85);
        d[p + 1] = 255 - a * (255 - g * 0.85);
        d[p + 2] = 255 - a * (255 - b * 0.85);
      }
    }
    octx.putImageData(id, 0, 0);
  }

  return { canvas: out, trimmed: !!box };
}

/* ------------------------------------------------------------ fitting */

/** High-quality downscale (progressive halving). */
function scaleTo(src, w, h) {
  let cur = src;
  let cw = W(src);
  let chh = H(src);
  while (cw > w * 2 && chh > h * 2) {
    const c = document.createElement('canvas');
    c.width = Math.max(w, Math.floor(cw / 2));
    c.height = Math.max(h, Math.floor(chh / 2));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
    cw = c.width;
    chh = c.height;
  }
  return cur;
}

/** The whole image, centred on white at exactly w×h (nothing cut off). */
export function containOnWhite(src, w, h) {
  const sw = W(src);
  const sh = H(src);
  const k = Math.min(w / sw, h / sh);
  const dw = Math.max(1, Math.round(sw * k));
  const dh = Math.max(1, Math.round(sh * k));
  const scaled = scaleTo(src, dw, dh);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(scaled, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  return c;
}

/** Centre crop to the w:h shape (for photos). */
export function centerCropRect(iw, ih, w, h) {
  const target = w / h;
  if (iw / ih > target) {
    const cw = ih * target;
    return { x: (iw - cw) / 2, y: 0, width: cw, height: ih };
  }
  const chh = iw / target;
  return { x: 0, y: (ih - chh) / 2, width: iw, height: chh };
}

/* ------------------------------------------------------------ KB window */

/**
 * Grow a JPEG to at least `minBytes` by adding a comment (COM) segment right
 * after the start marker. The picture itself is untouched — same pixels, same
 * dimensions — it only satisfies forms that reject files below a minimum size.
 */
export async function padJpegToBytes(blob, minBytes) {
  const need = Math.ceil(minBytes - blob.size);
  if (need <= 0) return blob;
  const src = new Uint8Array(await blob.arrayBuffer());
  if (src[0] !== 0xff || src[1] !== 0xd8) return blob; // not a JPEG
  const parts = [src.subarray(0, 2)];
  let left = need;
  while (left > 0) {
    // a COM segment is FF FE + 2-byte length (counting itself) + payload
    const payload = Math.max(1, Math.min(65533, left - 4));
    const seg = new Uint8Array(4 + payload);
    seg[0] = 0xff;
    seg[1] = 0xfe;
    seg[2] = ((payload + 2) >> 8) & 0xff;
    seg[3] = (payload + 2) & 0xff;
    seg.fill(0x20, 4);
    parts.push(seg);
    left -= seg.length;
  }
  parts.push(src.subarray(2));
  return new Blob(parts, { type: 'image/jpeg' });
}

/**
 * Encode `src` as a JPEG of exactly spec.w × spec.h, at the best quality that
 * stays under spec.max KB, padded up to spec.min KB if it came out too small.
 *
 * @param {CanvasImageSource} src
 * @param {{ w:number, h:number, min:number, max:number }} spec
 * @param {{ fit?: 'cover' | 'contain' }} [opts]  cover = centre-crop (photos),
 *   contain = whole image on white (signatures, thumb impressions)
 * @returns {Promise<{ blob, size, w, h, ok, small, padded }>}
 */
export async function encodeForForm(src, spec, { fit = 'cover' } = {}) {
  // Portals disagree on whether a KB is 1000 or 1024 bytes — aim inside both:
  // at most max × 1000 bytes, at least min × 1024 bytes.
  const maxBytes = spec.max * 1000;
  // contain: the whole image on a w×h white canvas; cover: centre-crop the source
  const source = fit === 'contain' ? containOnWhite(src, spec.w, spec.h) : src;
  const cropRect = fit === 'contain' ? undefined : centerCropRect(W(src), H(src), spec.w, spec.h);
  const opts = { cropRect, width: spec.w, height: spec.h, format: 'jpeg' };

  // Fast path: signatures and small form photos usually fit at near-top
  // quality — one encode instead of a whole quality search.
  let blob = await encodeImage(source, { ...opts, quality: 0.95 });
  if (blob.size > maxBytes) {
    ({ blob } = await encodeToTargetBytes(source, { ...opts, targetBytes: maxBytes, allowResize: false }));
  }
  let padded = false;
  const minBytes = spec.min * 1024;
  if (spec.min > 0 && blob.size < minBytes) {
    // land a little above the minimum (portals round KB differently), never over the max
    const goal = Math.min(maxBytes - 256, minBytes + Math.min(2048, Math.max(0, maxBytes - minBytes) * 0.15));
    if (goal > blob.size) {
      blob = await padJpegToBytes(blob, goal);
      padded = true;
    }
  }
  return {
    blob,
    size: blob.size,
    w: spec.w,
    h: spec.h,
    ok: blob.size <= maxBytes,
    small: blob.size < minBytes,
    padded,
  };
}
