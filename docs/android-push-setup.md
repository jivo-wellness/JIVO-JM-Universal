# Android notifications through Expo

JM uses expo-notifications to get an Expo push token and registers it with `/api/jm/push/expo/`. Android delivery still requires Firebase Cloud Messaging. The missing Firebase configuration caused the reported `Default FirebaseApp is not initialized` error.

## Required configuration

- Android package: `com.jivo.jm`
- Expo owner: `rohitrathod12`
- Expo project: `jivo-jm-universal`
- EAS project ID: `317d0883-008d-4947-8877-03c463e00b65`

Register this Android package in the appropriate JIVO Firebase project. Download its `google-services.json`, then save it at this repository root or set the build-process environment variable `GOOGLE_SERVICES_JSON` to its absolute path. The file must contain the JM client; an OMS client does not work. The dynamic Expo configuration validates it and sets `android.googleServicesFile`. Local release builds require it and regenerate native configuration when it changes. For EAS builds, use a GOOGLE_SERVICES_JSON file environment variable in the selected EAS environment; the local root file is ignored by Git.

Upload the same Firebase project's FCM V1 service-account credential directly to this Expo project's Android push credentials. Do not put the private key in chat, Git or the APK. This credential is separate from google-services.json.

On the JM server, enable `JM_EXPO_PUSH_ENABLED`. If enhanced Expo push security is enabled, configure `JM_EXPO_ACCESS_TOKEN` only on the server. Run the existing notification task worker. User push preferences and quiet hours still apply.

## App behaviour

After sign-in and app unlock, an account with server push support and no working device subscription sees an Enable notifications sheet once. Enable creates Android channels, requests OS permission and registers the Expo token. Not now dismisses it and remembers the choice for that account on this device. Notification settings remain available for later enabling. Registration errors remain visible and retryable. Account changes cancel registration before attaching a token to another account.

Missing Firebase build setup now produces a readable update message. This message is not a substitute for providing the configuration and rebuilding.

## Verify after configuration

1. Run `npm.cmd run android:build -- -Architecture arm64-v8a -Release` and install the resulting APK on a physical Android phone.
2. Sign in, choose Enable notifications and allow the OS prompt.
3. In Notifications > Settings, run Test device notification (local permission/channel check), then Send test notification (server-to-Expo delivery check). A local test alone does not prove remote push works.
4. Put JM in the background and send a message from another account. Confirm delivery and tapping the notification opens the intended conversation.
5. Check denial, Not now, enabling later in settings, logout/account changes and quiet-hours behaviour.

Reference: https://docs.expo.dev/push-notifications/fcm-credentials/

## Current verification

824 app unit tests passed; seven new native registration tests cover token registration, permission denial, background sync, cancellation at account boundaries and readable Firebase errors. Configuration test rejects another package, requires the file for Android EAS builds and preserves existing Expo settings. Real Android delivery and the native permission sheet still need the correct Firebase file/Expo credential and a physical-device check. No new APK was produced for these changes.
