# Incoming sharing ("share into JM")

Decision: U-036 in `decision.md`. Another app's share sheet lists JM; choosing it opens a WhatsApp-style "Send to…" page, then (for files) the attachment preview, then the outbox. Nothing is sent before the person presses Send.

## Flow (all platforms)

1. Intake: the share is copied into JM's own storage (native) or stashed by the service worker (PWA), with no account yet.
2. `IncomingShareBridge` (inside AppLock, so a locked app is unlocked first) opens `/share` once someone is signed in. Signed out: `/share` sends the person to sign in (`/login?next=/share`); the share waits (one hour, `SHARE_TTL`) and opens afterwards. A share already bound to another account is deleted, never shown.
3. "Send to…" (`components/ShareFlow.tsx`): search, "Recent chats" (server list; locked, left and archived chats are not offered), "People on JM" (directory; people who already have a listed direct chat are not repeated; "Message yourself"). Pick one or up to five. Chats where the server's `can` flags do not allow sending (or sending files, for a file share) are shown dimmed with the reason.
4. Files: Next opens the existing attachment preview (`AttachmentPreview`: caption prefilled with the shared text, thumbnails, remove, add more, image editor). Text and links: the message is edited on the "Send to…" page and sent from there.
5. Send: `modules/sharing/send.ts` queues one message per chat through the outbox (`enqueueFiles` / `outbox.enqueue`), each with its own client id and its own copy of the files; a person's direct chat is opened (`POST /conversations/direct/`) only at this point. A chat that fails does not stop the others; the page says who got it and why the rest did not, and Retry sends only the rest (same client ids). When all are queued the share is deleted and JM opens the chat (one) or the chat list (several).

Limits: the composer's (`media/selection.ts`): up to 10 files, photos 10 MB, videos 500 MB; text 4000 characters. Types: photos, videos, audio, text and common documents (PDF, Word, Excel, PowerPoint, OpenDocument, RTF, CSV, ZIP, vCard...); apps/programs (APK, EXE, ...) and unknown binary types are refused by name (`shareTypeProblem`). Files left out are listed on the page; a share with nothing usable shows only the reason.

## Android

expo-sharing 58 (first-party Expo, already a dependency) with its config plugin: `app.json` adds `ACTION_SEND` / `ACTION_SEND_MULTIPLE` intent filters for `text/*`, `image/*`, `video/*`, `audio/*`, `application/*` to the main activity (`com.jivo.jm`). Cold start: the plugin's activity listener rewrites the intent to `jivo-jm://expo-sharing`, which `+native-intent.ts` maps to `/share`. App already open: the new intent arrives as the same link (`onNewIntent`), which expo-router also maps to `/share`, and the bridge takes it in on the link event.

Intake (`storage.native.ts`) reads the raw payloads only (`getSharedPayloads`, no network; links stay text and are never fetched), then copies each content:// file with expo-file-system into `cache/jm-share/share-<uuid>/<n>/<display name>` while the provider's read grant is valid (files over 500 MB and past the tenth are not copied), writes `cache/jm-share/pending.json` and clears the intent. A newer share replaces the older one and its files. The copies are deleted after Send (the outbox keeps its own copies), on Cancel, when another account would see it, and at sign-out (`incomingShareBoundary`, Session.tsx). If the system clears the cache meanwhile, the page says to share again.

## iOS

The expo-sharing plugin's share extension is enabled (`expo-sharing-extension` target, bundle id `com.jivo.jm.ShareExtension`, App Group `group.com.jivo.jm`, activation: text, 1 web URL, up to 10 images/movies/files; iOS 16.4+ for the extension). The JS side is the same as Android. Before an iOS build: register the App Group `group.com.jivo.jm` in the Apple developer account and add it to both App IDs (`com.jivo.jm` and `com.jivo.jm.ShareExtension`) and their provisioning profiles (EAS Build does this automatically). Not built or tested yet (no macOS/EAS iOS build in this project).

## PWA (installed web app)

`public/manifest.webmanifest` `share_target`: `POST /share-target`, `multipart/form-data`, `title`/`text`/`url`, and `files` accepting `image/*`, `video/*`, `audio/*`, `text/*`, PDF and the common office types. The service worker (`pwa/incoming-share.ts` plus the pure rules of `src/modules/sharing/shareTarget.ts`, inlined into `share-worker.js` by `scripts/build-web.cts`) reads the body (at most 100 MB), keeps text, link and the first 10 files, asks `/api/jm/me/` for the owner (null when signed out or offline), stores the record in IndexedDB `jm-incoming-share-v1` (never Cache Storage) and redirects 303 to `/share` (or `/share?shareError=limit|empty|retry`). A newer share replaces an older one; a sign-out during the POST (boundary counter) drops it; sign-out clears the stash. The app (`storage.web.ts`) applies the types and limits when it reads the stash. If the POST reaches the server (worker not installed yet), the preview server and the nginx example answer 303 to `/share?shareError=retry`; `/share` is an SPA route in the worker, preview server and nginx example.

## Tests

- `src/modules/sharing/sharing.test.ts`: normalisation (single/multiple, text vs files, link dedupe, type allow/deny list with messages, limits), recipients (permissions, max five, no duplicate people), sending (one message per chat, per-chat ids, partial failure and retry of the rest), sign-in deferral and account binding.
- `src/modules/sharing/shareTarget.test.ts`: the worker's intake rules (text/link, files, 10-file cap, byte and text limits, redirects, sign-out race, expiry, no imports).
- `src/modules/sharing/storage.native.test.ts`: content:// copy before sign-in, intent cleared, same intent not taken twice, replacement, refused types, 500 MB / 10-file limits, revoked provider, clean-up after send/cancel/sign-out, cache cleared.
- `npm run test:pwa`: real worker intake into IndexedDB, replacement, 10-file cap, sign-out clear, limit/empty redirects, manifest share_target, server 303 fallback, `/share` route.
- `scripts/share-ui.cjs` (mocked web harness, `npm run test:web`): Send to… (locked hidden, no-files chat dimmed), two chats, preview with caption, one upload and message per chat, other-account and expired stashes.

Device checks still needed: see U-036.
