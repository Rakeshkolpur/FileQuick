// Pixel helpers shared by the on-device PDF compressor and its worker.

/** Undo PNG row filters (PDF /Predictor 10-15) in place of a new buffer. */
export function unfilterPng(data, rowBytes, bpp) {
  const rows = Math.floor(data.length / (rowBytes + 1));
  const out = new Uint8Array(rows * rowBytes);
  for (let y = 0; y < rows; y += 1) {
    const type = data[y * (rowBytes + 1)];
    const src = y * (rowBytes + 1) + 1;
    const dst = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const a = x >= bpp ? out[dst + x - bpp] : 0;
      const up = y ? out[dst + x - rowBytes] : 0;
      let v = data[src + x];
      if (type === 1) v += a;
      else if (type === 2) v += up;
      else if (type === 3) v += (a + up) >> 1;
      else if (type === 4) {
        const c = x >= bpp && y ? out[dst + x - rowBytes - bpp] : 0;
        const p = a + up - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      } else if (type !== 0) return null;
      out[dst + x] = v;
    }
  }
  return out;
}

/** Raw PDF image samples (1 or 3 channels, optional PNG filters) -> RGBA for ImageData. */
export function rgbaFromRaw(raw, { w, h, channels, predictor }) {
  const rowBytes = w * channels;
  const px = predictor >= 10 ? unfilterPng(raw, rowBytes, channels) : raw;
  if (!px || px.length < rowBytes * h) throw new Error('bad image data');
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, s = 0, o = 0; i < w * h; i += 1, s += channels, o += 4) {
    rgba[o] = px[s];
    rgba[o + 1] = channels === 3 ? px[s + 1] : px[s];
    rgba[o + 2] = channels === 3 ? px[s + 2] : px[s];
    rgba[o + 3] = 255;
  }
  return rgba;
}

export function scaledSize(w, h, cap) {
  const s = Math.min(1, cap / Math.max(w, h));
  return { W: Math.max(1, Math.round(w * s)), H: Math.max(1, Math.round(h * s)) };
}
