# Support end-to-end + real Version Management

## Evidence (verified, not assumed)

- Admin Support Desk (`features/system/components/SupportDesk.tsx`) calls
  `GET /system/support-tickets`, which reads the legacy `user_reports` table.
  It never touches `support_tickets`.
- A real tickets UI already exists at `/support`
  (`features/support/SupportListPage.tsx`, `SupportTicketPage.tsx`) using the
  admin API that is already role-guarded.
- The backend support API is complete, except: admin replies and status
  changes are not written to `audit_logs`, and the list has no
  "last message was from the student" marker.
- `app_configs` currently has **no** `update_policy` row. Version Management
  therefore renders empty inputs; the `1.2.0` / `1.4.0` values were input
  placeholders, and the header showed "Unknown" for nulls.
- Real identities: installed APK `1.0.5` (`android/app/build.gradle`),
  deployed website `1.0.5` (`/version.json`), OTA pointer separately.
- `https://porokhbd.vercel.app/downloads/porokh.apk` returns `200` but
  `content-type: text/html` and the SPA `index.html` — the APK is **not**
  actually hosted there. The admin must surface this instead of pretending.

## Tasks

1. Backend support: audit-log admin replies and status changes; add
   `last_message_author_role` to list items; accept a `statuses` CSV filter
   for the student's grouped chips.
2. Admin Support Desk: replace the legacy component with the real ticket
   inbox + conversation using the existing hooks; keep `user_reports` in a
   separate, clearly labelled "Question reports" section.
3. Version policy: validate min <= latest (client + server), remove
   placeholders/`Unknown`, probe the APK download URL and show a warning
   when it is not an APK, make the latest OTA value read the published
   pointer, and seed the missing `update_policy` row from real build values.
4. Student app: three filter chips (সব / উত্তরের অপেক্ষায় / সমাধান হয়েছে)
   mapped onto DB statuses; cards and detail show the grouped label.
5. Verify: typecheck/lint/build in all three repos, SQL spot-checks, remove
   any test data.

## Files

- `porokh-backend/src/features/support/{support.service,support.validation,support.types}.ts`
- `porokh-backend/src/features/system/{update-policy,system.service}.ts`
- `porokh-admin/src/features/system/components/{SupportDesk,VersionManagement}.tsx`
- `porokh-admin/src/features/support/types.ts`
- `porokh/src/features/support/**` and `porokh/src/shared/i18n/messages.ts`
- `porokh-backend/supabase/migrations/20261125090321_update_policy_seed.sql`

## Verification status

- RLS checked in Postgres as `authenticated`: the owner sees 1 ticket and 1
  message (PRK-000002); a different user id sees 0 and 0.
- Backend typecheck/build pass; `update-policy` (12), support validation +
  policy (21) and attachment (8) specs pass.
- Admin typecheck and build pass; changed-file lint passes (the repo-wide lint
  has 367 pre-existing errors elsewhere).
- Student typecheck and build pass; support (6) and update-policy (15) specs pass.
- NOT runtime-verified: no `porokh-backend/.env` in this checkout, so the API,
  admin reply flow, notifications and the live Version Management save could
  not be exercised end to end. Nothing was deployed.
- `https://porokhbd.vercel.app/downloads/porokh.apk` returns the SPA HTML, not
  an APK; the admin now shows that as a warning. The file still needs to be
  uploaded.
- Admin replies keep `author_role = 'staff'` (the existing DB constraint and
  UI contract); it is the admin role in this schema.
