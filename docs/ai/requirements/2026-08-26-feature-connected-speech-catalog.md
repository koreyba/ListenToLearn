---
phase: requirements
title: Connected speech catalog requirements
description: Typed catalog, phonetic taxonomy, optional analysis, and migration-safe Library behavior
---

# Connected Speech Catalog Requirements

## Problem Statement

Unmumble currently renders a flat preset phrase list on `/`, duplicates that list in a TypeScript constant and a D1 migration, and has no structured way to explain which connected-speech process makes a phrase difficult to hear. The accepted catalog contains 140 curated cards divided into three practice formats and six phonetic mechanisms. The main page will be redesigned separately, so Library needs its own route and catalog-oriented information architecture.

Prepared catalog cards and user-created phrases have different contracts. A catalog card has phonetic analysis, ranking, and one or more mechanisms. A custom phrase must remain addable with only its text and must continue through the existing Practice lifecycle without requiring or pretending to have phonetic analysis.

The target user is an English learner who wants to choose a connected-speech process, add useful material to Practice, and keep existing guest or account progress.

## Goals & Objectives

### Goals

- Create a dedicated `/library` catalog route and make the global Library destination point there. The independently delivered marketing homepage remains at `/`.
- Define the accepted 140-card catalog in one typed TypeScript module. The supplied `phrases.json` is an input example only and must not become a runtime, build-time, or committed product dependency.
- Present three practice formats:
  - `atom`: **One change at a time** — 18 cards.
  - `lexicon`: **Common spoken forms** — 22 cards.
  - `stack`: **Real phrases** — 100 cards.
- Present six connected-speech mechanisms with a technical name and plain-English explanation:
  - `elision`: **Elision** — Sounds disappear.
  - `reduction`: **Vowel reduction & weak forms** — Unstressed vowels weaken.
  - `coalescence`: **Yod coalescence** — Two sounds merge into one.
  - `t_variation`: **T-flapping & glottalization** — T becomes `/ɾ/` or `/ʔ/`.
  - `linking`: **Linking & resyllabification** — Word boundaries shift.
  - `syllabic_consonant`: **Syllabic consonants** — A consonant forms a syllable.
- Keep the mechanism visible on every analyzed card and allow a learner to filter the current practice format by one mechanism or show all mechanisms.
- Keep `pick → to_learn → learning_now → learnt`; Library owns available catalog choices and Practice owns active learning state and trainer entry.
- Preserve custom phrase creation for guest and signed-in users. A custom phrase goes directly to `to_learn`, has no catalog analysis, and remains playable by using its text as the provider query.
- Use D1 as the runtime relational store while generating its append-only catalog/schema migration from the typed TypeScript definition. Do not maintain a second hand-edited catalog copy.
- Preserve existing phrase progress, saved examples, video origins, and guest browser state across the catalog transition.

### Non-goals

- Automatically classify, transcribe, or assign mechanisms to custom phrases.
- Add AI analysis, an admin editor, CMS, spreadsheet, or JSON-based authoring pipeline.
- Redesign or otherwise change the independently delivered marketing/home page.
- Change trainer playback, saved-example semantics, caption navigation, translation providers, or the four learning statuses.
- Introduce a separate Words product area; a custom word and a custom phrase use the same base phrase model.
- Claim that the three practice formats are certified difficulty levels. They are learning formats ordered from isolated to combined listening.

## User Stories & Use Cases

- As a learner, I can open `/library` and choose among One change at a time, Common spoken forms, and Real phrases.
- As a learner, I can select Elision, Reduction, Yod coalescence, T variation, Linking, or Syllabic consonants and see matching cards without duplicated search results.
- As a learner, I can see the written phrase, connected-speech grouping, IPA, and all mechanisms assigned to a prepared card before adding it.
- As a learner, I can add a catalog card to To Learn and later open it explicitly from Practice.
- As a learner, I can add my own word or phrase with text only. It appears in To Learn without IPA, grouping, mechanism tags, or a fabricated analysis.
- As a guest, I can browse the public catalog and keep progress/custom phrases in localStorage without a D1 write.
- As a signed-in learner, I can use the same catalog while my progress and custom phrases remain account-scoped in D1.
- As an existing learner, I retain progress and saved material when an old preset is mapped to the new catalog or retired from new discovery.

### Edge cases

- A card can have multiple mechanisms. Selecting one mechanism includes cards containing it; it does not duplicate the card once per mechanism.
- Two catalog cards can have the same display text but different practice formats or analysis, such as the two `a couple of` cards. Phrase identity and mutations use stable IDs, never text or array position.
- Custom phrases have `analysis: null`. Their missing analysis is expected, not an error or a pending state.
- `searchQuery` may fall back to the card text. `alternateQuery` is provider metadata and is not presented as a canonical/full form.
- Of the 50 existing presets, 36 exact-text matches reuse their existing `preset-*` IDs. The 14 unmatched presets remain retained as legacy records so existing non-`pick` progress and references continue to work, but they are not shown as active catalog choices.
- Guest storage migration preserves statuses for reused IDs and keeps a legacy phrase available in Practice when the guest had already moved it out of `pick`.
- Retrying a catalog migration is idempotent and must not duplicate cards or mechanism relations.
- A missing/invalid catalog analysis rejects the catalog build or migration; it must not weaken the custom-phrase input contract.

## Success Criteria

- [x] One typed TypeScript catalog contains exactly 140 active cards: 18 atoms, 22 lexicon forms, and 100 stacks.
- [x] Catalog integrity tests verify unique stable IDs, valid ranks within each practice format, valid bracket grouping, allowed mechanisms, at least one mechanism per catalog card, and the expected A–F-to-semantic mapping.
- [x] No product code imports or reads `/Users/denys.koreiba/Downloads/phrases.json`, and no catalog JSON file is committed.
- [x] `/library` exposes the three practice formats, all six visible mechanism choices, search, recommended ordering, analyzed cards, and `Add to Learn`.
- [x] Mechanism filtering returns each matching card once and card badges show every assigned mechanism.
- [x] Custom phrase creation requires only non-empty text, creates `analysis: null`, and continues to work for guest and account modes.
- [x] Catalog validation requires complete analysis; custom phrase validation does not accept or require catalog analysis fields.
- [x] D1 represents optional catalog analysis separately from the base phrase and supports zero mechanism rows for a custom phrase.
- [x] Runtime catalog seeding occurs only through an append-only migration generated from the TypeScript catalog, never in request handlers.
- [x] Existing progress/examples/video references survive: 36 overlapping presets reuse stable IDs and 14 unmatched presets remain available only where prior state/reference requires them.
- [x] Guest storage migration preserves active and legacy in-progress phrases without writing guest data to D1.
- [x] Existing Practice tabs, explicit trainer entry, custom phrase removal, translation fallback, saved examples, and videos remain functional.
- [x] Type-check, lint, catalog/unit/integration tests, production build, D1 migration checks, and responsive browser smoke checks pass.

## Constraints & Assumptions

- The application remains React/Vinext on Cloudflare Workers with D1/Drizzle and append-only migrations.
- The canonical authoring format is TypeScript because the catalog is curated with the application, uses a closed schema, and needs compile-time types. JSON, direct SQL authoring, and a database/CMS editor were considered and rejected for this feature.
- D1 remains the runtime relational representation because phrase progress, saved examples, and saved-video origins already reference phrase IDs.
- Mechanism codes are stable semantic slugs; display names can change without changing relationships or progress.
- Only active analyzed catalog cards appear in Library. A custom or retired legacy phrase can remain in Practice without analysis.
- The user-supplied taxonomy and examples are accepted product content for this feature; linguistic content review beyond the agreed naming is out of scope.
- No production deploy, merge, or deletion of existing data is authorized by this requirements phase.

## Questions & Open Items

All feature-level product and storage decisions are resolved above. Deployment timing and the future home-page contents are intentionally deferred to their own approval/features.

### Alternatives considered

1. Hardcode the 140 cards in the Library component — smallest initial diff, rejected because content, UI, guest behavior, and D1 would drift.
2. Keep JSON plus runtime schema validation — portable and workable, rejected because no external authoring consumer currently needs a language-neutral file.
3. Typed TypeScript catalog generating D1 migration data — chosen for one reviewable source, compile-time shape checks, and compatibility with the current stack.

For optional analysis, making every catalog column nullable on `phrases` was considered. A separate optional analysis record is chosen because it keeps the custom phrase contract honest while allowing stricter validation for curated cards.
