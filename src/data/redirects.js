/**
 * Old / alternate URLs → their canonical page. Used in two places:
 *  - the app's router (src/routes.jsx), for in-app navigation;
 *  - vercel.json "redirects", so a crawler or a hard refresh gets a real 308.
 *    Run `node scripts/sync-vercel.mjs` after editing this file — the build
 *    (scripts/prerender.mjs) fails if vercel.json is out of date.
 */

// slug -> canonical slug (a tool id or a landing page slug)
export const TOOL_ALIASES = {
  // PDF editor
  'edit-pdf-text': 'pdf-editor',
  'edit-pdf': 'pdf-editor',
  'pdf-edit': 'pdf-editor',
  'advanced-pdf-editor': 'pdf-editor',
  'add-text-to-pdf': 'pdf-editor',
  'add-image-to-pdf': 'pdf-editor',
  // fill & sign
  'sign-pdf': 'fill-sign',
  'esign-pdf': 'fill-sign',
  'e-sign-pdf': 'fill-sign',
  'add-signature-to-pdf': 'fill-sign',
  'fill-pdf': 'fill-sign',
  'fill-and-sign-pdf': 'fill-sign',
  // compress PDF
  'compress-pdf': 'pdf-compressor',
  'pdf-compress': 'pdf-compressor',
  'reduce-pdf-size': 'pdf-compressor',
  'pdf-size-reducer': 'pdf-compressor',
  // pages
  'rotate-pdf-pages': 'rotate-pdf',
  'delete-pdf-pages': 'delete-pages',
  'remove-pdf-pages': 'delete-pages',
  'reorder-pdf-pages': 'organize-pdf',
  'reorder-pdf': 'organize-pdf',
  'rearrange-pdf-pages': 'organize-pdf',
  'add-watermark': 'watermark-pdf',
  // conversions
  'jpg-to-pdf': 'image-to-pdf',
  'jpeg-to-pdf': 'image-to-pdf',
  'png-to-pdf': 'image-to-pdf',
  'images-to-pdf': 'image-to-pdf',
  'pdf-to-jpeg': 'pdf-to-jpg',
  'pdf-to-image': 'pdf-to-jpg',
  'pdf-to-png': 'pdf-to-jpg',
  'ppt-to-pdf': 'powerpoint-to-pdf',
  'pptx-to-pdf': 'powerpoint-to-pdf',
  'xls-to-pdf': 'excel-to-pdf',
  'xlsx-to-pdf': 'excel-to-pdf',
  'txt-to-pdf': 'text-to-pdf',
  // images
  'background-remover': 'remove-background',
  'remove-bg': 'remove-background',
  'increase-image-size-in-kb': 'increase-image-size',
  'increase-photo-size': 'increase-image-size',
  'increase-jpg-size': 'increase-image-size',
  'make-image-bigger-kb': 'increase-image-size',
  'passport-photo-resizer': 'passport-photo',
  'passport-photo-maker': 'passport-photo',
  'passport-size-photo-maker': 'passport-photo',
  // exam / form photos
  'photo-signature-resizer': 'exam-photo-resizer',
  'exam-photo': 'exam-photo-resizer',
  'photo-resizer-in-kb': 'exam-photo-resizer',
  'resize-image-in-kb': 'exam-photo-resizer',
  'exam-photo-signature': 'exam-photo-resizer',
  'photo-background-changer': 'exam-photo-resizer',
  'sbi-photo-resizer': 'ibps-photo-resizer',
  'bank-exam-photo-resizer': 'ibps-photo-resizer',
  'railway-photo-resizer': 'rrb-photo-resizer',
  'nta-photo-resizer': 'neet-photo-resizer',
  'jee-photo-resizer': 'neet-photo-resizer',
  'signature-resize': 'signature-resizer',
  'thumb-impression-resizer': 'signature-resizer',
};

// "<prefix>-to-<n>kb|mb" families that mean the same as a landing page size.
// jpg/jpeg-to-Nkb were their own pages before; they are the same job as
// "compress image to N KB" (whose output is a JPG), so they now redirect.
export const SIZE_REDIRECTS = [
  {
    prefixes: ['jpg', 'jpeg', 'resize-image', 'reduce-image-size', 'image-compressor', 'photo-resize', 'compress-photo', 'compress-jpg', 'reduce-jpg-size'],
    to: 'compress-image-to-',
  },
  {
    prefixes: ['reduce-pdf', 'reduce-pdf-size', 'pdf-compressor', 'pdf-size-reducer'],
    to: 'compress-pdf-to-',
  },
];

/** Canonical slug for a size-family alias, e.g. "jpg-to-20kb" -> "compress-image-to-20kb". */
export function sizeRedirect(slug) {
  const s = (slug || '').toLowerCase();
  for (const { prefixes, to } of SIZE_REDIRECTS) {
    for (const p of prefixes) {
      const m = new RegExp(`^${p}-to-(\\d+[km]b)$`).exec(s);
      if (m) return `${to}${m[1]}`;
    }
  }
  return null;
}
