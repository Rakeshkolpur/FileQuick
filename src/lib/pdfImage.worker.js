// Re-encodes one PDF image off the main thread. This is what makes on-device
// compression quick: on the main page a canvas encode waits for idle time (a
// flat ~1 s per image whenever the page isn't drawing), here it just runs.
import { rgbaFromRaw, scaledSize } from './pdfImageCodec';

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

self.onmessage = async ({ data: job }) => {
  try {
    const bmp = job.kind === 'jpeg'
      ? await createImageBitmap(new Blob([job.bytes], { type: 'image/jpeg' }))
      : await createImageBitmap(new ImageData(rgbaFromRaw(await inflate(job.bytes), job), job.w, job.h));
    if (bmp.width !== job.w || bmp.height !== job.h) { bmp.close(); throw new Error('size mismatch'); }
    const { W, H } = scaledSize(job.w, job.h, job.cap);
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, W, H);
    bmp.close();
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: job.quality / 100 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    self.postMessage({ id: job.id, bytes, w: W, h: H }, [bytes.buffer]);
  } catch (e) {
    self.postMessage({ id: job.id, failed: true });
  }
};
