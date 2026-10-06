import React from 'react';
import { Link } from 'react-router-dom';
import { getLandingGroup } from '../../data/landingPages';

// Which landing-page groups to link from which tool.
const GROUPS_FOR_TOOL = {
  'compress-image': [['image-size', 'Compress to a specific size']],
  'resize-image': [['image-size', 'Need a file size in KB instead?']],
  'pdf-compressor': [['pdf-size', 'Compress a PDF to a specific size']],
  'exam-photo-resizer': [['exam', 'Ready-made exam presets'], ['image-size', 'Just need a file size?']],
  'signature-resizer': [['exam', 'Ready-made exam presets']],
  'passport-photo': [['exam', 'Exam & application form photos']],
};

/**
 * Internal links to the indexable landing pages (sizes, exam presets) shown
 * under their parent tool and under each landing page, so visitors and
 * crawlers can reach them.
 */
const LandingLinks = ({ toolId, currentSlug }) => {
  const groups = (GROUPS_FOR_TOOL[toolId] || [])
    .map(([key, heading]) => ({ heading, pages: getLandingGroup(key) }))
    .filter((g) => g.pages.length);
  if (!groups.length) return null;

  return (
    <>
      {groups.map(({ heading, pages }) => (
        <section key={heading}>
          <h2 className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white mb-4">
            <span className="h-4 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
            {heading}
          </h2>
          <div className="flex flex-wrap gap-2">
            {pages.map((p) => {
              const active = currentSlug === p.slug;
              return (
                <Link
                  key={p.slug}
                  to={`/${p.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                    active
                      ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:text-purple-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-purple-700 dark:hover:text-purple-300'
                  }`}
                >
                  {p.h1}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
};

export default LandingLinks;
