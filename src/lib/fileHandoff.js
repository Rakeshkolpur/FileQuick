/**
 * Pass a File to the next tool within the app (no reload, original name
 * kept). The File Converter hub hands a dropped file over, and the next
 * tool's upload area (FileDropzone) picks it up as if it had been dropped
 * there. Only an in-app navigation carries it; it expires after a minute.
 */
import { screenFiles } from './fileValidation';

let pending = null; // { file, at }

export function handOffFile(file) {
  pending = file ? { file, at: Date.now() } : null;
}

/** Take the handed-off file if there is one and it matches `accept`. */
export function takeHandedFile(accept) {
  if (!pending || Date.now() - pending.at > 60000) { pending = null; return null; }
  const { accepted } = screenFiles([pending.file], { accept: accept || undefined });
  if (!accepted.length) return null;
  pending = null;
  return accepted[0];
}
