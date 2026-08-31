import React from 'react';

const STEPS = [
  { n: 1, title: 'Pick a tool', text: 'Choose from resize, compress, convert, merge, sign and more.' },
  { n: 2, title: 'Add your file', text: 'Drag & drop, browse your device, or paste from the clipboard.' },
  { n: 3, title: 'Download', text: 'Grab the result instantly — no account and no watermark.' },
];

const HowItWorks = () => (
  <section>
    <h2 className="flex items-center gap-3 text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-8">
      <span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
      How it works
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {STEPS.map((s) => (
        <div
          key={s.n}
          className="rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 p-6"
        >
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-white font-bold mb-4">
            {s.n}
          </span>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{s.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{s.text}</p>
        </div>
      ))}
    </div>
  </section>
);

export default HowItWorks;
