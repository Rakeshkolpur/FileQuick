/**
 * Regenerates public/sitemap.xml + public/robots.txt from the tool registry.
 * Runs automatically before every `npm run build`.
 *
 * Set VITE_SITE_URL in the environment (Vercel/Netlify project settings) to your
 * real domain, e.g.  VITE_SITE_URL=https://filequik.in
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://filequik.in').replace(/\/+$/, '');

const src = readFileSync(resolve(root, 'src/data/tools.jsx'), 'utf8');
const re = /\bid:\s*'([a-z0-9-]+)',\s*title:[^,]+,\s*category:\s*'(image|pdf)'/g;

// Tools shown as "coming soon" shouldn't be in the sitemap — nothing to index yet.
const comingSoon = new Set();
if (/SERVER_TOOLS_COMING_SOON\s*=\s*true/.test(src)) {
  const setBody = src.match(/NEEDS_SERVER\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (setBody) for (const q of setBody[1].matchAll(/'([a-z0-9-]+)'/g)) comingSoon.add(q[1]);
}
for (const chunk of src.split(/\{\s*id:\s*'/).slice(1)) {
  const idm = chunk.match(/^([a-z0-9-]+)'/);
  if (idm && /status:\s*'soon'/.test(chunk.slice(0, 320))) comingSoon.add(idm[1]);
}

const routes = new Set(['/', '/image', '/pdf', '/contact', '/privacy-policy', '/terms-of-service']);
const toolIds = new Set();
let m;
while ((m = re.exec(src))) {
  if (comingSoon.has(m[1])) continue;
  toolIds.add(m[1]);
  routes.add(`/${m[1]}`);
}

const today = new Date().toISOString().slice(0, 10);
const urls = [...routes]
  .map((path) => {
    const id = path.slice(1);
    const priority = path === '/' ? '1.0' : toolIds.has(id) ? '0.8' : '0.5';
    return `  <url>\n    <loc>${SITE}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join('\n');

writeFileSync(
  resolve(root, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);

writeFileSync(
  resolve(root, 'public/robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
);

console.log(`[seo] wrote sitemap.xml (${routes.size} URLs${comingSoon.size ? `, ${comingSoon.size} coming-soon tools skipped` : ''}) + robots.txt for ${SITE}`);
