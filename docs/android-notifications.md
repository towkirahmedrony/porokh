# Android push notifications (FCM)

Push runs on Firebase Cloud Messaging end to end. The Android shell uses
`@capacitor-firebase/messaging` to obtain an FCM token, the backend sends through
the Firebase Admin SDK, and both sides share the existing notification tables,
templates, preferences and targeting. There is no third-party push provider.

## Architecture

| Piece | Android (Capacitor shell) |
| --- | --- |
| Token source | `@capacitor-firebase/messaging` → FCM registration token |
| Registration | `POST /api/v1/notifications/device-token` with `fcm_token` + `platform: 'android'` |
| Backend transport | Firebase Admin SDK, HTTP v1, batches of 500 tokens |
| Payload | `notification` + `data` (system tray renders it, even when the app is terminated) |
| Tap handling | `notificationActionPerformed` → React Router |
| Permission | Android 13+ `POST_NOTIFICATIONS` runtime permission |

The backend loads tokens from `user_devices` for the resolved accounts only, so
recipient choice never comes from the client. Payloads are built per platform and
per language, because Android needs a system notification block and the text
follows `profiles.language_preference`.

Web Push is **not** implemented in this app: browsers are served in-app
notifications only. A `web` platform row can only exist if a future web client
registers a token.

Tap routing is allowlisted in `src/features/notifications/native/pushRouting.ts`:
only known in-app paths are opened, everything else lands on `/notifications`.
The message id is de-duplicated so a cold-start replay cannot navigate twice.

## Token lifecycle

| Event | Behaviour |
| --- | --- |
| First launch | One non-blocking permission prompt; the "asked" marker is written first so the dialog cannot repeat. |
| Permission granted | Token read, posted to the backend, `registered` becomes true. |
| Token rotated | `tokenReceived` listener re-registers immediately; the old address is released by the unique `fcm_token` index. |
| Backend moved the token | A retry is scheduled once (2s) if the token is not ready when the dialog closes. |
| Network failure | Registration is retried on the next resume instead of looping. |
| Account switch | The new user's token is registered; the unique index moves the token off the previous account's row. |
| Sign-out | `DELETE /notifications/device-token` before the session is cleared, then `deleteToken()`. |
| In-app disable | Device deactivated + token deleted; the disabled flag survives a restart. |
| Invalid token | FCM `registration-token-not-registered` / `invalid-argument` → backend clears `fcm_token`. |

## Android configuration

- `android/app/src/main/AndroidManifest.xml`
  - `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`
  - `com.google.firebase.messaging.default_notification_channel_id` →
    `@string/default_notification_channel_id` (`porokh_default`)
  - `com.google.firebase.messaging.default_notification_icon` →
    `@drawable/ic_notification` (monochrome)
- `MainActivity` creates both channels before the first message arrives:
  `porokh_default` (normal) and `porokh_urgent` (high priority). Android 8+ drops
  a notification that names a channel which does not exist.
- `NotificationSettingsPlugin` opens `ACTION_APP_NOTIFICATION_SETTINGS`, because a
  denied Android 13 permission can only be re-enabled from system settings.
- `android/app/build.gradle` applies `com.google.gms.google-services` only when
  `google-services.json` exists.

## Firebase console setup

1. Open the Firebase project that owns the Android app.
2. **Project settings → Your apps → Add app → Android**
   - package name: `net.porokh.app` (do **not** change the application id)
3. Download `google-services.json`; it must contain a client whose
   `package_name` is `net.porokh.app`.
4. **Project settings → Service accounts → Generate new private key** and use the
   values for `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and
   `FIREBASE_PRIVATE_KEY` on the backend (Render). Never ship them to the app.

### Where `google-services.json` lives

- Local build: `android/app/google-services.json` (git-ignored).
- CI: the `GOOGLE_SERVICES_JSON` repository secret; the Android workflow writes
  it before Gradle and fails when it is missing or targets another package.

## Payload contract

Backend → client `data` (all values strings):

| Key | Meaning |
| --- | --- |
| `type` | `exam`, `reward`, `streak`, `social`, `billing` or `security`. |
| `notification_id` | `notifications.id`; used for read/click acknowledgement and tap dedupe. |
| `action_link` | In-app path, validated server-side and again on the device. |
| `title_bn` / `title_en` / `body_bn` / `body_en` | Both languages, so the client can re-render after a language switch. |
| `image_url` | Optional banner. |

Android also receives `notification.title` / `notification.body` for the system
tray, on channel `porokh_default` or `porokh_urgent` with priority `high`.

## Database

`supabase/migrations/20261106120000_fcm_push_migration.sql`

- `notifications.onesignal_message_id` → `fcm_message_id` (guarded rename; history
  preserved).
- unique index on `(user_id, device_id)` for `user_devices`.
- index on `user_devices (user_id) where fcm_token is not null` for token fan-out.
- RLS stays enabled: a signed-in user can only touch their own device rows, and
  push reads use the service role.

The backend releases a token from other rows before re-registering it, so an
account switch on a shared phone cannot leave the old account receiving this
device's pushes.

## Observable behaviour

| App state | What happens |
| --- | --- |
| Foreground | `notificationReceived` → in-app toast; no duplicate tray entry. |
| Background / terminated | Android shows the tray notification from the `notification` block; tap launches or resumes the app and navigates once. |
| Permission denied | No prompt loop; the Settings card explains the state and offers the system settings shortcut. |
| Sign-out / account switch | Token deactivated through `DELETE /notifications/device-token`; a new sign-in re-registers. |

## Build and verification

A new APK is required: the plugin, the Firebase Messaging service, the permission
and the channels are native code and cannot be delivered by a Capgo OTA bundle.
JS-only changes (routing, copy, settings UI) can still ship over OTA.

```bash
cd porokh
npm run native:sync     # regenerates android/ plugin wiring from package.json
npm run typecheck
npm test
npm run build
```

Manual verification on a physical device:

1. Install the new APK with `google-services.json` baked in.
2. Sign in; open **Settings → Device notifications** and enable.
3. Deny first: the card must show the denial and the system-settings shortcut,
   with no second dialog.
4. Send a notification from the admin panel.
5. Foreground: toast only. Background/terminated: tray entry; tap opens the
   target route exactly once.
6. Check `user_devices`: one row for the installation, `platform = 'android'`,
   `fcm_token` set.
7. Sign out: `fcm_token` becomes `NULL`. Sign in as another account: the token
   moves to that account's row.
8. Admin history shows `sent` with a device count; a send with no registered
   tokens shows `failed` with `no_registered_devices`.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| No token, `push_error = fcm_not_configured` | Backend Firebase env vars missing or malformed. |
| Token issued, nothing arrives | `google-services.json` package name mismatch, or the token belongs to another Firebase project. |
| Notification in foreground only | Missing `notification` block (Android needs it for tray display). |
| Notification never displayed | Channel id in the payload does not exist on the device. |
| `total_sent = 0` | No tokens for the resolved audience, or every token was invalid. |
| Duplicate tray entries | Both `notification` and `webpush` blocks sent to the same Android token. |
