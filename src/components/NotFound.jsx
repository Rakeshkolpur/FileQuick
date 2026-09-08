import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/seo';

const NotFound = () => {
  usePageMeta({ title: 'Page not found', description: 'That page doesn’t exist.', robots: 'noindex, follow' });

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-5xl font-extrabold text-purple-600 dark:text-purple-400">404</p>
      <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">This page doesn’t exist</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        The link may be wrong, or the size you asked for is outside the supported range.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/compress-image"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Compress an image
        </Link>
        <Link
          to="/"
          className="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 dark:border-gray-600 dark:text-gray-200"
        >
          Browse all tools
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
