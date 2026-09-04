import React from 'react';
import { getHomeDesign, setHomeDesign } from '../../lib/uiFlags';

// Dev-only switch between the new and classic landing pages. Remove once v2 is
// final (along with lib/uiFlags.js and HomeClassic.jsx).
const HomeDesignToggle = () => {
  const current = getHomeDesign();
  const next = current === 'v2' ? 'classic' : 'v2';
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={() => { setHomeDesign(next); window.location.reload(); }}
        className="text-xs font-medium text-gray-400 underline decoration-dotted underline-offset-2 hover:text-purple-600 dark:hover:text-purple-400"
      >
        {next === 'classic' ? 'Switch to the classic homepage' : 'Try the new homepage'}
      </button>
    </div>
  );
};

export default HomeDesignToggle;
