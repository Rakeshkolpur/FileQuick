/**
 * Front-door checks for every file a visitor drops, picks or pastes.
 *
 * Threat model: the working tools have NO backend — files are parsed and
 * transformed entirely in the visitor's own browser and never uploaded. So a
 * hostile file can't reach a server, be stored, or be served to anyone else.
 * The realistic damage is:
 *   - a huge file exhausting the tab's memory (a self-inflicted DoS), and
 *   - a script-bearing SVG running in the page if it were ever inlined.
 * These checks cover both, plus reject obviously wrong file types early with a
 * clear message instead of letting a parser throw a cryptic error.
 *
 * (PDF parsing is additionally hardened in lib/pdfjs.js with
 * `isEvalSupported: false`, the documented mitigation for malicious-PDF JS.)
 */

// Per-category size ceilings, in MB. These protect a *browser tab* from running
// out of memory — the desktop app (window.fq) has no such limit and lifts them.
export const SIZE_LIMIT_MB = {
  pdf: 50,
  image: 30,
  office: 25, // docx / pptx / xlsx and friends
  text: 10,
  default: 40,
};

const isDesktopApp = () =>
  typeof window !== 'undefined' && !!window.fq && window.fq.isDesktop === true;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif)$/i;
const OFFICE_EXT = /\.(docx?|pptx?|ppsx?|xlsx?m?|od[tsp]|rtf)$/i;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|log|json|xml|ya?ml|ini|text)$/i;

const isSvg = (file) =>
  /svg/i.test(file.type || '') || /\.svg$/i.test(file.name || '');

/** Best-effort category from the MIME type, falling back to the extension. */
export const fileCategory = (file) => {
  const t = (file.type || '').toLowerCase();
  const n = (file.name || '').toLowerCase();
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (t.startsWith('image/') || IMAGE_EXT.test(n)) return 'image';
  if (/officedocument|ms-(word|excel|powerpoint)|opendocument|msword/.test(t) || OFFICE_EXT.test(n)) return 'office';
  if (t.startsWith('text/') || TEXT_EXT.test(n)) return 'text';
  return 'other';
};

/** Turn an accept="" string into a predicate over the file's category / type. */
const acceptMatcher = (accept) => {
  if (!accept || !accept.trim()) return () => true;
  const parts = accept.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const wants = {
    image: parts.some((p) => p === 'image/*' || p.startsWith('image/')),
    pdf: parts.some((p) => p === 'application/pdf' || p === '.pdf'),
    office: parts.some((p) => /officedocument|ms-(word|excel|powerpoint)|opendocument|msword/.test(p) || OFFICE_EXT.test(p)),
    text: parts.some((p) => p === 'text/*' || p.startsWith('text/') || TEXT_EXT.test(p)),
  };
  return (file) => {
    const cat = fileCategory(file);
    if (wants[cat]) return true;
    // exact type / extension fallback for anything category logic missed
    const type = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    return parts.some((p) => (p.startsWith('.') ? name.endsWith(p) : type === p));
  };
};

/**
 * Screen a FileList / array before a tool touches it.
 * @returns {{ accepted: File[], rejected: {file: File, reason: string}[] }}
 */
export function screenFiles(list, { accept, maxMB } = {}) {
  const files = [...(list || [])].filter(Boolean);
  const matchesAccept = acceptMatcher(accept);
  const accepted = [];
  const rejected = [];

  const desktop = isDesktopApp();

  for (const file of files) {
    const cat = fileCategory(file);
    const cap = desktop ? Infinity : (maxMB || SIZE_LIMIT_MB[cat] || SIZE_LIMIT_MB.default);

    if (!file.size) {
      rejected.push({ file, reason: `"${file.name || 'That file'}" is empty.` });
    } else if (isSvg(file)) {
      rejected.push({ file, reason: 'SVG files aren’t supported.' });
    } else if (file.size > cap * 1024 * 1024) {
      rejected.push({
        file,
        reason: `"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB — the limit is ${cap} MB.`,
      });
    } else if (accept && !matchesAccept(file)) {
      rejected.push({ file, reason: `"${file.name}" isn’t a file type this tool can open.` });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}

/** Join the rejection reasons into one line (or '' when nothing was rejected). */
export const rejectionMessage = (rejected) =>
  (rejected && rejected.length ? rejected.map((r) => r.reason).join(' ') : '');
