/**
 * Write a DPI into a JPEG's JFIF header, so a photo sized in cm / inches
 * (e.g. 3.5 × 4.5 cm at 300 DPI = 413 × 531 px) prints at that physical size.
 * The browser's encoder writes "no unit, 1:1"; we set "dots per inch, dpi:dpi".
 * The pixels are untouched. Returns the blob unchanged if it has no JFIF header.
 */
export async function setJpegDpi(blob, dpi) {
  const d = Math.round(dpi);
  if (!blob || !(d > 0 && d < 65536)) return blob;
  const b = new Uint8Array(await blob.arrayBuffer());
  // FF D8 | FF E0 len(2) "JFIF\0" ver(2) units(1) Xdensity(2) Ydensity(2)
  const isJfif = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b[3] === 0xe0
    && b[6] === 0x4a && b[7] === 0x46 && b[8] === 0x49 && b[9] === 0x46 && b[10] === 0x00;
  if (!isJfif) return blob;
  b[13] = 1; // units: dots per inch
  b[14] = (d >> 8) & 0xff;
  b[15] = d & 0xff;
  b[16] = (d >> 8) & 0xff;
  b[17] = d & 0xff;
  return new Blob([b], { type: 'image/jpeg' });
}
