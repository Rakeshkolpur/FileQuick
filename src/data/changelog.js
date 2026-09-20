// Desktop app release notes live in changelog.json (newest first) — add a new
// entry there whenever the desktop app is bumped + tagged. Used by:
//  - the "Update available" popup (DesktopBridge) — for versions NEWER than
//    the installed app, the notes are fetched from GitHub (see below), since
//    the installed build can't have them bundled yet
//  - the "What's new" popup shown once after a restart onto a new version
//  - the /download page and the homepage's version picker
import changelog from './changelog.json';

export const CHANGELOG = changelog;

export const LATEST = CHANGELOG[0];

/** Notes for one version from the bundled list, or [] if it isn't in there. */
export const notesForVersion = (version) => CHANGELOG.find((c) => c.version === version)?.notes || [];

// The same JSON, straight from the repo's main branch. A running desktop app
// only knows the versions that existed when it was built, so to show what's in
// an update it hasn't installed yet it reads this instead. (GitHub only — same
// host family the updater already talks to.)
const REMOTE_URL = 'https://raw.githubusercontent.com/Rakeshkolpur/FileQuick/main/src/data/changelog.json';

/** Notes for `version` from GitHub, or [] on any failure/timeout/unlisted version. */
export async function fetchRemoteNotes(version, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(REMOTE_URL, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return [];
    const list = await res.json();
    return Array.isArray(list) ? (list.find((c) => c.version === version)?.notes || []) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
