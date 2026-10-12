// Document-scanner image ops built on OpenCV.js: find the page in a photo,
// straighten it with a perspective warp, and clean it up so it reads like a
// real scan. Everything runs on the device.

import { getCv } from './opencvLoader';

const DETECT_EDGE = 800;   // downscale for corner detection (speed)

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not read this image.'));
    im.src = src;
  });

function drawToCanvas(img, maxEdge) {
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  const k = maxEdge && long > maxEdge ? maxEdge / long : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
  return { canvas: c, scale: k };
}

// order 4 points as [TL, TR, BR, BL]
export function orderCorners(pts) {
  const p = pts.slice();
  const bySum = [...p].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const byDiff = [...p].sort((a, b) => (a.y - a.x) - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Best-guess document quad for a photo. Returns [{x,y}×4] in the *full-res*
 * image's pixel coords ordered TL,TR,BR,BL — or null if nothing convincing.
 */
export async function detectDocument(srcUrl) {
  const cv = await getCv();
  const img = await loadImage(srcUrl);
  const { canvas, scale } = drawToCanvas(img, DETECT_EDGE);
  const W = canvas.width;
  const H = canvas.height;
  const area = W * H;

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let quad = null;

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, 70, 200);
    cv.dilate(edges, edges, kernel);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let bestArea = 0;
    for (let i = 0; i < contours.size(); i += 1) {
      const c = contours.get(i);
      const peri = cv.arcLength(c, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(c, approx, 0.02 * peri, true);
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const a = Math.abs(cv.contourArea(approx));
        if (a > bestArea && a > area * 0.18 && a < area * 0.995) {
          bestArea = a;
          quad = [];
          for (let j = 0; j < 4; j += 1) {
            quad.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
          }
        }
      }
      approx.delete();
      c.delete();
    }
  } finally {
    src.delete(); gray.delete(); edges.delete(); kernel.delete();
    contours.delete(); hierarchy.delete();
  }

  if (!quad) return null;
  const inv = 1 / scale;
  return orderCorners(quad.map((p) => ({ x: p.x * inv, y: p.y * inv })));
}

function quadFromContour(cv, contour) {
  const hull = new cv.Mat();
  cv.convexHull(contour, hull);
  const pts = [];
  for (let i = 0; i < hull.rows; i += 1) {
    pts.push({ x: hull.data32S[i * 2], y: hull.data32S[i * 2 + 1] });
  }
  hull.delete();
  const peri = cv.arcLength(contour, true);
  const approx = new cv.Mat();
  cv.approxPolyDP(contour, approx, 0.02 * peri, true);
  let quad = null;
  if (approx.rows === 4) {
    quad = [];
    for (let j = 0; j < 4; j += 1) quad.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
  } else if (pts.length >= 4) {
    const bySum = [...pts].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    const byDiff = [...pts].sort((a, b) => (a.x - a.y) - (b.x - b.y));
    quad = [bySum[0], byDiff[byDiff.length - 1], bySum[bySum.length - 1], byDiff[0]];
  }
  approx.delete();
  return quad;
}

/**
 * "AI" edge detection — GrabCut foreground segmentation seeded with a near-full
 * frame rect, then the quad of the largest foreground blob. Works on
 * low-contrast / cluttered / partly-occluded photos where Canny finds no clean
 * rectangle. No model download; ~1–3 s. Returns full-res TL,TR,BR,BL or null.
 */
export async function detectDocumentAI(srcUrl, onProgress) {
  const cv = await getCv();
  const img = await loadImage(srcUrl);
  const { canvas, scale } = drawToCanvas(img, 500); // GrabCut is O(pixels) — keep it small
  const W = canvas.width;
  const H = canvas.height;
  onProgress?.(0.1);

  const rgba = cv.imread(canvas);
  const src = new cv.Mat();
  const mask = new cv.Mat();
  const bgd = new cv.Mat();
  const fgd = new cv.Mat();
  const bin = new cv.Mat(H, W, cv.CV_8UC1);
  const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let quad = null;

  try {
    cv.cvtColor(rgba, src, cv.COLOR_RGBA2RGB);
    const m = Math.round(Math.min(W, H) * 0.03);
    const rect = new cv.Rect(m, m, W - 2 * m, H - 2 * m);
    cv.grabCut(src, mask, rect, bgd, fgd, 4, cv.GC_INIT_WITH_RECT);
    onProgress?.(0.75);

    for (let i = 0; i < mask.data.length; i += 1) {
      const v = mask.data[i];
      bin.data[i] = v === cv.GC_FGD || v === cv.GC_PR_FGD ? 255 : 0;
    }
    cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, kernel);
    cv.morphologyEx(bin, bin, cv.MORPH_OPEN, kernel);

    cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let best = 0;
    let bi = -1;
    for (let i = 0; i < contours.size(); i += 1) {
      const a = Math.abs(cv.contourArea(contours.get(i)));
      if (a > best) { best = a; bi = i; }
    }
    if (bi >= 0 && best > W * H * 0.12 && best < W * H * 0.999) {
      quad = quadFromContour(cv, contours.get(bi));
    }
  } finally {
    rgba.delete(); src.delete(); mask.delete(); bgd.delete(); fgd.delete();
    bin.delete(); kernel.delete(); contours.delete(); hierarchy.delete();
  }
  onProgress?.(1);

  if (!quad || quad.some((p) => p == null)) return null;
  const inv = 1 / scale;
  return orderCorners(quad.map((p) => ({ x: p.x * inv, y: p.y * inv })));
}

/** A sensible default quad (90% inset) in full-res coords. */
export async function defaultCorners(srcUrl) {
  const img = await loadImage(srcUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const mx = w * 0.06;
  const my = h * 0.06;
  return [
    { x: mx, y: my },
    { x: w - mx, y: my },
    { x: w - mx, y: h - my },
    { x: mx, y: h - my },
  ];
}

/* ===================================================================== */
/*  Scan pipeline: snap the frame to the paper edge → perspective warp →  */
/*  flatten the paper's lighting/colour → straighten bent text lines →   */
/*  finish (white paper, black text, sharpen).                            */
/* ===================================================================== */

const SCAN_MAX = 2400; // long side of the scanned page

/**
 * Pull each side of the user's frame onto the real paper edge if one is
 * close by (within ~2.5% of the photo). Each side is moved as a line — both
 * ends independently along its normal — to where the brightness changes most
 * strongly across it; a side with no clear edge nearby stays where it is.
 */
function snapQuad(cv, canvas, corners) {
  const W = canvas.width;
  const H = canvas.height;
  const k = Math.min(1, 1000 / Math.max(W, H));
  const sw = Math.max(1, Math.round(W * k));
  const sh = Math.max(1, Math.round(H * k));
  const src = cv.imread(canvas);
  const small = new cv.Mat();
  const gray = new cv.Mat();
  const gx = new cv.Mat();
  const gy = new cv.Mat();
  try {
    cv.resize(src, small, new cv.Size(sw, sh), 0, 0, cv.INTER_AREA);
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0);
    cv.Sobel(gray, gx, cv.CV_32F, 1, 0, 3);
    cv.Sobel(gray, gy, cv.CV_32F, 0, 1, 3);
    const GX = gx.data32F;
    const GY = gy.data32F;
    const P = corners.map((p) => ({ x: p.x * k, y: p.y * k }));
    const R = Math.max(6, Math.round(Math.max(sw, sh) * 0.025));
    const N = 90;

    // mean |gradient · normal| along the segment a→b (skipping the ends)
    const score = (a, b, nx, ny) => {
      let s = 0;
      let n = 0;
      for (let i = 4; i < N - 4; i += 1) {
        const t = i / (N - 1);
        const x = Math.round(a.x + (b.x - a.x) * t);
        const y = Math.round(a.y + (b.y - a.y) * t);
        if (x < 1 || y < 1 || x >= sw - 1 || y >= sh - 1) continue;
        const j = y * sw + x;
        s += Math.abs(GX[j] * nx + GY[j] * ny);
        n += 1;
      }
      return n > N / 3 ? s / n : 0;
    };

    const lines = [];
    for (let s = 0; s < 4; s += 1) {
      const a = P[s];
      const b = P[(s + 1) % 4];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const base = score(a, b, nx, ny);
      let best = { s: base, ta: 0, tb: 0 };
      for (let ta = -R; ta <= R; ta += 1.5) {
        for (let tb = -R; tb <= R; tb += 1.5) {
          const v = score(
            { x: a.x + nx * ta, y: a.y + ny * ta },
            { x: b.x + nx * tb, y: b.y + ny * tb },
            nx, ny,
          );
          if (v > best.s) best = { s: v, ta, tb };
        }
      }
      // only move to a clear, real edge (a paper/desk boundary is a strong one)
      const move = best.s > 40 && best.s > base * 1.25;
      lines.push(move
        ? [{ x: a.x + nx * best.ta, y: a.y + ny * best.ta }, { x: b.x + nx * best.tb, y: b.y + ny * best.tb }]
        : [a, b]);
    }

    // corners = where neighbouring sides meet
    const meet = ([p1, p2], [p3, p4]) => {
      const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
      if (Math.abs(d) < 1e-6) return null;
      const u = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
      return { x: p1.x + u * (p2.x - p1.x), y: p1.y + u * (p2.y - p1.y) };
    };
    const out = [];
    for (let i = 0; i < 4; i += 1) {
      const q = meet(lines[(i + 3) % 4], lines[i]);
      // a corner may only move a little — otherwise keep the user's
      if (!q || Math.hypot(q.x - P[i].x, q.y - P[i].y) > R * 1.6) out.push(corners[i]);
      else out.push({ x: Math.min(W, Math.max(0, q.x / k)), y: Math.min(H, Math.max(0, q.y / k)) });
    }
    return out;
  } finally {
    src.delete(); small.delete(); gray.delete(); gx.delete(); gy.delete();
  }
}

/**
 * The paper's own colour at every pixel: shrink, take a local maximum so the
 * ink disappears, smooth, grow back. Dividing by it removes shadows, uneven
 * light and colour casts in one go.
 */
function paperBackground(cv, rgba) {
  const sw = Math.max(16, Math.round(rgba.cols / 8));
  const sh = Math.max(16, Math.round(rgba.rows / 8));
  const small = new cv.Mat();
  const bg = new cv.Mat();
  const ks = Math.max(5, Math.round(Math.min(sw, sh) / 30)) | 1;
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(ks, ks));
  try {
    cv.resize(rgba, small, new cv.Size(sw, sh), 0, 0, cv.INTER_AREA);
    cv.dilate(small, small, kernel);
    cv.medianBlur(small, small, 5);
    cv.GaussianBlur(small, small, new cv.Size(ks * 2 + 1, ks * 2 + 1), 0);
    cv.resize(small, bg, new cv.Size(rgba.cols, rgba.rows), 0, 0, cv.INTER_LINEAR);
  } finally {
    small.delete(); kernel.delete();
  }
  return bg;
}

/** In place: rgba / paper * 255 — white paper, original ink. */
function flattenPaper(cv, rgba) {
  const bg = paperBackground(cv, rgba);
  const d = rgba.data;
  const b = bg.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, (d[i] * 255) / Math.max(24, b[i]));
    d[i + 1] = Math.min(255, (d[i + 1] * 255) / Math.max(24, b[i + 1]));
    d[i + 2] = Math.min(255, (d[i + 2] * 255) / Math.max(24, b[i + 2]));
  }
  bg.delete();
}

/**
 * Least-squares polynomial of degree `deg` through (xs, ys); returns y(x).
 * x is centred and scaled to [-1, 1] so the normal equations stay stable.
 */
function fitPoly(xs, ys, deg) {
  const n = xs.length;
  const m = deg + 1;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const sx = Math.max(1, Math.max(...xs.map((v) => Math.abs(v - mx))));
  const A = Array.from({ length: m }, () => new Float64Array(m + 1));
  for (let i = 0; i < n; i += 1) {
    const u = (xs[i] - mx) / sx;
    const pw = [1];
    for (let p = 1; p < 2 * m; p += 1) pw.push(pw[p - 1] * u);
    for (let r = 0; r < m; r += 1) {
      for (let c = 0; c < m; c += 1) A[r][c] += pw[r + c];
      A[r][m] += ys[i] * pw[r];
    }
  }
  for (let c = 0; c < m; c += 1) {
    let p = c;
    for (let r = c + 1; r < m; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    if (Math.abs(A[c][c]) < 1e-9) return null;
    for (let r = 0; r < m; r += 1) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= m; k += 1) A[r][k] -= f * A[c][k];
    }
  }
  const coef = A.map((row, i) => row[m] / row[i]);
  return (x) => {
    const u = (x - mx) / sx;
    let y = 0;
    for (let i = m - 1; i >= 0; i -= 1) y = y * u + coef[i];
    return y;
  };
}

/**
 * Straighten bent text lines (a curled or folded page). Finds each line of
 * text, fits a curve through it, and remaps the page so every line runs
 * straight — rows between lines are interpolated. Returns a new Mat, or null
 * if the page has too few clear lines or is already straight.
 */
function straightenLines(cv, rgba) {
  const W = rgba.cols;
  const H = rgba.rows;
  const k = Math.min(1, 1100 / W);
  const sw = Math.round(W * k);
  const sh = Math.round(H * k);
  const small = new cv.Mat();
  const gray = new cv.Mat();
  const bin = new cv.Mat();
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const cents = new cv.Mat();
  const kClose = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(Math.max(9, Math.round(sw / 45)), 1));
  const kOpen = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 2));
  let lines = [];
  try {
    cv.resize(rgba, small, new cv.Size(sw, sh), 0, 0, cv.INTER_AREA);
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, kClose); // words -> line blobs
    cv.morphologyEx(bin, bin, cv.MORPH_OPEN, kOpen);
    const n = cv.connectedComponentsWithStats(bin, labels, stats, cents, 8, cv.CV_32S);
    const st = stats.data32S;
    const keep = new Int32Array(n).fill(-1);
    for (let i = 1; i < n; i += 1) {
      const w = st[i * 5 + 2];
      const h = st[i * 5 + 3];
      if (w > sw * 0.22 && h < sh * 0.05 && w / Math.max(1, h) > 7) {
        keep[i] = lines.length;
        lines.push({ x0: st[i * 5], x1: st[i * 5] + w, sum: new Float64Array(Math.ceil(sw / 8) + 1), cnt: new Uint32Array(Math.ceil(sw / 8) + 1) });
      }
    }
    if (lines.length < 4) return null;
    const L = labels.data32S;
    for (let y = 0; y < sh; y += 1) {
      const row = y * sw;
      for (let x = 0; x < sw; x += 1) {
        const id = keep[L[row + x]];
        if (id >= 0) {
          const bi = x >> 3;
          lines[id].sum[bi] += y;
          lines[id].cnt[bi] += 1;
        }
      }
    }
  } finally {
    small.delete(); gray.delete(); bin.delete(); labels.delete(); stats.delete(); cents.delete();
    kClose.delete(); kOpen.delete();
  }

  // a curve through each line; drop lines that don't fit a smooth curve
  const fitted = [];
  for (const ln of lines) {
    const xs = [];
    const ys = [];
    for (let bi = 0; bi < ln.cnt.length; bi += 1) {
      if (ln.cnt[bi] >= 2) { xs.push(bi * 8 + 4); ys.push(ln.sum[bi] / ln.cnt[bi]); }
    }
    if (xs.length < 6) continue;
    // long lines may bend in an S (a fold), short ones only arc
    const deg = ln.x1 - ln.x0 > sw * 0.5 && xs.length >= 14 ? 3 : 2;
    let f = fitPoly(xs, ys, deg);
    if (!f) continue;
    const res = xs.map((x, i) => Math.abs(f(x) - ys[i]));
    const ok = xs.map((_, i) => res[i] < 3);
    if (ok.filter(Boolean).length >= 6 && ok.some((v) => !v)) {
      f = fitPoly(xs.filter((_, i) => ok[i]), ys.filter((_, i) => ok[i]), deg) || f;
    }
    const target = ys.reduce((s, v) => s + v, 0) / ys.length;
    fitted.push({ f, x0: ln.x0, x1: ln.x1, target });
  }
  if (fitted.length < 4) return null;
  fitted.sort((a, b) => a.target - b.target);

  // offset grid (analysis scale): source y = dest y + offset(x, y)
  const G = 16;
  const gw = Math.ceil(sw / G) + 1;
  const gh = Math.ceil(sh / G) + 1;
  const grid = new Float32Array(gw * gh);
  let maxOff = 0;
  const reach = sw * 0.12; // how far beyond a line's ends its curve is trusted
  for (let gxi = 0; gxi < gw; gxi += 1) {
    const x = Math.min(sw - 1, gxi * G);
    const pts = [];
    for (const ln of fitted) {
      const xc = Math.min(ln.x1, Math.max(ln.x0, x));
      if (Math.abs(xc - x) > reach) continue;
      pts.push({ t: ln.target, o: ln.f(xc) - ln.target });
    }
    for (let gyi = 0; gyi < gh; gyi += 1) {
      const y = gyi * G;
      let o = 0;
      if (pts.length) {
        if (y <= pts[0].t) o = pts[0].o;
        else if (y >= pts[pts.length - 1].t) o = pts[pts.length - 1].o;
        else {
          for (let i = 1; i < pts.length; i += 1) {
            if (y <= pts[i].t) {
              const a = pts[i - 1];
              const b = pts[i];
              const u = (y - a.t) / Math.max(1e-6, b.t - a.t);
              o = a.o + (b.o - a.o) * u;
              break;
            }
          }
        }
      }
      grid[gyi * gw + gxi] = o;
      maxOff = Math.max(maxOff, Math.abs(o));
    }
  }
  // nothing worth fixing, or something implausible
  if (maxOff < 1.2 || maxOff > sh * 0.08) return null;

  const g = cv.matFromArray(gh, gw, cv.CV_32F, Array.from(grid));
  const off = new cv.Mat();
  const mapX = new cv.Mat(H, W, cv.CV_32F);
  const mapY = new cv.Mat(H, W, cv.CV_32F);
  const out = new cv.Mat();
  try {
    cv.GaussianBlur(g, g, new cv.Size(5, 5), 0);
    cv.resize(g, off, new cv.Size(W, H), 0, 0, cv.INTER_CUBIC);
    const O = off.data32F;
    const MX = mapX.data32F;
    const MY = mapY.data32F;
    const inv = 1 / k;
    for (let y = 0; y < H; y += 1) {
      const row = y * W;
      for (let x = 0; x < W; x += 1) {
        MX[row + x] = x;
        MY[row + x] = y + O[row + x] * inv;
      }
    }
    cv.remap(rgba, out, mapX, mapY, cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar());
    return out;
  } catch (e) {
    out.delete();
    return null;
  } finally {
    g.delete(); off.delete(); mapX.delete(); mapY.delete();
  }
}

/** Percentile of 8-bit luminance (0..1). */
function lumaPercentile(d, p) {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < d.length; i += 16) { // every 4th pixel is plenty
    hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8] += 1;
    n += 1;
  }
  let acc = 0;
  for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= n * p) return v; }
  return 255;
}

/**
 * Whiten leftovers of the desk around the page (a wavy paper edge, a corner
 * that was outside the frame): dark marks that touch the border and stay
 * inside the outer ~6% strip. Real text never touches the edge, so it stays.
 */
function cleanBorders(cv, rgba) {
  const W = rgba.cols;
  const H = rgba.rows;
  const gray = new cv.Mat();
  const bin = new cv.Mat();
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const cents = new cv.Mat();
  try {
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, bin, 140, 255, cv.THRESH_BINARY_INV);
    const n = cv.connectedComponentsWithStats(bin, labels, stats, cents, 8, cv.CV_32S);
    const st = stats.data32S;
    const band = Math.round(Math.min(W, H) * 0.06);
    const wipe = new Uint8Array(n);
    let any = false;
    for (let i = 1; i < n; i += 1) {
      const x = st[i * 5];
      const y = st[i * 5 + 1];
      const w = st[i * 5 + 2];
      const h = st[i * 5 + 3];
      const top = y === 0 && y + h <= band;
      const bottom = y + h >= H && y >= H - band;
      const left = x === 0 && x + w <= band;
      const right = x + w >= W && x >= W - band;
      if (top || bottom || left || right) { wipe[i] = 1; any = true; }
    }
    if (!any) return;
    const L = labels.data32S;
    const d = rgba.data;
    for (let p = 0; p < L.length; p += 1) {
      if (wipe[L[p]]) { const j = p * 4; d[j] = 255; d[j + 1] = 255; d[j + 2] = 255; }
    }
  } finally {
    gray.delete(); bin.delete(); labels.delete(); stats.delete(); cents.delete();
  }
}

/**
 * Finish a flattened page. auto: white paper, black text, colour kept only
 * where it is real (ink, stamps); grey: neutral; colour: gentle; bw: pure
 * black and white.
 */
function finishPage(cv, rgba, mode) {
  const d = rgba.data;
  if (mode === 'bw') {
    const g = new cv.Mat();
    cv.cvtColor(rgba, g, cv.COLOR_RGBA2GRAY);
    cv.threshold(g, g, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    cv.cvtColor(g, rgba, cv.COLOR_GRAY2RGBA);
    g.delete();
    cleanBorders(cv, rgba);
    return;
  }
  // levels: darkest ~0.5% of the page -> black, near-white paper -> white
  const lo = Math.min(110, lumaPercentile(d, 0.005));
  const hi = mode === 'colour' ? 248 : 236;
  const gamma = mode === 'colour' ? 1.1 : 1.35; // >1 deepens mid-tones (text)
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v += 1) {
    const t = Math.min(1, Math.max(0, (v - lo) / Math.max(1, hi - lo)));
    lut[v] = Math.round(255 * t ** gamma);
  }
  for (let i = 0; i < d.length; i += 4) {
    let r = lut[d[i]];
    let gg = lut[d[i + 1]];
    let b = lut[d[i + 2]];
    if (mode === 'grey' || mode === 'auto') {
      const y = (r * 77 + gg * 150 + b * 29) >> 8;
      // auto keeps clearly coloured ink/stamps; tinted greys become neutral
      const sat = Math.max(r, gg, b) - Math.min(r, gg, b);
      const keep = mode === 'auto' ? Math.min(1, Math.max(0, (sat - 28) / 40)) : 0;
      r = y + (r - y) * keep;
      gg = y + (gg - y) * keep;
      b = y + (b - y) * keep;
    }
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;
  }
  // unsharp mask for crisp text
  const blur = new cv.Mat();
  cv.GaussianBlur(rgba, blur, new cv.Size(0, 0), 1.1);
  cv.addWeighted(rgba, 1.6, blur, -0.6, 0, rgba);
  blur.delete();
  // keep alpha opaque after the arithmetic
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  cleanBorders(cv, rgba);
}

/**
 * Warp `corners` (full-res coords, TL,TR,BR,BL) to a straight page and
 * enhance it. mode: 'auto' | 'colour' | 'grey' | 'bw' | 'original'.
 * opts.snap: pull the frame onto the nearest real paper edge (default on)
 * opts.dewarp: straighten bent text lines (default on)
 * @returns {Promise<{blob:Blob, width:number, height:number, snapped:boolean, dewarped:boolean}>}
 */
export async function scanPage(srcUrl, corners, mode = 'auto', { snap = true, dewarp = true } = {}) {
  const cv = await getCv();
  const img = await loadImage(srcUrl);
  const { canvas, scale } = drawToCanvas(img, SCAN_MAX);
  const user = corners.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const c = snap ? snapQuad(cv, canvas, user) : user;
  const snapped = c.some((p, i) => Math.hypot(p.x - user[i].x, p.y - user[i].y) > 1);
  const [tl, tr, br, bl] = c;

  const outW = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
  const outH = Math.round(Math.max(dist(tl, bl), dist(tr, br)));

  const src = cv.imread(canvas);
  let page = new cv.Mat();
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  let dewarped = false;

  const out = document.createElement('canvas');
  try {
    cv.warpPerspective(src, page, M, new cv.Size(outW, outH), cv.INTER_CUBIC, cv.BORDER_REPLICATE, new cv.Scalar());
    if (mode !== 'original') flattenPaper(cv, page);
    if (dewarp) {
      const straight = straightenLines(cv, page);
      if (straight) { page.delete(); page = straight; dewarped = true; }
    }
    if (mode !== 'original') finishPage(cv, page, mode);
    cv.imshow(out, page);
  } finally {
    src.delete(); page.delete(); srcTri.delete(); dstTri.delete(); M.delete();
  }

  const type = mode === 'bw' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((res) => out.toBlob((b) => res(b), type, 0.92));
  return { blob, width: out.width, height: out.height, snapped, dewarped };
}
