/**
 * FileQuick for Desktop — release metadata for the /download page.
 *
 * Until the first installer is published, `available` stays false and the page
 * shows a "first build on the way" state. Once a release exists:
 *   1. flip `available` to true
 *   2. set `version`, `sizeLabel` and `downloadUrl` (the .exe asset URL, or the
 *      GitHub "releases/latest" page)
 * The desktop build itself checks GitHub Releases for updates on its own.
 */
export const DESKTOP = {
  available: false,
  version: '1.0.0',
  platform: 'Windows 10 & 11 · 64-bit',
  sizeLabel: '~90 MB',
  // The installer asset (or the releases page). Kept as one place to update.
  downloadUrl: 'https://github.com/Rakeshkolpur/FileQuick/releases/latest',
  releasesUrl: 'https://github.com/Rakeshkolpur/FileQuick/releases',
};

const EULA_KEY = 'fq.desktopEulaAccepted';

export const hasAcceptedEula = () => {
  try { return localStorage.getItem(EULA_KEY) === '1'; } catch { return false; }
};

export const setEulaAccepted = (ok) => {
  try {
    if (ok) localStorage.setItem(EULA_KEY, '1');
    else localStorage.removeItem(EULA_KEY);
  } catch { /* private mode — the checkbox still gates this session */ }
};
