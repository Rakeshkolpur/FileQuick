import React from 'react';
import { useJsonLd } from '../../lib/seo';
import { getToolSeo } from '../../data/toolSeo';

/**
 * The SEO content block under a tool: a short "how to" explainer, numbered
 * steps and an FAQ — plus HowTo / FAQPage / SoftwareApplication structured
 * data so the page can win rich results and rank for "how to <task>" queries.
 *
 * Renders nothing for tools with no entry in src/data/toolSeo.js.
 */
const ToolSeoContent = ({ tool }) => {
  const seo = tool ? getToolSeo(tool.id) : null;

  const graph = [];
  if (seo) {
    if (seo.steps?.length) {
      graph.push({
        '@type': 'HowTo',
        name: seo.h1 || `How to use ${tool.title}`,
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
      '@type': 'SoftwareApplication',
      name: tool.title,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (web browser)',
      description: tool.description,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    });
  }

  useJsonLd(
    seo ? `tool-${tool.id}` : 'tool-none',
    seo ? { '@context': 'https://schema.org', '@graph': graph } : null,
  );

  if (!seo) return null;

  return (
    <section className="max-w-3xl">
      <h2 className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white mb-3">
        <span className="h-4 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
        {seo.h1 || `How to use ${tool.title}`}
      </h2>

      {seo.intro && (
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{seo.intro}</p>
      )}

      {seo.steps?.length > 0 && (
        <ol className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-200">
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
    </section>
  );
};

export default ToolSeoContent;
