// Pure font-name helpers, kept apart from pdfTextEdit.js so code that only
// needs a name (PDF to Word) doesn't pull in pdf-lib with it.

/** Strip the 6-letter subset prefix: "ABCDEF+Calibri-Bold" -> "Calibri-Bold". */
export const cleanFontName = (base) => String(base || '').replace(/^[A-Z]{6}\+/, '');

/**
 * The real family name behind a PDF font name, as installed fonts call it:
 * "ABCDEF+BookmanOldStyle-Bold" -> "Bookman Old Style",
 * "TimesNewRomanPS-BoldMT" -> "Times New Roman", "SegoeUI" -> "Segoe UI".
 */
export function realFamilyName(base) {
  let s = cleanFontName(base).split(',')[0].split('-')[0];
  s = s.replace(/(PSMT|PS|MT)$/, '');
  for (let i = 0; i < 3; i += 1) s = s.replace(/(Bold|Italic|Oblique|Regular)$/, '');
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').trim();
}

/** Standard PDF fonts only cover WinAnsi — map common keyboard/autocorrect punctuation into it. */
export const winAnsiSafe = (s) => String(s)
  .replace(/[‘’‚′]/g, "'")
  .replace(/[“”„″]/g, '"')
  .replace(/[–—−]/g, '-')
  .replace(/…/g, '...')
  .replace(/\u00A0/g, ' ')
  .replace(/[•●]/g, '·');
