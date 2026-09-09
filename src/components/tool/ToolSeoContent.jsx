import React from 'react';
import { Link } from 'react-router-dom';
import { useJsonLd } from '../../lib/seo';
import { getToolSeo } from '../../data/toolSeo';
import { getToolById } from '../../data/tools';

const SITE_ORIGIN = (import.meta.env.VITE_SITE_URL
  || (typeof window !== 'undefined' ? window.location.origin : 'https://filequik.in')).replace(/\/+$/, '');

const CATEGORY_LABEL = { image: 'Image Tools', pdf: 'PDF Tools' };
const CATEGORY_PATH = { image: '/image', pdf: '/pdf' };

/**
 * The SEO content block under a tool: a short "how to" explainer, a few
 * paragraphs of genuinely useful copy, numbered steps, an FAQ and links to
 * related tools — plus HowTo / FAQPage / WebApplication / BreadcrumbList
 * structured data so the page can win rich results and rank for the queries
 * people actually type.
 *
 * Renders nothing for tools with no entry in src/data/toolSeo.js.
 */
const ToolSeoContent = ({ tool, seo: seoOverride }) => {
  const seo = seoOverride || (tool ? getToolSeo(tool.id) : null);
  const path = tool ? `/${tool.id}` : (seo?.path || '');

  const graph = [];
  if (seo) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
        ...(tool?.category
          ? [{
            '@type': 'ListItem',
            position: 2,
            name: CATEGORY_LABEL[tool.category] || 'Tools',
            item: `${SITE_ORIGIN}${CATEGORY_PATH[tool.category] || '/'}`,
          }]
          : []),
        {
          '@type': 'ListItem',
          position: tool?.category ? 3 : 2,
          name: seo.breadcrumb || tool?.title || seo.h1,
          item: `${SITE_ORIGIN}${path}`,
        },
      ],
    });
    if (seo.steps?.length) {
      graph.push({
        '@type': 'HowTo',
        name: seo.h1 || `How to use ${tool?.title || ''}`.trim(),
        description: seo.intro,
        step: seo.steps.map((text, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          text,
        })),
      });
    }
    if (seo.faqs?.length) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: seo.faqs.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      });
    }
    graph.push({
      '@type': 'WebApplication',
      name: `${tool?.title || seo.breadcrumb || 'FileQuick tool'} — FileQuick`,
      applicationCategory: tool?.category === 'pdf' ? 'BusinessApplication' : 'MultimediaApplication',
      operatingSystem: 'Any (web browser)',
      browserRequirements: 'Requires JavaScript. Works in Chrome, Firefox, Safari and Edge.',
      url: `${SITE_ORIGIN}${path}`,
      description: seo.seoDescription || seo.intro || tool?.description,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: 'FileQuick', url: `${SITE_ORIGIN}/` },
    });
  }

  useJsonLd(
    seo ? `tool-${tool?.id || 'x'}` : 'tool-none',
    seo ? { '@context': 'https://schema.org', '@graph': graph } : null,
  );

  if (!seo) return null;

  const body = Array.isArray(seo.body) ? seo.body : (seo.body ? [seo.body] : []);
  const related = (seo.related || [])
    .map((r) => (typeof r === 'string' ? { id: r } : r))
    .map((r) => ({ ...r, tool: getToolById(r.id) }))
    .filter((r) => r.tool);

  return (
    <section className="max-w-3xl">
      <h2 className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white mb-3">
        <span className="h-4 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
        {seo.h1 || `How to use ${tool?.title || ''}`}
      </h2>

      {seo.intro && (
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{seo.intro}</p>
      )}

      {body.length > 0 && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          {body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}

      {seo.steps?.length > 0 && (
        <ol className="mt-5 space-y-2 text-sm text-gray-700 dark:text-gray-200">
          {seo.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-[11px] font-bold text-purple-700 dark:text-purple-300">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}

      {seo.faqs?.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
            Frequently asked questions
          </h3>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 border-y border-gray-200 dark:border-gray-700">
            {seo.faqs.map(({ q, a }, i) => (
              <details key={i} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-gray-800 dark:text-gray-100">
                  {q}
                  <svg
                    className="h-4 w-4 flex-none text-gray-400 transition-transform group-open:rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{a}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Related tools</h3>
          <ul className="space-y-1.5 text-sm">
            {related.map(({ id, tool: rt, text }) => (
              <li key={id}>
                <Link
                  to={`/${id}`}
                  className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                >
                  {rt.title}
                </Link>
                {text ? <span className="text-gray-500 dark:text-gray-400"> — {text}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default ToolSeoContent;
