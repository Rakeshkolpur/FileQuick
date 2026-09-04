// Edge refinement for cut-outs — the segmentation model gives a slightly loose,
// colour-contaminated mask, which shows as a pale halo around hair once you drop
// a new background behind it. This tightens the alpha by ~1 px, feathers it, and
// replaces the RGB of every semi-transparent pixel with the nearest solid
// foreground colour so translucent hair blends into whatever background it lands
// on instead of carrying the old one. Pure typed-array maths — no OpenCV.

const loadImage = (src) =>
  new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Could not read the cut-out.'));
    im.src = src;
  });

// separable box blur on a Float32 plane (radius in px, a couple of passes ≈ gaussian)
function boxBlur(plane, w, h, radius, passes = 2) {
  let src = plane;
  const r = Math.max(1, Math.round(radius));
  for (let p = 0; p < passes; p += 1) {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    const norm = 1 / (2 * r + 1);
    for (let y = 0; y < h; y += 1) {
      let acc = 0;
      const row = y * w;
      for (let x = -r; x <= r; x += 1) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x += 1) {
        tmp[row + x] = acc * norm;
        const add = src[row + Math.min(w - 1, x + r + 1)];
        const sub = src[row + Math.max(0, x - r)];
        acc += add - sub;
      }
    }
    for (let x = 0; x < w; x += 1) {
      let acc = 0;
      for (let y = -r; y <= r; y += 1) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y += 1) {
        out[y * w + x] = acc * norm;
        const add = tmp[Math.min(h - 1, y + r + 1) * w + x];
        const sub = tmp[Math.max(0, y - r) * w + x];
        acc += add - sub;
      }
    }
    src = out;
  }
  return src;
}

// 1-px alpha erosion (min of the plus-neighbourhood)
function erode(a, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      let m = a[i];
      if (x > 0) m = Math.min(m, a[i - 1]);
      if (x < w - 1) m = Math.min(m, a[i + 1]);
      if (y > 0) m = Math.min(m, a[i - w]);
      if (y < h - 1) m = Math.min(m, a[i + w]);
      out[i] = m;
    }
  }
  return out;
}

/**
 * @param {Blob|string} cutout  a transparent PNG (blob or object/data URL)
 * @param {{choke?:number, feather?:number}} [opts]
 * @returns {Promise<Blob>} a cleaner transparent PNG
 */
export async function refineCutout(cutout, opts = {}) {
  const choke = opts.choke ?? 1;
  const feather = opts.feather ?? 1;
  const url = typeof cutout === 'string' ? cutout : URL.createObjectURL(cutout);
  const img = await loadImage(url);
  if (typeof cutout !== 'string') URL.revokeObjectURL(url);

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const n = w * h;

  const A0 = new Float32Array(n);
  for (let i = 0; i < n; i += 1) A0[i] = d[i * 4 + 3] / 255;

  // tighten + soften the alpha
  let a = A0;
  for (let s = 0; s < choke; s += 1) a = erode(a, w, h);
  if (feather > 0) a = boxBlur(a, w, h, feather, 2);

  // nearest solid-foreground colour: blur the RGB weighted by "was this pixel
  // solidly foreground", then normalise
  const wr = new Float32Array(n);
  const wg = new Float32Array(n);
  const wb = new Float32Array(n);
  const ww = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const solid = A0[i] > 0.9 ? 1 : 0;
    wr[i] = d[i * 4] * solid;
    wg[i] = d[i * 4 + 1] * solid;
    wb[i] = d[i * 4 + 2] * solid;
    ww[i] = solid;
  }
  const rad = Math.max(6, Math.round(Math.min(w, h) / 120));
  const R = boxBlur(wr, w, h, rad, 2);
  const G = boxBlur(wg, w, h, rad, 2);
  const B = boxBlur(wb, w, h, rad, 2);
  const Wt = boxBlur(ww, w, h, rad, 2);

  for (let i = 0; i < n; i += 1) {
    // drop faint stray pixels (isolated wisps that still carry old background)
    const av = a[i] < 0.12 ? 0 : Math.max(0, Math.min(1, a[i]));
    d[i * 4 + 3] = Math.round(av * 255);
    if (A0[i] <= 0.9 && Wt[i] > 1e-4) {
      // semi-transparent edge → swap in the local foreground colour
      d[i * 4] = R[i] / Wt[i];
      d[i * 4 + 1] = G[i] / Wt[i];
      d[i * 4 + 2] = B[i] / Wt[i];
    }
  }
  ctx.putImageData(id, 0, 0);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
