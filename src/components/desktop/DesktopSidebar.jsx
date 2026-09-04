import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LuHome, LuFileText, LuImage, LuFileType2, LuRepeat, LuLayoutGrid,
  LuClock, LuStar, LuSettings, LuInfo, LuChevronRight, LuMoon, LuSun,
} from 'react-icons/lu';
import { useTheme } from '../../context/ThemeContext';
import { desktopInfo } from '../../lib/desktop';
import Logo from '../Logo';

const NAV = [
  { to: '/', label: 'Home', end: true, Icon: LuHome },
  { to: '/pdf', label: 'PDF Tools', Icon: LuFileText, tint: 'text-rose-500 bg-rose-500/10' },
  { to: '/image', label: 'Image Tools', Icon: LuImage, tint: 'text-emerald-500 bg-emerald-500/10' },
  { to: '/document-tools', label: 'Document Tools', Icon: LuFileType2, tint: 'text-blue-500 bg-blue-500/10' },
  { to: '/convert', label: 'Converter Tools', Icon: LuRepeat, tint: 'text-violet-500 bg-violet-500/10' },
  { to: '/all-tools', label: 'All Tools', Icon: LuLayoutGrid, tint: 'text-gray-500 bg-gray-500/10' },
];

const SECONDARY = [
  { to: '/recent-files', label: 'Recent Files', Icon: LuClock },
  { to: '/favorites', label: 'Favorites', Icon: LuStar },
];

const FOOTER = [
  { to: '/settings', label: 'Settings', Icon: LuSettings },
  { to: '/about', label: 'About', Icon: LuInfo },
];

const Item = (n) => (
  <NavLink
    to={n.to}
    end={n.end}
    className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
      isActive
        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
    }`}
  >
    {({ isActive }) => (
      <>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${isActive ? 'bg-white/15 text-white' : n.tint || 'text-gray-400'}`}>
          <n.Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="flex-1 truncate">{n.label}</span>
        <LuChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isActive ? 'text-white/70' : 'text-gray-300 dark:text-gray-600'} group-hover:translate-x-0.5`} />
      </>
    )}
  </NavLink>
);

const DesktopSidebar = () => {
  const { dark, toggle } = useTheme();
  const [version, setVersion] = useState('');

  useEffect(() => {
    desktopInfo().then((info) => info && setVersion(info.version));
  }, []);

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-white/10 dark:bg-gray-950">
      <div className="p-5">
        <Logo markClassName="h-10 w-10" wordClassName="text-xl" showTagline />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map((n) => <Item key={n.to} {...n} />)}
        <div className="my-3 border-t border-gray-100 dark:border-white/5" />
        {SECONDARY.map((n) => <Item key={n.to} {...n} />)}
        <div className="my-3 border-t border-gray-100 dark:border-white/5" />
        {FOOTER.map((n) => <Item key={n.to} {...n} />)}
      </nav>

      <div className="border-t border-gray-100 p-4 dark:border-white/5">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-[14px] font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {dark ? <LuMoon className="h-4 w-4 shrink-0" /> : <LuSun className="h-4 w-4 shrink-0" />}
            <span className="truncate">Dark Mode</span>
          </span>
          <span className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${dark ? 'bg-indigo-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 block h-4 w-4 rounded-full bg-white shadow transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`} />
          </span>
        </button>
        <p className="mt-3 px-2 text-[11px] text-gray-400 dark:text-gray-500">
          FileQuick Desktop {version ? `v${version}` : ''}
        </p>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
