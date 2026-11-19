# JIVO JM - Android release and Play Store upload

Updated 19 November 2026. Package: `com.jivo.jm`. Release candidate: **1.0.1 (version code 2)**.

## Build status

Release configuration and listing assets are prepared. The owner chose **local builds**, so source and signing credentials are not uploaded to Expo Build. Expo project `317d0883-008d-4947-8877-03c463e00b65` is linked for app identity; that does not configure Firebase push credentials. Build results are recorded below once verified.

The owner confirmed this is the first Play upload. Version code 2 is valid for a first release. Increase it for every later Play upload. Keep the package name unchanged.

## Local build (selected workflow)

Android Studio's SDK/NDK and Java must be installed. Use the original JM keystore already on this PC; it never leaves the machine in this workflow.

```powershell
cd C:\Users\JIVO\Desktop\JM\JIVO-JM-Universal
$env:EXPO_PUBLIC_API_ORIGIN = 'https://messenger.jivo.in'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-android.ps1 -Release -Bundle -Architecture arm64-v8a
```

This builds both `android/app/build/outputs/apk/release/app-release.apk` and `android/app/build/outputs/bundle/release/app-release.aab`. Release mode refuses to fall back to the public debug key. This build targets **ARM64 Android devices**, not x86 emulators or 32-bit phones. The AAB lets Play generate device-specific install packages within that supported architecture. It contains bundled JavaScript and does not require Metro.

The EAS steps below remain an optional future alternative, requiring explicit authorization to upload source and signing credentials. They are not required for the selected local build.

## 1. Sign in and link the JM project

Run in PowerShell:

```powershell
cd C:\Users\JIVO\Desktop\JM\JIVO-JM-Universal
npm.cmd ci
npx.cmd --yes eas-cli@latest login
npx.cmd --yes eas-cli@latest whoami
npx.cmd --yes eas-cli@latest init
```

Choose the company's JM project (create one only if JM has none). Do not link OMS. `init` writes the real `extra.eas.projectId` to app configuration. Commit that public project identity; never commit an Expo token or password.

## 2. Keep the existing Android signing identity

The release profiles use local signing credentials, deliberately avoiding automatic creation of a different upload key.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\prepare-eas-signing.ps1
```

This reads the existing `C:\JIVO-keys\jivo-jm-upload.jks`, alias `jivo-jm`, and the adjacent protected password file (or `JM_ANDROID_KEYSTORE_PASSWORD`). It writes access-restricted, git-ignored `credentials.json`. If that file already exists, inspect its identity privately rather than overwriting it. The script never prints passwords. EAS receives signing credentials to sign cloud builds. Keep an encrypted backup of the original key and password separately.

Known existing upload certificate SHA-256:

```text
68:B6:08:BA:5A:68:5F:7B:BD:51:F7:D0:54:34:B2:19:28:7A:52:0E:A6:FD:B6:B2:8A:30:F2:51:74:97:F5:62
```

Compare with Play Console's upload certificate for an existing listing before building. Never substitute a debug key. See [Expo local credentials](https://docs.expo.dev/app-signing/local-credentials/).

## 3. Configure background notifications before a production build

1. Register Android package `com.jivo.jm` in the company's Firebase project.
2. Download its matching `google-services.json`; the OMS file for `com.jivo.oms` cannot be used.
3. Set `expo.android.googleServicesFile` in `app.json` to the matching file. For cloud builds, an EAS file environment variable can supply it; make sure the configured path resolves on the build worker. Do not assume a git-ignored local file is uploaded.
4. Use `npx.cmd --yes eas-cli@latest credentials --platform android` to configure matching FCM v1 push credentials for JM. Do not replace the upload signing key.
5. Keep the service-account private key out of source control and out of `EXPO_PUBLIC_*` variables.
6. Verify push registration against `https://messenger.jivo.in` and delivery while the installed app is backgrounded.

Background push is not verified in this release preparation. Do not advertise it as working until tested. The EAS project UUID is separate from the website domain. `.env.example` contains the setup outline.

## 4. Build APK and AAB

```powershell
npm.cmd run typecheck
npm.cmd run lint
npx.cmd --yes eas-cli@latest build --platform android --profile preview
npx.cmd --yes eas-cli@latest build --platform android --profile production
```

- `preview`: signed standalone **APK**, for installing directly on Android. No Metro or Expo Go needed.
- `production`: signed **AAB**, for Google Play. An AAB is not directly installable by tapping it.
- Both profiles compile `https://messenger.jivo.in` as the API origin and use the same release version/signing identity.
- Build configuration lives in [eas.json](../eas.json). See [Expo build profiles](https://docs.expo.dev/build/eas-json/).

After successful builds, download the artifacts from the build URLs printed by EAS into ignored `release-artifacts/`. Name them `jivo-jm-1.0.1-2.apk` and `jivo-jm-1.0.1-2.aab`. Record each build ID, Git commit and SHA-256:

```powershell
Get-FileHash release-artifacts\*.apk,release-artifacts\*.aab -Algorithm SHA256
```

Verify package, version, signing certificate and final permissions from the built artifacts. Check current Play target-API and native page-size compatibility requirements using Play's bundle validation; source configuration alone is not proof of acceptance.

## 5. Listing text to copy

**App name:** JIVO JM

**Short description:**

```text
Team messaging and shared work passwords for JIVO employees.
```

**Full description:**

```text
JIVO JM brings workplace messaging and password vaults together for JIVO employees. Use your company account to stay in touch with colleagues and access the work information available to your role.

TEAM MESSAGING
Chat with colleagues individually or in groups. Share photos, documents and voice messages. Reply to messages, react to updates and keep conversations organized. Queued messages can be sent when connectivity returns and the app is running.

WORK PASSWORDS
Access personal and shared work vaults according to your permissions. Organize entries, reveal or copy details when authorized, and manage shared access through your organization's controls.

YOUR WORKSPACE
Read company alerts, open links to JIVO software tools and manage your profile and device sessions. Choose light or dark mode for your device.

ACCOUNT AND ACCESS
An active JIVO company account is required. Features depend on permissions assigned by your organization. Device authentication and account verification help protect access. Internet access is required for sign-in and synchronization.

JIVO JM is intended for authorized JIVO employees. Contact your company's support team if you need an account or access to a feature.
```

**Category suggestion:** Business. **App type:** App. **Pricing suggestion:** Free (confirm company policy). Choose only relevant tags offered by Play Console.

**Search terms for natural use in descriptions:** JIVO, JM, team messaging, employee chat, workplace messenger, shared passwords, password vault, company tools. Google Play has no separate Apple-style keywords field; do not paste keyword spam into the description.

**Release notes:**

```text
Improved chat sending and keyboard behavior, online-status refresh, and native navigation. Includes team messaging, work password vaults, company tools, and profile controls for JIVO employees.
```

Play listing limits: name 30 characters, short description 80, full description 4,000. Source: [Google Play listing setup](https://support.google.com/googleplay/android-developer/answer/9859152).

## 6. Images and assets

| Upload field | File | Dimensions |
| --- | --- | --- |
| App icon | `store/play-icon-512.png` | 512 x 512 |
| Feature graphic | `store/feature-graphic-1024x500.png` | 1024 x 500 |
| Phone screenshots | `store/screenshots/android-phone/01-chat-list.png` through `08-sign-in.png` | 1080 x 2160 |

The screenshots contain synthetic people, messages and vault entries. They are generated from the Universal web renderer, **not captures of the final Android binary**. Compare them against the release APK and replace any different screens with sanitized Android captures before publishing. The contact sheet is a review aid, not a store screenshot. Do not upload employee chats or actual passwords.

Suggested order and alt text:

1. Chats - Find and open conversations with colleagues.
2. Direct chat - Messages and photos in a colleague conversation.
3. Group chat - Coordinate with a work group.
4. Passwords - Browse work vault entries.
5. Password entry - View authorized login details with secrets concealed.
6. Profile - Manage your profile details.
7. Tools - Open company software links.
8. Sign in - Access JM with a company account.

Asset requirements: [Google Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151). The 1024px Apple icon and iPhone screenshots are not needed for this Android upload. Tablet-specific artwork and a promotional video are not included.

## 7. Information the company must confirm

- Developer/publisher legal identity and Play Console verification.
- Monitored support email: existing listing draft uses `info@jivo.in`; confirm it is the right JM support address.
- Website: `https://messenger.jivo.in`.
- Public privacy policy: previous draft uses `https://jivo.in/privacy-policy`; verify it actually covers JM, employee data, messages, attachments, vault data, device tokens, retention, administrators' access and contact/deletion requests. Do not submit an unrelated website policy.
- Account/data deletion process and public request URL, as applicable to this company-provisioned app. Signing out and administrator deactivation are not evidence that all user data is deleted.
- Public versus managed/private employee distribution. Decide with the company before publishing.
- Intended audience and content rating: answer Play's questionnaires accurately; do not invent a rating.

## 8. Play Console forms and upload

1. Open the existing `com.jivo.jm` app, or create the company app if it does not exist. Never create a second listing just to work around signing/version errors.
2. Fill the store listing with the text and images above.
3. Complete App access: provide a dedicated reviewer account with synthetic data and clear verification instructions in Play Console only. Do not publish credentials or weaken normal authentication policy. Ensure reviewers can complete every required verification step.
4. Complete Privacy policy, Data safety, Ads, Target audience and Content rating. Review actual backend processing and SDKs. Do not declare "no data collected" for an authenticated messaging service.
5. Review account identifiers/email/employee code, user messages, photos/video/audio/files, optional shared contacts/location, device/push identifiers and any diagnostics. Identify which are collected, shared, optional, retained and encrypted in transit. Do not claim end-to-end encryption without verified implementation.
6. Review the final merged permissions. Camera/microphone are for user-initiated capture. Contacts/location are for explicit sharing. The recent-photo camera strip can use media-library access: evaluate Play's photo/video permission policy and use the system picker if broad access is not justified. Complete any required declaration honestly.
7. Enroll in Play App Signing, upload the **AAB** to Internal testing, add release notes and fix all bundle validation errors.
8. Add testers and distribute the opt-in link. Install from Play and run the checks below. A directly installed APK does not verify Play signing behavior.
9. Follow the testing/production-access requirements shown for your developer account, then promote the tested release when approved by the company.

## 9. Passkeys on Play-installed builds

Google may sign installed apps with a different certificate from the upload key. Copy the **app signing certificate SHA-256** from Play Console > App integrity. Add it to the backend Android association configuration and serve it at `https://messenger.jivo.in/.well-known/assetlinks.json`, along with the correct Android WebAuthn origin. Keep the sideload certificate while those APKs remain supported. See [ANDROID-PASSKEY-ASSOCIATION.md](../docs/ANDROID-PASSKEY-ASSOCIATION.md). Never change the RP ID away from `messenger.jivo.in`.

## 10. Release acceptance checks

- Install the standalone APK with Metro stopped; verify app icon, startup, sign-in and sign-out.
- Verify update installation over the previous signed build without losing local state.
- Send/receive text and media between two accounts; confirm receipts and privacy-aware presence.
- Queue a message offline, reconnect, and confirm exactly one delivered message.
- Confirm keyboard stays open when sending and Android Back navigates correctly.
- Exercise camera/microphone permission denial, image preview and voice playback.
- Verify vault verification expiry and access restrictions with a non-administrator account.
- Test background push after Firebase/EAS configuration and passkeys after Play certificate registration.
- Inspect Play's pre-launch report and supported Android devices before production promotion.

Atlas is still awaiting its external mapping rollout. Do not advertise working Atlas responses, cross-platform history or Atlas attachments in this release until end-to-end tests pass. This release preparation does not resolve that external service dependency.
