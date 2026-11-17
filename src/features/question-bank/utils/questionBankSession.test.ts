import test from 'node:test';
import assert from 'node:assert/strict';
import {
  questionBankSessionKey,
  readQuestionBankSession,
  writeQuestionBankSession,
} from './questionBankSession';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    values,
  };
};

test('session state is keyed by the full URL', () => {
  assert.notEqual(
    questionBankSessionKey('/bank', '?subject=a'),
    questionBankSessionKey('/bank', '?subject=b')
  );
});

test('page count and scroll position survive a write/read cycle', () => {
  const storage = createStorage();
  const key = questionBankSessionKey('/bank', '?subject=a');

  writeQuestionBankSession(key, { pageCount: 3, scrollY: 640 }, storage);

  assert.deepEqual(readQuestionBankSession(key, storage), {
    pageCount: 3,
    scrollY: 640,
  });
});

test('partial writes keep the other value', () => {
  const storage = createStorage();
  const key = questionBankSessionKey('/bank', '?subject=a');

  writeQuestionBankSession(key, { pageCount: 2, scrollY: 100 }, storage);
  writeQuestionBankSession(key, { scrollY: 500 }, storage);

  assert.deepEqual(readQuestionBankSession(key, storage), {
    pageCount: 2,
    scrollY: 500,
  });
});

test('corrupt or negative values are ignored', () => {
  const storage = createStorage();
  const key = 'corrupt';
  storage.setItem(key, '{not json');

  assert.equal(readQuestionBankSession(key, storage), null);

  writeQuestionBankSession(key, { pageCount: -1, scrollY: -10 }, storage);
  assert.equal(readQuestionBankSession(key, storage), null);
});

test('missing session storage never throws', () => {
  const key = questionBankSessionKey('/bank', '?subject=a');

  assert.equal(readQuestionBankSession(key, null), null);
  assert.doesNotThrow(() =>
    writeQuestionBankSession(key, { pageCount: 1 }, null)
  );
});
