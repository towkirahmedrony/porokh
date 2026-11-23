# Notifications (app)

The app shows the inbox and owns this installation's FCM token. It never
decides whether a push is allowed; that is `can_send_push` in Postgres.

## Token lifecycle

`NativePushProvider` binds the token to the signed-in user:

| event | action |
|---|---|
| sign-in (user id appears) | `getToken()` → `POST /notifications/devices` |
| app resume | re-check permission, re-register the token |
| `tokenReceived` | register the rotated token immediately |
| sign-out | `DELETE /notifications/devices/:deviceId`, then `deleteToken()` |

`device_id` is stable per installation (`getDeviceId()`); the backend upserts on
`(user_id, device_id)` and releases the same token from any other row, so a
shared phone stops delivering to the previous account.

## Android setup (required)

The FCM token cannot be issued without Firebase configuration:

1. Place `android/app/google-services.json` (Firebase project `pbswsbfcmztmbcqnuqny`).
   Without it, `build.gradle` skips the Google Services plugin and every token
   request fails.
2. `MainActivity` creates the four channels on start: `exam` and `security`
   (high importance), `general` and `social` (default). The backend addresses
   these ids; a message naming a missing channel is dropped on Android 8+.
3. The small icon is `@drawable/ic_notification` (monochrome) and the tint is
   `@color/notification_color`; both are declared in the manifest.

## Permission flow

1. After the first successful sign-in — never during the splash — a short
   explanation is shown.
2. "Turn on" opens the Android permission dialog. "Not now" records the answer
   and never asks again automatically.
3. A denial leaves in-app notifications working; Settings > Notifications shows
   the device card so the user can enable it later.

The prompt is skipped when the user already answered or disabled notifications
in-app, so a restart does not re-ask.

## Delivery states

- **Foreground**: `notificationReceived` → in-app toast, inbox and badge refresh.
- **Background / cold start**: `notificationActionPerformed` → mark read,
  invalidate the inbox, `navigate(action_link)`. Duplicate taps for the same
  notification id are ignored.
- Every tap calls `POST /notifications/:id/click`, which writes the read row and
  the derived click counter.

`action_link` is validated by `resolvePushTarget`; a non-relative or unsafe link
opens the home route instead. Never navigate to a raw payload value.

## Inbox

`src/features/notifications/pages/Notifications.tsx`:

- bell with unread count in the header
- Today / Earlier sections, unread dot, skeleton, empty state
- pull-to-refresh, cursor pagination ("Load more"), realtime insert refresh
- Bangla first, English fallback (`title_bn`/`body_bn`, then `_en`)
- mark one, mark all, detail sheet that opens the validated route

## Settings

`Settings > Notifications` uses `notification_preferences`:
push on/off, exam, streak, social, rewards, premium, quiet-hours window. Security
is shown as always on and has no toggle. In-app rows cannot be disabled.

## Web

`public/firebase-messaging-sw.js` still renders data-only web pushes. Android is
the priority; the web path is unchanged by this work.

## Testing

- `npm run typecheck`
- `npm test` (includes `pushPermission.test.ts`, `pushRouting.test.ts`)
- On a device: sign in → accept the prompt → confirm a row in `user_devices`
  with a non-null `fcm_token`; then trigger a test notification from the admin
  panel and check foreground, background and cold-start taps.

## Known limitations

- Without `google-services.json` the app builds and runs, but push is silently
  unavailable; the Settings card reports the plugin as unavailable.
- Realtime refresh depends on the `notifications` table being in the project's
  realtime publication; pull-to-refresh still works without it.
