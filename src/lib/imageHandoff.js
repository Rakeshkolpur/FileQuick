// Hand the image the user is working on from one tool to the next, so they
// don't have to save it and re-upload. Stored as a data URL under the key every
// image tool already checks on mount (see UploadZone + the image tools).

const KEY = 'pendingImageUpload';

// Held between an effect's StrictMode double-invoke: the first run pulls the
// value out of sessionStorage, the (immediately re-run) second run still sees
// it here and can deliver it. Cleared once an image is actually handed to a
// tool, so a later, separate handoff re-reads sessionStorage.
let _stash = null;

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the image.'));
    r.readAsDataURL(blob);
  });

/**
 * Stash the current image for the next tool. Accepts a Blob/File, a data: URL,
 * or a blob:/http(s) URL. Returns true if it was stored.
 */
export async function stashImage(source) {
  try {
    let dataUrl;
    if (typeof source === 'string') {
      dataUrl = source.startsWith('data:')
        ? source
        : await blobToDataUrl(await fetch(source).then((res) => res.blob()));
    } else {
      dataUrl = await blobToDataUrl(source);
    }
    sessionStorage.setItem(KEY, dataUrl);
    _stash = null; // a fresh handoff supersedes any undelivered one
    return true;
  } catch {
    return false;
  }
}

/** Read and clear the handed-off image (call once when a tool mounts). */
export function readHandoff() {
  if (_stash) return _stash;
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v || null;
  } catch {
    return null;
  }
}

/**
 * Wire the handoff into a tool: on mount, if an image was handed off, turn it
 * into a File and pass it to `onFile`. Returns a cleanup fn for useEffect.
 */
export function consumeHandoff(onFile, name = 'image') {
  const pending = readHandoff();
  if (!pending) return () => {};
  _stash = pending;
  let cancelled = false;
  fetch(pending)
    .then((r) => r.blob())
    .then((blob) => {
      if (cancelled) return;
      _stash = null;
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      onFile(new File([blob], `${name}.${ext}`, { type: blob.type || 'image/png' }));
    })
    .catch(() => { _stash = null; });
  return () => { cancelled = true; };
}
