# Batch + Goal + Stage System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the HSC batch a permanent identity, make the study goal the current target, and drive both from a server-timed `stage` so the student app can gate the goal exactly once after the HSC exam ends.

**Architecture:** Postgres owns the truth. `profiles.hsc_batch` is the only batch column, `hsc_batches` holds admin-edited exam dates, and `get_my_stage()` computes `studying | post_hsc | admission_prep` from the caller's profile and `now()`. The backend proxies that RPC and owns goal writes; the student app holds one `StageProvider` as the single source of truth and never computes a stage from the device clock; the admin panel edits batches and reads server-computed stage.

**Tech Stack:** Postgres/Supabase (RLS, plpgsql), Express + TypeScript + Zod, React 18 + Vite + Tailwind + TanStack Query, React 19 admin panel with shadcn primitives.

**Spec:** the task brief in the conversation (product decisions are final; this plan records only the decisions the brief left open).

**Design Read (new screens):** native-app goal gate for 17-19 year old Bangladeshi HSC students, in the existing Porokh teal/amber language, dial ENERGY 2 / RHYTHM 2 / MOTION 2. Focal point per screen is the goal choice itself; one accent (amber) on the selected card; no new palette.

## Global Constraints

- Bangla UI copy is the source of truth; every new key is added to `bn` and `en` in `src/shared/i18n/messages.ts` (the `en` object is typed against `bn`, so a missing key is a compile error).
- Batch labels always use `hsc_batch` and Bangla digits: `HSC ২০২৬ ব্যাচ`. The word `শ্রেণি` is never printed with a batch.
- Tap targets 44px minimum, light and dark mode both work, no browser-default card template.
- Stage is never computed on the client. Only the server's answer (or the last answer it gave) is used.
- No writes to `class_level` or `batch_year` anywhere after Task 1.
- Exam engine, quota logic and Model Test flow are not modified; they only read the goal.
- New local branch `feat/batch-stage-system` in all three repos (created). Do not push.
- No migration is applied, and no row is deleted, without the owner's explicit OK.

## Decisions this plan makes (the brief left these open)

1. **Route aliases.** The brief names `/api/v1/profile/stage`; the repo mounts profiles at `/api/v1/profiles`. Both are mounted so neither name breaks: canonical `/api/v1/profiles/*`, alias `/api/v1/profile/*`. Admin batches are canonical `/api/v1/admin/hsc-batches`.
2. **`search_path`.** The brief says `search_path = public`; every function in this schema (including `is_admin()`) uses `set search_path to ''` with schema-qualified names, exactly because of the warning in the brief. The RPC follows the codebase (`''` + qualified), which satisfies the intent.
3. **Exam end day.** A batch counts as finished from the day *after* `exam_end_date`, in `Asia/Dhaka`. On the end date itself the student is still `studying`.
4. **Seed data.** `2026` gets the owner's date; `2027` and `2028` are `NULL` (= not finished). `profiles.goal_confirmed_at` is **not** backfilled, so the one existing account with `study_goal = 'varsity'` lands in `post_hsc` and sees the one-tap confirmation, which is the behaviour the brief asks for.
5. **Two gate modes.** `post_hsc` with no real goal shows the 3 tappable cards plus a disabled HSC card that explains why it is gone. `post_hsc` with an unconfirmed real goal shows "তোমার লক্ষ্য X, ঠিক আছে? / বদলাও". Both save through `PATCH .../goal`.
6. **Offline behaviour.** `useStage()` persists the last server answer. On a network failure it reuses that answer; if the server has never answered on this device it renders no gate (a student is never locked out of the app by a failed request). A gate that has been shown is never dismissible.
7. **`hsc_batch` write path.** `authenticated` has no UPDATE privilege on `profiles.hsc_batch` today; signup and the academic editor already go through `SECURITY DEFINER` RPCs. That stays. The new `goal_confirmed_at` column gets `grant select` only, so a client cannot mark its own goal confirmed.
8. **Backend validation of the batch.** The signup RPC keeps accepting any four-digit year (older APKs send 2024/2025, which are not seeded); the backend endpoints require the batch to exist in `hsc_batches`. New clients only offer seeded batches.
9. **Goal writes.** Any accepted goal write sets `goal_confirmed_at = now()`; `hsc` is rejected once the server says `post_hsc`.
10. **Home personalisation** keeps its existing track logic and reads `goal` from `useStage()` instead of `user.study_goal`; `user.study_goal` is still updated so cached code paths agree.

---

## Task 1: Database migration and rollback

**Files:**
- Create: `porokh-backend/supabase/migrations/20261126120000_batch_goal_stage.sql` (written)
- Create: `porokh-backend/supabase/rollbacks/20261126120000_batch_goal_stage.down.sql` (written)

**Interfaces:**
- Produces: `public.hsc_batches(batch_year, exam_end_date, notes, updated_at, updated_by)`, `public.profiles.goal_confirmed_at`, `public.get_my_stage() returns jsonb` with keys `stage`, `batch_year`, `goal`, `needs_goal_gate`, `exam_ended`; `complete_onboarding(...)` same signature, no longer writes `class_level`, sets `goal_confirmed_at`.

- [ ] **Step 1:** Owner reviews the SQL and supplies the 2026 `exam_end_date`; replace `date '2026-11-05'` in the seed with it.
- [ ] **Step 2:** Apply with `supabase__apply_migration` (name `batch_goal_stage`).
- [ ] **Step 3:** Verify: `select * from hsc_batches order by batch_year;` returns 3 rows; `select hsc_batch, goal_confirmed_at from profiles;` shows `2026` for the existing row and `goal_confirmed_at` null; `select prosrc from pg_proc where proname='get_my_stage'` is non-empty.
- [ ] **Step 4:** Verify the RPC as the owner's own JWT is not possible from SQL (no `auth.uid()`); the backend read is verified in Task 2 Step 6 against the live API instead.
- [ ] **Step 5:** Commit the two files.

## Task 2: Backend stage and goal endpoints

**Files:**
- Modify: `porokh-backend/src/features/profile/profile.validation.ts`
- Modify: `porokh-backend/src/features/profile/profile.types.ts`
- Modify: `porokh-backend/src/features/profile/profile.service.ts`
- Modify: `porokh-backend/src/features/profile/profile.controller.ts`
- Modify: `porokh-backend/src/features/profile/profile.routes.ts`
- Modify: `porokh-backend/src/app.ts` (alias mount)
- Test: `porokh-backend/src/features/profile/profile.stage.spec.ts`

**Interfaces:**
- Consumes: `get_my_stage()` from Task 1.
- Produces:
  - `GET /api/v1/profiles/stage` and `GET /api/v1/profile/stage` → `{ stage: 'studying'|'post_hsc'|'admission_prep', batch_year: string|null, goal: StudyGoal|null, needs_goal_gate: boolean, exam_ended: boolean }`
  - `PATCH /api/v1/profiles/goal` body `{ goal: 'hsc'|'medical'|'engineering'|'varsity' }` → same shape
  - `ProfileService.getMyStage(accessToken: string): Promise<StageResponse>`
  - `ProfileService.setGoal(userId: string, accessToken: string, goal: StudyGoal): Promise<StageResponse>`
  - `parseStudyGoal(value: unknown, { allowHsc: boolean }): StudyGoal` and `parseHscBatch(value: unknown): string` in `profile.validation.ts`
  - `STUDY_GOALS = ['hsc','medical','engineering','varsity'] as const`, `type StudyGoal`, `interface StageResponse`

- [ ] **Step 1: Write the failing test.** `profile.stage.spec.ts` follows the `profile.security.spec.ts` harness (stub `../../config/supabase`, `../../config/supabaseAdmin`, `../../config/userSupabase` via `createRequire` + `require.cache` injection as that file does). Cases:
  - `parseStudyGoal('medical') === 'medical'`; `parseStudyGoal('MBBS')` throws `ProfileValidationError`; `parseStudyGoal('hsc', { allowHsc: false })` throws.
  - `parseHscBatch('2027') === '2027'`; `parseHscBatch('27')` throws; `parseHscBatch('2019')` throws.
  - `PATCH /goal` with goal `hsc` when the stubbed RPC returns `{ stage: 'post_hsc' }` responds 400 and performs no update.
  - `PATCH /goal` with `medical` when the RPC returns `{ stage: 'post_hsc' }` responds 200 and the update payload contains `study_goal: 'medical'` and a non-null `goal_confirmed_at`.
  - `GET /stage` without a bearer token responds 401.
- [ ] **Step 2: Run it, confirm it fails** (`npm test` includes the new spec only after it is added to the `test` script; add the path there).
- [ ] **Step 3: Implement.** `getMyStage` calls `createUserSupabaseClient(accessToken).rpc('get_my_stage')` and validates the five fields, throwing `ProfileValidationError('Stage response was invalid')` on a shape mismatch. `setGoal` calls `getMyStage` first, rejects `hsc` when `stage === 'post_hsc'`, then updates `profiles` with `study_goal` + `goal_confirmed_at: new Date().toISOString()` through `supabaseAdmin`, then re-reads the stage and returns it. Controller reads `(req as any).accessToken` and passes it; routes get `rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'profile-goal' })` on the PATCH and 120/min on the GET.
- [ ] **Step 4: Profile update stops accepting legacy fields.** Remove `class_level` and `batch_year` from `PROFILE_SELF_EDITABLE_FIELDS` and `profileFields`; type `hsc_batch` as `/^20[0-9]{2}$/`; type `study_goal` as `z.enum(STUDY_GOALS)`. In `updateProfile`, when the payload has `hsc_batch`, check it exists in `hsc_batches` and throw `ProfileValidationError('Unknown HSC batch')` otherwise; when it has `study_goal`, add `goal_confirmed_at` and reject `hsc` for a `post_hsc` user.
- [ ] **Step 5: Run the new spec and the existing profile specs.** All pass.
- [ ] **Step 6: Verify against the live API** with the owner's token: `GET /api/v1/profile/stage` returns `stage: "admission_prep"` or `"post_hsc"` for the 2026 account (never a phone-derived answer).
- [ ] **Step 7: Commit.**

## Task 3: Backend admin batch endpoints

**Files:**
- Create: `porokh-backend/src/features/hsc-batches/hscBatches.admin.routes.ts`
- Create: `porokh-backend/src/features/hsc-batches/hscBatches.admin.controller.ts`
- Create: `porokh-backend/src/features/hsc-batches/hscBatches.admin.service.ts`
- Create: `porokh-backend/src/features/hsc-batches/hscBatches.validation.ts`
- Create: `porokh-backend/src/features/hsc-batches/hscBatches.types.ts`
- Create: `porokh-backend/src/features/hsc-batches/hscBatches.admin.spec.ts`
- Modify: `porokh-backend/src/app.ts`

**Interfaces:**
- Produces:
  - `GET /api/v1/admin/hsc-batches` → `{ batches: BatchRow[] }` where `BatchRow = { batch_year: string; exam_end_date: string|null; notes: string|null; updated_at: string; student_count: number; pending_goal_count: number; exam_ended: boolean }`
  - `POST /api/v1/admin/hsc-batches` body `{ batch_year: string; exam_end_date?: string|null; notes?: string|null }` → `BatchRow`
  - `PATCH /api/v1/admin/hsc-batches/:year` body `{ exam_end_date?: string|null; notes?: string|null }` → `BatchRow & { affected_students: number }`
- Reuses `rateLimit`, `requireAuth`, `rbacGuard(['admin','super_admin'])`, `requirePermission(PERMISSIONS.SETTINGS_MANAGE)`, `recordAdminAudit`.

- [ ] **Step 1: Write the failing spec:** rejects a malformed year (`2026-27`, `26`), rejects `2026-02-30`, rejects notes over 500 chars, requires admin (non-admin 403 through the guard stub), and writes an audit row with `action: 'hsc_batch.update'`, `target_table: 'hsc_batches'`, `target_id: '2027'`.
- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Implement.** `listBatches` reads `hsc_batches` ordered by year desc and, for counts, one `profiles` query grouped in JS over `hsc_batch, study_goal, goal_confirmed_at` (both tables are small; no new view). `exam_ended` is computed with `(now() in Asia/Dhaka).date > exam_end_date`, the same rule as the RPC. `upsertBatch` inserts with `on conflict do nothing` and returns 409 `{ success: false, message: 'Batch already exists' }`. `updateBatch` returns 404 for an unknown year, sets `updated_by = req.user.id`, and counts `affected_students` as profiles in that batch whose stored goal is not a confirmed real goal when the date crosses from future/NULL to past.
- [ ] **Step 4: Run the spec; then `npm test` for the whole suite.**
- [ ] **Step 5: Commit.**

## Task 4: Backend read models that still speak `class_level`

**Files:**
- Modify: `porokh-backend/src/features/users/users.admin.service.ts` (`DIRECTORY_COLUMNS`, row mapper, 360 profile)
- Modify: `porokh-backend/src/features/users/users.admin.types.ts`
- Modify: `porokh-backend/src/features/users/users.admin.query.ts` (accept `batch`, `goal`)
- Modify: `porokh-backend/src/features/users/users.admin.controller.ts` (CSV columns)
- Modify: `porokh-backend/src/features/progress/progress.service.ts:214-256`
- Modify: `porokh-backend/src/features/support/support.service.ts:150,451` and `support.types.ts`
- Test: `porokh-backend/src/features/users/users.admin.query.spec.ts` (new cases)

**Interfaces:**
- Produces: directory rows gain `hsc_batch: string|null`, `study_goal: string|null`, `stage: Stage`; `DirectoryQuery` gains `batch?: string`, `goal?: StudyGoal`; 360 `profile` object gains `hsc_batch`, `study_goal`, `goal_confirmed_at`, `stage`.
- Progress and support payloads keep their `class_label` / `class_level` field names (client contract) but read `hsc_batch`.

- [ ] **Step 1: Write failing assertions** in the existing query spec: `parseDirectoryQuery({ batch: '2026' })` filters; `parseDirectoryQuery({ batch: '26' })` throws; `parseDirectoryQuery({ goal: 'doctor' })` throws.
- [ ] **Step 2: Implement.** Use a shared `computeStage({ hsc_batch, study_goal, goal_confirmed_at, exam_end_date })` helper in `src/lib/utils/stage.ts` so the backend's two stage call sites cannot drift from the RPC. Directory `stage` is computed after one `hsc_batches` read per request.
- [ ] **Step 3: Remove every remaining `class_level` read** in the files listed above; keep the payload field names the clients already consume.
- [ ] **Step 4: `npm test`, `npm run build`, `npm run lint`.** All pass.
- [ ] **Step 5: Commit.**

## Task 5: Student app academic helper

**Files:**
- Create: `porokh/src/shared/lib/academic.ts`
- Test: `porokh/src/shared/lib/academic.test.ts`
- Modify: `porokh/package.json` (add the test path)

**Interfaces:**
- Produces:
  ```ts
  export const STUDY_GOALS = ['hsc', 'medical', 'engineering', 'varsity'] as const;
  export type StudyGoal = (typeof STUDY_GOALS)[number];
  export const ADMISSION_GOALS = ['varsity', 'medical', 'engineering'] as const;
  export type StudyStage = 'studying' | 'post_hsc' | 'admission_prep';
  export const isStudyGoal = (v: unknown): v is StudyGoal => ...
  export const isAdmissionGoal = (v: unknown): v is StudyGoal => ...
  export const goalLabel = (goal: StudyGoal | string | null | undefined, language?: AppLanguage): string
  export const formatAcademicLabel = (
    profile: { hsc_batch?: string | null; study_goal?: string | null },
    stage: StudyStage | null,
    language?: AppLanguage
  ): string
  export const formatBatchLabel = (hscBatch: string | null | undefined, language?: AppLanguage): string | null
  export const banglaYear = (year: string): string
  ```
- `goalLabel`: `hsc → এইচএসসি`, `medical → মেডিকেল`, `engineering → ইঞ্জিনিয়ারিং`, `varsity → ভার্সিটি`; EN `HSC / Medical / Engineering / University`; unknown → `''`.
- `formatAcademicLabel`: `studying` → `HSC ২০২৭ · পরীক্ষার্থী` plus ` · মেডিকেল প্রস্তুতি` only for a real goal; `admission_prep` → `HSC ২০২৬ ব্যাচ · ভার্সিটি ভর্তি প্রস্তুতি`; `post_hsc` → `HSC ২০২৬ ব্যাচ · লক্ষ্য ঠিক করো`; no batch → `''` for `studying`, goal-only text otherwise. Never emits `শ্রেণি`.

- [ ] **Step 1: Write the failing test** with the exact strings above, both languages, plus `formatAcademicLabel({ hsc_batch: '2026' }, 'admission_prep') === 'HSC ২০২৬ ব্যাচ · ভার্সিটি ভর্তি প্রস্তুতি'` only when the goal is confirmed (pass `goal`), and a test that no output contains `শ্রেণি`.
- [ ] **Step 2: Run `npx tsx --test src/shared/lib/academic.test.ts`, confirm it fails.**
- [ ] **Step 3: Implement.** Digits go through `localizeDigits`; labels go through the new `academic.*` i18n keys rather than inline Bangla where the app already uses `t()`; `goalLabel` stays a pure function (no hook) so it works in both apps' non-React code.
- [ ] **Step 4: Run the test; it passes.**
- [ ] **Step 5: Commit.**

## Task 6: Stage provider and hook

**Files:**
- Create: `porokh/src/features/stage/types/stage.ts`
- Create: `porokh/src/features/stage/services/stageService.ts`
- Create: `porokh/src/features/stage/context/StageProvider.tsx`
- Create: `porokh/src/features/stage/hooks/useStage.ts`
- Create: `porokh/src/features/stage/utils/stage.ts`
- Test: `porokh/src/features/stage/utils/stage.test.ts`
- Modify: `porokh/src/shared/constants/storageKeys.ts`
- Modify: `porokh/src/App.tsx`
- Modify: `porokh/package.json`

**Interfaces:**
- Produces:
  ```ts
  interface StageState {
    stage: StudyStage | null;
    batchYear: string | null;
    goal: StudyGoal | null;
    needsGoalGate: boolean;
    examEnded: boolean;
    status: 'idle' | 'loading' | 'ready' | 'error';
  }
  useStage(): StageState & { refresh: () => Promise<void>; setGoal: (goal: StudyGoal) => Promise<void> }
  parseStageResponse(data: unknown): StageState | null   // in utils/stage.ts
  ```
- `stageService.getStage()` → `apiClient.get('/profiles/stage')`, reads `data.data`; `stageService.setGoal(goal)` → `apiClient.patch('/profiles/goal', { goal })`.

- [ ] **Step 1: Write the failing test** for `parseStageResponse`: accepts a valid payload; rejects `stage: 'graduate'`, a missing key, and a non-boolean `exam_ended`; maps `goal: 'hsc'` + `stage: 'studying'` correctly.
- [ ] **Step 2: Implement.** Provider behaviour, in this order:
  1. On mount with a user id: read the cached stage from `StorageUtils` (key `STAGE_STATE_PREFIX + userId`), adopt it immediately, then `refresh()`.
  2. `refresh()` is idempotent per user and never runs without a session.
  3. `App.addListener('appStateChange', …)` on resume calls `refresh()`; the listener is removed on unmount.
  4. `setGoal()` calls the API, writes the new state + cache, and calls `updateUserProfile(user.id, { study_goal })`.
  5. A network error keeps the previous state and sets `status: 'error'` without clearing `stage`; with no previous state, `stage` stays `null` (no gate).
  6. On sign-out, clear the cached stage.
  Mount `<StageProvider>` inside `<AuthProvider>` and above `<SystemGuard>` in `src/main.tsx`/`App.tsx` (the provider needs `useAuth`, the guard does not need it).
- [ ] **Step 3: Run the test, then `npm run typecheck`.**
- [ ] **Step 4: Commit.**

## Task 7: Goal gate

**Files:**
- Create: `porokh/src/features/stage/components/GoalGate.tsx`
- Create: `porokh/src/features/stage/components/GoalCard.tsx`
- Create: `porokh/src/features/stage/components/GoalConfirm.tsx`
- Modify: `porokh/src/features/auth/components/PermissionGuard.tsx`
- Modify: `porokh/src/shared/i18n/messages.ts`

**Interfaces:**
- Consumes `useStage()` from Task 6.
- `PermissionGuard` renders `<GoalGate />` instead of `children` when `needsGoalGate` is true, and a `<GoalGateSkeleton />` while `status === 'loading'` and no cached stage exists. Nothing else in the guard changes.

- [ ] **Step 1: Write the gate.** Full-screen, no app shell: batch label (`formatBatchLabel`) at the top, `তোমার লক্ষ্য কী?` as the single `h1`, three selectable cards (ভার্সিটি / মেডিকেল / ইঞ্জিনিয়ারিং) with a one-line description each, a disabled `এইচএসসি` card carrying the note that HSC prep is over, and a `চালিয়ে যাও` primary button that is disabled until a card is selected. Selection is one tap to select, the button commits (two taps total, deliberate: an accidental tap must not lock the goal).
- [ ] **Step 2: Block dismissal.** Register `pushBackInterceptor(() => true)` while the gate is mounted; no close control; the gate is rendered by the guard, so a deep link only reaches the gate, never the page behind it.
- [ ] **Step 3: No flicker.** On `setGoal` success, update the stage before navigating: render children only when `needsGoalGate` is false, so Home mounts once, after the gate.
- [ ] **Step 4: Confirmation variant.** When `goal` is a real goal and `needsGoalGate` is true, show `তোমার লক্ষ্য {goal}, ঠিক আছে?` with `হ্যাঁ, ঠিক আছে` (PATCH the same goal) and `বদলাও` (switches to the 3-card view).
- [ ] **Step 5: Design checks.** 44px cards, `min-h-screen` with `bg-app`, selected state uses `border-primary` + `bg-primary/10` + a check icon (not colour alone), focus-visible ring, dark mode via the existing tokens, `prefers-reduced-motion` respected (the only motion is a 150ms opacity/scale on tap).
- [ ] **Step 6: Verify at 360px, light and dark** with `npm run dev` in the browser at a 360px viewport; record the pass in the final report.
- [ ] **Step 7: Commit.**

## Task 8: Signup picks the batch, goal is optional

**Files:**
- Modify: `porokh/src/features/onboarding/pages/Onboarding.tsx`
- Modify: `porokh/src/features/onboarding/utils/onboarding.ts`
- Modify: `porokh/src/features/onboarding/utils/onboardingDraft.ts`
- Modify: `porokh/src/features/profile/utils/academicProfile.ts` (`HSC_BATCH_OPTIONS` no longer the source for the picker)
- Create: `porokh/src/features/profile/hooks/useHscBatches.ts`
- Modify: `porokh/src/features/onboarding/utils/onboarding.test.ts`
- Modify: `porokh/src/shared/i18n/messages.ts`

**Interfaces:**
- Produces: `useHscBatches(): { batches: string[]; isLoading: boolean; isError: boolean; refetch: () => void }` reading `hsc_batches` newest first via the Supabase client.
- `OnboardingDraft` keeps `hscBatch`, drops `classLevel` and `group`; `CompleteOnboardingParams.p_class_level` is sent as `null` always; `p_group` as `null`.

- [ ] **Step 1: Update the failing test** first: `buildCompleteOnboardingParams` returns `p_class_level: null` and `p_study_goal: 'hsc'` when the goal step was untouched, `p_study_goal: 'medical'` when picked, and `p_hsc_batch` from the draft.
- [ ] **Step 2: Replace the class chips** in step 2 with required batch chips from `useHscBatches` (2026/2027/2028, newest first), with loading, empty and error states (`আবার চেষ্টা করো`). Batch cannot be skipped: the skip button advances to step 3 but keeps the batch requirement, and `finishOnboarding` blocks with `academic.batchRequired` when it is empty.
- [ ] **Step 3: Goal chips** use `STUDY_GOALS` labels via `goalLabel`, default selection `hsc`, plus an explicit `এখনো ঠিক করিনি` chip that clears the selection; the draft stores `''` for not-decided.
- [ ] **Step 4: Keep the flow order** (name/username → academics → password/verification) and the email-verification path unchanged.
- [ ] **Step 5: `npm test` (onboarding specs) and `npm run typecheck`.**
- [ ] **Step 6: Commit.**

## Task 9: One label everywhere the batch or goal is shown

**Files:**
- Modify: `porokh/src/features/profile/pages/UserProfile.tsx` (subtitle + new `লক্ষ্য` row)
- Modify: `porokh/src/features/profile/pages/EditProfile.tsx` (drop `class_level` select and the raw goal text input)
- Modify: `porokh/src/features/profile/pages/AcademicProfile.tsx` (batch from `hsc_batches`, goal via `useStage().setGoal`)
- Modify: `porokh/src/features/profile/components/public/ProfileHero.tsx`
- Modify: `porokh/src/features/progress/components/ProgressIdentity.tsx`
- Modify: `porokh/src/features/progress/types/progress.ts` + `porokh/src/features/progress/utils/progressView.ts`
- Modify: `porokh/src/features/auth/context/AuthProvider.tsx`, `types/auth.ts`, `utils/profileCache.ts`, `utils/authSessionSync.ts` (drop `class_level` from the select list and cache shape)
- Modify: `porokh/src/shared/i18n/messages.ts` (delete unused `progress.classChip`, `onboarding.classLabel`; add `profile.goalRow`, `profile.goalChangeTitle`, `academic.goal*`)

**Interfaces:**
- Consumes `formatAcademicLabel`, `formatBatchLabel`, `goalLabel` (Task 5) and `useStage()` (Task 6).
- `ProgressUser.class_label` becomes `hsc_batch`; the progress page passes it through `formatBatchLabel`.

- [ ] **Step 1: Profile header** subtitle becomes `formatAcademicLabel(user, stage)`, and an `AccountRow` labelled `লক্ষ্য` shows `goalLabel(goal)` and opens a goal sheet reusing `GoalCard`; changing the goal calls `setGoal` and the Home content updates because it reads the same provider.
- [ ] **Step 2: Public profile hero** uses `formatBatchLabel(profile.hsc_batch)` + `goalLabel(profile.study_goal)` (another student's stage is not available and is not guessed).
- [ ] **Step 3: Progress** shows `HSC ২০২৬ ব্যাচ`, never `শ্রেণি HSC ২৬`.
- [ ] **Step 4: Grep** `class_level|classLevel|batch_year|শ্রেণি` across `src`; only the legacy type fields kept for the API contract may remain, and no rendering path may use them.
- [ ] **Step 5: `npm test`, `npm run typecheck`, `npm run build`.**
- [ ] **Step 6: Commit.**

## Task 10: Home personalisation reads the stage goal

**Files:**
- Modify: `porokh/src/features/dashboard/components/HomeExamsSection.tsx`
- Modify: `porokh/src/features/dashboard/pages/Home.tsx`
- Modify: `porokh/src/features/dashboard/hooks/useHomeGrids.ts`
- Modify: `porokh/src/features/dashboard/services/homeExamService.ts` (delete `saveStudyGoal`, which wrote `profiles.study_goal` directly)
- Modify: `porokh/src/features/exam/pages/ModelCategoryPage.tsx`

**Interfaces:**
- Consumes `useStage()`; `goal` replaces `user?.study_goal` at every read site. The in-picker "save target" action now calls `setGoal` instead of `homeExamService.saveStudyGoal`.

- [ ] **Step 1:** Replace the three `user?.study_goal` reads and add `stage.goal` to the dependency arrays.
- [ ] **Step 2:** Delete `saveStudyGoal` and point the picker at `setGoal`.
- [ ] **Step 3:** Confirm the track mapping is unchanged (`isHomeExamTrack(goal)` → `'hsc' | 'medical' | 'engineering' | 'varsity'`), so a null goal still shows the current empty state.
- [ ] **Step 4: `npm run typecheck` and a browser check** that Home renders for the owner's account.
- [ ] **Step 5: Commit.**

## Task 11: Admin batch management page

**Files:**
- Create: `porokh-admin/src/features/hsc-batches/HscBatchesPage.tsx`
- Create: `porokh-admin/src/features/hsc-batches/api/useHscBatches.ts`
- Create: `porokh-admin/src/features/hsc-batches/types.ts`
- Create: `porokh-admin/src/features/hsc-batches/components/BatchRowEditor.tsx`
- Create: `porokh-admin/src/features/hsc-batches/components/AddBatchDialog.tsx`
- Modify: `porokh-admin/src/routes/paths.ts`, `porokh-admin/src/routes/index.tsx`
- Modify: `porokh-admin/src/components/layout/navigation.ts`

**Interfaces:**
- Consumes the Task 3 API through `apiClient`.
- `PATHS.HSC_BATCHES = '/hsc-batches'`; nav leaf `HSC ব্যাচ` with `GraduationCap` under the existing `users-access` section.

- [ ] **Step 1: Table** with columns: batch year, exam end date, status (`চলছে` / `শেষ`), students in batch, students still needing a goal, notes, last updated. TanStack Query, loading skeletons, empty state, error state with retry.
- [ ] **Step 2: Edit date** opens an `AlertDialog`: date input + notes, with the confirmation line `এতে X জন শিক্ষার্থীর স্টেজ বদলাবে` computed from the row's `pending_goal_count` when the change moves the date across today. Invalid/empty date handling: clearing the date means "not finished" and says so.
- [ ] **Step 3: Add batch** dialog validates `^20[0-9]{2}$` client-side and surfaces the 409 message.
- [ ] **Step 4: Bangla/English labels** follow the panel's existing bilingual helper, not ad-hoc strings.
- [ ] **Step 5: `npm run lint`, `npm run build`.**
- [ ] **Step 6: Commit.**

## Task 12: Admin user views

**Files:**
- Modify: `porokh-admin/src/features/users/components/tabs/TabAcademic.tsx`
- Modify: `porokh-admin/src/features/users/components/tabs/TabOverview.tsx`
- Modify: `porokh-admin/src/features/users/components/UserFilterTable.tsx`
- Modify: `porokh-admin/src/features/users/types/index.ts`
- Modify: `porokh-admin/src/features/support/SupportTicketPage.tsx`, `src/features/system/components/SupportDesk.tsx` (batch instead of class)

**Interfaces:**
- Consumes: directory rows now carry `hsc_batch`, `study_goal`, `stage`.

- [ ] **Step 1:** Academic tab shows `Batch: HSC ২০২৬`, `Goal: ভার্সিটি`, `Stage: ভর্তি প্রস্তুতি` and drops `Class:` / `batch_year`.
- [ ] **Step 2:** Overview shows the goal through `goalLabel`, never the raw `varsity` string.
- [ ] **Step 3:** Directory filter bar gains Batch (from the batches API) and Goal selects, passed as `batch` / `goal` query params; a row shows its batch and goal label.
- [ ] **Step 4:** `npm run lint`, `npm run build`, and a browser pass over the users page with the two filters applied.
- [ ] **Step 5: Commit.**

## Task 13: End-to-end verification

**Files:** none (evidence only). Temporary test accounts and rows are removed at the end.

- [ ] **Step 1: Fixtures.** Create throwaway auth users with profiles (`qa-2027@…`, `qa-2026-gate@…`, `qa-2026-hsc@…`, `qa-2026-varsity@…`) via service role, then delete them in Step 9.
- [ ] **Step 2: Stage matrix** through `GET /profile/stage` with each user's JWT: 2027 → `studying`, gate false; 2027 + medical → `studying`, gate false; 2026 + null goal → `post_hsc`, gate true; 2026 + `hsc` → `post_hsc`, gate true; 2026 + confirmed varsity → `admission_prep`, gate false.
- [ ] **Step 3: Gate behaviour in the app** for the 2026 + null user: gate appears before Home, saves once, and does not return on reload or resume.
- [ ] **Step 4: Admin flip.** Set 2026's date to a future date: a `studying` user goes to `studying`; set it back to the past: `post_hsc` + gate on the next resume. Both changes audited.
- [ ] **Step 5: Wrong phone clock.** With the device clock set two years forward, `GET /profile/stage` returns the identical payload (the server value is compared byte for byte).
- [ ] **Step 6: Authorization abuse**, all expected to fail: as a normal user `PATCH /admin/hsc-batches/2027`, `UPDATE hsc_batches` through PostgREST, `UPDATE profiles SET study_goal` for another user's id through PostgREST, `PATCH /profiles/goal` for another user (no such parameter exists, so the request must 400), and `PATCH /profiles/goal { goal: 'hsc' }` as a `post_hsc` user (400).
- [ ] **Step 7: Greps** across the three repos: no `class_level` / `batch_year` in active code paths outside the legacy type fields and migration files; no raw `varsity` / `medical` / `engineering` in user-facing strings; no hardcoded exam end date outside `hsc_batches`.
- [ ] **Step 8: Builds.** `npm run typecheck` + `npm test` + `npm run build` for porokh; `npm test` + `npm run build` + `npm run lint` for porokh-backend; `npm run lint` + `npm run build` for porokh-admin.
- [ ] **Step 9: Clean up** the QA users, their profiles and any rows written during testing; confirm row counts return to the pre-test values.
- [ ] **Step 10: Report** per repo, the migration + rollback, evidence per check, and merge-conflict notes with `feat/home-personalised-exams` (already merged into `main`) and the progress redesign.

## Review Focus

- A student whose batch has **no row** in `hsc_batches` (older APK sent 2024) must read `studying`, not crash and not gate.
- The stage request **fails** (offline, 500). The app must keep the last known answer and must not show the gate for a student who is still studying, nor skip it for one who is `post_hsc` and already cached as such.
- `exam_end_date` is **today**. The student is still `studying` today, `post_hsc` tomorrow, in Dhaka time.
- The admin **clears** the exam date. Stage must return to `studying` for that batch, and the confirmation dialog must say the date is being removed.
- A goal write while the gate is open is **double-tapped**. The second request must not create a second confirmation or a different goal.

## Merge-conflict notes

- `feat/home-personalised-exams` is already in `porokh/main` (commit `adce687`); no conflict expected, but `HomeExamsSection.tsx`, `Home.tsx` and `homeExamService.ts` are the shared files with the progress-redesign work.
- The progress redesign touched `ProgressIdentity.tsx`, `progressView.ts` and `messages.ts`; this branch changes the same files. Expect textual conflicts in `messages.ts` (key removal) and `ProgressIdentity.tsx`; resolve by keeping the redesigned layout and the new label function.
- `AuthProvider.tsx` and `profileCache.ts` are touched by both cached-profile work and this change; the only removal here is `class_level` from the select and cache shape.
