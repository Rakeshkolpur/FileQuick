import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Navigation.module.css';
import { useTheme } from '../context/ThemeContext';
import { NAV_CATEGORIES, getMenuColumns, getToolTint } from '../data/tools';
import Logo from './Logo';

const SunIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const MoonIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);
const Chevron = ({ open }) => (
  <svg
    className={`h-4 w-4 ml-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const IconChip = ({ children, tint }) => (
  <span
    className={`w-7 h-7 shrink-0 rounded-md flex items-center justify-center p-1.5 ${
      tint || 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300'
    }`}
  >
    {children}
  </span>
);

const MegaMenu = ({ columns, onNavigate }) => {
  const total = columns.reduce((n, c) => n + c.tools.length, 0);
  const cols = total <= 8 ? 2 : total <= 16 ? 3 : 4;
  let running = 0;

  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-40">
      <div
        className={`${styles.menuPanel} bg-white dark:bg-gray-800 rounded-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 p-4`}
      >
        <div
          style={{ columnCount: cols, columnGap: '1.5rem', width: `${cols * 196}px`, maxWidth: 'calc(100vw - 2rem)' }}
        >
          {columns.map((col) => (
            <div key={col.title} className="break-inside-avoid mb-4">
              {col.to ? (
                <Link
                  to={col.to}
                  onClick={onNavigate}
                  className="block px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 hover:text-purple-500 dark:text-gray-500 dark:hover:text-purple-400"
                >
                  {col.title}
                </Link>
              ) : (
                <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {col.title}
                </div>
              )}
              <div className="flex flex-col">
                {col.tools.map((t) => {
                  const delay = Math.min(running, 12) * 20;
                  running += 1;
                  return (
                    <Link
                      key={t.id}
                      to={`/${t.id}`}
                      onClick={onNavigate}
                      style={{ animationDelay: `${delay}ms` }}
                      className={`${styles.menuItem} flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-700/60 transition-colors`}
                    >
                      <IconChip tint={getToolTint(t)}>{t.icon}</IconChip>
                      <span className="whitespace-nowrap">{t.title}</span>
                      {t.status === 'soon' && (
                        <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1 py-0.5 rounded">
                          soon
                        </span>
                      )}
                    </Link>
                  );
                })}
                {col.more && (
                  <Link
                    to={col.more}
                    onClick={onNavigate}
                    className="mt-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    See all →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Navigation = () => {
  const { dark, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileGroup, setMobileGroup] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navClass = [
    styles.navbarSticky,
    scrolled ? styles.navbarScrolled : 'bg-white dark:bg-gray-800',
    scrolled && dark ? styles.dark : '',
    'border-b border-gray-200 dark:border-gray-700',
  ].join(' ');

  const closeAll = () => {
    setOpenDropdown(null);
    setMenuOpen(false);
    setMobileGroup(null);
  };

  return (
    <nav className={navClass}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center" onClick={closeAll} aria-label="FileQuick — home">
            <Logo markClassName="h-10 w-10" wordClassName="text-xl" showTagline />
          </Link>

          <div className="hidden md:flex items-center space-x-1">
            <Link
              to="/"
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-purple-600 dark:text-gray-200 dark:hover:text-purple-400"
            >
              Home
            </Link>
            {NAV_CATEGORIES.map((cat) => {
              const open = openDropdown === cat.slug;
              return (
                <div
                  key={cat.slug}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(cat.slug)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <Link
                    to={`/${cat.slug}`}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      open
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-gray-700 hover:text-purple-600 dark:text-gray-200 dark:hover:text-purple-400'
                    }`}
                  >
                    {cat.label}
                    {cat.badge && (
                      <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-px text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                        {cat.badge}
                      </span>
                    )}
                    <Chevron open={open} />
                  </Link>
                  {open && (
                    <MegaMenu columns={getMenuColumns(cat.slug)} onNavigate={closeAll} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link
              to="/login"
              onClick={closeAll}
              className="hidden md:inline-flex items-center rounded-lg border border-gray-200 px-3.5 py-1.5 text-sm font-semibold text-gray-700 hover:border-purple-300 hover:text-purple-700 dark:border-gray-600 dark:text-gray-200 dark:hover:border-purple-600"
            >
              Login
            </Link>
            <Link
              to="/signup"
              onClick={closeAll}
              className="hidden md:inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25 hover:bg-indigo-700"
            >
              Sign Up Free
            </Link>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden ml-1 p-2 rounded-md text-gray-500 dark:text-gray-400"
              aria-label="Menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className={`${styles.scaleIn} md:hidden pb-3 border-t border-gray-200 dark:border-gray-700`}>
            <Link
              to="/"
              onClick={closeAll}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Home
            </Link>
            {NAV_CATEGORIES.map((cat) => {
              const expanded = mobileGroup === cat.slug;
              return (
                <div key={cat.slug}>
                  <button
                    onClick={() => setMobileGroup(expanded ? null : cat.slug)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="flex items-center gap-1.5">
                      {cat.label}
                      {cat.badge && (
                        <span className="rounded bg-purple-600 px-1 py-px text-[9px] font-bold uppercase text-white">{cat.badge}</span>
                      )}
                    </span>
                    <Chevron open={expanded} />
                  </button>
                  {expanded && (
                    <div className="pb-2">
                      {getMenuColumns(cat.slug).map((col) => (
                        <div key={col.title} className="mt-1">
                          <div className="px-5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            {col.title}
                          </div>
                          {col.tools.map((t) => (
                            <Link
                              key={t.id}
                              to={`/${t.id}`}
                              onClick={closeAll}
                              className="flex items-center gap-3 px-5 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <IconChip tint={getToolTint(t)}>{t.icon}</IconChip>
                              <span>{t.title}</span>
                              {t.status === 'soon' && (
                                <span className="ml-auto text-[9px] font-semibold uppercase bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1 rounded">
                                  soon
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="mt-3 flex gap-2 px-3">
              <Link
                to="/login"
                onClick={closeAll}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-center text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                Login
              </Link>
              <Link
                to="/signup"
                onClick={closeAll}
                className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 py-2 text-center text-sm font-semibold text-white"
              >
                Sign Up Free
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
