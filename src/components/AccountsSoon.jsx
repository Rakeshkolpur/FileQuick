import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/seo';

const AccountsSoon = ({ mode = 'login' }) => {
  const isSignup = mode === 'signup';
  usePageMeta({ title: isSignup ? 'Sign up' : 'Log in', description: 'FileQuick works fully without an account.' });

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
        {isSignup ? 'Accounts are coming soon' : 'Log in is coming soon'}
      </h1>
      <p className="mt-2 text-[15px] text-gray-600 dark:text-gray-300">
        You don&apos;t need an account to use FileQuick — every tool works right now, free, with nothing
        uploaded. Accounts will add saved history and presets later.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/"
          className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-600/25 hover:brightness-110"
        >
          Browse the tools
        </Link>
        {!isSignup && (
          <Link
            to="/signup"
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:border-purple-300 dark:border-gray-700 dark:text-gray-200"
          >
            Sign up instead
          </Link>
        )}
      </div>
    </div>
  );
};

export default AccountsSoon;
