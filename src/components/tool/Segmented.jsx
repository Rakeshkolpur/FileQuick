import React from 'react';

// Active-tab text colour, keyed by `accent`. Defaults to the site-wide
// purple everywhere this is used; a caller can opt into a different accent
// for its own screen without affecting any other tool.
const ACTIVE_TEXT = {
  purple: 'text-purple-700 dark:text-purple-300',
  blue: 'text-blue-700 dark:text-blue-300',
};

const Segmented = ({ options, value, onChange, className = '', accent = 'purple' }) => (
  <div className={`inline-flex w-full p-1 rounded-xl bg-gray-100 dark:bg-gray-700/60 ${className}`}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          value === o.value
            ? `bg-white dark:bg-gray-800 shadow-sm ${ACTIVE_TEXT[accent] || ACTIVE_TEXT.purple}`
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export default Segmented;
