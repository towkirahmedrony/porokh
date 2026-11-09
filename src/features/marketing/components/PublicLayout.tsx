import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Mail, Menu, X } from 'lucide-react';

import { usePageMeta } from '@/app/seo/usePageMeta';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { APP_LANGUAGES, LANGUAGE_OPTION_LABELS } from '@/shared/i18n/messages';
import { SUPPORT_CONFIG } from '@/shared/constants/supportConfig';
import { PUBLIC_CHROME } from '../content';

const NAV_ITEMS = [
  { key: 'home', to: '/', end: true },
  { key: 'about', to: '/about', end: false },
  { key: 'faq', to: '/faq', end: false },
  { key: 'contact', to: '/contact', end: false },
] as const;

const linkClass = (isActive: boolean): string =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
    isActive
      ? 'text-primary'
      : 'text-text-secondary hover:text-text-primary'
  }`;

const LanguageSwitch: React.FC<{ label: string }> = ({ label }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className="flex gap-1 rounded-lg border border-border-color bg-surface p-1"
      role="group"
      aria-label={label}
    >
      {APP_LANGUAGES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          onClick={() => setLanguage(option)}
          aria-pressed={language === option}
          className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            language === option
              ? 'bg-primary text-primary-foreground'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {LANGUAGE_OPTION_LABELS[option]}
        </button>
      ))}
    </div>
  );
};

/**
 * Shell for every public marketing page.
 *
 * It is rendered outside `PermissionGuard`, so an anonymous visitor can read
 * these pages, refresh them, and move between them without a session.
 */
export const PublicLayout: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const chrome = PUBLIC_CHROME[language];

  usePageMeta();

  // A menu left open across a navigation would cover the new page.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const year = new Date().getFullYear();

  return (
    <div
      className={`flex min-h-screen flex-col bg-app text-text-primary ${
        language === 'bn' ? "font-['Noto_Sans_Bengali']" : 'font-sans'
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-primary-foreground"
      >
        {chrome.nav.skipToContent}
      </a>

      <header className="sticky top-0 z-40 border-b border-border-color bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label="Porokh (পরোখ)"
          >
            <img
              src="/icons/header.webp"
              alt="Porokh (পরোখ)"
              width={720}
              height={240}
              className="h-9 w-auto object-contain"
            />
          </Link>

          <nav
            aria-label={chrome.nav.menu}
            className="hidden items-center gap-1 md:flex"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => linkClass(isActive)}
              >
                {chrome.nav[item.key]}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitch label={chrome.nav.languageLabel} />

            {user ? (
              <Link
                to="/dashboard/home"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {chrome.nav.dashboard}
              </Link>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {chrome.nav.login}
                </Link>
                <Link
                  to="/auth/register"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {chrome.nav.register}
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            aria-label={menuOpen ? chrome.nav.closeMenu : chrome.nav.menu}
            className="rounded-lg border border-border-color p-2 text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring md:hidden"
          >
            {menuOpen ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <Menu size={20} aria-hidden="true" />
            )}
          </button>
        </div>

        {menuOpen && (
          <div
            id="public-mobile-menu"
            className="border-t border-border-color bg-surface px-4 pb-5 pt-3 md:hidden"
          >
            <nav aria-label={chrome.nav.menu} className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                      isActive
                        ? 'bg-surface-elevated text-primary'
                        : 'text-text-secondary'
                    }`
                  }
                >
                  {chrome.nav[item.key]}
                </NavLink>
              ))}
            </nav>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border-color pt-3">
              <LanguageSwitch label={chrome.nav.languageLabel} />

              {user ? (
                <Link
                  to="/dashboard/home"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  {chrome.nav.dashboard}
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/auth/login"
                    className="rounded-lg border border-border-color px-3 py-2 text-sm font-semibold text-text-primary"
                  >
                    {chrome.nav.login}
                  </Link>
                  <Link
                    to="/auth/register"
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                  >
                    {chrome.nav.register}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border-color bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-1">
            <img
              src="/icons/header.webp"
              alt="Porokh (পরোখ)"
              width={720}
              height={240}
              className="h-8 w-auto object-contain"
            />
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              {chrome.footer.blurb}
            </p>
          </div>

          <nav aria-label={chrome.footer.platformTitle}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              {chrome.footer.platformTitle}
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/" className="text-text-primary hover:text-primary">
                  {chrome.footer.home}
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-text-primary hover:text-primary"
                >
                  {chrome.footer.about}
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-text-primary hover:text-primary">
                  {chrome.footer.faq}
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-text-primary hover:text-primary"
                >
                  {chrome.footer.contact}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={chrome.footer.legalTitle}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              {chrome.footer.legalTitle}
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-text-primary hover:text-primary"
                >
                  {chrome.footer.privacy}
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-conditions"
                  className="text-text-primary hover:text-primary"
                >
                  {chrome.footer.terms}
                </Link>
              </li>
              <li>
                <Link
                  to="/cookie-policy"
                  className="text-text-primary hover:text-primary"
                >
                  {chrome.footer.cookies}
                </Link>
              </li>
              <li>
                <Link
                  to="/data-deletion"
                  className="text-text-primary hover:text-primary"
                >
                  {chrome.footer.dataDeletion}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={chrome.footer.supportTitle}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              {chrome.footer.supportTitle}
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href={`mailto:${SUPPORT_CONFIG.EMAIL}`}
                  className="inline-flex items-center gap-2 text-text-primary hover:text-primary"
                >
                  <Mail size={16} aria-hidden="true" />
                  {chrome.footer.email}
                </a>
              </li>
              <li>
                <a
                  href={SUPPORT_CONFIG.FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-primary hover:text-primary"
                >
                  {chrome.footer.facebook}
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-border-color">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              © {year} Porokh (পরোখ). {chrome.footer.rights}
            </p>
            <p>Bangladesh</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
