import React from 'react';

// Defaults to the site-wide purple everywhere this is used; a caller can
// opt into a different accent for its own screen without affecting any
// other tool.
const VALUE_TEXT = {
  purple: 'text-purple-600 dark:text-purple-400',
  blue: 'text-blue-600 dark:text-blue-400',
};
const TRACK_ACCENT = {
  purple: 'accent-purple-600',
  blue: 'accent-blue-600',
};

const RangeSlider = ({ label, value, min, max, step = 1, onChange, suffix = '', hint, disabled = false, accent = 'purple' }) => (
  <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <span className={`text-sm font-semibold ${VALUE_TEXT[accent] || VALUE_TEXT.purple}`}>
        {value}
        {suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 ${TRACK_ACCENT[accent] || TRACK_ACCENT.purple}`}
    />
    {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
  </div>
);

export default RangeSlider;
