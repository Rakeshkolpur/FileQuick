import React from 'react';

const Panel = ({ title, action, children, className = '' }) => (
  <div
    className={`rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 p-5 md:p-6 ${className}`}
  >
    {(title || action) && (
      <div className="flex items-center justify-between gap-3 mb-4">
        {title && <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>}
        {action}
      </div>
    )}
    {children}
  </div>
);

export default Panel;
