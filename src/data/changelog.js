// Desktop app release notes — newest first. Used by:
//  - the "Update available" popup (DesktopBridge), to show what's in the update
//  - the "What's new" popup shown once after a fresh restart onto a new version
//  - the /download page and the homepage's version picker
//
// Add a new entry here whenever the desktop app is bumped + tagged
// (see [[desktop-app]] release flow — package.json version, git tag vX.Y.Z).
export const CHANGELOG = [
  {
    version: '1.0.17',
    date: '2026-09-17',
    notes: [
      'Fixed "Restart now" after an update not reopening the app — you had to relaunch it yourself',
      'New: a "Send feedback" option (Settings, and the website footer) — opens your email app, no account needed',
    ],
  },
  {
    version: '1.0.16',
    date: '2026-09-17',
    notes: [
      'Homepage: dropping a PDF now hands it straight to whichever tool you pick — Compress, Merge, Split, Edit or To Word open with it already loaded, no re-upload',
      'Merge PDF: a new compact file grid — drag any tile to reorder PDFs and images together, click one to preview it full-size',
    ],
  },
  {
    version: '1.0.15',
    date: '2026-09-14',
    notes: [
      'Fixed the "support this project" QR code not showing up in the desktop app',
      'Every image tool now defaults its download format to JPG (still changeable per file)',
      'Remove Background, Compress Image and Increase Image Size got the streamlined new editor layout',
      "Crop Image's download formats now include JPEG and PDF in a proper dropdown",
    ],
  },
  {
    version: '1.0.14',
    date: '2026-09-14',
    notes: [
      'Resize Image and Crop Image: redesigned editor — a live preview alongside a simple Tools/Download panel',
      'Image Upscaler is more reliable on lower-end graphics cards, with an automatic fallback when 4x fails',
      'New: an optional "support this project" tip QR, from the navbar coffee icon',
    ],
  },
  {
    version: '1.0.13',
    date: '2026-09-13',
    notes: [
      'New tool: Remove Watermark, for PDFs and photos',
      'Add Watermark: drag the watermark anywhere on the page, and use it on photos, not just PDFs',
      "A heads-up when a tool needs to download its AI model and you're offline",
    ],
  },
];

export const LATEST = CHANGELOG[0];

/** Notes for one version, or an empty array if that version isn't listed. */
export const notesForVersion = (version) => CHANGELOG.find((c) => c.version === version)?.notes || [];
