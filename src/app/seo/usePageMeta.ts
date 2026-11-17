import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import {
  SITE,
  absoluteUrl,
  buildPageJsonLd,
  findPublicPage,
  type PublicPage,
} from './publicPages';

const upsertMeta = (
  attribute: 'name' | 'property',
  key: string,
  content: string
): void => {
  const selector = `meta[${attribute}="${key}"]`;
  let tag = document.head.querySelector<HTMLMetaElement>(selector);

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
};

const applyPageMeta = (page: PublicPage): void => {
  const url = absoluteUrl(page.path);
  const image = absoluteUrl(SITE.ogImagePath);

  document.title = page.title;

  upsertMeta('name', 'description', page.description);
  upsertMeta(
    'name',
    'robots',
    'index, follow, max-image-preview:large, max-snippet:-1'
  );

  const canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );
  if (canonical) {
    canonical.setAttribute('href', url);
  }

  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:site_name', SITE.name);
  upsertMeta('property', 'og:locale', SITE.locale);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:title', page.title);
  upsertMeta('property', 'og:description', page.description);
  upsertMeta('property', 'og:image', image);
  upsertMeta('property', 'og:image:alt', SITE.ogImageAlt);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', page.title);
  upsertMeta('name', 'twitter:description', page.description);
  upsertMeta('name', 'twitter:image', image);

  // Replace the build-time payload so a client-side navigation never leaves
  // structured data describing a different page in the document.
  document
    .querySelectorAll('script[type="application/ld+json"][data-seo="page"]')
    .forEach((element) => element.remove());

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.seo = 'page';
  script.textContent = JSON.stringify(buildPageJsonLd(page));
  document.head.appendChild(script);
};

/**
 * Keeps title, description, canonical, social metadata and structured data in
 * sync with the current public route.
 *
 * The same values are baked into the static HTML for each public route at build
 * time, so crawlers that do not execute JavaScript still see the page's own
 * metadata rather than the homepage's.
 */
export function usePageMeta(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = findPublicPage(pathname);
    if (page) applyPageMeta(page);
  }, [pathname]);
}
