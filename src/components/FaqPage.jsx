import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/seo';
import FaqAccordion from './FaqAccordion';

const FaqPage = () => {
  usePageMeta({
    title: 'Frequently Asked Questions',
    description: 'Answers to common questions about FileQuick — pricing, privacy, file limits, supported formats and how the in-browser tools work.',
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h1>
      <p className="mt-3 mb-8 text-gray-600 dark:text-gray-300">
        Everything you might want to know about how FileQuick works. Still stuck?{' '}
        <Link to="/contact" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Get in touch
        </Link>
        .
      </p>

      <FaqAccordion />
    </div>
  );
};

export default FaqPage;
