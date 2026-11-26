// Tests for the self-hosted fonts (ADR-8, Milestone 12: Gilda Display + Montserrat). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const PAGES = ['index.html', 'order.html', 'staff/login.html', 'staff/manager.html', 'staff/agent.html', 'staff/archive.html'];
const MAX_FONT_BYTES = 73 * 1024; // about 10% above the 66 KB served before Milestone 12 (plan D11)

const tokens = readFileSync(join(PUBLIC, 'css/tokens.css'), 'utf8');
const declared = [...tokens.matchAll(/@font-face\s*{[^}]*src:\s*url\('([^']+)'\)/g)].map((m) => m[1]);

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test('every @font-face file exists under public/', () => {
  assert.equal(declared.length, 2);
  for (const url of declared) assert.ok(existsSync(join(PUBLIC, url)), `missing ${url}`);
});

test('every page preloads exactly the declared font files', () => {
  for (const page of PAGES) {
    const html = readFileSync(join(PUBLIC, page), 'utf8');
    const preloaded = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font"/g)].map((m) => m[1]);
    assert.deepEqual([...preloaded].sort(), [...declared].sort(), page);
  }
});

test('no page or stylesheet loads fonts from Google', () => {
  const files = filesUnder(PUBLIC).filter((f) => ['.html', '.css'].includes(extname(f)));
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(text), file);
  }
});

test('the fonts together stay about as light as before', () => {
  const total = declared.reduce((sum, url) => sum + statSync(join(PUBLIC, url)).size, 0);
  assert.ok(total <= MAX_FONT_BYTES, `fonts are ${total} bytes`);
});

test('headings use Gilda Display and text uses Montserrat', () => {
  assert.match(tokens, /--font-heading:\s*'Gilda Display',/);
  assert.match(tokens, /--font-body:\s*'Montserrat',/);
});
