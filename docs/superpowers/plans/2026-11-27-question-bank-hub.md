# Question Bank Hub Implementation Plan

> **For agentic workers:** Use the plan task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Put a stage- and goal-ordered hub in front of the question list: `/question-bank` becomes the entrance, `/question-bank/list` stays the list it opens.

**Architecture:** One RPC (`get_question_bank_hub`) returns every section the caller may see, already ordered and counted over `_qb_base`, so a hub number always equals the list total behind it. The student app adds three screens (hub, all-institutions, university drill-down), a service that validates the payload, and one hook. The list keeps its URL contract; it gains a generic institution preset and a search field.

**Tech Stack:** Postgres/Supabase RPC, React 18 + TypeScript + Vite + Tailwind, TanStack Query, react-router 6, node:test via tsx.

**Spec:** the task brief in the conversation (Question Bank HUB).

## Global Constraints

- No user id or stage parameter in any RPC; `auth.uid()` and `get_my_stage()` only.
- Stage `admission_prep` never receives HSC sections, whatever `p_mode` says.
- Counts come from `_qb_base` (active, published, not deleted, live-paper rule).
- Bangla labels and Bangla digits everywhere; no emoji; existing teal/amber tokens.
- 44px tap targets, no hover-only behaviour, 360px first.
- No hardcoded subject, board, college, university name or count in the app.
- Existing list deep links keep working: any legacy query on `/question-bank` redirects to `/question-bank/list` with the same query.
- The list, its filters, the stage gate, quota, exam engine, bookmarks and mistakes are unchanged in behaviour.

## Review Focus

- A hub row whose count is not the list total after tapping it (untested edge: institution + unit + year together).
- A stage that is loading, unknown or `post_hsc` painting content instead of a skeleton.
- Returning from the list to the hub losing the scroll position or flashing a skeleton.
- `/question-bank` with a legacy query string (push notification, old share link) landing on the hub instead of the list.
- An error response rendering as "no questions".

---

## File Structure

Backend (`porokh-backend`):
- `supabase/migrations/20261127180000_question_bank_hub.sql` — hub RPC + the `_qb_base` year fix.
- `supabase/rollbacks/20261127180000_question_bank_hub.down.sql` — drops the RPC, restores `_qb_base`.

Student app (`porokh`):
- `src/features/question-bank/types/questionBankHub.ts` — payload types.
- `src/features/question-bank/services/questionBankHubService.ts` — RPC call + field-by-field validation.
- `src/features/question-bank/utils/questionBankHub.ts` — pure selection: section order, top-N cuts, college threshold, goal-first, link builders.
- `src/features/question-bank/hooks/useQuestionBankHub.ts` — one query, stale-while-revalidate, refetch.
- `src/features/question-bank/pages/QuestionBankHub.tsx` — the hub.
- `src/features/question-bank/pages/QuestionBankInstitutions.tsx` — searchable all-colleges / all-universities.
- `src/features/question-bank/pages/QuestionBankUniversity.tsx` — units and exam years, from `get_question_bank_facets`.
- `src/features/question-bank/components/hub/*` — rows, section shell, skeleton, subject sheet.
- Modified: `utils/questionBankUrlState.ts`, `services/questionBankRequest.ts`, `types/questionBank.ts`, `pages/QuestionBank.tsx`, `app/routes/AppRoutes.tsx`, `app/navigation/backNavigation.ts`, `shared/i18n/messages.ts`, `shared/components/layout/MainLayout.tsx`.

## Task 1: Hub RPC

- [ ] Create the migration with `get_question_bank_hub(p_mode text default null) returns jsonb`, section kinds `hsc_subjects`, `hsc_boards`, `hsc_colleges`, `all_admission`, `track`; grant to `authenticated` only.
- [ ] Correct `_qb_base` so exam year, institution and unit read one reference row.
- [ ] Write the rollback file.
- [ ] Apply after approval; verify with `set_config('request.jwt.claims', ...)` that admission prep gets no HSC section and every count matches an independent count.

## Task 2: App data layer

**Interfaces:**
- `fetchQuestionBankHub(mode: 'hsc' | 'admission' | null): Promise<QuestionBankHubPayload>`
- `QuestionBankHubPayload = { stage: StudyStage | null; goal: StudyGoal | null; mode: 'hsc' | 'admission' | null; sections: QuestionBankHubSection[] }`
- `QuestionBankHubRow = { id: string; labelBn: string; labelEn: string | null; shortName: string | null; count: number }`

- [ ] Types, service, hook and the pure helpers in `utils/questionBankHub.ts`.
- [ ] Tests for the helpers: top-6 universities, top-8 colleges at 3+ with the rest link, goal-first ordering, link construction per section kind.
- [ ] `npx tsx --test src/features/question-bank/utils/questionBankHub.test.ts` passes.

## Task 3: Routes and the list preset

- [ ] `/question-bank` renders a route that redirects to `/question-bank/list` when the URL carries any list key, otherwise the hub.
- [ ] `/question-bank/list` renders the existing list page unchanged otherwise.
- [ ] Add `institutionId` to the list filter state, URL state and RPC args (`p_institution_id` falls back from `universityId` to `institutionId`).
- [ ] List: search input, `focusSearch` navigation state, back to the hub with history, institution badge.
- [ ] `/question-bank/colleges`, `/question-bank/universities`, `/question-bank/university/:institutionId`.
- [ ] Back-navigation fallbacks for the new routes.

## Task 4: The hub screen

- [ ] HSC mode: search field, `এইচএসসি | ভর্তি` segmented control, subjects, boards, colleges (top 8 at 3+, plus "সব কলেজ (N)").
- [ ] Admission mode: "সব ভর্তি প্রশ্ন", goal section first and visually primary with universities (top 6 + all), "বিষয় অনুযায়ী" sheet, medical/engineering rows with the coming-soon line.
- [ ] Skeleton on load, error + retry, empty state, pull-to-refresh, scroll restore.
- [ ] Hide empty sections; never render a blank hub.

## Task 5: Verification

- [ ] Hub payload for the real admission-prep account; every count compared with an independent SQL count.
- [ ] Temporary profiles for medical, engineering, studying (no goal, medical goal), post_hsc and no stage; then deleted and the row count restored.
- [ ] Security: HSC mode for admission prep, no token, `p_mode` validation.
- [ ] Grep for English digits, hardcoded names/counts, dead handlers.
- [ ] `npm run typecheck`, `npm run test`, `npm run build` in `porokh`; `npm run build` and `npm test` in `porokh-backend`.
- [ ] Report what could not be rendered.
