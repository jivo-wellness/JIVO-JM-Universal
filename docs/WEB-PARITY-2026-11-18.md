# Web parity update - 18 November 2026

Reference frontend: f09f2e2. Implementation is in Universal only.

## Added
- Fine-grained web capability gates, including the server Oversight feature switch.
- Administrator permission catalogue and holder lists, bulk removals and skipped-result explanations.
- Freeze, unfreeze, block and unblock account actions with server permission checks.
- Audit screen with filters, pagination and integrity status.
- Oversight sessions, read-only chat/person views, search, moderation and vault reveal requests.
- Oversight reveal approvals in the unified approval inbox.
- Audit/Oversight navigation and SPA route support; private API responses remain outside the service-worker cache.
- Authenticated Oversight attachment reads rather than opening a sessionless external browser.

## Verification
- Full Vitest suite: 108 files / 750 tests passed before the final approval addition.
- Final focused approval/admin tests: 14 passed, including the added Oversight approval test.
- Route/cache policy tests: 6 passed.
- TypeScript and lint passed.
- Final production web export passed, including Audit, Oversight and approvals routes.

## Not yet verified
- New administration flows against a live backend and on Android/iOS.
- Pixel-for-pixel parity of the new native administrator screens.
- Oversight authenticated attachment viewing and platform file handoff on-device.

This report does not assert complete web/native parity. Existing messaging, vault and capture flows still need a regression pass with the updated permission catalogue. No backend or reference frontend files were changed in this update.
