// Document-scanner image ops built on OpenCV.js: find the page in a photo,
// straighten it with a perspective warp, and clean it up so it reads like a
// real scan. Everything runs on the device.

import { getCv } from './opencvLoader';

const DETECT_EDGE = 800;   // downscale for corner detection (speed)
const OUTPUT_MAX = 2200;   // cap the warped output's long side

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

function odd(n) {
  const v = Math.max(3, Math.round(n));
  return v % 2 === 0 ? v + 1 : v;
}

// out = src / blur(src) * 255 — divides away uneven lighting so paper goes
// white and the ink keeps its contrast. `punch` adds a mild S-curve + white
// point for the "Auto" look; `colour` keeps hue, otherwise greyscale.
function flattenLighting(cv, mat, { colour = true, punch = false } = {}) {
  const rgb = new cv.Mat();
  cv.cvtColor(mat, rgb, cv.COLOR_RGBA2RGB);

  const blur = new cv.Mat();
  const k = odd(Math.max(rgb.cols, rgb.rows) / 12);
  cv.GaussianBlur(rgb, blur, new cv.Size(k, k), 0);

  const f = new cv.Mat();
  const bf = new cv.Mat();
  rgb.convertTo(f, cv.CV_32F);
  blur.convertTo(bf, cv.CV_32F);
  const ones = cv.Mat.ones(bf.rows, bf.cols, bf.type());
  cv.add(bf, ones, bf); // avoid divide-by-zero

  const div = new cv.Mat();
  cv.divide(f, bf, div, 255);
  const out8 = new cv.Mat();
  div.convertTo(out8, cv.CV_8U); // saturating cast clamps to [0,255]

  if (punch) {
    // lift the white point (anything ≥ ~200 → 255) and a touch of contrast
    out8.convertTo(out8, -1, 1.15, -18);
  }

  if (colour) {
    cv.cvtColor(out8, mat, cv.COLOR_RGB2RGBA);
  } else {
    const g = new cv.Mat();
    cv.cvtColor(out8, g, cv.COLOR_RGB2GRAY);
    cv.normalize(g, g, 0, 255, cv.NORM_MINMAX);
    cv.cvtColor(g, mat, cv.COLOR_GRAY2RGBA);
    g.delete();
  }

  rgb.delete(); blur.delete(); f.delete(); bf.delete(); ones.delete(); div.delete(); out8.delete();
}

function toBW(cv, mat) {
  const g = new cv.Mat();
  cv.cvtColor(mat, g, cv.COLOR_RGBA2GRAY);
  // even out lighting first so the threshold block size isn't fighting shadows
  const blur = new cv.Mat();
  const bk = odd(Math.max(g.cols, g.rows) / 12);
  cv.GaussianBlur(g, blur, new cv.Size(bk, bk), 0);
  const gf = new cv.Mat();
  const bff = new cv.Mat();
  g.convertTo(gf, cv.CV_32F);
  blur.convertTo(bff, cv.CV_32F);
  const ones = cv.Mat.ones(bff.rows, bff.cols, bff.type());
  cv.add(bff, ones, bff);
  cv.divide(gf, bff, gf, 255);
  gf.convertTo(g, cv.CV_8U);

  const k = odd(Math.max(g.cols, g.rows) / 30);
  cv.adaptiveThreshold(g, g, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, k, 10);
  // drop specks
  cv.medianBlur(g, g, 3);
  cv.cvtColor(g, mat, cv.COLOR_GRAY2RGBA);
  g.delete(); blur.delete(); gf.delete(); bff.delete(); ones.delete();
}

/**
 * Warp `corners` (full-res coords, TL,TR,BR,BL) to a straight rectangle and
 * enhance. mode: 'auto' | 'colour' | 'grey' | 'bw' | 'original'.
 * @returns {Promise<{blob:Blob, width:number, height:number}>}
 */
export async function scanPage(srcUrl, corners, mode = 'auto') {
  const cv = await getCv();
  const img = await loadImage(srcUrl);
  const { canvas, scale } = drawToCanvas(img, OUTPUT_MAX);
  const c = corners.map((p) => ({ x: p.x * scale, y: p.y * scale }));
  const [tl, tr, br, bl] = c;

  const outW = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
  const outH = Math.round(Math.max(dist(tl, bl), dist(tr, br)));

  const src = cv.imread(canvas);
  const dstMat = new cv.Mat();
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);

  const out = document.createElement('canvas');
  try {
    cv.warpPerspective(src, dstMat, M, new cv.Size(outW, outH), cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar());
    if (mode === 'bw') toBW(cv, dstMat);
    else if (mode === 'grey') flattenLighting(cv, dstMat, { colour: false });
    else if (mode === 'auto') flattenLighting(cv, dstMat, { colour: true, punch: true });
    else if (mode === 'colour') flattenLighting(cv, dstMat, { colour: true });
    // 'original' → leave the warp as-is
    cv.imshow(out, dstMat);
  } finally {
    src.delete(); dstMat.delete(); srcTri.delete(); dstTri.delete(); M.delete();
  }

  const type = mode === 'bw' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((res) => out.toBlob((b) => res(b), type, 0.9));
  return { blob, width: out.width, height: out.height };
}
