import React from 'react';
import { Link } from 'react-router-dom';
import { SEO_SIZE_PRESETS, FORMATS, presetPath } from '../../lib/targetSizeUrl';

/**
 * Internal links to the indexable "compress to <size>" presets. Shown under the
 * Compress Image tool and every preset page so search engines (and visitors)
 * can reach the configured sizes. Only SEO_SIZE_PRESETS appear here — arbitrary
 * sizes still work by URL but are deliberately not linked or indexed.
 */
const TargetSizeLinks = ({ currentSlug }) => {
  if (!SEO_SIZE_PRESETS.length) return null;

  return (
    <section>
      <h2 className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white mb-4">
        <span className="h-4 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
        Compress to a specific size
      </h2>
      <div className="flex flex-wrap gap-2">
        {SEO_SIZE_PRESETS.map((p) => {
          const label = `${(FORMATS[p.format]?.label) || p.format.toUpperCase()} to ${p.kb} KB`;
          const active = currentSlug === `${p.format}-to-${p.kb}kb`;
          return (
            <Link
              key={`${p.format}-${p.kb}`}
              to={presetPath(p)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:text-purple-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-purple-700 dark:hover:text-purple-300'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default TargetSizeLinks;
