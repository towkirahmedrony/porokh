# Progress Page Redesign and Data Repair Implementation Plan

**Goal:** Replace the fake, empty and broken sections of `/progress` with one server-computed, user-scoped dashboard built only from real rows, and rebuild the screen as a compact native-feeling report for a 360px phone.

**Architecture:** `GET /progress/dashboard` stays the only page read. The backend loads the user's own rows in one parallel batch (profile, exam history, question-level detail, catalog labels, levels, streak functions, mistake pool) and passes them to a pure aggregation module. Every number is derived there, so it can be unit tested without a database. The frontend renders one typed response and keeps range switching and month navigation client side, so no interaction needs a refetch.

**Stack:** Express 4 + TypeScript + Supabase service client; React 18 + Vite + Tailwind + TanStack Query v5 + Recharts.

**Spec:** Session brief dated 2026-11-26 (audit, data repair, redesign, end-to-end verification).

## Global Constraints

- One page read: `GET /progress/dashboard`. No new table, view, index or RPC is applied without approval.
- Every query is scoped to the authenticated user id from `req.user`; catalog tables (`questions`, `subjects`, `chapters`, `topics`, `levels_master`) are read only by ids already reachable from that user.
- Definitions: `accuracy = correct responses / all responses`; `topic error rate = (wrong + skipped) / all responses for that topic`; `average score = mean of per-attempt score / total_marks` over submitted non-practice attempts.
- Practice attempts are excluded from "exams taken" and the score trend, and included in question-level analysis, matching the mistake pool which already reads every `exam_history_details` row.
- `exam_id LIKE 'seed-test-%'` rows are not filtered; they are real attempts in the same ledger the History screen and the mistake pool read. Mixing filters would make the page disagree with the rest of the app. Reported to the user with the exact consequence.
- No global rank is displayed: there is one ranked user. The response has no rank field, so no fake percentile can be rendered again.
- Percentages are rounded to one decimal in the payload and to whole numbers by the UI; all digits pass through `localizeDigits` when the language is Bengali.
- Strings live in `src/shared/i18n/messages.ts` under `progress.*` with Bengali and English parity (`messages.test.ts` enforces it).
- Theme tokens only (`bg-app`, `card-bg`, `primary`, `accent`, `secondary`, `text-primary`, `text-secondary`); no new palette, no purple, no emoji.
- Tap targets >= 44px; no hover-only affordance; `prefers-reduced-motion` respected.
- Do not touch Home, the exam engine, or the Model Test flow; only `MistakePracticeSection` changes, to take the page's count.

## Review Focus

- A user with zero attempts: hero shows `—` not `0%`, calendar is empty but navigable, and no analysis card renders.
- A user with only skipped responses: accuracy is `0%` (not `—`), topic error rate is `100%`, and no division by zero produces `NaN`.
- An attempt with `total_marks = 0` or a missing `submitted_at` must not create an `Infinity` point or disappear from the calendar.
- A topic with one response must not outrank a topic with 24 responses on equal error rate.
- `status = 'fraud_detected'` rows must not count anywhere.
- Calendar month navigation in December/January must cross the year without an invalid `Date`.
- A subject with no chapters (null `chapter_id`) still appears in the subject report.

---

### Task 1: Pure aggregation module (backend)

**Files:**
- Create: `porokh-backend/src/features/progress/progress.metrics.ts`
- Test: `porokh-backend/src/features/progress/progress.metrics.spec.ts`
- Modify: `porokh-backend/package.json` (add the spec to `test`)

**Interfaces:**
- Produces:
  - `type ProgressHistoryRow`, `ProgressDetailRow`, `ProgressCatalogRow`
  - `dhakaDateKey(iso: string | null): string | null`
  - `buildProgressSnapshot(input: ProgressSnapshotInput): ProgressSnapshot` where `ProgressSnapshotInput` carries `{ history, details, subjects, chapters, topics, levels, totalXp, streak, longestStreak, now }` and `ProgressSnapshot` is the page payload minus `user` and `mistakes`.
  - `summarizeTopics(details, labels): WeakTopic[]`, exported for its own tests.

- [ ] Step 1: Write failing tests pinning: zero attempts, one attempt, seven attempts, all-skipped, `total_marks = 0`, `fraud_detected` exclusion, topic tie broken by response count, accuracy and average-score arithmetic, Dhaka date bucketing, level lookup at a boundary.
- [ ] Step 2: Run `npx tsx --test src/features/progress/progress.metrics.spec.ts` and confirm it fails on the missing module.
- [ ] Step 3: Implement the module.
- [ ] Step 4: Re-run and confirm pass.

### Task 2: Dashboard service and typed contract (backend)

**Files:**
- Modify: `porokh-backend/src/features/progress/progress.service.ts`
- Modify: `porokh-backend/src/features/progress/progress.types.ts`

**Interfaces:**
- Consumes: `buildProgressSnapshot` from Task 1.
- Produces: `getProgressDashboardData(userId: string): Promise<ProgressDashboardResponse>` with
  `{ user, summary, activity, performance, skills, subjects, weaknesses, mentor, mistakes }`.

- [ ] Step 1: Replace the six independent calls (two of which hit RPCs that throw `42P01`) with one `Promise.all` batch: profile, `exam_history` for the user, `exam_history_details` for those ids with embedded `questions(subject_id, chapter_id, topic_id)`, `subjects`, `chapters`, `topics`, `levels_master`, `get_mistake_pool`, `get_current_streak`, `get_longest_streak`.
- [ ] Step 2: Map rows to the snapshot input and return it; log and rethrow load errors instead of silently returning empty arrays.
- [ ] Step 3: `npx tsc --noEmit` and confirm pass.

### Task 3: View helpers (frontend)

**Files:**
- Create: `porokh/src/features/progress/utils/progressView.ts`
- Test: `porokh/src/features/progress/utils/progressView.test.ts`
- Modify: `porokh/package.json` (add the test file to `test`)

**Interfaces:**
- Produces:
  - `type MonthCell = { date: string; day: number; count: number } | null`
  - `buildMonthGrid(year: number, month: number, counts: Record<string, number>): MonthCell[][]` (weeks, Sunday first, leading and trailing nulls)
  - `shiftMonth(year: number, month: number, delta: number): { year: number; month: number }`
  - `dhakaTodayKey(now?: Date): string`
  - `filterTrend(points: TrendPoint[], range: '7' | '30' | 'all'): TrendPoint[]`
  - `formatPercent(value: number | null, language: AppLanguage): string` returning `—` for null.

- [ ] Step 1: Write failing tests: November 2026 starts on Sunday with no blanks, February 2024 has 29 days, a 31-day month starting Saturday needs 6 rows, counts land on the right cells, `shiftMonth(2026, 11, 1)` is January 2027, `filterTrend` keeps the last N in ascending order, `formatPercent(null)` is `—`.
- [ ] Step 2: Run `npx tsx --test src/features/progress/utils/progressView.test.ts` and confirm failure.
- [ ] Step 3: Implement, re-run, confirm pass.

### Task 4: Presentational components (frontend)

**Files:**
- Rewrite: `porokh/src/features/progress/pages/Progress.tsx`
- Create: `porokh/src/features/progress/components/{ProgressIdentity,AccuracyHero,ActivityCalendar,PerformanceTrend,SkillBars,WeakTopics,MentorNote,SubjectReport}.tsx`
- Modify: `porokh/src/features/practice/components/MistakePracticeSection.tsx` (accept `availableCount`)
- Delete: `MetricsGrid.tsx`, `StatCard.tsx`, `StatsCard.tsx`, `ProgressHeader.tsx`, `ChartsSection.tsx`, `AnalysisSection.tsx`, `SubjectReportSection.tsx`, `SubjectCard.tsx`, `ActivityHeatmap.tsx`, `charts/PerformanceChart.tsx`, `charts/SubjectRadar.tsx`
- Modify: `porokh/src/features/progress/types/progress.ts`, `hooks/useProgressData.ts`, `src/shared/i18n/messages.ts`

**Interfaces:**
- Consumes: `ProgressDashboardResponse`, `useProgressData`, `PullToRefresh`, `localizeDigits`, `t`.
- Produces: the page. Sections in order: identity row, accuracy hero (ring plus exam/average/streak/XP minis and level bar), month activity calendar, performance trend with 7/30/all chips, subject skill bars, ranked weak topics with question-bank links, one mentor note, compact mistake practice, subject report accordion.

- [ ] Step 1: Add Bengali and English keys; change `progress.weaknessTitle` to Bangla only.
- [ ] Step 2: Implement the components with empty, loading and error states; each data section hides itself when its own array is empty, except the calendar which always renders a navigable month.
- [ ] Step 3: Wire links: topic practice and mentor action to `/question-bank?subject=...&topic=...`, no-attempt CTA to `/exams/model`.
- [ ] Step 4: `npm run typecheck` and confirm pass.

### Task 5: Verification

- [ ] Step 1: Run the backend and frontend test files above.
- [ ] Step 2: Cross-check the real account against direct SQL for exams, average, accuracy, streak, longest streak, mistake count, subject totals and the top weak topic.
- [ ] Step 3: Grep the progress feature for digits, `Top`, `General Revision`, `Math.random`, mock arrays and "no data" literals.
- [ ] Step 4: `npm run typecheck` in both apps and `VITE_API_URL=http://localhost:5000 npm run build` in the app.
- [ ] Step 5: Report what could not be exercised (no deployed backend credentials, no browser in this environment).

## Out of scope (reported, not applied)

```sql
-- Repair two functions that currently throw 42P01 with search_path = ''.
-- Unused by the app after Task 2, offered for other consumers.
create or replace function public.get_student_subject_analytics(p_user_id uuid)
returns table (subject_name text, mastery_percentage numeric, average_score numeric,
               total_correct bigint, total_wrong bigint, total_skipped bigint)
language sql stable security invoker set search_path = 'public'
as $$ ... $$;

create or replace function public.get_student_weaknesses(p_user_id uuid)
returns table (topic_name text, subject_name text, error_rate numeric)
language sql stable security invoker set search_path = 'public'
as $$ ... $$;
```
