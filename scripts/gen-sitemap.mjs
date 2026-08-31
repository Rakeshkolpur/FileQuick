/**
 * Regenerates public/sitemap.xml + public/robots.txt from the tool registry.
 * Runs automatically before every `npm run build`.
 *
 * Set SITE_URL in the environment (or Vercel/Netlify project settings) to your
 * real domain, e.g.  SITE_URL=https://filequick.app
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.SITE_URL || 'https://filequick.app').replace(/\/$/, '');

const src = readFileSync(resolve(root, 'src/data/tools.jsx'), 'utf8');
const re = /\bid:\s*'([a-z0-9-]+)',\s*title:[^,]+,\s*category:\s*'(image|pdf)'/g;

const routes = new Set(['/', '/image', '/pdf', '/contact', '/privacy-policy', '/terms-of-service']);
const toolIds = new Set();
let m;
while ((m = re.exec(src))) { toolIds.add(m[1]); routes.add(`/${m[1]}`); }

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

console.log(`[seo] wrote sitemap.xml (${routes.size} URLs) + robots.txt for ${SITE}`);
