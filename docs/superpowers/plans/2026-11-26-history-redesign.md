# History and Result Details Redesign Implementation Plan

> **For agentic workers:** implement task by task; every task ends with a runnable check.

**Goal:** Make the History list and the attempt-review page match Progress/Profile, and give the review page the retake and wrong+skipped practice actions.

**Architecture:** History keeps its existing React Query data (`/history/exams`, summaries only), gains one tappable card, day groups and a sort sheet. The review route stays `/exam/analysis/:id`; it receives the list summary through router state and fetches only `details_json` from the existing owner-scoped result endpoint. Practice and retake continue to go through `practiceService` + `Arena`.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind, React Query, Supabase backend (`porokh-backend`).

**Spec:** the user's task message (History + Details redesign, 26 Nov 2026).

## Global Constraints

- Branch `feat/history-redesign`; no push, no DB writes, no migrations.
- Reuse Progress/Profile layout primitives: `max-w-md`, `text-xl font-bold` page title, `rounded-[20px] bg-card-bg`, `gap-5`, 44px targets.
- Bangla digits and Bangla labels on both pages through one formatter (`src/shared/lib/attemptFormat.ts`).
- Scores have at most 2 decimals, trailing zeros trimmed.
- No emoji icons, no purple gradients, no dead controls, no raw `{"bn":..,"en":..}` JSON.
- Do not change the exam engine, quota logic, Home or Progress pages.
- `/exam/analysis/:id` and `/exam/analysis` keep working.

## Review Focus

- Fractional and negative-marked scores: `0.75/20`, `2.75/30`, `0.25/30` must render as `০.৭৫`, `২.৭৫`, `০.২৫`, never `0.75` or `০.৭৫০`.
- All-skipped attempts: no trophy, no success copy, a fully neutral proportion bar.
- Live exams with `correct_answers_revealed: false`: no invented correct option; say the key is not published yet.
- Legacy rows with `exam_id: null`, `attempt_id: null`: real subject fallback, never `undefined` or a blank title.
- Practice count 0: disabled action with a visible reason; backend `reason: 'empty'` still falls back to a toast.
- Deep link to `/exam/analysis/:id` (no router state): fetch the result, and Back goes to `/history` instead of leaving the app.

---

### Task 1: Shared attempt formatter

**Files:** create `src/shared/lib/attemptFormat.ts`, `src/shared/lib/attemptFormat.test.ts`.

**Produces:**
- `formatScoreParts(score, total, language): { score: string; total: string }`
- `formatDecimal(value, language, maxDecimals = 2): string`
- `formatCount(value, language): string`
- `formatPercent(value, language): string` (one decimal under 10, integer above)
- `formatDuration(seconds, language): string` (`৪ মিনিট ৩২ সেকেন্ড`, `৫২ সেকেন্ড`)
- `formatAttemptDate(iso, language): string` (`৯ নভেম্বর ২০২৬ · রাত ১:১০`)
- `formatDayGroupLabel(iso, language, now?): string` (`আজ` / `গতকাল` / `এই সপ্তাহ` / `এর আগে`)
- `formatTimeTaken`, `formatScore` maybe folded into parts.

Tests pin the spec values and Dhaka timezone behaviour.

### Task 2: History card view model

**Files:** create `src/features/history/utils/historyCard.ts` + test.

**Produces:**
- `buildHistoryCard(item, language, t)` → `{ title, meta, scoreText, totalText, counts: { correct, wrong, skipped, total }, segments: number[], badge: 'retake' | 'practice' | null }`.
- `groupHistoryByDay(items, language, now)` → ordered groups with `key`, `label`.
- `filterAndSortHistory(items, query, order)` (search titles/subjects, newest/oldest).

### Task 3: History UI

**Files:** modify `History.tsx`, `HistoryCard.tsx`, `HistoryTabs.tsx`; create `HistorySortSheet.tsx`, `HistorySkeleton.tsx`; delete `HistoryPracticeActions` usage.

- Page title, compact segmented tabs, one search+sort row, count, day groups, tappable card with score focal point and proportion bar.
- Loading skeleton, empty state, no-results state, infinite-scroll sentinel (`PAGE_SIZE` 20), pull-to-refresh.
- Save scroll offset + page size to `sessionStorage` on card open, restore once on mount.

### Task 4: Review page

**Files:** rewrite `Analysis.tsx`, `AnalysisQuestionCard.tsx`; create `src/features/practice/components/AttemptPracticeActions.tsx`, `src/features/exam/components/ResultSummary.tsx`; extend `ExamResultPayload`.

- Header with back, title, date, time taken, honest outcome line.
- One summary surface: score/total, accuracy, correct/wrong/skipped, time, rank when meaningful.
- Sticky actions: retake (full original set) and wrong+skipped practice with count; disabled state with reason.
- Filter chips, compact question cards, choice vs correct option, expandable explanation, bookmark, working report.
- Summary from router state renders immediately; details fetch separately.

### Task 5: Copy, verification, backend note

- Add Bangla and English message keys.
- Typecheck, lint, build, grep checks, read-only Supabase comparison of the seven attempts.
- Report what the practice flow writes (`exam_progress.practice_mode` → `exam_history.practice_mode` on submission) and whether a backfill is safe.
