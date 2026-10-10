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
export function toolFileName(source, toolId, ext, part) {
  const name = typeof source === 'string' ? source : source?.name;
  const base = stripExt(name || '').trim() || 'filequick';
  const code = TOOL_CODES[toolId];
  return `${base}${code ? `-${code}` : ''}${part != null && part !== '' ? `-${part}` : ''}.${ext}`;
}
