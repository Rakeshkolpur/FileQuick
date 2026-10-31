/**
 * Pass one File, or several, to the next tool within the app (no reload,
 * original names kept). The File Converter hub and the home cards hand files
 * over, and the next tool's upload area (FileDropzone) picks them up as if they
 * had been dropped there. Only an in-app navigation carries them; they expire
 * after a minute.
 */
import { screenFiles } from './fileValidation';

let pending = null; // { files, at }

export function handOffFile(fileOrFiles) {
  const files = [].concat(fileOrFiles || []).filter(Boolean);
  pending = files.length ? { files, at: Date.now() } : null;
}

/** Take the handed-off files that match `accept` (empty when there are none). */
export function takeHandedFiles(accept) {
  if (!pending || Date.now() - pending.at > 60000) { pending = null; return []; }
  const { accepted } = screenFiles(pending.files, { accept: accept || undefined });
  if (!accepted.length) return [];
  pending = null;
  return accepted;
}

/** Same, for a tool that takes one file. */
export const takeHandedFile = (accept) => takeHandedFiles(accept)[0] || null;
