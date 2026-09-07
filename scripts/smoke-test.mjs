import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const dist = path.resolve(process.argv[2] ?? 'dist/client');

function read(relativePath) {
  const file = path.join(dist, relativePath);
  assert.ok(existsSync(file), `missing build output: ${relativePath}`);
  return readFileSync(file);
}

function decodeXmlEntities(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => entities[entity]);
}

// Astro's compressHTML deletes the whitespace between a text node and an adjacent tag, so the
// layout has to spell these separators out; nothing else in the build fails when they disappear.
function footerMarkup(html, name) {
  const footer = html.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/);
  assert.ok(footer, `${name}: missing site footer`);
  return footer[1];
}

const websitePages = [
  ['home', read('index.html').toString()],
  ['404', read('404.html').toString()],
  ['blog index', read('blog/index.html').toString()],
];
const blogDirectory = path.join(dist, 'blog');
assert.ok(existsSync(blogDirectory), 'missing build output: blog');
const postPages = readdirSync(blogDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => [entry.name, read(path.join('blog', entry.name, 'index.html')).toString()])
  .sort(([left], [right]) => left.localeCompare(right));
assert.ok(postPages.length > 0, 'missing a built blog post');
for (const [name] of postPages) {
  assert.match(name, /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/, `${name}: invalid blog post route`);
}

const allPages = [...websitePages, ...postPages];
const indexablePages = [websitePages[0], websitePages[2], ...postPages];

for (const [name, html] of allPages) {
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/starhaven\.io\/og\.png">/,
    `${name}: missing default OG image`,
  );
  assert.match(html, /<meta property="og:image:type" content="image\/png">/, `${name}: missing OG image type`);
  assert.match(html, /<meta property="og:image:alt" content="[^"]+">/, `${name}: missing OG image alt text`);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/, `${name}: wrong Twitter card type`);
  assert.doesNotMatch(html, /<script(?:\s|>)/i, `${name}: static pages must not contain scripts`);

  const footer = footerMarkup(html, name);
  assert.match(
    footer,
    />Blog<\/a> · <a [^>]*>GitHub<\/a> · <a [^>]*>Mastodon<\/a> · <a [^>]*>RSS<\/a>/,
    `${name}: footer nav lost its separators`,
  );
  assert.match(
    footer,
    /Prose licensed under <a [^>]*>CC BY-SA 4\.0<\/a>\. Code licensed under <a [^>]*>AGPL-3\.0-only<\/a>\./,
    `${name}: footer license text lost its spacing`,
  );
}

for (const [name, html] of indexablePages) {
  assert.match(html, /<link rel="canonical" href="https:\/\/starhaven\.io\//, `${name}: missing canonical URL`);
  assert.match(html, /<meta property="og:url" content="https:\/\/starhaven\.io\//, `${name}: missing OG URL`);
}

const notFound = websitePages[1][1];
assert.match(notFound, /<meta name="robots" content="noindex">/, '404: missing noindex directive');
assert.doesNotMatch(notFound, /<link rel="canonical"/, '404: must not claim a canonical URL');
assert.doesNotMatch(notFound, /<meta property="og:url"/, '404: must not claim an OG URL');

for (const [name, html] of websitePages) {
  assert.match(html, /<meta property="og:type" content="website">/, `${name}: wrong OG type`);
}
for (const [name, html] of postPages) {
  assert.match(html, /<meta property="og:type" content="article">/, `${name}: wrong OG type`);
  assert.match(html, /<meta property="article:published_time" content="[^"]+">/, `${name}: missing publication time`);
  assert.match(html, /<time datetime="\d{4}-\d{2}-\d{2}"(?:\s|>)/, `${name}: visible date must use a calendar value`);
  assert.doesNotMatch(html, /<time datetime="[^"]*T/, `${name}: visible date must not depend on a timezone`);
}

const headers = read('_headers').toString();
assert.match(headers, /Content-Security-Policy:.*script-src 'none'/);
assert.doesNotMatch(headers, /script-src 'self'/);
assert.match(headers, /^\/$\s+Cache-Control: public, max-age=0, must-revalidate, no-transform/m);
assert.match(headers, /\/\*\/\s+Cache-Control: public, max-age=0, must-revalidate, no-transform/);
assert.match(headers, /\/\.well-known\/revision\.json\s+Cache-Control: no-store, no-transform/);

const redirects = read('_redirects').toString();
assert.match(
  redirects,
  /^\/blog\/hello-starhaven\s+\/blog\/2026-04-17-hello-starhaven\/\s+301$/m,
  'missing redirect from the original blog post URL without a trailing slash',
);
assert.match(
  redirects,
  /^\/blog\/hello-starhaven\/\s+\/blog\/2026-04-17-hello-starhaven\/\s+301$/m,
  'missing redirect from the original blog post URL with a trailing slash',
);

const rss = read('rss.xml').toString();
assert.match(rss, /<rss\b/);
assert.doesNotMatch(rss, /<script\b/i);
assert.match(rss, /<content:encoded>/);
const decodedRss = decodeXmlEntities(rss);
for (const [, description] of rss.matchAll(/<description>([\s\S]*?)<\/description>/g)) {
  assert.doesNotMatch(
    decodeXmlEntities(description),
    /[<>\u0000-\u001f\u007f-\u009f]/u,
    'rss: decoded description must remain plain text',
  );
}
for (const [, url] of decodedRss.matchAll(/<[a-z][^>]*\s(?:href|src)="([^"]*)"/gi)) {
  assert.match(url, /^(?:[a-z][a-z\d+.-]*:|\/\/)/i, `rss: unresolved feed-content URL: ${url}`);
}

const revision = JSON.parse(read(path.join('.well-known', 'revision.json')).toString());
assert.deepEqual(Object.keys(revision), ['revision']);
assert.ok(revision.revision === null || /^[0-9a-f]{40}$/.test(revision.revision));

const workerConfig = JSON.parse(read('wrangler.json').toString());
assert.deepEqual(workerConfig.kv_namespaces, [], 'static deployment must not provision KV state');

const sitemap = read('sitemap-0.xml').toString();
const sitemapEntries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1]);
for (const [name] of postPages) {
  const absoluteUrl = `https://starhaven.io/blog/${name}/`;
  assert.ok(rss.includes(`<link>${absoluteUrl}</link>`), `${name}: missing RSS link`);
  assert.ok(
    rss.includes(`<guid isPermaLink="true">${absoluteUrl}</guid>`),
    `${name}: RSS GUID does not match its built route`,
  );

  const sitemapEntry = sitemapEntries.find((entry) => entry.includes(`<loc>${absoluteUrl}</loc>`));
  assert.ok(sitemapEntry, `${name}: missing sitemap entry`);
  assert.match(
    sitemapEntry,
    /<lastmod>\d{4}-\d{2}-\d{2}T00:00:00\.000Z<\/lastmod>/,
    `${name}: sitemap lastmod must use timezone-independent UTC midnight`,
  );
}

const ogImage = read('og.png');
assert.ok(ogImage.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
assert.equal(ogImage.readUInt32BE(16), 1200);
assert.equal(ogImage.readUInt32BE(20), 630);

console.log(
  'smoke: build output preserves metadata, static rendering, footer spacing, RSS safety, and deployment identity',
);
