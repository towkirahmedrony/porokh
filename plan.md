# Porokh profile hub redesign

## Implementation approach

Replace the current long-form profile details layout with a compact, single-scroll profile and account hub in `src/features/profile/pages/UserProfile.tsx`. The page will keep the existing profile query, access/plan hook, theme hook, language provider, navigation routes, logout behavior, and profile update API. Existing `/edit-profile`, `/settings`, `/change-password`, `/referral`, `/dashboard/marketplace`, `/support`, and legal routes remain the navigation targets.

The profile page will derive a subtitle from only populated identity/academic fields, calculate completion from the eleven requested profile fields, hide the completion card at 100%, and render grouped account rows with 44px+ touch targets. The plan presentation will be compact while reusing `useAccess` data and existing plan labels. The existing edit page already contains the two requested Personal/Academic sections, phone/date controls, verified email display capability, sticky save action, and the existing update endpoint; it will receive only targeted polish if needed rather than a new API path.

## Project structure

- `src/features/profile/pages/UserProfile.tsx`: compact profile/account hub, completion calculation, grouped navigation, logout confirmation.
- `src/features/profile/pages/EditProfile.tsx`: existing edit form, retained as the dedicated profile editor route.
- `src/features/profile/components/*`: existing avatar and form primitives reused where they fit.
- `src/shared/i18n/messages.ts`: add any profile-hub copy in both Bengali and English so the language toggle remains complete.
- `src/index.css`: only use existing semantic theme tokens; no new hardcoded colors.

## Design direction

**Chosen movement:** quiet utility / editorial account hub. It uses a calm vertical rhythm, thin borders, compact information hierarchy, and teal interaction accents rather than large dashboard cards.

**Core principles:** one clear identity block; progressive disclosure through grouped rows; every row is actionable or meaningfully informative; Bengali text gets generous line-height and no clipped conjuncts.

**Color philosophy:** preserve Porokh's semantic teal for action/icon emphasis, blue for the avatar identity, amber for plan/status accents, and theme variables for all surfaces, borders, and text so light/dark remain coherent.

**Layout paradigm:** a single narrow reading column with a top bar, identity rail, compact cards, and grouped list sections. No desktop-only split layout that pushes account actions below the fold.

**Signature elements:** 72px initial/avatar circle; thin progress rail for profile completion; grouped list rows with one consistent outline-icon color and trailing chevrons/toggle.

**Interaction philosophy:** tapping identity or completion opens editing; rows disclose their destination; destructive logout is visually separated and confirmed.

**Typography:** existing Noto Sans Bengali/Hind Siliguri for Bengali and the app's existing sans stack for English; minimum 1.4 line-height for Bengali copy.

**Brand essence:** Porokh is a focused study account hub for students who want their profile, plan, and everyday controls in one short, calm surface. Personality: focused, warm, dependable.

## Constraints

Do not change business logic, API calls, or existing route semantics. Reuse semantic theme classes and the current icon set. Keep bottom navigation safe-area space, support loading/error states, and verify `npm run build` plus the native sync command if dependencies/platform files require it.
