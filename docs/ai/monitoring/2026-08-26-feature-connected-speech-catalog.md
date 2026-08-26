---
phase: monitoring
title: Connected speech catalog monitoring
description: Release signals and integrity checks for Library, optional analysis, and migration compatibility
---

# Connected Speech Catalog Monitoring

## Objective

Detect catalog availability, integrity, compatibility, or custom-phrase regressions without logging learner text or account data. This feature does not introduce a new monitoring vendor or remote alert configuration.

## Release Signals

### Application health

- `GET /api/catalog` returns HTTP 200 with 140 cards, three formats, six mechanism definitions, and a public cache header.
- `/` redirects to `/library`; `/library` and `/practice` render without client-console errors.
- Account phrase reads return analyzed catalog cards plus `analysis: null` for custom/legacy phrases.
- Text-only custom creation succeeds; attempts to inject catalog metadata return HTTP 400.

### D1 integrity

- `catalog_phrase_analysis WHERE active = 1`: exactly 140 rows.
- `phrase_mechanisms`: exactly 230 rows for the accepted catalog.
- Active format counts: 18 atom, 22 lexicon, 100 stack.
- `PRAGMA foreign_key_check`: zero rows.
- Reused preset analysis exists; unmatched legacy preset analysis does not.
- Existing progress, phrase examples, saved-video origins, and preset timestamps remain unchanged by migration.

### UX health

- Format counts show 18/22/100 before learner progress filters out added cards.
- Each atom mechanism returns three cards; multi-mechanism cards appear once and display every badge.
- Add/Undo and custom text-only flows work for guest and account modes.
- The 390px layout has no document-level horizontal overflow and keeps navigation/actions readable.

## Logs and Privacy

- Treat catalog query failures, migration failures, and phrase mutation failures as operational errors.
- Metadata-injection HTTP 400 responses are expected validation events, not incidents.
- Do not log custom phrase text, translations, account identity, Access assertions, provider keys, or saved media captions for catalog monitoring.
- Existing provider-not-configured warnings are separate from catalog availability; text-only custom saving remains successful with `translationPending`.

## Alert Thresholds

### Release blocking

- Migration error, foreign-key violation, or loss/misattribution of progress/examples/video origins.
- Catalog API 5xx or active count/taxonomy mismatch.
- Custom phrase creation failure or fabricated analysis on custom/legacy data.
- Public access to a catalog mutation method.
- Unusable Library navigation/actions at the supported mobile width.

### Follow-up

- Unexpected catalog payload growth or materially slower bounded catalog retrieval.
- Increased client fetch failures, empty catalog states with a healthy D1 count, or repeated translation-pending warnings.
- Cosmetic taxonomy/card layout differences that preserve content and interaction.

## Post-release Checks

Run the application, D1, and UX signals immediately after preview deployment and again after any authorized production deployment. If a release-blocking signal appears, stop rollout and follow the deployment rollback contract.
