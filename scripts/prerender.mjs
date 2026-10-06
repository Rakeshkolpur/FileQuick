/**
 * Pre-render every indexable page into its own static HTML file, plus the
 * sitemap, robots.txt and a real 404 page (runs after `vite build`).
 *
 * The site is a single-page app: without this, every URL returned the same
 * index.html — the homepage's <title>, description and a canonical link to
 * "/" — with an empty <div id="root">. Now /resize-image, /pdf-editor,
 * /compress-image-to-50kb, … each get their own title, description,
 * canonical, Open Graph / Twitter tags, structured data (Breadcrumb, HowTo,
 * FAQPage, WebApplication) and the same how-to / FAQ text the page shows —
 * readable without running JavaScript. React replaces the pre-rendered
 * markup as soon as the app starts.
 *
 * Page data comes from the app's own modules (loaded through Vite), so the
 * pre-rendered text always matches what users see, and the sitemap lists
 * exactly the pages written here.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { buildRedirects, buildRewrites } from './vercelRoutes.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const SITE = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://filequik.in').replace(/\/+$/, '');
const BRAND = 'FileQuick';

/* ------------------------------------------------- vercel.json in sync? */

const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
if (JSON.stringify(vercel.redirects) !== JSON.stringify(buildRedirects())
  || JSON.stringify(vercel.rewrites) !== JSON.stringify(buildRewrites())) {
  throw new Error('prerender: vercel.json redirects/rewrites are out of date — run `node scripts/sync-vercel.mjs`.');
}

/* ---------------------------------------------------------------- data */

const vite = await createServer({
  root,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const toolsMod = await vite.ssrLoadModule('/src/data/tools.jsx');
const seoMod = await vite.ssrLoadModule('/src/data/toolSeo.js');
const landingMod = await vite.ssrLoadModule('/src/data/landingPages.js');
await vite.close();

const TOOLS = toolsMod.getAllTools().filter((t) => t.status !== 'soon');
const { getToolSeo } = seoMod;
const LANDING = landingMod.LANDING_PAGES.filter((p) => p.indexed && TOOLS.some((t) => t.id === p.toolId));
const byId = new Map(TOOLS.map((t) => [t.id, t]));
const landingBySlug = new Map(LANDING.map((p) => [p.slug, p]));
const titleOf = (id) => byId.get(id)?.title || landingBySlug.get(id)?.h1;

/* ------------------------------------------------------------- helpers */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (obj) => `<script type="application/ld+json" data-prerendered="">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const CATEGORY_LABEL = { image: 'Image Tools', pdf: 'PDF Tools' };

// Readable styling for the pre-rendered markup (Tailwind's reset flattens
// headings and lists); it only shows until the app has loaded.
const PRERENDER_CSS = '<style>[data-prerendered] h1{font-size:2rem;font-weight:800;line-height:1.2;margin:24px 0 8px}'
  + '[data-prerendered] h2{font-size:1.3rem;font-weight:700;margin:28px 0 8px}'
  + '[data-prerendered] h3{font-size:1rem;font-weight:600;margin:14px 0 4px}'
  + '[data-prerendered] p{margin:0 0 10px;opacity:.85}[data-prerendered] ol{list-style:decimal;padding-left:24px}'
  + '[data-prerendered] main a,[data-prerendered] footer a{color:#2563eb}</style>';

const template = readFileSync(resolve(dist, 'index.html'), 'utf8');
const sitemap = []; // { path, priority }

function page({ path, title, description, robots = 'index, follow', ld = [], body, priority, canonical = true }) {
  const url = `${SITE}${path}`;
  const fullTitle = title ? `${title} — ${BRAND}` : `Free PDF & Image Tools — Compress, Convert, Merge | ${BRAND}`;
  let html = template;
  const swap = (re, value, what) => {
    if (!re.test(html)) throw new Error(`prerender: ${what} not found in dist/index.html`);
    html = html.replace(re, value);
  };
  swap(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`, '<title>');
  swap(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(description)}" />`, 'meta description');
  swap(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/, `<meta name="robots" content="${esc(robots)}" />`, 'meta robots');
  swap(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, canonical ? `<link rel="canonical" href="${esc(url)}" />` : '', 'canonical');
  swap(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(fullTitle)}" />`, 'og:title');
  swap(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(description)}" />`, 'og:description');
  swap(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, canonical ? `<meta property="og:url" content="${esc(url)}" />` : '', 'og:url');
  const extra = [
    `<meta name="twitter:title" content="${esc(fullTitle)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    ...ld.map(jsonLd),
    PRERENDER_CSS,
  ].join('\n    ');
  html = html.replace('</head>', `    ${extra}\n  </head>`);
  swap(/<div id="root"><\/div>/, `<div id="root">${body}</div>`, 'root div');

  const file = path === '/' ? resolve(dist, 'index.html') : resolve(dist, `${path.slice(1)}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  if (priority && robots.startsWith('index')) sitemap.push({ path, priority });
}

/* ---- shared body parts: site header, all-tools footer (internal links) */

const header = `<header style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:16px 0">
<a href="/" style="font-weight:800;font-size:20px">${BRAND}</a>
<nav style="display:flex;flex-wrap:wrap;gap:12px"><a href="/">Home</a><a href="/image">Image Tools</a><a href="/pdf">PDF Tools</a><a href="/pdf-editor">PDF Editor</a><a href="/resize-image">Resize Image</a><a href="/exam-photo-resizer">Exam Photo</a><a href="/download">Download</a></nav>
</header>`;

const linkList = (items) => `<ul style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 16px;padding:0;list-style:none">
${items.map(([href, title, text]) => `<li><a href="${href}">${esc(title)}</a>${text ? ` — <span>${esc(text)}</span>` : ''}</li>`).join('\n')}
</ul>`;
const toolList = (tools) => linkList(tools.map((t) => [`/${t.id}`, t.title, t.description]));
const landingList = (group) => linkList(LANDING.filter((p) => p.group === group).map((p) => [`/${p.slug}`, p.h1]));

const footer = `<footer style="margin-top:48px">
<h2>Image tools</h2>${toolList(TOOLS.filter((t) => t.category === 'image'))}
<h2>Exam &amp; form photos</h2>${landingList('exam')}
<h2>Compress an image to a size</h2>${landingList('image-size')}
<h2>PDF tools</h2>${toolList(TOOLS.filter((t) => t.category === 'pdf'))}
<h2>Compress a PDF to a size</h2>${landingList('pdf-size')}
<p>${BRAND} (File Quick) — free online tools to prepare photos, signatures and PDFs for online forms, plus a PDF editor, image resizer, compressor and converters.</p>
<p><a href="/about">About ${BRAND}</a> · <a href="/faq">FAQ</a> · <a href="/contact">Contact</a> · <a href="/privacy-policy">Privacy Policy</a> · <a href="/terms-of-service">Terms of Service</a></p>
</footer>`;

const wrap = (main) => `<div data-prerendered="" style="max-width:1100px;margin:0 auto;padding:0 16px 48px;font-family:system-ui,sans-serif;line-height:1.6">
${header}
<main>${main}</main>
${footer}
</div>`;

/** How-to / FAQ content + structured data for a tool page (same as ToolSeoContent.jsx). */
function toolParts(tool, seo, path, h1, lead) {
  const body = Array.isArray(seo.body) ? seo.body : (seo.body ? [seo.body] : []);
  const related = (seo.related || [])
    .map((r) => (typeof r === 'string' ? { id: r } : r))
    .filter((r) => titleOf(r.id));
  const main = `<h1>${esc(h1)}</h1>
<p>${esc(lead)}</p>
<section>
<h2>${esc(seo.h1 || `How to use ${tool.title}`)}</h2>
${seo.intro ? `<p>${esc(seo.intro)}</p>` : ''}
${body.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${seo.steps?.length ? `<h3>Steps</h3><ol>${seo.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
${seo.faqs?.length ? `<h2>Frequently asked questions</h2>${seo.faqs.map(({ q, a }) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}` : ''}
${related.length ? `<h2>Related tools</h2><ul>${related.map((r) => `<li><a href="/${r.id}">${esc(titleOf(r.id))}</a>${r.text ? ` — ${esc(r.text)}` : ''}</li>`).join('')}</ul>` : ''}
</section>`;

  const graph = [{
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: CATEGORY_LABEL[tool.category] || 'Tools', item: `${SITE}/${tool.category}` },
      { '@type': 'ListItem', position: 3, name: seo.breadcrumb || tool.title, item: `${SITE}${path}` },
    ],
  }];
  if (seo.steps?.length) {
    graph.push({
      '@type': 'HowTo',
      name: seo.h1 || `How to use ${tool.title}`,
      description: seo.intro,
      step: seo.steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
    });
  }
  if (seo.faqs?.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: seo.faqs.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    });
  }
  graph.push({
    '@type': 'WebApplication',
    name: `${seo.breadcrumb || tool.title} — ${BRAND}`,
    applicationCategory: tool.category === 'pdf' ? 'BusinessApplication' : 'MultimediaApplication',
    operatingSystem: 'Any (web browser)',
    url: `${SITE}${path}`,
    description: seo.seoDescription || seo.intro || tool.description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: BRAND, url: `${SITE}/` },
  });
  return { main, ld: [{ '@context': 'https://schema.org', '@graph': graph }] };
}

/* ---------------------------------------------------------------- pages */

// Tools
for (const tool of TOOLS) {
  const seo = getToolSeo(tool.id);
  const path = `/${tool.id}`;
  if (seo) {
    const { main, ld } = toolParts(tool, seo, path, tool.title, tool.description);
    page({ path, title: seo.seoTitle || tool.title, description: seo.seoDescription || tool.description, ld, body: wrap(main), priority: '0.8' });
  } else {
    page({ path, title: tool.title, description: tool.description, body: wrap(`<h1>${esc(tool.title)}</h1><p>${esc(tool.description)}</p>`), priority: '0.8' });
  }
}

// Landing pages: an existing tool with a preset + content for one job
for (const lp of LANDING) {
  const tool = byId.get(lp.toolId);
  const path = `/${lp.slug}`;
  const seo = { ...lp.seo, seoDescription: lp.description };
  const { main, ld } = toolParts(tool, seo, path, lp.h1, lp.toolProps?.intro || lp.description);
  page({ path, title: lp.title, description: lp.description, ld, body: wrap(main), priority: '0.8' });
}

// Category pages
const CATS = {
  image: { title: 'Image Tools', description: 'Resize, crop, compress, convert and remove backgrounds from images — free and in your browser.', h1: 'Free online image tools' },
  pdf: { title: 'PDF Tools', description: 'Merge, split, compress, convert, protect, sign and edit PDF files — free and in your browser.', h1: 'Free online PDF tools' },
};
for (const [slug, c] of Object.entries(CATS)) {
  const list = TOOLS.filter((t) => t.category === slug);
  page({
    path: `/${slug}`,
    title: c.title,
    description: c.description,
    ld: [{
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${c.title} — ${BRAND}`,
      itemListElement: list.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.title, url: `${SITE}/${t.id}` })),
    }],
    body: wrap(`<h1>${esc(c.h1)}</h1><p>${esc(c.description)}</p>${toolList(list)}`),
    priority: '0.6',
  });
}

// Static pages
const STATIC = [
  ['/about', 'About', 'FileQuick is a free collection of privacy-first tools for images and PDFs — resize, compress, convert, merge, sign and edit.'],
  ['/faq', 'Frequently Asked Questions', 'Answers to common questions about FileQuick — pricing, privacy, file limits, supported formats and how the tools work.'],
  ['/contact', 'Contact Us', 'Get in touch with the FileQuick team — questions, bug reports, feature requests and feedback.'],
  ['/download', 'Download FileQuick for Desktop', 'Install FileQuick on Windows for unlimited file sizes, fully offline tools, local file history and automatic updates. Free, no account.'],
  ['/privacy-policy', 'Privacy Policy', 'How FileQuick handles your data.'],
  ['/terms-of-service', 'Terms of Service', 'The terms that govern your use of FileQuick.'],
];
for (const [path, title, description] of STATIC) {
  page({ path, title, description, body: wrap(`<h1>${esc(title)}</h1><p>${esc(description)}</p>`), priority: '0.3' });
}

// 404 — Vercel serves dist/404.html (with a 404 status) for any unknown URL.
page({
  path: '/404',
  title: 'Page not found',
  description: 'That page doesn’t exist.',
  robots: 'noindex, follow',
  canonical: false,
  body: wrap(`<h1>This page doesn’t exist</h1><p>The link may be wrong or out of date. Try one of the tools below.</p>`),
});

// Home (last: it rewrites dist/index.html, the template for everything above)
page({
  path: '/',
  title: null,
  description: 'Compress, convert, merge, resize and edit PDFs and images — 100% free, no sign-up, no watermark. Most tools run right in your browser, nothing uploaded.',
  body: wrap(`<h1>${BRAND} — free PDF & image tools</h1>
<p>Resize, compress, convert, merge, sign and edit images and PDFs — free, fast, no sign-up and no watermark. Get photos, signatures and PDFs to the exact size an online form asks for.</p>
<p>Popular: <a href="/resize-image">Resize Image</a> · <a href="/pdf-editor">PDF Editor</a> · <a href="/compress-image">Compress Image</a> · <a href="/exam-photo-resizer">Exam Photo &amp; Signature Resizer</a> · <a href="/signature-resizer">Signature Resizer</a> · <a href="/pdf-compressor">Compress PDF</a> · <a href="/merge-pdf">Merge PDF</a> · <a href="/pdf-to-word">PDF to Word</a> · <a href="/passport-photo">Passport Photo</a></p>`),
  priority: '1.0',
});

/* ------------------------------------------------- sitemap + robots.txt */

const today = new Date().toISOString().slice(0, 10);
const urls = sitemap
  .sort((a, b) => b.priority.localeCompare(a.priority) || a.path.localeCompare(b.path))
  .map(({ path, priority }) => `  <url>\n    <loc>${SITE}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`)
  .join('\n');
writeFileSync(resolve(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
writeFileSync(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`prerender: ${sitemap.length} indexable pages (+404) for ${SITE}; sitemap.xml + robots.txt written`);
