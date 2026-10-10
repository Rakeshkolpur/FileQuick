/**
 * Download file names: the user's own file name plus a short tool code,
 * e.g. "report.pdf" through Remove Pages -> "report-rp.pdf". One code per
 * tool, kept here so every tool names its output the same way.
 */
import { stripExt } from './format';

export const TOOL_CODES = {
  // images
  'resize-image': 'ri',
  'crop-image': 'cr',
  'profile-picture': 'dp',
  'compress-image': 'ci',
  'exam-photo-resizer': 'ex',
  'signature-resizer': 'sr',
  'increase-image-size': 'is',
  'remove-background': 'rb',
  'upscale-image': 'up',
  'document-scanner': 'ds',
  'passport-photo': 'pp',
  'convert-image': 'cv',
  // PDF
  'pdf-compressor': 'cp',
  'merge-pdf': 'mp',
  'split-pdf': 'sp',
  'pdf-editor': 'ed',
  'organize-pdf': 'op',
  'rotate-pdf': 'rt',
  'crop-pdf': 'crp',
  'delete-pages': 'rp',
  'extract-pages': 'xp',
  'extract-images': 'xi',
  'page-numbers': 'pn',
  'watermark-pdf': 'wm',
  'remove-watermark': 'rw',
  'fill-sign': 'fs',
  'extract-text': 'xt',
  'unlock-pdf': 'ul',
  'protect-pdf': 'pr',
  // conversions
  'image-to-pdf': 'i2p',
  'word-to-pdf': 'w2p',
  'powerpoint-to-pdf': 'ppt2p',
  'excel-to-pdf': 'xl2p',
  'text-to-pdf': 't2p',
  'pdf-to-jpg': 'p2j',
  'pdf-to-word': 'p2w',
  'pdf-to-powerpoint': 'p2ppt',
  'pdf-to-excel': 'p2xl',
  'pdf-to-text': 'p2t',
};

/**
 * "<source name>-<tool code>[-<part>].<ext>"
 * @param {string | File | null | undefined} source  original file (or its name)
 * @param {string} toolId
 * @param {string} ext      without the dot
 * @param {string|number} [part]  tells several outputs apart (page number, range …)
 */
// What earlier downloads tacked onto a name — our old long suffixes and the
// tool codes above — so a file that has been through FileQuick before doesn't
// pile them up ("syllabus-pages-removed (1)-rp" -> "syllabus-rp").
const OLD_SUFFIXES = [
  'pages-removed', 'compressed', 'min', 'no-bg', 'rotated', 'signed', 'edited', 'organized',
  'cleaned', 'watermarked', 'numbered', 'protected', 'unlocked', 'cropped', 'crop', 'pages',
  'split', 'enhanced', 'upscaled-\\d+x', 'profile-\\d+', 'images', 'converted',
  '\\d+x\\d+(?:mm)?', '\\d+kb', 'page-\\d+', 'sheet(?:-[a-z0-9]+)*', 'p\\d+(?:-img\\d+)?',
];
const CODES = Object.values(TOOL_CODES).join('|');
const TRAILING = [
  /\s*\(\d+\)$/, // browser duplicate marker: "file (1)"
  new RegExp(`[-_ ](?:${CODES})(?:-(?:p?\\d+(?:-\\d+)*|all|sheet))?$`, 'i'),
  new RegExp(`[-_ ](?:${OLD_SUFFIXES.join('|')})$`, 'i'),
];

/** The user's own name for the file, without what earlier tools added to it. */
export function cleanBaseName(name) {
  let base = stripExt(name || '').trim();
  for (let changed = true; changed;) {
    changed = false;
    for (const re of TRAILING) {
      const next = base.replace(re, '').trim();
      if (next && next !== base) { base = next; changed = true; }
    }
  }
  return base;
}

export function toolFileName(source, toolId, ext, part) {
  const name = typeof source === 'string' ? source : source?.name;
  const base = cleanBaseName(name) || 'filequick';
  const code = TOOL_CODES[toolId];
  return `${base}${code ? `-${code}` : ''}${part != null && part !== '' ? `-${part}` : ''}.${ext}`;
}
