---
phase: testing
title: Unmumble Blue-Green Migration Testing
description: Configuration, data-parity, isolation, and deployment checks
---

# Unmumble Blue-Green Migration Testing

## Automated checks

- [x] Preview configs name Worker `unmumble-preview` and bind only
  `unmumble-preview-db` with its target UUID.
- [x] Production configs name Worker `unmumble-prod`, bind only
  `unmumble-prod-db`, and declare `unmumble.online` as Custom Domain.
- [x] Branch previews upload a version without promoting it.
- [x] Production deployment remains explicitly gated.
- [x] Full repository test suite, lint, build, and Wrangler dry-run pass.
- [x] Visible product surfaces and package metadata use Unmumble.
- [x] Legacy browser state is copied forward and dual-written for rollback.
- [x] Existing integration-secret AAD values remain unchanged.

## D1 integration checks

- [x] Target migration list has no pending migrations.
- [x] Source and target application-table row counts match.
- [x] `PRAGMA foreign_key_check` returns no rows on target.
- [x] Target has saved-video columns from migration `0010_early_angel.sql`.
- [x] Failed direct import leaves the new D1 empty.

## Deployment smoke checks

- [x] Each new Worker binds only its matching new D1.
- [x] Branch preview aliases redirect to preview-only Access.
- [x] `unmumble.online` resolves over HTTPS to `unmumble-prod`.
- [x] Production Access redirects unauthenticated traffic using the deployed AUD.
- [ ] Authenticated phrase/example/video/integration flows must be rechecked
  after the parallel Google-auth branch is merged.

## Test data handling

Remote preview data was copied through a private temporary directory that was
removed after verification. Fresh encryption keys are streamed directly into
Wrangler secret input and are never committed, printed, or documented.

## Latest evidence

- `node --test tests/deployment-config.test.mjs`: 5 passed, 0 failed.
- `node --test tests/*.test.mjs`: 148 passed, 0 failed.
- `node --test tests/unmumble-rename.test.mjs`: 3 passed, 0 failed.
- `npm test`: 134 passed, 0 failed; build completed.
- `npm run lint`: 0 errors, 2 generated-type warnings.
- `wrangler deploy --dry-run --config wrangler.preview.jsonc`: binding resolves
  to `unmumble-preview-db`.
- `curl https://unmumble.online/`: HTTPS reached `unmumble-prod`; after Access
  activation it returned the expected 302 login redirect with production AUD.
- Branch alias curl: 302 to the preview Access application with preview AUD.
- Remote SQL: both new D1 databases report 50 phrases, 1 user, 0 integration
  secrets, and empty `PRAGMA foreign_key_check` output.
- `git diff --check`: no errors.
- `wrangler check startup --config wrangler.preview.jsonc`: Worker built and
  local startup profile completed.
