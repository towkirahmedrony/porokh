# Native Android notifications (FCM)

Porokh runs Web Push in the browser and FCM push in the Android shell. Both use
the same notification tables, templates, preferences and targeting; only the
transport differs. Adding native push did **not** create a second notification
system.

## Architecture

| Piece | Web (browser/PWA) | Android (Capacitor shell) |
| --- | --- | --- |
| Token source | Firebase JS SDK + `public/firebase-messaging-sw.js` | `@capacitor/push-notifications` (FCM Android SDK) |
| Registration | `POST /api/v1/notifications/device-token`, `platform: 'web'` | Same endpoint, `platform: 'android'` |
| Backend payload | data-only (service worker displays it) | `notification` + `data`, high priority (system tray displays it) |
| Tap handling | `firebase-messaging-sw.js` `notificationclick` | `pushNotificationActionPerformed` → React Router |
| Permission | Browser `Notification.requestPermission()` | Android 13+ `POST_NOTIFICATIONS` runtime permission |

The backend groups registered tokens by `user_devices.platform` before sending,
because one multicast message can only carry one payload shape. Web delivery is
byte-for-byte the existing data-only contract.

Tap routing is allowlisted in `src/features/notifications/native/pushRouting.ts`:
only known in-app paths are opened, everything else lands on `/notifications`.
The message id is de-duplicated so a cold-start replay cannot navigate twice.

## Firebase Console requirements

1. Open the existing Firebase project (`parapothexam`, sender id `597075104838`).
2. **Project settings → Your apps → Add app → Android**
   - package name: `net.porokh.app` (do **not** change the application id)
   - nickname: `Porokh Android`
   - SHA-1/SHA-256: optional for FCM; add the release signing certificate if you
     also use Firebase features that require it.
3. Download `google-services.json` (it must contain a client entry whose
   `package_name` is `net.porokh.app`).
4. No server key is needed in the console: the backend already authenticates with
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
   Service-account credentials never reach the app.

### Where `google-services.json` lives

- Local build: place it at `android/app/google-services.json` (git-ignored).
- CI: stored as the `GOOGLE_SERVICES_JSON` repository secret; the Android
  workflow writes it before Gradle and fails if it is missing or targets another
  package name.

Without the file the Gradle plugin is not applied, `PushNotifications.register()`
fails with `registrationError`, and no token is ever registered.

## Android configuration that shipped

- `android/app/src/main/AndroidManifest.xml`
  - `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`
  - `com.google.firebase.messaging.default_notification_channel_id` →
    `@string/default_notification_channel_id` (`porokh_default`)
  - `com.google.firebase.messaging.default_notification_icon` →
    `@drawable/ic_notification` (monochrome)
- `MainActivity` creates the channel before the first message arrives, using
  localized strings (`values/`, `values-bn/`).
- `NotificationSettingsPlugin` (custom, ~35 lines) opens
  `ACTION_APP_NOTIFICATION_SETTINGS`, because a denied Android 13 permission can
  only be re-enabled from system settings.
- `android/app/build.gradle` still applies `com.google.gms.google-services`
  only when the JSON file exists; CI now guarantees it exists.

## APK and OTA compatibility

| Installed APK | Native push | Web Push | OTA bundles |
| --- | --- | --- | --- |
| 1.0.0 / 1.0.1 / 1.0.2 | not available | unchanged | still accepted |
| 1.0.3+ (this change) | available | unchanged | accepted |

- **A new APK is mandatory** for native push. The plugin, the Firebase Messaging
  service, `POST_NOTIFICATIONS` and the settings intent are native code; they
  cannot be delivered by a Capgo OTA bundle.
- `minNativeVersion` in `ota.config.json` stays `1.0.1` on purpose: older APKs
  keep receiving JS updates instead of being cut off.
- Every JS entry point is guarded by
  `Capacitor.isPluginAvailable('PushNotifications')`, so an OTA bundle running on
  a 1.0.2 APK simply does not register native push and keeps Web Push.
- Notification **content, routing, copy, preferences and settings UI** are JS and
  can be changed through OTA. Anything that needs a new plugin, permission,
  manifest entry, channel or Firebase config needs a new APK.

## Database migration

`supabase/migrations/20261104080000_native_push_devices.sql`

- `user_devices.platform` (`web` | `android`, default `web`)
- unique index on `fcm_token` (one active installation per token)
- index on `platform`
- RLS stays enabled; direct client access is limited to the caller's own rows,
  writes and delivery use the service role.

The backend also releases a token from previous rows before re-registering it,
so an account switch on a shared phone cannot leave the old account receiving
this device's pushes.

## Observable behaviour

| App state | What happens |
| --- | --- |
| Foreground | `pushNotificationReceived` → in-app toast; tap navigates. No duplicate tray entry (no `presentationOptions` configured). |
| Background / terminated | Android shows the tray notification from the `notification` block; tap launches/resumes the app and navigates once. |
| Permission denied | No prompt loop; Settings card explains the state and offers the system settings shortcut. |
| Sign-out / account switch | Token deactivated through `DELETE /notifications/device-token` before the session is cleared; a new sign-in re-registers. |
| Token refresh | `registration` listener re-posts the token to the same endpoint (upsert on user + device id). |
| Invalid/expired token | FCM `registration-token-not-registered` / `invalid-argument` responses delete the stale row. |

## Manual verification (physical Android device)

1. Fresh install of the 1.0.3 APK.
2. Sign in, open **Settings → Device notifications**; no prompt before that.
3. Toggle on: Android 13+ permission dialog appears once; status becomes On.
4. Deny: status Off, guidance + "Open system settings" appears; no repeated prompt.
5. Send a test notification from Admin or the exam/streak cron.
6. Foreground: in-app toast; no duplicate from the tray.
7. Background: tray notification with title/body/icon; tap opens the target route.
8. Terminated: same tray notification; tap cold-starts into the target route once.
9. Check `user_devices`: one row for the installation, `platform = 'android'`, the
   same `device_id` used by `x-device-id`.
10. Sign out: `fcm_token` becomes `NULL` for that row; sign back in: token returns.
11. Sign in as another account on the same phone: only the new account's options
    deliver to this device.
12. Web Push in a desktop browser still prompts and delivers exactly as before.
13. Publish/activate an OTA bundle: it must boot and push must keep working.
