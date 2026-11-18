# Android passkeys for messenger.jivo.in

Checked 2026-11-18: https://messenger.jivo.in/.well-known/assetlinks.json returns HTTP 404. Android cannot validate the app until this public association exists. This cannot be fixed by substituting local fingerprint authentication for server verification.

The installed com.jivo.jm APK was inspected with apksigner. Its public signing certificate is CN=JIVO JM, O=JIVO, C=IN. Configure the **deployed backend environment**, then restart that service:

```dotenv
JM_ANDROID_APP_PACKAGE=com.jivo.jm
JM_ANDROID_APP_FINGERPRINTS=68:B6:08:BA:5A:68:5F:7B:BD:51:F7:D0:54:34:B2:19:28:7A:52:0E:A6:FD:B6:B2:8A:30:F2:51:74:97:F5:62
JM_WEBAUTHN_ANDROID_ORIGINS=android:apk-key-hash:aLYIulpoX3u9UffQVDSyGSh6Ug6m_bayijDyUXSX9WI
```

The backend already exposes the well-known endpoint when fingerprints are configured. Verify it returns HTTP 200 JSON with package_name com.jivo.jm, the fingerprint above, and delegate_permission/common.get_login_creds. Preserve other trusted fingerprints/origins when adding this one. Use the actual Play App Signing certificate instead if distributing through Google Play; upload certificates are not the installed certificate.

Then retry registering/signing in with a passkey on the physical phone. Existing web credentials still use messenger.jivo.in as RP ID. Password fallback remains available only when the server allows it. No server authorization checks were weakened. Production configuration has not been changed by this UI update.
