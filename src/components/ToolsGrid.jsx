import React from 'react';
import { Link } from 'react-router-dom';
import { getToolTint } from '../data/tools';

const CATEGORY_SLUGS = new Set(['image', 'pdf']);

const ToolCard = ({ tool }) => (
  <Link
    to={`/${tool.id}`}
    className="group relative flex items-start gap-4 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 p-5 pr-8 transition-all duration-200 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-lg hover:shadow-purple-500/5 hover:-translate-y-0.5"
  >
    <span className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center p-2.5 ${getToolTint(tool)}`}>
      {tool.icon}
    </span>
    <span className="min-w-0">
      <span className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 dark:text-white">{tool.title}</span>
        {tool.status === 'soon' && (
          <span className="text-[9px] font-bold uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1.5 py-0.5 rounded">
            soon
          </span>
        )}
      </span>
      <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{tool.description}</span>
    </span>
    <svg
      className="absolute right-4 top-6 h-4 w-4 text-purple-400 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  </Link>
);

const ToolsGrid = ({ id, title, tools }) => {
  if (!tools?.length) return null;
  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <h2 className="flex items-center gap-3 text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          <span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
          {title}
        </h2>
        {CATEGORY_SLUGS.has(id) && (
          <Link
            to={`/${id}`}
            className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
          >
            View all →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
};

export default ToolsGrid;
