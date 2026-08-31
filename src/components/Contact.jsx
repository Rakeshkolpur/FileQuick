import React from 'react';
import { usePageMeta } from '../lib/seo';

const EMAIL = 'mju646139@gmail.com';

const Contact = () => {
  usePageMeta({
    title: 'Contact Us',
    description: 'Get in touch with the FileQuick team — questions, bug reports, feature requests and feedback.',
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Contact Us</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        Questions, bug reports, feature requests or feedback — we&apos;d love to hear from you.
        We usually reply within a couple of days.
      </p>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/60">
        <div className="flex items-start gap-4 p-5">
          <span className="mt-0.5 h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4zM4 7l8 6 8-6" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Email</p>
            <a href={`mailto:${EMAIL}`} className="text-sm text-purple-600 dark:text-purple-400 hover:underline break-all">
              {EMAIL}
            </a>
          </div>
        </div>

        <div className="flex items-start gap-4 p-5">
          <span className="mt-0.5 h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Location</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Tarnaka, Hyderabad, Telangana, India</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium text-gray-900 dark:text-white">A note on privacy:</span> most FileQuick
          tools run entirely in your browser and never send your files anywhere. Please don&apos;t attach
          sensitive documents to support emails — a description of the problem is enough.
        </p>
      </div>
    </div>
  );
};

export default Contact;
