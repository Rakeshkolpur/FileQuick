/**
 * FileQuick for Desktop — release metadata for the /download page.
 *
 * Once a new version is built and its GitHub Release is published:
 *   1. bump `version` here to match package.json
 *   2. done — `downloadUrl` and `releasesUrl` are built from it below
 * The desktop build itself checks GitHub Releases for updates on its own;
 * this is only for the marketing page's download link.
 */
const OWNER = 'Rakeshkolpur';
const REPO = 'FileQuick';
const VERSION = '1.0.6';

export const DESKTOP = {
  available: true,
  version: VERSION,
  platform: 'Windows 10 & 11 · 64-bit',
  sizeLabel: '~260 MB', // confirmed from the v1.0.1 release asset
  // Direct link to the .exe asset — clicking it starts the download immediately
  // instead of opening a GitHub page. Must match electron-builder.yml's
  // `artifactName: FileQuick-Setup-${version}.${ext}`.
  downloadUrl: `https://github.com/${OWNER}/${REPO}/releases/download/v${VERSION}/FileQuick-Setup-${VERSION}.exe`,
  releasesUrl: `https://github.com/${OWNER}/${REPO}/releases`,
};
