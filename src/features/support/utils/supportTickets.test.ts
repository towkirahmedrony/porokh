import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canReopen,
  canStudentReply,
  isActiveStatus,
  isSupportCategory,
  isSupportStatus,
  validateAttachmentFile,
  validateTicketDraft,
  buildNewTicketPath,
  statusGroup,
  SUPPORT_FILTERS,
  MAX_SUPPORT_ATTACHMENT_BYTES,
} from './supportTickets.ts';

test('categories and statuses are validated against the API contract', () => {
  assert.equal(isSupportCategory('exam'), true);
  assert.equal(isSupportCategory('billing'), false);
  assert.equal(isSupportStatus('awaiting_student'), true);
  assert.equal(isSupportStatus('pending'), false);
});

test('students can reply until the ticket is closed', () => {
  assert.equal(canStudentReply('open'), true);
  assert.equal(canStudentReply('resolved'), true);
  assert.equal(canStudentReply('closed'), false);
  assert.equal(canReopen('resolved'), true);
  assert.equal(canReopen('closed'), false);
  assert.equal(isActiveStatus('awaiting_student'), true);
  assert.equal(isActiveStatus('resolved'), false);
});

test('three chips cover every stored status', () => {
  assert.deepEqual(
    SUPPORT_FILTERS.map((option) => option.value),
    ['all', 'active', 'resolved']
  );

  const active = SUPPORT_FILTERS.find((option) => option.value === 'active')?.statuses;
  const resolved = SUPPORT_FILTERS.find((option) => option.value === 'resolved')?.statuses;

  assert.deepEqual(active, ['open', 'in_progress', 'awaiting_student']);
  assert.deepEqual(resolved, ['resolved', 'closed']);
  assert.equal(statusGroup('closed'), 'resolved');
  assert.equal(statusGroup('awaiting_student'), 'active');
});

test('attachments are limited by type, size and count', () => {
  const png = { type: 'image/png', size: 1024 };
  assert.equal(validateAttachmentFile(png, 0), null);
  assert.equal(validateAttachmentFile(png, 3), 'support.errTooMany');
  assert.equal(
    validateAttachmentFile({ type: 'application/pdf', size: 1024 }, 0),
    'support.errFileType'
  );
  assert.equal(
    validateAttachmentFile(
      { type: 'image/png', size: MAX_SUPPORT_ATTACHMENT_BYTES + 1 },
      0
    ),
    'support.errFileSize'
  );
});

test('ticket drafts mirror the server limits before submit', () => {
  assert.equal(
    validateTicketDraft({ category: 'bug', subject: 'App crashes', description: 'It crashes on open.' }),
    null
  );
  assert.equal(
    validateTicketDraft({ category: 'bug', subject: 'Bad', description: 'It crashes on open.' }),
    'support.errSubject'
  );
  assert.equal(
    validateTicketDraft({ category: 'bug', subject: 'App crashes', description: 'short' }),
    'support.errDescription'
  );
});

test('contextual links preserve the question, exam and return screen', () => {
  const path = buildNewTicketPath({
    category: 'question',
    questionId: 'q-1',
    examId: 'exam-2',
    screen: '/exam/analysis/1',
  });

  assert.equal(
    path,
    '/support/new?category=question&question_id=q-1&exam_id=exam-2&screen=%2Fexam%2Fanalysis%2F1'
  );
  assert.equal(buildNewTicketPath({}), '/support/new');
});
