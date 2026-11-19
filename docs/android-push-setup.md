# Firebase setup for JM Android push notifications

Updated: 19 November 2026. Follow these steps for the current JM repository and Windows build setup.

JM already uses **Expo Push Notifications**. Android still needs Firebase Cloud Messaging (FCM) underneath Expo. The reported `Default FirebaseApp is not initialized` error means the installed APK was built without the Android Firebase client configuration. Adding the file requires a new APK; a JavaScript reload alone cannot fix that installed binary.

## 1. Keep these JM identifiers ready

| Setting | Exact value |
| --- | --- |
| Android package / application ID | `com.jivo.jm` |
| Suggested Firebase app nickname | `JIVO JM Android` |
| Expo owner | `rohitrathod12` |
| Expo project slug | `jivo-jm-universal` |
| EAS project ID | `317d0883-008d-4947-8877-03c463e00b65` |
| Local app repository | `C:\Users\JIVO\Desktop\JM\JIVO-JM-Universal` |
| JM API origin | `https://messenger.jivo.in` |

Use a Google account that can register apps and manage credentials in the chosen JIVO Firebase project, plus an Expo account with access to the project above. If your organization blocks service-account key creation, ask its administrator to complete the credential step.

## 2. Create or select the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Select the intended JIVO project. If there is none, choose **Create a project**, enter a name such as `JIVO JM`, and complete the wizard.
3. Record its **Project ID** from **Project settings > General**. It is a Firebase identifier, not the EAS UUID above.
4. Under **Project overview**, choose **Add app**, then the **Android** icon.
5. Enter Android package **`com.jivo.jm`**, nickname **`JIVO JM Android`**, and choose **Register app**. If this package is already registered, open that existing Android app instead.
6. Download **google-services.json**. For an existing app: **Project settings > General > Your apps > com.jivo.jm > google-services.json**.
7. Continue through the console wizard. JM already has the Expo notification library and plugin; its build generates the native Firebase wiring.

A Firebase project can contain several apps, but the downloaded file must include the **JM** Android client. A file containing only `com.jivo.oms` cannot configure JM. Follow the official [Firebase Android registration guide](https://firebase.google.com/docs/android/setup).

## 3. Put google-services.json in the exact app location

Save the downloaded file here, with exactly this filename:

```text
C:\Users\JIVO\Desktop\JM\JIVO-JM-Universal\google-services.json
```

It sits beside `app.json`, `app.config.js` and `package.json`:

```text
JIVO-JM-Universal/
  app.json
  app.config.js
  package.json
  google-services.json       <-- downloaded Android client configuration
  scripts/
    build-android.ps1
```

In PowerShell, if the download has its normal filename:

```powershell
Set-Location 'C:\Users\JIVO\Desktop\JM\JIVO-JM-Universal'
Copy-Item -LiteralPath "$env:USERPROFILE\Downloads\google-services.json" -Destination '.\google-services.json'
```

If the browser named it `google-services (1).json`, use that actual source filename and keep the destination `google-services.json`.

Check the package without printing API keys or the entire file:

```powershell
$firebaseConfig = Get-Content -LiteralPath '.\google-services.json' -Raw | ConvertFrom-Json
$firebaseConfig.client | ForEach-Object { $_.client_info.android_client_info.package_name }
```

The output must include `com.jivo.jm`. If it does not, download the JM client's file from Firebase. Do not manually replace an OMS package name inside its JSON.

The repository's `app.config.js` already reads this file, validates the JM client and sets `android.googleServicesFile`. You do **not** need to edit `app.json` or manually copy the file into generated `android/app/`. Expo prebuild handles that. The root file is already ignored by Git.

**Alternative location:** if you keep the file elsewhere, set its path in the same PowerShell window used for building:

```powershell
$env:GOOGLE_SERVICES_JSON = 'C:\JIVO-keys\jm-google-services.json'
```

Use the real path where you saved it. Prefer the repository-root location for the simplest local setup. The local PowerShell build script reads this process variable before Expo starts; do not rely only on a line in `.env` for the alternative path.

## 4. Get the separate FCM V1 service-account key

In the **same Firebase project**, open **Project settings > Service accounts**. Choose **Generate new private key**, then confirm **Generate key**. Save the downloaded JSON in a restricted folder outside every repository, for example:

```text
C:\JIVO-keys\jm-fcm-service-account.json
```

This file contains a private key. Do not put it in the app, Git, screenshots or chat. It is different from `google-services.json`.

## 5. Upload the private key directly to Expo

Open [JM's Expo credentials page](https://expo.dev/accounts/rohitrathod12/projects/jivo-jm-universal/credentials).

1. Select **Android**, then application identifier **`com.jivo.jm`**; add that identifier if necessary.
2. Under **Service credentials > FCM V1 service account key**, choose **Add a service account key**.
3. Select **Upload new key**, upload `C:\JIVO-keys\jm-fcm-service-account.json`, and choose **Save**.
4. Confirm the credential belongs to the Firebase project used in steps 2-3.

If using the CLI instead, run `npx.cmd eas-cli@latest credentials` from the app repository. Select **Android > production > Google Service Account > Manage your Google Service Account Key for Push Notifications (FCM V1) > Set up > Upload a new service account key**.

These steps follow [Expo's FCM V1 credential guide](https://docs.expo.dev/push-notifications/fcm-credentials/). Configure this even when building the APK locally: Expo's servers need the credential to send Android notifications.

## 6. Check the JM server settings

For this repository's standard Windows installation, edit this file **on the server**, not on the development phone:

```text
C:\JIVO-JM\config\.env
```

If deployment used a different root than `C:\JIVO-JM`, use `<deployment-root>\config\.env`.

Ensure these settings are present:

```dotenv
JM_EXPO_PUSH_ENABLED=True
JM_TASK_BACKEND=dramatiq
```

`JM_EXPO_ACCESS_TOKEN` is needed only if Expo's enhanced push security is enabled. In that case, put the authorized Expo access token in this server `.env`. Otherwise it can remain empty:

```dotenv
JM_EXPO_ACCESS_TOKEN=
```

Never put the Expo access token or Firebase service-account private key in `EXPO_PUBLIC_*` variables. JM's backend sends through Expo, so the Firebase private key belongs in Expo credentials, not the backend `.env`.

After changing server settings, run elevated PowerShell on the server:

```powershell
Restart-Service jm-web
Restart-Service jm-worker
Get-Service jm-web, jm-worker
```

Both services should be running. The existing worker/queue must be healthy for delivery. No database migration is required just for these credential settings.

For local backend development, the corresponding file is `C:\Users\JIVO\Desktop\JM\JIVO-JM-Backend\.env`; the production app above connects to the live server, so changing only the local backend does not configure production push.

## 7. Rebuild the Android release APK locally

On the development computer:

```powershell
Set-Location 'C:\Users\JIVO\Desktop\JM\JIVO-JM-Universal'
git pull --ff-only origin main
Test-Path -LiteralPath '.\google-services.json'
node --test scripts/push-config.test.cjs
npm.cmd run android:build -- -Architecture arm64-v8a -Release
```

The `Test-Path` result should be `True` for the default file location. If using `GOOGLE_SERVICES_JSON`, check that file instead. The automated test checks the configuration logic with synthetic fixtures; the build itself validates your real downloaded file.

The script uses the existing signing key `C:\JIVO-keys\jivo-jm-upload.jks` and its existing password configuration. Keep that signing identity so the APK can update the installed JM app. It regenerates Android configuration when the app config or Firebase file changes, then builds the APK. A missing Firebase file blocks release builds.

Expected output:

```text
C:\Users\JIVO\Desktop\JM\JIVO-JM-Universal\android\app\build\outputs\apk\release\app-release.apk
```

Install over the existing app without clearing data:

```powershell
adb devices -l
adb install -r '.\android\app\build\outputs\apk\release\app-release.apk'
adb shell am start -n com.jivo.jm/.MainActivity
```

If multiple devices appear, use `adb -s <serial>` for each command. If Android reports a signing-key mismatch, stop and use the correct existing signing key; uninstalling would remove local app data. A release APK runs without the USB-connected Expo development server.

## 8. Optional: configure cloud EAS builds

Skip this section if you only use the local build in step 7.

The ignored local Firebase file is not automatically included in cloud builds. Open [JM's Expo environment variables](https://expo.dev/accounts/rohitrathod12/projects/jivo-jm-universal/environment-variables), then **Add Variables**:

| Field | Value |
| --- | --- |
| Name | `GOOGLE_SERVICES_JSON` |
| Type | File / uploaded file |
| File | The Android client `google-services.json` from step 3 |
| Visibility | Secret |
| Environment | `production` |

Do not upload the private service-account key here. Both `production` and `preview` build profiles currently use the **production** environment because `preview` inherits it in `eas.json`. File variables become file paths on the build worker, matching `app.config.js`. See [Expo's environment-variable instructions](https://docs.expo.dev/eas/environment-variables/manage/).

Keep the local client file for local config resolution too. From the app repository, build an installable APK with:

```powershell
npx.cmd eas-cli@latest build --platform android --profile preview
```

The `production` profile creates a Play Store app bundle instead. This repository uses **local signing credentials** in `eas.json`; the existing ignored `credentials.json` and referenced signing files must be available on the build-submission computer. Firebase configuration does not replace Android signing credentials.

## 9. Enable and verify notifications on the phone

1. Open the newly installed JM app and sign in. On first eligible sign-in, choose **Enable notifications**, then allow the Android permission prompt.
2. If you previously chose **Not now**, open **Notifications > Settings > This device > Enable notifications**. The onboarding prompt is remembered per account/device and does not appear on every launch.
3. Confirm the status says **Enabled on this device through Expo**.
4. Keep **Send push notifications** enabled in the account's notification preferences. Check quiet hours and chat mute settings.
5. Tap **Test device notification**. This checks local OS permission and notification channels only.
6. Tap **Send test notification**. This exercises JM's remote push path. Put JM in the background and check the notification shade.
7. Send a new message to this user from another account while JM is in the background. Confirm the notification appears and tapping it opens the correct conversation.
8. Check that device notification permission and JM's message channels remain enabled in Android settings.

JM may suppress a message notification while that conversation is actively open. Do not force-stop the app for the background test. Use the installed JM app, not Expo Go, for Android remote push. See [Expo's device and push-testing guidance](https://docs.expo.dev/push-notifications/push-notifications-setup/).

## 10. Troubleshooting

| Symptom | Check / action |
| --- | --- |
| `Default FirebaseApp is not initialized` | Verify the JM client file, rebuild, and install the **new** APK. Refreshing the old APK's JavaScript is insufficient. |
| App says push is not configured in this version | This build lacks Android Firebase configuration. Complete steps 3 and 7. |
| Build rejects the package | Download the Firebase client for `com.jivo.jm`; do not edit an OMS JSON to imitate it. |
| No first-login prompt | Server push may be disabled, the account may already be subscribed, or the prompt was dismissed before. Check server settings and enable through Notifications settings. |
| Android permission denied | Open **Notifications > Settings > Open device notification settings**, allow notifications, return and enable again. |
| Local test works, remote test fails | Recheck Expo FCM V1 credentials, matching Firebase project, JM server flag, worker/queue and account push preferences. Local delivery does not prove remote setup. |
| Expo rejects delivery credentials | Confirm the FCM credential in the listed Expo project uses the same Firebase project as the APK. Ask the credential administrator to inspect access/API configuration and Expo delivery errors. |
| Old app still shows the original error | Confirm the installed APK was rebuilt after adding the file; do not reinstall an earlier downloaded artifact. |

## Completion checklist

- [ ] Firebase contains Android client `com.jivo.jm`.
- [ ] Correct `google-services.json` is saved at the local root or configured path.
- [ ] Matching FCM V1 service-account credential is saved in the JM Expo project.
- [ ] Live JM server has Expo push enabled and its worker is running.
- [ ] A new signed APK has been built and installed.
- [ ] Android notification permission and JM account preferences are enabled.
- [ ] Remote test and background-message delivery succeed on the phone.

This guide documents setup; it does not mean the external credentials have already been created or remote delivery has been verified. The app-side registration/configuration tests pass, but the real Firebase credential and physical-device remote-delivery checks remain required.
