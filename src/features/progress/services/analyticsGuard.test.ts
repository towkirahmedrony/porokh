import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression guard for the removed client-side result/XP writer.
 *
 * Exam results are server-owned: they are written by the backend after it has
 * graded a claimed attempt. The browser must never insert `exam_history` rows,
 * call `update_user_progress`, or ship a module that could do either.
 *
 * This test reads the source tree (no network, no database) so a future
 * refactor cannot quietly reintroduce the pattern.
 */

const SRC_ROOT = new URL('../../../', import.meta.url).pathname;

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

const collectSourceFiles = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(fullPath);
    }
  }

  return files;
};

/**
 * Executable client sources only: generated Supabase types describe every
 * table and RPC, and test files quote the forbidden patterns on purpose.
 */
const sourceFiles = collectSourceFiles(SRC_ROOT).filter(
  (file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')
);

const sourceText = sourceFiles
  .map((file) => ({
    file: file.slice(SRC_ROOT.length),
    text: readFileSync(file, 'utf8'),
  }))
  .filter(({ file }) => file !== 'shared/types/supabase.ts');

test('the dead client-side analytics writer stays removed', () => {
  assert.equal(
    existsSync(join(SRC_ROOT, 'features/progress/services/analytics.ts')),
    false,
    'analytics.ts must not come back: it wrote exam results and XP from the browser'
  );
});

test('no client module writes exam_history directly', () => {
  const offenders = sourceText.filter(({ text }) =>
    /from\(\s*['"]exam_history['"]\s*\)/.test(text)
  );

  assert.deepEqual(offenders.map(({ file }) => file), []);
});

test('no client module calls update_user_progress', () => {
  const offenders = sourceText.filter(({ text }) => /update_user_progress/.test(text));

  assert.deepEqual(offenders.map(({ file }) => file), []);
});

test('practice submissions go through the authoritative backend endpoint', () => {
  const submissionCallers = sourceText.filter(({ text }) =>
    /\/exams\/user\/submit/.test(text)
  );

  assert.ok(
    submissionCallers.length > 0,
    'the practice/arena flow must submit through the backend, not the database'
  );
});
