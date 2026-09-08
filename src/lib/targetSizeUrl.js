/**
 * Dynamic "compress <format> to <size>" URLs — /jpg-to-20kb, /png-to-50kb, …
 *
 * One parser, one config. The route feeds the parsed values straight into the
 * existing Image Reduce Size component (src/components/tools/image/ImageCompress
 * .jsx) — there is no separate per-size tool or engine.
 *
 * To add a format later: extend FORMATS. To add an indexable size: add it to
 * SEO_SIZE_PRESETS (that list, and only that list, goes in the sitemap and the
 * on-page links — every other size still works for visitors but is noindex).
 */

// url token -> { label for headings, image tool output format }
export const FORMATS = {
  jpg: { label: 'JPG', out: 'jpeg' },
  jpeg: { label: 'JPEG', out: 'jpeg' },
  png: { label: 'PNG', out: 'png' },
  webp: { label: 'WebP', out: 'webp' },
};

// Reasonable bounds for an image compression target, in KB.
export const MIN_TARGET_KB = 1;
export const MAX_TARGET_KB = 25 * 1024; // 25 MB — matches the image upload cap

// Only these get a <loc> in the sitemap and a link on the page. Others still
// resolve for users but carry <meta name="robots" content="noindex,follow">.
export const SEO_SIZE_PRESETS = [
  { format: 'jpg', kb: 10 },
  { format: 'jpg', kb: 20 },
  { format: 'jpg', kb: 50 },
  { format: 'jpg', kb: 100 },
  { format: 'jpg', kb: 200 },
  { format: 'jpg', kb: 500 },
];

const SLUG_RE = /^([a-z]+)-to-(\d+)(kb|mb)$/i;

/** A slug that is shaped like one of our size URLs (so a bad one 404s instead
 *  of falling through to the generic "redirect home"). */
export const looksLikeTargetSlug = (slug) =>
  new RegExp(`^(${Object.keys(FORMATS).join('|')})-to-`, 'i').test(slug || '');

/**
 * Parse a slug into compression parameters, or null if it isn't a valid one.
 * @returns {{ format:string, formatLabel:string, outFormat:string,
 *             targetKB:number, unit:'KB'|'MB', slug:string } | null}
 */
export function parseTargetSlug(slug) {
  const m = SLUG_RE.exec(slug || '');
  if (!m) return null;

  const format = m[1].toLowerCase();
  const fmt = FORMATS[format];
  if (!fmt) return null;

  const n = parseInt(m[2], 10);
  if (!Number.isFinite(n) || n <= 0) return null;

  const unit = m[3].toLowerCase() === 'mb' ? 'MB' : 'KB';
  const targetKB = unit === 'MB' ? n * 1024 : n;
  if (targetKB < MIN_TARGET_KB || targetKB > MAX_TARGET_KB) return null;

  return {
    format,
    formatLabel: fmt.label,
    outFormat: fmt.out,
    targetKB,
    unit,
    slug: `${format}-to-${n}${unit.toLowerCase()}`,
  };
}

/** Canonical path for a preset, e.g. { format:'jpg', kb:20 } -> '/jpg-to-20kb'. */
export const presetPath = ({ format, kb }) => `/${format}-to-${kb}kb`;

/** Is this parsed target one of the indexable presets? */
export const isSeoPreset = (p) =>
  !!p && SEO_SIZE_PRESETS.some((s) => s.format === p.format && s.kb === p.targetKB && p.unit === 'KB');

const sizeText = (p) => (p.unit === 'MB' && p.targetKB % 1024 === 0
  ? `${p.targetKB / 1024} MB`
  : `${p.targetKB} KB`);

/** Title / H1 / meta description built from the parsed slug. */
export function targetMeta(p) {
  const size = sizeText(p);
  const F = p.formatLabel;
  return {
    title: `Compress ${F} to ${size} Online Free`,
    h1: `Compress ${F} to ${size}`,
    description: `Compress ${F} images to ${size} online for free. Upload your ${F} image and reduce its file size to ${size} in seconds — no sign-up, nothing uploaded.`,
    // non-preset sizes work for users but shouldn't spawn endless indexable pages
    robots: isSeoPreset(p) ? 'index, follow' : 'noindex, follow',
    path: presetPath({ format: p.format, kb: p.targetKB }),
  };
}

/** How-to + FAQ copy for the on-page SEO block (same shape as data/toolSeo.js). */
export function targetSeoContent(p) {
  const size = sizeText(p);
  const F = p.formatLabel;
  return {
    h1: `How to compress ${F} to ${size}`,
    intro: `This tool lowers the quality of a ${F} image just enough to bring its file size down to ${size}, keeping the same dimensions. It runs entirely in your browser — the image is never uploaded. Free, no sign-up, no watermark.`,
    steps: [
      `Drop your ${F} image (or several) onto the box above.`,
      `The target is already set to ${size} — change it if you need a different size.`,
      'Click Compress. The quality is tuned down until each image fits.',
      `Download the compressed ${F} at ${size}.`,
    ],
    faqs: [
      {
        q: `How do I compress a ${F} to ${size}?`,
        a: `Upload the image here — the target is preset to ${size}. The tool reduces the JPEG quality until the file is at or just under ${size}, then you download it. Dimensions stay the same.`,
      },
      {
        q: `Will the ${F} lose quality?`,
        a: `Some, yes — that's how the file gets smaller at the same dimensions. Smaller targets (10–20 KB) show visible compression; 100 KB and up usually look fine.`,
      },
      {
        q: 'Is my image uploaded to a server?',
        a: 'No. The compression happens on your device with the Canvas API, so the image never leaves your browser.',
      },
      {
        q: 'Can I compress several images at once?',
        a: `Yes — drop multiple ${F} files and they're each compressed to ${size} and downloaded together as a ZIP.`,
      },
    ],
  };
}
