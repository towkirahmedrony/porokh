# Home "For You" Exams Implementation Plan

**Goal:** Fill the empty space below the Home feature grid with a track-personalised "Live & Upcoming Exams" section and a "Model Tests for You" section, including a one-tap target switcher and no-goal fallback.

**Architecture:** Two React Query reads (timed papers, full model tests) live behind one `useHomeExams(track)` hook. A presentation component owns the shared one-second ticker, target picker, skeletons and empty states. Starting a paper reuses `useStartModelPaper`, which calls the existing `POST /exams/user/attempts/start` endpoint, so quota and XP checks remain server-side. The target is persisted with a direct, RLS-protected `profiles.study_goal` update and mirrored into auth state.

**Stack:** React 18, TypeScript, Vite, Tailwind, TanStack Query v5, Supabase JS.

**Spec:** User brief in this session (no separate spec file).

## Global Constraints

- Track values: `hsc | medical | engineering | varsity`; labels come from `MODEL_CATEGORY_CONFIGS` so they match the Model Test category page.
- Do not add Leaderboard, hero card, free-exam counter, daily-goal card, or new routes.
- Cards use existing theme tokens, no bordered white website cards, tap targets >= 44px, skeleton while loading.
- Bangla + English strings must both be added (`messages.test.ts` enforces parity).
- Countdowns are driven by one ticker, cleaned up on unmount.
- SQL index on `exam_papers(track, is_published, start_time)` is reported to the user, not applied.

## Review Focus

- An exam whose window has already ended must disappear without a refetch (client-side filter against the ticker).
- A paper that crosses `start_time` while the screen is open must move from Upcoming to Live.
- `study_goal` values outside the four known tracks must show the choice row, not crash or query.
- A failed profile save must not remove the sections already on screen.
- The Live section must render nothing (no heading, no gap) when there is no live or upcoming paper.

---

### Task 1: Time + classification utilities

**Files:**
- Create: `src/features/dashboard/utils/homeExamTiming.ts`
- Test: `src/features/dashboard/utils/homeExamTiming.test.ts`

**Interfaces:**
- Produces: `type HomeExamTiming = 'live' | 'upcoming' | 'ended'`;
  `getHomeExamTiming(paper: { start_time: string | null; end_time: string | null }, now: number): HomeExamTiming`;
  `splitHomeExams<T extends { start_time: string | null; end_time: string | null; id: string }>(papers: T[], now: number): { live: T[]; upcoming: T[] }`;
  `formatCountdown(targetIso: string | null, now: number): string` returning `HH:MM:SS` (hours may exceed 24) or `''`.

- [ ] Step 1: Write tests pinning: ended paper excluded, future paper in upcoming, started-and-unended in live, live sorted by nearest end, upcoming sorted by nearest start, `formatCountdown` floors and clamps at `00:00:00`.
- [ ] Step 2: Run `npx tsx --test src/features/dashboard/utils/homeExamTiming.test.ts` — expect failure (module missing).
- [ ] Step 3: Implement the utilities.
- [ ] Step 4: Re-run the test — expect pass.

### Task 2: Service + hook

**Files:**
- Modify: `src/features/exam/services/modelPaperService.ts` (export the paper select and question-count helper)
- Create: `src/features/dashboard/services/homeExamService.ts`
- Create: `src/features/dashboard/hooks/useHomeExams.ts`

**Interfaces:**
- Consumes: `ModelPaperListItem`, `MODEL_PAPER_SELECT`, `fetchQuestionCounts` from `modelPaperService`.
- Produces:
  `type HomeExamTrack = 'hsc' | 'medical' | 'engineering' | 'varsity'`;
  `HOME_EXAM_TRACKS: readonly HomeExamTrack[]`;
  `isHomeExamTrack(value: unknown): value is HomeExamTrack`;
  `homeExamService.getTimedPapers(track: HomeExamTrack): Promise<ModelPaperListItem[]>` (published, `track`, both times non-null, `end_time >= now`, ordered by `start_time`, limit 20, question counts attached);
  `homeExamService.getModelTests(track: HomeExamTrack): Promise<ModelPaperListItem[]>` (published, `track`, `subject_id IS NULL`, newest 3, counts attached);
  `homeExamService.saveStudyGoal(userId: string, track: HomeExamTrack): Promise<void>` (updates `profiles.study_goal`, `.select('id').single()` so a blocked update throws);
  `useHomeExams(track: HomeExamTrack | null): { timedPapers; modelTests; isLoading; isError; refetch }`.

- [ ] Step 1: Export the select/helper without changing existing call sites.
- [ ] Step 2: Implement the service with `supabase` (RLS already allows published reads and own-row study_goal update).
- [ ] Step 3: Implement the hook with two parallel `useQuery` calls, `enabled: Boolean(track)`, `staleTime` 60s for timed / 5min for model tests, `refetchInterval` 60s for timed, shared `queryKey: ['home-exams', ...]`.
- [ ] Step 4: `npx tsc --noEmit` — expect pass.

### Task 3: Presentation + Home wiring

**Files:**
- Create: `src/features/dashboard/components/HomeExamsSection.tsx`
- Modify: `src/features/dashboard/pages/Home.tsx` (render below `FeatureGrid`)
- Modify: `src/shared/i18n/messages.ts` (bn + en keys)

**Interfaces:**
- Consumes: `useHomeExams`, `useStartModelPaper`, `PaperDetailsSheet`, `useAuth`, `useLanguage`, `MODEL_CATEGORY_CONFIGS`, timing utilities.
- Produces: default export `HomeExamsSection` with no props; reads the signed-in user itself.

- [ ] Step 1: Add the Bangla and English keys (section headings, target chip, live badge, countdowns, Start/Details, empty state, save error).
- [ ] Step 2: Implement the component: skeleton, no-goal choice row, target sheet, shared `useEffect` ticker (1s, only when timed papers exist), live cards then upcoming cards, model-test cards with "See all", single empty state with other-tracks link, start via `useStartModelPaper`, details via `PaperDetailsSheet`.
- [ ] Step 3: Render `<HomeExamsSection />` directly after the grid.
- [ ] Step 4: `npm run typecheck` and the message test — expect pass.
- [ ] Step 5: `npm run build` — expect exit 0.

## Out of scope (reported, not applied)

```sql
create index if not exists exam_papers_track_published_start_idx
  on public.exam_papers (track, is_published, start_time);
```
