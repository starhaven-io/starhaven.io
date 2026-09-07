import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(left, right) {
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('shared styles', () => {
  it('keeps subtle text readable on both surfaces in both color schemes', () => {
    const light = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const dark = css.match(/@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const value = (block, name) => block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];

    for (const block of [light, dark]) {
      assert.ok(contrast(value(block, 'color-text-subtle'), value(block, 'color-bg')) >= 4.5);
      assert.ok(contrast(value(block, 'color-text-subtle'), value(block, 'color-bg-secondary')) >= 4.5);
    }
  });

  it('does not rely on color alone for links embedded in prose', () => {
    assert.match(
      css,
      /main p a,\s*\.post li a,\s*\.post th a,\s*\.post td a,\s*\.site-license a\s*\{[^}]*text-decoration:\s*underline;/s,
    );
  });
});
