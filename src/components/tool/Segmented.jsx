import React from 'react';

const Segmented = ({ options, value, onChange, className = '' }) => (
  <div className={`inline-flex w-full p-1 rounded-xl bg-gray-100 dark:bg-gray-700/60 ${className}`}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          value === o.value
            ? 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export default Segmented;
