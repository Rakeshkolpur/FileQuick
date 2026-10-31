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
const MOBILE_GROUPS = toolsMod.MOBILE_TOOL_GROUPS;
const LANDING = landingMod.LANDING_PAGES.filter((p) => p.indexed && TOOLS.some((t) => t.id === p.toolId));
const byId = new Map(TOOLS.map((t) => [t.id, t]));
const landingBySlug = new Map(LANDING.map((p) => [p.slug, p]));
const titleOf = (id) => byId.get(id)?.title || landingBySlug.get(id)?.h1;

/* ------------------------------------------------------------- helpers */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (obj) => `<script type="application/ld+json" data-prerendered="">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const CATEGORY_LABEL = { image: 'Image Tools', pdf: 'PDF Tools' };

// What a visitor sees until the app's JavaScript has arrived — on a slow phone
// connection that can be several seconds, so this is a small, app-styled page
// (header, the three start cards / a "loading the tool" card, key tools as
// plain links that work without JS), not a wall of text. The full how-to/FAQ
// copy and the all-tools link lists are still in the HTML for crawlers, folded
// into <details>. Self-contained CSS (fq-*) so it renders right after the HTML.
const SHELL_CSS = `<style>
html{background:#f9fafb}html.dark{background:#111827}
.fq{max-width:1100px;margin:0 auto;padding:0 16px 40px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5;color:#111827}
html.dark .fq{color:#f3f4f6}
.fq a{text-decoration:none}
.fq-top{display:flex;align-items:center;justify-content:space-between;height:64px;margin:0 -16px;padding:0 16px;background:#fff;border-bottom:1px solid #e5e7eb}
html.dark .fq-top{background:#1f2937;border-color:#374151}
.fq-logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:20px;color:inherit}
.fq-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:20px}
.fq-logo b{color:#6366f1}
.fq-nav{display:none;gap:20px}.fq-nav a{color:#4b5563;font-size:14px;font-weight:500}html.dark .fq-nav a{color:#d1d5db}
@media(min-width:1024px){.fq-nav{display:flex}}
.fq-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fq-hero{font-size:28px;font-weight:800;line-height:1.15;letter-spacing:-.02em;text-align:center;margin:28px 0 6px}
.fq-hero span{background:linear-gradient(90deg,#8b5cf6,#6366f1,#3b82f6);-webkit-background-clip:text;background-clip:text;color:transparent}
.fq-sub{text-align:center;color:#6b7280;margin:0 0 20px}html.dark .fq-sub{color:#9ca3af}
@media(min-width:640px){.fq-hero{font-size:44px}}
.fq-cards{display:grid;gap:14px}@media(min-width:1024px){.fq-cards{grid-template-columns:repeat(3,1fr);gap:22px}}
.fq-card{display:block;border:2px solid;border-radius:22px;padding:16px;background:#fff;color:inherit}
html.dark .fq-card{background:rgba(31,41,55,.6)}
.fq-card h3{margin:0;font-size:18px;font-weight:700}
.fq-card p{margin:4px 0 0;font-size:13.5px;color:#4b5563}html.dark .fq-card p{color:#d1d5db}
.fq-card small{display:block;margin-top:4px;font-size:11.5px;color:#6b7280}
.fq-btn{display:block;margin-top:14px;border-radius:12px;padding:11px;text-align:center;color:#fff;font-weight:600;font-size:15px}
.fq-teal{border-color:rgba(45,212,191,.7)}.fq-teal .fq-btn{background:#0d9488}
.fq-blue{border-color:rgba(96,165,250,.7)}.fq-blue .fq-btn{background:#2563eb}
.fq-violet{border-color:rgba(167,139,250,.7)}.fq-violet .fq-btn{background:#7c3aed}
.fq-rose{border-color:rgba(251,113,133,.7)}.fq-rose .fq-btn{background:#e11d48}
.fq-orange{border-color:rgba(251,146,60,.7)}.fq-orange .fq-btn{background:#ea580c}
.fq-sky{border-color:rgba(56,189,248,.7)}.fq-sky .fq-btn{background:#0284c7}
@media(min-width:768px){.fq-card.fq-m{display:none}}
.fq-h2{font-size:18px;font-weight:700;margin:28px 0 10px}
.fq-label{margin:14px 0 8px;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9ca3af}
.fq-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}@media(min-width:768px){.fq-grid{grid-template-columns:repeat(4,1fr)}}
.fq-grid a{display:block;border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#fff;color:#1f2937;font-weight:600;font-size:13.5px}
html.dark .fq-grid a{background:#1f2937;border-color:#374151;color:#f3f4f6}
.fq-page h1{font-size:22px;font-weight:800;line-height:1.2;margin:22px 0 4px}
.fq-page>h1+p{margin:0;color:#6b7280;font-size:14px}html.dark .fq-page>h1+p{color:#9ca3af}
.fq-load{display:flex;align-items:center;gap:14px;margin:18px 0;padding:26px 18px;border:1px solid #e5e7eb;border-radius:18px;background:#fff;font-weight:600}
html.dark .fq-load{background:#1f2937;border-color:#374151}
.fq-spin{flex:none;width:22px;height:22px;border-radius:50%;border:3px solid #c7d2fe;border-top-color:#6366f1;animation:fqspin .8s linear infinite}
.fq-slow{display:block;margin-top:2px;font-size:12.5px;font-weight:400;color:#6b7280;opacity:0;animation:fqshow .3s 8s forwards}
.fq-slow a{color:#6366f1;font-weight:600}
@keyframes fqspin{to{transform:rotate(360deg)}}@keyframes fqshow{to{opacity:1}}
.fq details{margin-top:16px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;padding:0 16px}
html.dark .fq details{background:#1f2937;border-color:#374151}
.fq summary{padding:12px 0;font-weight:600;font-size:14px;cursor:pointer}
.fq details h2{font-size:1.15rem;font-weight:700;margin:20px 0 8px}.fq details h3{font-size:1rem;font-weight:600;margin:12px 0 4px}
.fq details p{margin:0 0 10px;opacity:.85}.fq details ol{list-style:decimal;padding-left:24px}
.fq details ul{padding:0;list-style:none}.fq details a{color:#4f46e5}html.dark .fq details a{color:#a5b4fc}
.fq-foot{margin-top:24px;font-size:13px;color:#6b7280}.fq-foot a{color:#6b7280}
</style>`;

// Same rule as ThemeContext, run before first paint so the page (and the app
// after it) doesn't flash the wrong theme.
const THEME_SCRIPT = `<script>try{var d=localStorage.getItem('darkMode');if(d===null?matchMedia('(prefers-color-scheme: dark)').matches:d==='true')document.documentElement.classList.add('dark')}catch(e){}</script>`;

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
    THEME_SCRIPT,
    SHELL_CSS,
  ].join('\n    ');
  html = html.replace('</head>', `    ${extra}\n  </head>`);
  swap(/<div id="root"><\/div>/, `<div id="root">${body}</div>`, 'root div');

  const file = path === '/' ? resolve(dist, 'index.html') : resolve(dist, `${path.slice(1)}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  if (priority && robots.startsWith('index')) sitemap.push({ path, priority });
}

/* ---- shared body parts: site header, all-tools footer (internal links) */

const header = `<header class="fq-top">
<a href="/" class="fq-logo"><span class="fq-mark">F</span><span>File<b>Quick</b></span></a>
<nav class="fq-nav"><a href="/image">Image Tools</a><a href="/pdf">PDF Tools</a><a href="/pdf-editor">PDF Editor</a><a href="/exam-photo-resizer">Exam Photo</a><a href="/download">Download</a></nav>
</header>`;

const linkList = (items) => `<ul style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 16px;padding:0;list-style:none">
${items.map(([href, title, text]) => `<li><a href="${href}">${esc(title)}</a>${text ? ` — <span>${esc(text)}</span>` : ''}</li>`).join('\n')}
</ul>`;
const toolList = (tools) => linkList(tools.map((t) => [`/${t.id}`, t.title, t.description]));
const landingList = (group) => linkList(LANDING.filter((p) => p.group === group).map((p) => [`/${p.slug}`, p.h1]));

// every tool and landing page, as plain links — folded away for people,
// fully there for crawlers
const footer = `<details>
<summary>All tools</summary>
<h2>Image tools</h2>${toolList(TOOLS.filter((t) => t.category === 'image'))}
<h2>Exam &amp; form photos</h2>${landingList('exam')}
<h2>Compress an image to a size</h2>${landingList('image-size')}
<h2>PDF tools</h2>${toolList(TOOLS.filter((t) => t.category === 'pdf'))}
<h2>Compress a PDF to a size</h2>${landingList('pdf-size')}
</details>
<p class="fq-foot">${BRAND} (File Quick) — free online tools to prepare photos, signatures and PDFs for online forms, plus a PDF editor, image resizer, compressor and converters.<br>
<a href="/about">About</a> · <a href="/faq">FAQ</a> · <a href="/contact">Contact</a> · <a href="/privacy-policy">Privacy</a> · <a href="/terms-of-service">Terms</a></p>`;

const wrap = (main) => `<div data-prerendered="" class="fq">
${header}
<main class="fq-page">${main}</main>
${footer}
</div>`;

// the key tools (data/tools.jsx MOBILE_TOOL_GROUPS), as a tap-friendly grid
const keyTools = () => MOBILE_GROUPS.map((g) => `<p class="fq-label">${esc(g.title)}</p><div class="fq-grid">${
  g.ids.filter((id) => byId.has(id)).map((id) => `<a href="/${id}">${esc(byId.get(id).short || byId.get(id).title)}</a>`).join('')}</div>`).join('');

// shown on a tool page until the tool's code has loaded
const loading = (name, path) => `<div class="fq-load"><span class="fq-spin"></span><span>Loading ${esc(name)}…<span class="fq-slow">Slow connection — almost there. <a href="${esc(path)}">Tap to retry</a></span></span></div>`;

/** How-to / FAQ content + structured data for a tool page (same as ToolSeoContent.jsx). */
function toolParts(tool, seo, path, h1, lead) {
  const body = Array.isArray(seo.body) ? seo.body : (seo.body ? [seo.body] : []);
  const related = (seo.related || [])
    .map((r) => (typeof r === 'string' ? { id: r } : r))
    .filter((r) => titleOf(r.id));
  const main = `<h1>${esc(h1)}</h1>
<p>${esc(lead)}</p>
${loading(tool.short || tool.title, path)}
<details><summary>How to use &amp; FAQ</summary>
<section>
<h2>${esc(seo.h1 || `How to use ${tool.title}`)}</h2>
${seo.intro ? `<p>${esc(seo.intro)}</p>` : ''}
${body.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${seo.compare ? `${seo.compare.title ? `<h3>${esc(seo.compare.title)}</h3>` : ''}<table><thead><tr>${seo.compare.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${seo.compare.rows.map((row) => `<tr>${row.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table>${seo.compare.note ? `<p>${esc(seo.compare.note)}</p>` : ''}` : ''}
${seo.steps?.length ? `<h3>Steps</h3><ol>${seo.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
${seo.faqs?.length ? `<h2>Frequently asked questions</h2>${seo.faqs.map(({ q, a }) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}` : ''}
${related.length ? `<h2>Related tools</h2><ul>${related.map((r) => `<li><a href="/${r.id}">${esc(titleOf(r.id))}</a>${r.text ? ` — ${esc(r.text)}` : ''}</li>`).join('')}</ul>` : ''}
</section>
</details>`;

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
    page({ path, title: tool.title, description: tool.description, body: wrap(`<h1>${esc(tool.title)}</h1><p>${esc(tool.description)}</p>${loading(tool.short || tool.title, path)}`), priority: '0.8' });
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
  body: wrap(`<h1 class="fq-sr">${BRAND} — free PDF &amp; image tools: resize, compress, convert, merge, sign and edit images and PDFs</h1>
<div class="fq-hero">What would you <span>like to do?</span></div>
<div class="fq-sub">Choose a tool to get started.</div>
<div class="fq-cards">
<a class="fq-card fq-teal" href="/resize-image"><h3>Image Resizer</h3><p>Resize images by dimensions or target file size.</p><small>JPG, PNG, WEBP, BMP</small><span class="fq-btn">Choose Image →</span></a>
<a class="fq-card fq-blue" href="/file-converter"><h3>PDF Converter</h3><p>Convert PDF, Word, and other supported document formats.</p><small>PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, RTF, ODT</small><span class="fq-btn">Choose PDF →</span></a>
<a class="fq-card fq-violet" href="/pdf-editor"><h3>PDF Editor</h3><p>Open PDFs and use available editing tools.</p><small>PDF</small><span class="fq-btn">Open PDF Editor →</span></a>
<a class="fq-card fq-rose fq-m" href="/pdf-compressor"><h3>Compress PDF</h3><p>Make a PDF file smaller, ready to send or upload.</p><small>PDF</small><span class="fq-btn">Compress PDF →</span></a>
<a class="fq-card fq-orange fq-m" href="/merge-pdf"><h3>Merge PDF</h3><p>Combine several PDFs and images into one PDF.</p><small>PDF, JPG, PNG — pick two or more</small><span class="fq-btn">Choose Files →</span></a>
<a class="fq-card fq-sky fq-m" href="/delete-pages"><h3>Remove Pages</h3><p>Delete the pages you don’t need and save a new copy.</p><small>PDF, DOC, DOCX, ODT, RTF</small><span class="fq-btn">Choose File →</span></a>
</div>
<h2 class="fq-h2">Popular tools</h2>
${keyTools()}
<p class="fq-foot">Resize, compress, convert, merge, sign and edit images and PDFs — free, fast, no sign-up and no watermark. Get photos, signatures and PDFs to the exact size an online form asks for.</p>`),
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
