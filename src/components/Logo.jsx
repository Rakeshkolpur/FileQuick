import React from 'react';

/**
 * FileQuick logo. The badge is a self-contained SVG (reads on any background);
 * the wordmark is HTML so it follows the light/dark theme.
 */
export const LogoMark = ({ className = 'h-9 w-9' }) => (
  <svg className={className} viewBox="0 0 48 44" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FileQuick">
    <defs>
      <linearGradient id="fq-badge" x1="12" y1="2" x2="46" y2="42" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2563EB" />
        <stop offset="0.55" stopColor="#4F46E5" />
        <stop offset="1" stopColor="#7C3AED" />
      </linearGradient>
    </defs>

    {/* speed trail */}
    <rect x="0" y="12" width="8" height="3" rx="1.5" fill="#EF4444" />
    <rect x="0" y="18.5" width="10.5" height="3" rx="1.5" fill="#22C55E" />
    <rect x="1.6" y="25" width="7" height="3" rx="1.5" fill="#F59E0B" />

    {/* badge */}
    <rect x="12" y="2" width="34" height="40" rx="11" fill="url(#fq-badge)" />
    <path d="M38 2a8 8 0 0 1 8 8h-6a2 2 0 0 1-2-2V2Z" fill="#fff" fillOpacity="0.32" />

    {/* bold F */}
    <rect x="20" y="9" width="5.4" height="26" rx="1.4" fill="#fff" />
    <rect x="20" y="9" width="15" height="5.2" rx="1.4" fill="#fff" />
    <rect x="20" y="18" width="10.6" height="4.6" rx="1.4" fill="#fff" />

    {/* speed arrow curving up out of the F */}
    <path
      d="M23 33.4c3-4.6 7.3-6.7 12.9-6.4l-2.5-2.6a1.15 1.15 0 0 1 1.63-1.63l4.9 4.9a1.15 1.15 0 0 1 0 1.63l-4.9 4.9a1.15 1.15 0 0 1-1.63-1.63l2.6-2.6c-4.4-.25-7.8 1.4-10.2 5.1a1.35 1.35 0 0 1-2.4-1.24Z"
      fill="#BFDBFE"
    />
  </svg>
);

const Logo = ({ className = '', markClassName = 'h-9 w-9', wordClassName = 'text-[1.35rem]', showTagline = false }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <LogoMark className={markClassName} />
    <span className="leading-none">
      <span className={`${wordClassName} font-extrabold tracking-tight`}>
        <span className="text-gray-900 dark:text-white">File</span>
        <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Quick</span>
      </span>
      {showTagline && (
        <span className="block text-[0.58rem] font-semibold tracking-[0.14em] text-gray-500 dark:text-gray-400 mt-1">
          ALL YOUR FILE TOOLS.{' '}
          <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">ONE PLACE.</span>
        </span>
      )}
    </span>
  </span>
);

export default Logo;
