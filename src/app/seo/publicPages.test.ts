import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  PUBLIC_PAGES,
  SITE,
  absoluteUrl,
  buildPageJsonLd,
  findPublicPage,
  normalizePath,
  renderSeoHead,
} from './publicPages';

const PRIVATE_PREFIXES = [
  '/dashboard',
  '/auth/',
  '/exam/',
  '/exams',
  '/progress',
  '/history',
  '/profile',
  '/settings',
  '/groups',
  '/question-bank',
];

test('public page paths are unique, absolute and free of private routes', () => {
  const paths = PUBLIC_PAGES.map((page) => page.path);

  assert.equal(new Set(paths).size, paths.length);
  assert.equal(paths[0], '/');

  for (const pagePath of paths) {
    if (pagePath === '/') continue;
    assert.match(pagePath, /^\/[a-z0-9-]+$/, `${pagePath} is not a clean path`);
    assert.ok(
      !PRIVATE_PREFIXES.some((prefix) => pagePath.startsWith(prefix)),
      `${pagePath} is an authenticated route`
    );
  }
});

test('every public page has a unique title and a unique description', () => {
  const titles = PUBLIC_PAGES.map((page) => page.title);
  const descriptions = PUBLIC_PAGES.map((page) => page.description);

  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descriptions).size, descriptions.length);

  for (const page of PUBLIC_PAGES) {
    assert.ok(
      page.title.length <= 65,
      `${page.path} title is ${page.title.length} characters`
    );
    assert.ok(
      page.description.length >= 70 && page.description.length <= 175,
      `${page.path} description is ${page.description.length} characters`
    );
  }
});

test('trailing slashes and query strings resolve to the same page', () => {
  assert.equal(findPublicPage('/about/')?.id, 'about');
  assert.equal(findPublicPage('/about?utm_source=x')?.id, 'about');
  assert.equal(findPublicPage('/')?.id, 'home');
  assert.equal(normalizePath(''), '/');

  assert.equal(findPublicPage('/dashboard/home'), undefined);
  assert.equal(findPublicPage('/profile/view/1'), undefined);
});

test('llms.txt describes the brand and links every public page', () => {
  const text = fs.readFileSync(
    path.join(process.cwd(), 'public', 'llms.txt'),
    'utf8'
  );

  assert.match(text, /^# Porokh \(পরোখ\)/m);
  assert.match(text, /\bBangladesh\b/);

  for (const page of PUBLIC_PAGES) {
    assert.ok(
      text.includes(absoluteUrl(page.path)),
      `${page.path} is not linked from llms.txt`
    );
  }
});

test('sitemap.xml lists exactly the public canonical pages', () => {
  const xml = fs.readFileSync(
    path.join(process.cwd(), 'public', 'sitemap.xml'),
    'utf8'
  );
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  assert.deepEqual(
    [...locs].sort(),
    PUBLIC_PAGES.map((page) => absoluteUrl(page.path)).sort()
  );

  for (const loc of locs) {
    assert.ok(loc.startsWith(`${SITE.url}/`), `${loc} is not on the site origin`);
  }
});

test('robots.txt points at the sitemap and keeps private routes out', () => {
  const robots = fs.readFileSync(
    path.join(process.cwd(), 'public', 'robots.txt'),
    'utf8'
  );

  assert.ok(robots.includes(`Sitemap: ${SITE.url}/sitemap.xml`));
  assert.match(robots, /^Allow: \/$/m);

  for (const prefix of PRIVATE_PREFIXES) {
    assert.match(
      robots,
      new RegExp(`^Disallow: ${prefix}`, 'm'),
      `robots.txt does not disallow ${prefix}`
    );
  }
});

test('structured data names the current brand and claims nothing unverifiable', () => {
  for (const page of PUBLIC_PAGES) {
    const structuredData = buildPageJsonLd(page);
    const serialized = JSON.stringify(structuredData);

    assert.equal(structuredData['@context'], 'https://schema.org');
    assert.ok(Array.isArray(structuredData['@graph']));

    const graph = structuredData['@graph'] as Record<string, unknown>[];

    assert.ok(serialized.length > 0);
    assert.doesNotMatch(
      serialized,
      /aggregateRating|ratingValue|reviewCount|"offers"|"price"/,
      `${page.path} contains an unverifiable claim`
    );

    const organization = graph.find((node) => node['@type'] === 'Organization');
    assert.equal(organization?.name, 'Porokh');
    assert.equal(organization?.alternateName, 'পরোখ');

    const webPage = graph.find((node) => node['@type'] === 'WebPage');
    assert.equal(webPage?.url, absoluteUrl(page.path));
    assert.equal(webPage?.name, page.title);

    // The public brand fields must not carry the previous name. The support
    // email and Facebook page are live external identifiers and are kept
    // deliberately, so they are excluded from this check.
    const brandText = [
      organization?.['name'],
      organization?.['alternateName'],
      organization?.['description'],
      webPage?.['name'],
      webPage?.['description'],
    ]
      .map((value) => String(value ?? ''))
      .join(' ');

    assert.doesNotMatch(brandText, /parapoth/i, `${page.path} uses the old brand`);
  }
});

test('every published SEO artifact uses the primary domain, never the legacy one', () => {
  assert.equal(SITE.url, 'https://porokhbd.vercel.app');

  const legacyOrigin = /parapothexam\.web\.app/;

  for (const file of ['sitemap.xml', 'robots.txt', 'llms.txt']) {
    const text = fs.readFileSync(path.join(process.cwd(), 'public', file), 'utf8');

    assert.doesNotMatch(text, legacyOrigin, `public/${file} still uses the legacy domain`);
    assert.ok(text.includes(SITE.url), `public/${file} does not use ${SITE.url}`);
  }

  // index.html serves the homepage and every signed-in route, so its canonical
  // and Open Graph URLs are what social previews and crawlers read.
  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  assert.doesNotMatch(html, legacyOrigin, 'index.html still uses the legacy domain');
  assert.ok(html.includes(`<link rel="canonical" href="${SITE.url}/" />`));
  assert.ok(html.includes(`<meta property="og:url" content="${SITE.url}/" />`));

  for (const page of PUBLIC_PAGES) {
    const serialized = JSON.stringify(buildPageJsonLd(page));

    assert.doesNotMatch(
      serialized,
      legacyOrigin,
      `${page.path} structured data still uses the legacy domain`
    );
    assert.ok(serialized.includes(absoluteUrl(page.path)));
  }
});

test('rendered head carries page-specific canonical, social and structure data', () => {
  const about = PUBLIC_PAGES.find((page) => page.id === 'about');
  assert.ok(about);

  const head = renderSeoHead(about);

  assert.ok(head.includes(`<link rel="canonical" href="${absoluteUrl('/about')}" />`));
  assert.ok(head.includes(`<title>${about.title}</title>`));
  assert.ok(head.includes('property="og:image"'));
  assert.ok(head.includes('name="twitter:card"'));
  assert.ok(head.includes('data-seo="page"'));
  assert.ok(head.includes('"BreadcrumbList"'));
  assert.ok(!head.includes('<script type="application/ld+json">\n      {'));
});
