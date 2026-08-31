import React from 'react';
import { Link } from 'react-router-dom';
import { getToolsByCategory } from '../../data/tools';

const RelatedTools = ({ category, currentId }) => {
  const tools = getToolsByCategory(category)
    .filter((t) => t.id !== currentId)
    .slice(0, 7);
  if (!tools.length) return null;

  return (
    <section>
      <h2 className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white mb-4">
        <span className="h-4 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
        Related tools
      </h2>
      <div className="flex flex-wrap gap-2">
        {tools.map((t) => (
          <Link
            key={t.id}
            to={`/${t.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:border-purple-300 dark:hover:border-purple-700 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
          >
            <span className="w-4 h-4 text-purple-500 dark:text-purple-400">{t.icon}</span>
            {t.title}
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RelatedTools;
