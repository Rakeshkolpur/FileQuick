/* Regenerates the raster favicons + social card from public/favicon.svg.
 * Run manually after changing the logo:  node scripts/gen-favicons.mjs
 * (search engines want a square PNG/ICO — an SVG-only favicon often shows
 * as a blank globe in Bing/Google results.) */
import sharp from 'sharp';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = readFileSync(join(pub, 'favicon.svg'));

const png = (size, name) =>
  sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(pub, name))
    .then(() => console.log('wrote', name));

await Promise.all([
  png(512, 'icon-512.png'),
  png(192, 'icon-192.png'),
  png(180, 'apple-touch-icon.png'),
  png(96, 'favicon-96.png'),
  png(48, 'favicon-48.png'),
  png(32, 'favicon-32.png'),
  png(16, 'favicon-16.png'),
  sharp({ create: { width: 1200, height: 630, channels: 4, background: '#4F46E5' } })
    .composite([{ input: await sharp(svg, { density: 384 }).resize(340, 340).png().toBuffer(), gravity: 'centre' }])
    .png()
    .toFile(join(pub, 'og-image.png'))
    .then(() => console.log('wrote og-image.png')),
]);

// .ico from a large source so PIL downscales (not upscales) each size
await png(256, 'favicon-256.png');
const p = pub.replace(/\\/g, '/');
execSync(
  `python3 -c "from PIL import Image; Image.open('${p}/favicon-256.png').save('${p}/favicon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64)])"`,
  { stdio: 'inherit' },
);
console.log('wrote favicon.ico');
