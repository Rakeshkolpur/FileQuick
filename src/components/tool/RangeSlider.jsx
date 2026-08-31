import React from 'react';

const RangeSlider = ({ label, value, min, max, step = 1, onChange, suffix = '', hint, disabled = false }) => (
  <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
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
      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 accent-purple-600"
    />
    {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
  </div>
);

export default RangeSlider;
