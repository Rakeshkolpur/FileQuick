/**
 * FileQuick for Desktop — release metadata for the /download page and the
 * homepage's download widget.
 *
 * The version comes from data/changelog.js's newest entry, so there's one
 * place to update per release (bump package.json, tag vX.Y.Z, add a
 * changelog entry) instead of two.
 */
import { CHANGELOG, LATEST } from '../data/changelog';

const OWNER = 'Rakeshkolpur';
const REPO = 'FileQuick';
const VERSION = LATEST.version;

// Direct link to a version's .exe asset — clicking it starts the download
// immediately instead of opening a GitHub page. Must match electron-builder
// .yml's `artifactName: FileQuick-Setup-${version}.${ext}`.
export const releaseDownloadUrl = (version) =>
  `https://github.com/${OWNER}/${REPO}/releases/download/v${version}/FileQuick-Setup-${version}.exe`;

// Every version with a published desktop build, newest first — for the
// "select a version" picker.
export const RELEASES = CHANGELOG.map((c) => ({ version: c.version, date: c.date }));

export const DESKTOP = {
  available: true,
  version: VERSION,
  platform: 'Windows 10 & 11 · 64-bit',
  sizeLabel: '~260 MB', // confirmed from the v1.0.1 release asset
  downloadUrl: releaseDownloadUrl(VERSION),
  releasesUrl: `https://github.com/${OWNER}/${REPO}/releases`,
};
