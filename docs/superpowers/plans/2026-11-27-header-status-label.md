# Header Status Label Implementation Plan

> **For agentic workers:** implement task by task, keeping every change inside the header block of each screen.

**Goal:** Both the Profile and Progress headers show the student's current status (stage + goal) instead of the batch and `@username`.

**Architecture:** One pure formatter in `src/shared/lib/academic.ts` turns the server stage plus the profile into an ordered list of chips. One shared presentational component renders that list in both headers. The Profile header also gets its XP and streak chips back. Nothing is computed from the phone clock; `useStage()` remains the only stage source.

**Tech Stack:** React 18, TypeScript, Tailwind tokens, `node:test` via `tsx`.

**Spec:** The task brief supplied in this session (product decisions and verification list).

**Design read:** mobile student identity card for Bangladeshi HSC/admission candidates, in the app's existing calm utility language, dial ENERGY 1 / RHYTHM 1 / MOTION 1. Status chips carry hierarchy; no new decorative layer.

## Global Constraints

- Stage source is `useStage()` only (`studying` | `post_hsc` | `admission_prep` | loading | error). No client date maths.
- Status text comes from the formatter. Components render chips, never build label strings.
- No `@username` in either header. Batch stays only in the Profile rows.
- Bangla digits, `HSC` in Latin letters.
- Chips wrap at 360px, no ellipsis, light and dark, WCAG AA.
- Progress: only the header component changes.
- No DB writes.

## Review Focus

- A slow or failed stage request must not print a stale or guessing label.
- `post_hsc` must render nothing rather than "পরীক্ষার্থী" or "লক্ষ্য ঠিক করো".
- A null or malformed batch must not produce "HSC  · পরীক্ষার্থী" or "HSC null".
- A raw goal value (`varsity`) must never reach the screen, including unknown future goals.
- Long Bangla names and two long chips must not overflow 360px or clip the settings button.

---

### Task 1: Formatter and labels

**Files:**
- Modify: `src/shared/lib/academic.ts`
- Test: `src/shared/lib/academic.test.ts`

**Interfaces:**
- Produces: `HeaderStatusChip = { text: string; kind: 'status' | 'goal' }`
- Produces: `formatHeaderStatus(profile, stage, language?): HeaderStatusChip[]`

- [ ] **Step 1: Write the failing tests**

Cover: admission_prep with varsity / medical / engineering; studying with no goal; studying with medical; studying with `hsc` goal; post_hsc; null stage; unknown goal; null batch; batch `26`; long name irrelevant to formatter but assert the goal chip text is unchanged by profile name.

- [ ] **Step 2: Run to see them fail**

Run: `npm test` (after adding the file is already listed in the script).
Expected: `formatHeaderStatus is not a function` or import failure.

- [ ] **Step 3: Implement**

`formatHeaderStatus` returns `[]` for any stage other than the two real pre/post cases, one goal chip for `admission_prep`, and for `studying` a status chip `HSC <year> · পরীক্ষার্থী` plus a prep chip only for `medical | engineering | varsity`.

- [ ] **Step 4: Update `HSC` wording in the shared goal labels**

`GOAL_LABELS.hsc.bn` and `GOAL_PREP_LABELS.hsc.bn` move from `এইচএসসি` to `HSC`. Update the pinned assertions.

- [ ] **Step 5: Commit**

### Task 2: Shared chips component and theme tokens

**Files:**
- Create: `src/shared/components/ui/AcademicStatusChips.tsx`
- Modify: `tailwind.config.js`, `src/index.css`

**Interfaces:**
- Consumes: `HeaderStatusChip`
- Produces: `<AcademicStatusChips chips={chips} loading={boolean} />`

- [ ] **Step 1: Build the list** with `flex flex-wrap gap-2`, status chip on `bg-secondary text-text-primary`, goal chip on `bg-badge-bg text-badge-text`, single skeleton chip while loading.
- [ ] **Step 2: Add `warning-tint` / `warning-ink` tokens** for the streak chip in both themes.

### Task 3: Profile header

**Files:**
- Modify: `src/features/profile/pages/UserProfile.tsx`

- [ ] Remove the `subtitle` that joins `@username` with the academic label.
- [ ] Render `AcademicStatusChips` under the name; pass the stage and the profile batch/goal.
- [ ] Restore XP and streak chips as a second row, through message keys.
- [ ] Keep the settings button, avatar, name, and rows untouched.
- [ ] Add the two chip message keys to `src/shared/i18n/messages.ts`.

### Task 4: Progress header

**Files:**
- Modify: `src/features/progress/components/ProgressIdentity.tsx`

- [ ] Delete the `class_label` batch chip and the old comment.
- [ ] Render `AcademicStatusChips` from `useStage()`, with a loading skeleton and nothing on error.
- [ ] Keep avatar, name, and everything below the header unchanged.

### Task 5: Verify

- [ ] Grep: no `@username` in headers, no `class_label` reads, no hard-coded status strings, no legacy columns.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`.
- [ ] `git diff --stat main` shows Progress changes only in `ProgressIdentity.tsx`.
- [ ] Record the 360px render check; no browser is installed, so use a server-render of the chip list plus code inspection and say so.
