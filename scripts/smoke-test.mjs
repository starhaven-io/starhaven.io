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

for (const [name, html] of [...websitePages, ...postPages]) {
  assert.match(html, /<link rel="canonical" href="https:\/\/starhaven\.io\//, `${name}: missing canonical URL`);
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/starhaven\.io\/og\.png">/,
    `${name}: missing default OG image`,
  );
  assert.match(html, /<meta property="og:image:type" content="image\/png">/, `${name}: missing OG image type`);
  assert.match(html, /<meta property="og:image:alt" content="[^"]+">/, `${name}: missing OG image alt text`);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/, `${name}: wrong Twitter card type`);
  assert.match(
    html,
    /<script type="module" src="\/_astro\/ClientRouter[^"]+\.js"><\/script>/,
    `${name}: expected ClientRouter module compatible with script-src 'self'`,
  );

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

for (const [name, html] of websitePages) {
  assert.match(html, /<meta property="og:type" content="website">/, `${name}: wrong OG type`);
}
for (const [name, html] of postPages) {
  assert.match(html, /<meta property="og:type" content="article">/, `${name}: wrong OG type`);
  assert.match(html, /<meta property="article:published_time" content="[^"]+">/, `${name}: missing publication time`);
}

const headers = read('_headers').toString();
assert.match(headers, /Content-Security-Policy:.*script-src 'self'/);
assert.doesNotMatch(headers, /script-src 'none'/);

const rss = read('rss.xml').toString();
assert.match(rss, /<rss\b/);
assert.doesNotMatch(rss, /<script\b/i);
assert.match(rss, /<content:encoded>/);
const decodedRss = decodeXmlEntities(rss);
for (const [, url] of decodedRss.matchAll(/<[a-z][^>]*\s(?:href|src)="([^"]*)"/gi)) {
  assert.match(url, /^(?:[a-z][a-z\d+.-]*:|\/\/)/i, `rss: unresolved feed-content URL: ${url}`);
}

const ogImage = read('og.png');
assert.ok(ogImage.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
assert.equal(ogImage.readUInt32BE(16), 1200);
assert.equal(ogImage.readUInt32BE(20), 630);

console.log('smoke: build output preserves metadata, transitions, footer spacing, RSS safety, and OG image dimensions');
