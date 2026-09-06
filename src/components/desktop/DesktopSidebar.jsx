import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LuHome, LuFileText, LuImage, LuFileType2, LuRepeat, LuLayoutGrid,
  LuClock, LuStar, LuSettings, LuInfo, LuChevronRight, LuChevronsLeft, LuMoon, LuSun,
} from 'react-icons/lu';
import { useTheme } from '../../context/ThemeContext';
import { desktopInfo } from '../../lib/desktop';
import Logo, { LogoMark } from '../Logo';

const COLLAPSE_KEY = 'fq.desktop.sidebarCollapsed';

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

const Item = ({ collapsed, ...n }) => (
  <NavLink
    to={n.to}
    end={n.end}
    title={collapsed ? n.label : undefined}
    className={({ isActive }) => `group flex items-center rounded-xl py-2.5 text-[14px] font-medium transition-colors ${
      collapsed ? 'justify-center px-0' : 'gap-3 px-3'
    } ${
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
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{n.label}</span>
            <LuChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isActive ? 'text-white/70' : 'text-gray-300 dark:text-gray-600'} group-hover:translate-x-0.5`} />
          </>
        )}
      </>
    )}
  </NavLink>
);

const DesktopSidebar = () => {
  const { dark, toggle } = useTheme();
  const [version, setVersion] = useState('');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    desktopInfo().then((info) => info && setVersion(info.version));
  }, []);

  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c;
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  return (
    <aside
      style={{ width: collapsed ? 76 : 288, transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
      className="relative flex h-screen shrink-0 flex-col border-r border-gray-200 bg-white dark:border-white/10 dark:bg-gray-950"
    >
      {/* collapse / expand handle — sits on the edge */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-7 z-20 grid h-6 w-6 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-all hover:scale-110 hover:text-indigo-600 dark:border-white/15 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-indigo-400"
      >
        <LuChevronsLeft className={`h-3.5 w-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
      </button>

      <div className={`flex items-center overflow-hidden ${collapsed ? 'justify-center p-4' : 'p-5'}`}>
        {collapsed
          ? <LogoMark className="h-9 w-9" />
          : <Logo markClassName="h-10 w-10" wordClassName="text-xl" showTagline />}
      </div>

      <nav className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2.5' : 'px-3'}`}>
        {NAV.map((n) => <Item key={n.to} collapsed={collapsed} {...n} />)}
        <div className="my-3 border-t border-gray-100 dark:border-white/5" />
        {SECONDARY.map((n) => <Item key={n.to} collapsed={collapsed} {...n} />)}
        <div className="my-3 border-t border-gray-100 dark:border-white/5" />
        {FOOTER.map((n) => <Item key={n.to} collapsed={collapsed} {...n} />)}
      </nav>

      <div className={`border-t border-gray-100 dark:border-white/5 ${collapsed ? 'p-2.5' : 'p-4'}`}>
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? (dark ? 'Switch to light mode' : 'Switch to dark mode') : undefined}
          className={`flex w-full items-center rounded-xl py-2 text-[14px] font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5 ${
            collapsed ? 'justify-center px-0' : 'justify-between px-2'
          }`}
        >
          {collapsed ? (
            dark ? <LuMoon className="h-4 w-4" /> : <LuSun className="h-4 w-4" />
          ) : (
            <>
              <span className="flex min-w-0 items-center gap-2.5">
                {dark ? <LuMoon className="h-4 w-4 shrink-0" /> : <LuSun className="h-4 w-4 shrink-0" />}
                <span className="truncate">Dark Mode</span>
              </span>
              <span className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${dark ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 block h-4 w-4 rounded-full bg-white shadow transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`} />
              </span>
            </>
          )}
        </button>
        {!collapsed && (
          <p className="mt-3 px-2 text-[11px] text-gray-400 dark:text-gray-500">
            FileQuick Desktop {version ? `v${version}` : ''}
          </p>
        )}
      </div>
    </aside>
  );
};

export default DesktopSidebar;
