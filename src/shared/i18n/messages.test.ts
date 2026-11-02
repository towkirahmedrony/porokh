import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP_MESSAGES, localizeDigits } from './messages';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const MESSAGES_FILE = path.resolve(SRC_ROOT, 'shared/i18n/messages.ts');

const readSource = (): string => fs.readFileSync(MESSAGES_FILE, 'utf8');

/** Extract the raw body of one message object by counting braces. */
const objectBody = (source: string, name: string): string => {
  const start = source.search(new RegExp(`^const ${name}\\b[^=]*=\\s*\\{`, 'm'));
  assert.ok(start >= 0, `message object "${name}" not found in messages.ts`);

  const open = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let i = open; i < source.length; i += 1) {
    const char = source[i];

    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }

  assert.fail(`unterminated message object "${name}"`);
};

const keysOf = (body: string): string[] => [
  ...body.matchAll(/^\s*'([^']+)'\s*:/gm),
].map((m) => m[1]);

const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const walkSourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
};

const asMap = (messages: Record<string, string>): Record<string, string> =>
  messages as Record<string, string>;

const BN = asMap(APP_MESSAGES.bn);
const EN = asMap(APP_MESSAGES.en);

test('Bengali digits map 1 and 2 to ১ and ২ (not ৬)', () => {
  assert.equal(localizeDigits(1, 'bn'), '১');
  assert.equal(localizeDigits(2, 'bn'), '২');
  assert.equal(localizeDigits('12', 'bn'), '১২');
  assert.equal(localizeDigits(1, 'en'), '1');
  assert.equal(BN['onboarding.stepLabel'], 'ধাপ {current}/{total}');
  assert.equal(EN['onboarding.stepLabel'], 'Step {current} of {total}');
});

test('Bangla and English resources cover exactly the same keys', () => {
  const bnKeys = Object.keys(BN).sort();
  const enKeys = Object.keys(EN).sort();

  const missingEn = bnKeys.filter((key) => !(key in EN));
  const missingBn = enKeys.filter((key) => !(key in BN));

  assert.deepEqual(
    missingEn,
    [],
    `Keys missing from the English resource: ${missingEn.join(', ')}`
  );
  assert.deepEqual(
    missingBn,
    [],
    `Keys missing from the Bangla resource: ${missingBn.join(', ')}`
  );
  assert.deepEqual(bnKeys, enKeys);
});

test('no translation value is empty', () => {
  for (const [language, messages] of Object.entries({ bn: BN, en: EN })) {
    for (const [key, value] of Object.entries(messages)) {
      assert.ok(
        value.trim().length > 0,
        `Empty ${language} value for "${key}"`
      );
    }
  }
});

test('Bangla and English placeholders match for every key', () => {
  for (const key of Object.keys(BN)) {
    const bnPlaceholders = placeholders(BN[key]);
    const enPlaceholders = placeholders(EN[key]);
    assert.deepEqual(
      bnPlaceholders,
      enPlaceholders,
      `Placeholder mismatch for "${key}": bn=${bnPlaceholders.join(',')} en=${enPlaceholders.join(',')}`
    );
  }
});

test('message objects declare no duplicate keys in source', () => {
  const source = readSource();
  for (const name of ['bn', 'en']) {
    const keys = keysOf(objectBody(source, name));
    const seen = new Set<string>();
    const duplicates = keys.filter((key) => {
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    assert.deepEqual(
      duplicates,
      [],
      `Duplicate keys in the ${name} resource: ${[...new Set(duplicates)].join(', ')}`
    );
  }
});

test('every translation key referenced by the app exists in the resources', () => {
  const known = new Set(Object.keys(BN));
  const missing = new Map<string, string>();

  for (const file of walkSourceFiles(SRC_ROOT)) {
    if (file === MESSAGES_FILE) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(/\bt\(\s*'([^']+)'/g)) {
      const key = match[1];
      if (!known.has(key)) {
        missing.set(key, path.relative(SRC_ROOT, file));
      }
    }
  }

  assert.deepEqual(
    [...missing.entries()],
    [],
    `Unknown translation keys: ${JSON.stringify([...missing])}`
  );
});
