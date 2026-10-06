/**
 * Rewrite the "redirects" and "rewrites" sections of vercel.json from
 * src/data/redirects.js. Run after changing redirects:  node scripts/sync-vercel.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRedirects, buildRewrites } from './vercelRoutes.mjs';

const file = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'vercel.json');
const cfg = JSON.parse(readFileSync(file, 'utf8'));
const out = {};
for (const [k, v] of Object.entries(cfg)) {
  if (k === 'redirects' || k === 'rewrites') continue;
  out[k] = v;
  if (k === 'cleanUrls') {
    out.redirects = buildRedirects();
    out.rewrites = buildRewrites();
  }
}
if (!out.redirects) { out.redirects = buildRedirects(); out.rewrites = buildRewrites(); }
writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.log(`vercel.json: ${out.redirects.length} redirects, ${out.rewrites.length} rewrites`);
