import React from 'react';

const ICONS = {
  shield: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M12 3.75c-2.15 2.04-5.05 3.28-8.25 3.28h-.15A11.99 11.99 0 003 10.75c0 5.6 3.82 10.3 9 11.63 5.18-1.33 9-6.03 9-11.63 0-1.3-.21-2.57-.6-3.75h-.15c-3.2 0-6.1-1.24-8.25-3.28z" />
  ),
  bolt: <path strokeLinecap="round" strokeLinejoin="round" d="M13 3v7h6l-8 11v-7H5l8-11z" />,
  gift: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13M12 8V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zM5 12h14M6 12v7a2 2 0 002 2h8a2 2 0 002-2v-7M5 8h14v4H5z" />
  ),
  devices: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v3M15 12h5a1 1 0 011 1v6a1 1 0 01-1 1h-5a1 1 0 01-1-1v-6a1 1 0 011-1z" />
  ),
};

const ITEMS = [
  { icon: 'shield', title: 'Private by default', text: 'Image tools run entirely in your browser — nothing is uploaded.' },
  { icon: 'bolt', title: 'No waiting', text: 'Processing starts the instant you drop a file. No queues.' },
  { icon: 'gift', title: 'Free & unlimited', text: 'No sign-up, no watermark, no daily limits.' },
  { icon: 'devices', title: 'Works anywhere', text: 'Any modern browser on desktop, tablet or phone.' },
];

const TrustStrip = () => (
  <section className="rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200/70 dark:border-gray-700/50 py-10 px-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
      {ITEMS.map((it) => (
        <div key={it.title} className="flex flex-col items-center text-center">
          <span className="mb-3 w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center p-3">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} className="w-full h-full">
              {ICONS[it.icon]}
            </svg>
          </span>
          <h3 className="font-semibold text-gray-900 dark:text-white">{it.title}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-[15rem]">{it.text}</p>
        </div>
      ))}
    </div>
  </section>
);

export default TrustStrip;
