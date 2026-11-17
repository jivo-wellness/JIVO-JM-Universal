# Store listing: JIVO JM

Texts and files for Google Play and the App Store. Character limits are checked; counts are in brackets.
App id on both stores: `com.jivo.jm` (in `app.json`).

## Files to upload

| Where | File | Size |
|---|---|---|
| App Store: App icon | `store/app-store-icon-1024.png` | 1024 × 1024, no transparency |
| Play: App icon | `store/play-icon-512.png` | 512 × 512 |
| Play: Feature graphic | `store/feature-graphic-1024x500.png` | 1024 × 500 |
| Play: Phone screenshots | `store/screenshots/android-phone/*.png` | 1080 × 2160 |
| App Store: iPhone 6.9" | `store/screenshots/ios-iphone-6.9/*.png` | 1320 × 2868 |

Upload screenshots in file-name order (01, 02, ...). They use made-up people and chats, never real JIVO data.
The same 8 screens in light mode are in the `*-light` folders, if you prefer those. Regenerate them all with
`node scripts/store/capture-store-screens.cjs` (mocked API, nothing reaches the real server).
`app.json` sets `supportsTablet: true`, so Apple also asks for iPad 13" screenshots (2064 × 2752); set it to
`false` before the first iOS build if JM should be iPhone-only.

## Both stores

**App name** [7 of 30]

```
JIVO JM
```

**Description** (Play "Full description" and App Store "Description")

```
JIVO JM is the messenger and password manager for JIVO staff. Sign in with your JIVO account to chat with colleagues and keep shared work passwords safe.

MESSENGER
• One-to-one and group chats with your JIVO colleagues
• Send photos, videos, documents, voice messages, locations and contacts
• Reply, react, forward, edit and delete messages
• Polls and events in group chats
• Read receipts, typing indicators and unread counts
• Messages you send without a connection wait on your phone and go out on their own when you are back online

PASSWORDS
• Personal and team vaults for work logins
• Share an entry with colleagues and take access back at any time
• Secrets stay hidden until you reveal them, and screenshots are blocked while they are shown
• Copied passwords are cleared from the clipboard after 30 seconds

ALSO IN JM
• Company announcements and alerts
• Approvals inbox
• Quick links to JIVO's work tools
• Dark and light mode

SECURITY
• Sign in with your JIVO account, with passkeys or an authenticator app for two-step verification
• Every session can be ended from your profile
• Messages and vault entries are encrypted on JIVO's servers

JIVO JM is for JIVO employees. You need an active JIVO account to sign in.
```

## Google Play only

**Short description** [73 of 80]

```
Team chat, groups and shared passwords for JIVO staff, in one secure app.
```

**Category:** Business. **Tags:** Business, Communication.

**Contact details:** email `info@jivo.in`, website `https://jivo.in`.

**Privacy policy:** `https://jivo.in/privacy-policy`

## App Store only

**Subtitle** [30 of 30]

```
Messenger & Passwords for JIVO
```

**Promotional text** [85 of 170]

```
Secure chat and team passwords for JIVO staff. Works offline, syncs when back online.
```

**Keywords** [99 of 100]

```
jivo,messenger,chat,team,groups,passwords,vault,work,office,employees,secure,company,internal,staff
```

**Category:** Business (secondary: Productivity).

**Support URL:** `https://jivo.in` · **Support email:** `info@jivo.in`

**Privacy policy URL:** `https://jivo.in/privacy-policy`

**Copyright:** `© 2026 JIVO`

## App review sign-in (App Store Connect → App Review Information)

Apple's reviewers need a working account. Enter it **only in App Store Connect's "Sign-in information"
fields** (and Play Console → App content → App access), never in this repository or in chat.

- Use a dedicated demo account, not a personal or administrator account: Messenger Users and Password
  Users groups only, with a few made-up chats and one demo vault.
- Two-step verification must not be required for that account (reviewers cannot use a passkey), so do not
  put it in an admin, Passwords-administrator, moderation or alerts group.
- Review notes: "JM is an internal app for JIVO employees. Use the demo account above; it has sample chats
  and a sample password vault."

## Signing key (Android)

JM's own key, created 17-Nov-2026 (decision U-030). It is never in this repository, `app.json`,
`gradle.properties` or git.

- **Where:** `C:\JIVO-keys\jivo-jm-upload.jks` (PKCS12, RSA 4096, valid to 2054, alias `jivo-jm`,
  `CN=JIVO JM, O=JIVO, C=IN`). The store/key password is only in `C:\JIVO-keys\jivo-jm-upload.password.txt`.
  Both files are readable by the JIVO user and Administrators only.
- **Fingerprint:** SHA-256 `68:B6:08:BA:5A:68:5F:7B:BD:51:F7:D0:54:34:B2:19:28:7A:52:0E:A6:FD:B6:B2:8A:30:F2:51:74:97:F5:62`
  (backend `JM_ANDROID_APP_FINGERPRINTS` / `assetlinks.json`); WebAuthn origin
  `android:apk-key-hash:aLYIulpoX3u9UffQVDSyGSh6Ug6m_bayijDyUXSX9WI` (backend `JM_WEBAUTHN_ANDROID_ORIGINS`).
- **Builds:** `scripts\build-android.ps1` signs debug and release APKs with it (`-KeystorePath`, `-KeyAlias`;
  password from the `.password.txt` next to the keystore or `JM_ANDROID_KEYSTORE_PASSWORD`). Without the
  keystore it warns and falls back to the public React Native template debug key, which production must not trust.
- **Back it up now:** copy the `.jks` and the password (separately) to a safe offline place, e.g. an encrypted
  USB drive in the office safe and the password in the company password vault. Losing the key, or its password,
  means app updates can no longer be signed: a new app listing (new package name, users reinstall), unless Play
  App Signing is enabled, in which case Google can reset the upload key.
- **Play Store:** enrol in Play App Signing at the first upload. This key then becomes the **upload key** and
  Google signs what users install with its own app-signing key. Copy that key's SHA-256 from Play Console →
  Test and release → App integrity → App signing, and add it (colon form, and as `android:apk-key-hash:`
  base64url without padding) to the backend settings next to this one; passkeys and app links on Play installs
  fail until then. Keep this key's fingerprint too while sideloaded test APKs are in use.
- **Rotate:** create a new keystore the same way (keytool `-genkeypair`, new random password, `icacls` limited),
  add its fingerprint to the backend **before** shipping builds signed with it, then build with
  `-KeystorePath <new.jks>`. A sideloaded APK signed with a different key cannot update the installed app
  (uninstall first; local data is lost). On Play, request an upload-key reset in Play Console (the app-signing
  key stays the same, so the backend values for it do not change). Remove the old fingerprint from the backend
  once no installed build uses it.

## Open questions

- **Privacy policy:** `https://jivo.in/privacy-policy` is JIVO's website policy. Both stores need the policy
  to cover what JM handles (account and employee code, messages, files, vault entries, device push token,
  optional location and contacts when the user shares them). Check it does, or publish a JM page.
- **Distribution:** JM only works with a JIVO account. Apple may prefer a Custom App (Apple Business Manager)
  and Google a private app (Managed Google Play) over a public listing. Decide before the first upload.
