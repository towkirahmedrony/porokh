/**
 * Public site identity and per-page SEO data.
 *
 * This module is the single source of truth shared by the running app (page
 * metadata on navigation) and the build (`vite.config.ts` renders one static
 * HTML file per public route). Keeping both readers on the same data means the
 * title a crawler receives and the title React applies after a route change can
 * never drift apart.
 *
 * Keep it dependency-free apart from plain constants: `vite.config.ts` imports
 * it through esbuild, where the `@/` alias does not exist.
 */
import { SUPPORT_CONFIG } from '../../shared/constants/supportConfig';

export const SITE = {
  name: 'Porokh',
  nameBn: 'পরোখ',
  /**
   * Primary and only canonical origin of the website.
   *
   * Must match `public/sitemap.xml`, `public/robots.txt` and `public/llms.txt`
   * byte for byte; `publicPages.test.ts` fails if they drift. The legacy
   * `parapothexam.web.app` deployment is intentionally absent from every
   * canonical, Open Graph and structured-data URL.
   */
  url: 'https://porokhbd.vercel.app',
  logoPath: '/icons/porokh-icon.webp',
  ogImagePath: '/icons/header.webp',
  ogImageAlt: 'Porokh (পরোখ) — Bangladesh exam preparation platform',
  locale: 'bn_BD',
  /** Primary content language of the public pages. */
  language: 'bn',
  category: 'Educational technology platform',
} as const;

export type PublicPageId =
  | 'home'
  | 'about'
  | 'faq'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'cookies'
  | 'dataDeletion';

export interface PublicPage {
  id: PublicPageId;
  /** Canonical path, no trailing slash (except the root). */
  path: string;
  /** Unique <title> / og:title. */
  title: string;
  /** Unique meta description / og:description. */
  description: string;
  /** Short label used in breadcrumb structured data and internal links. */
  breadcrumbLabel: string;
}

export const PUBLIC_PAGES: readonly PublicPage[] = [
  {
    id: 'home',
    path: '/',
    title: 'Porokh (পরোখ) — SSC, HSC & Admission Exam Practice',
    description:
      'Porokh (পরোখ) is an exam practice platform for SSC, HSC and university admission tests in Bangladesh, with MCQ practice, model tests and question banks.',
    breadcrumbLabel: 'Home',
  },
  {
    id: 'about',
    path: '/about',
    title: 'About Porokh (পরোখ) — Exam Practice for Bangladesh',
    description:
      'What Porokh (পরোখ) is, who it is built for, and how it helps SSC, HSC and admission candidates in Bangladesh prepare through regular practice.',
    breadcrumbLabel: 'About',
  },
  {
    id: 'faq',
    path: '/faq',
    title: 'Porokh FAQ — Exams, Accounts and Practice',
    description:
      'Answers to common questions about Porokh (পরোখ): what the platform offers, how to start practising, and how student accounts and data work.',
    breadcrumbLabel: 'FAQ',
  },
  {
    id: 'contact',
    path: '/contact',
    title: 'Contact Porokh — Student Support',
    description:
      'Contact the Porokh (পরোখ) team for help with your account, exam practice, payments or data requests. Reach us by email or through our Facebook page.',
    breadcrumbLabel: 'Contact',
  },
  {
    id: 'privacy',
    path: '/privacy-policy',
    title: 'Porokh Privacy Policy — Student Data and Privacy',
    description:
      'How Porokh (পরোখ) collects, uses, stores and protects student data, and the choices you have over the information saved in your account.',
    breadcrumbLabel: 'Privacy Policy',
  },
  {
    id: 'terms',
    path: '/terms-conditions',
    title: 'Porokh Terms & Conditions — Platform Rules',
    description:
      'The rules for using Porokh (পরোখ): accounts, exam practice, acceptable use, premium plans and the limits of the service.',
    breadcrumbLabel: 'Terms & Conditions',
  },
  {
    id: 'cookies',
    path: '/cookie-policy',
    title: 'Porokh Cookie Policy — Cookies and Storage',
    description:
      'Which cookies and browser storage Porokh (পরোখ) uses, why they are needed for sign-in, language and exam progress, and how to control them.',
    breadcrumbLabel: 'Cookie Policy',
  },
  {
    id: 'dataDeletion',
    path: '/data-deletion',
    title: 'Porokh Data Deletion — Remove Your Account',
    description:
      'How to request deletion of your Porokh (পরোখ) account and personal data, what is removed, and how long the process takes.',
    breadcrumbLabel: 'Data Deletion',
  },
];

const PUBLIC_PAGE_BY_PATH = new Map(
  PUBLIC_PAGES.map((page) => [page.path, page] as const)
);

/** Trims query, hash and trailing slashes so `/about/` matches `/about`. */
export const normalizePath = (pathname: string): string => {
  const path = (pathname || '/').split('?')[0].split('#')[0];
  if (path.length > 1) return path.replace(/\/+$/, '');
  return path || '/';
};

export const findPublicPage = (pathname: string): PublicPage | undefined =>
  PUBLIC_PAGE_BY_PATH.get(normalizePath(pathname));

export const absoluteUrl = (path: string): string =>
  path === '/' ? `${SITE.url}/` : `${SITE.url}${normalizePath(path)}`;

const ORGANIZATION_ID = `${SITE.url}/#organization`;
const WEBSITE_ID = `${SITE.url}/#website`;
const APP_ID = `${SITE.url}/#software`;

const organization = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: SITE.name,
  alternateName: SITE.nameBn,
  url: absoluteUrl('/'),
  logo: {
    '@type': 'ImageObject',
    url: absoluteUrl(SITE.logoPath),
  },
  description:
    'Porokh (পরোখ) is a Bangladesh-focused educational technology platform where students prepare for SSC, HSC, board and university admission examinations.',
  areaServed: {
    '@type': 'Country',
    name: 'Bangladesh',
  },
  email: SUPPORT_CONFIG.EMAIL,
  sameAs: [SUPPORT_CONFIG.FACEBOOK_URL],
};

const website = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: SITE.name,
  alternateName: SITE.nameBn,
  url: absoluteUrl('/'),
  inLanguage: ['bn', 'en'],
  publisher: { '@id': ORGANIZATION_ID },
};

/**
 * Structured data for one public page, as a single `@graph` document.
 *
 * Only statements the product can back up are emitted: no ratings, no review
 * counts, no prices and no founder or address details.
 */
export const buildPageJsonLd = (page: PublicPage): Record<string, unknown> => {
  const url = absoluteUrl(page.path);

  const graph: Record<string, unknown>[] = [organization, website];

  if (page.id === 'home') {
    graph.push({
      '@type': 'SoftwareApplication',
      '@id': APP_ID,
      name: SITE.name,
      alternateName: SITE.nameBn,
      url: absoluteUrl('/'),
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web, Android',
      inLanguage: ['bn', 'en'],
      description:
        'Exam preparation app for students in Bangladesh: chapter-wise MCQ practice, timed model tests, question banks and admission test preparation.',
      publisher: { '@id': ORGANIZATION_ID },
    });
  }

  graph.push({
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    description: page.description,
    isPartOf: { '@id': WEBSITE_ID },
    inLanguage: SITE.language,
  });

  if (page.id !== 'home') {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: absoluteUrl('/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: page.breadcrumbLabel,
          item: url,
        },
      ],
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Head block for one public page.
 *
 * Rendered into `index.html` (which serves the homepage and every app route)
 * and into the prerendered `dist/<path>/index.html` files. The markers around
 * this block in `index.html` are what the build replaces.
 */
export const renderSeoHead = (page: PublicPage): string => {
  const url = absoluteUrl(page.path);
  const image = absoluteUrl(SITE.ogImagePath);
  const jsonLd = JSON.stringify(buildPageJsonLd(page), null, 2)
    // A literal `</script>` inside the payload would close the tag early.
    .replace(/</g, '\\u003c')
    .replace(/\n/g, '\n    ');

  return [
    `    <title>${escapeHtml(page.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(page.description)}" />`,
    `    <link rel="canonical" href="${escapeHtml(url)}" />`,
    `    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`,
    '',
    '    <meta property="og:type" content="website" />',
    `    <meta property="og:site_name" content="${SITE.name}" />`,
    `    <meta property="og:locale" content="${SITE.locale}" />`,
    `    <meta property="og:url" content="${escapeHtml(url)}" />`,
    `    <meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `    <meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `    <meta property="og:image" content="${escapeHtml(image)}" />`,
    `    <meta property="og:image:alt" content="${escapeHtml(SITE.ogImageAlt)}" />`,
    '',
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `    <meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    `    <meta name="twitter:image" content="${escapeHtml(image)}" />`,
    '',
    '    <script type="application/ld+json" data-seo="page">',
    `    ${jsonLd}`,
    '    </script>',
  ].join('\n');
};

export const SEO_MARKER_START = '<!-- seo:start -->';
export const SEO_MARKER_END = '<!-- seo:end -->';
