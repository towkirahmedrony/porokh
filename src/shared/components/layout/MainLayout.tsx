import React, { useEffect, Suspense, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AppMessageKey } from '@/shared/i18n/messages';

const updateMetaTag = (
  selector: string,
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string
) => {
  let tag = document.querySelector<HTMLMetaElement>(selector);

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attributeName, attributeValue);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
};

const updateSeoMeta = (
  pathname: string,
  t: (key: AppMessageKey) => string
) => {
  const routeTitleMap: Record<string, string> = {
    '/dashboard': t('meta.dashboardTitle'),
    '/dashboard/home': t('meta.dashboardTitle'),
    '/dashboard/question-bank': t('meta.route.questionBank'),
    '/question-bank': t('meta.route.questionBank'),
    '/dashboard/arena': t('meta.route.arena'),
    '/exam/live': t('meta.route.arena'),
    '/dashboard/leaderboard': t('meta.route.leaderboard'),
    '/dashboard/progress': t('meta.route.progress'),
    '/progress': t('meta.route.progress'),
    '/dashboard/streak': t('meta.route.streak'),
  };

  const title = pathname.startsWith('/admission')
    ? t('meta.route.admission')
    : routeTitleMap[pathname] ?? t('meta.dashboardTitle');

  document.title = title;

  // Every route inside the app shell is behind auth and holds personal data,
  // so it must never be indexed. Public pages reset this in `usePageMeta`.
  updateMetaTag('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');

  updateMetaTag(
    'meta[name="description"]',
    'name',
    'description',
    t('meta.description')
  );

  updateMetaTag('meta[property="og:title"]', 'property', 'og:title', title);

  updateMetaTag(
    'meta[property="og:description"]',
    'property',
    'og:description',
    t('meta.description')
  );

  updateMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);

  updateMetaTag(
    'meta[name="twitter:description"]',
    'name',
    'twitter:description',
    t('meta.description')
  );
};

export const MainLayout: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { language, t } = useLanguage();

  useEffect(() => {
    updateSeoMeta(location.pathname, t);
  }, [location.pathname, language, t]);


  return (
    <div className="flex h-screen overflow-hidden bg-app text-text-primary transition-colors duration-500">
      <Sidebar />

      <div className="relative flex w-full flex-1 flex-col">
        <Header />

        <main
          className="scrollbar-hide flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 md:p-6 md:pb-6"
          aria-label={t('layout.mainAria')}
        >
          <div className="mx-auto min-h-[calc(100vh-100px)] w-full max-w-7xl">
            <Suspense fallback={null}>{children ?? <Outlet />}</Suspense>
          </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 z-50 bg-nav-bg md:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
