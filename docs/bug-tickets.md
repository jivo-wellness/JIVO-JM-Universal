# Bug tickets in the JM app

Open **Home → Bug tickets** (also in the desktop rail and Profile account menu). Everyone with `JM_ACCESS` can report an issue with a title, description, priority, affected screen and up to six attachments of 10 MiB each. Images, MP4/WebM recordings, PDF, TXT, LOG and CSV are supported. The document picker uses the existing native temporary-file ownership and cleanup flow.

The list supports status, search, pagination, refresh and a resolver's “mine” filter. A ticket shows its reporter, assignee, description, resolution and activity. Users can reply and attach more evidence; reporters can withdraw an active ticket with a reason or reopen a completed ticket. People in **Ticket Resolvers** (`JM_TICKETS_RESOLVE`) can assign tickets and change status, priority and resolution. The app uses the server's per-ticket action flags; every API request is authorized again by the backend.

Attachments use the separate `ticket` upload purpose and the existing upload/scan pipeline. Downloads go through the authenticated ticket file endpoint and require an explicit export confirmation. The app does not use chat attachment permissions for tickets. Ticket drafts and API responses are not persisted to the offline cache or queued for later sending. Requests are cancelled on navigation, background, lock and account changes; after an interrupted submission, refresh before retrying because the server may already have received it.

Ticket notifications open `/tickets/TKT-…` directly, including after sign-in. The PWA service worker and the preview/nginx route allowlists serve only the public application shell for those routes, never ticket content or attachments.

## Deployment

1. Deploy the backend ticket release and run `python manage.py migrate` with the normal backup/release procedure. This creates the ticket tables and the **Ticket Resolvers** group.
2. Assign the people who will handle bugs to that group in JM Administration. Ordinary Messenger Users can submit and follow their own tickets without resolver access.
3. Keep the backend upload scanner and notification worker running. Ticket attachments require a successful clean scan.
4. Build and distribute the updated Android app through the existing release process. Older installed APKs will not gain these screens until updated. For Universal web/PWA, deploy the rebuilt web output and the updated nginx route configuration.

No new environment variables, Auth changes, dependencies or app permissions are needed. This feature does not require enabling Jivo Auth.

## Verification commands

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test -- --maxWorkers=2
npm.cmd run test:tools
$env:JM_TEST_ONLY='tickets'
node run-mocked-ui.cjs
npm.cmd run build:web
npm.cmd run android:build -- -Architecture arm64-v8a -Release
```

The browser walkthrough uses synthetic accounts and an intercepted API; it does not connect to a live JM service. Native picker/share-sheet behavior still needs a physical-device smoke test against a ticket-enabled test server before distribution.
