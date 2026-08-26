---
phase: design
title: Connected speech catalog design
description: Typed authoring, optional analysis, D1 projection, APIs, and migration compatibility
---

# Connected Speech Catalog Design

## Architecture Overview

```mermaid
flowchart LR
  TS[Typed catalog.ts] --> V[Catalog integrity tests]
  TS --> G[Migration generator]
  G --> M[Append-only Drizzle SQL]
  M --> D1[(D1)]
  D1 --> CAPI[Public read-only catalog API]
  D1 --> PAPI[Authenticated phrase/progress API]
  CAPI --> LIB[/library]
  PAPI --> PRACTICE[/practice]
  LOCAL[Guest localStorage] --> LIB
  LOCAL --> PRACTICE
```

- `lib/catalog/connected-speech-catalog.ts` is the only editable active catalog definition. It exports typed mechanism metadata, practice-format metadata, the 140 active cards, explicit reused-ID mappings, and the small legacy compatibility set required for guest migration.
- Catalog tests validate the module before SQL generation.
- A deterministic repository script converts catalog records into one append-only, idempotent migration. Generated SQL is a deployment artifact and is never edited as a second source.
- D1 is the runtime projection used for filtering, phrase relationships, account progress, examples, and video origins.
- `/api/catalog` is public and read-only. Mutating account APIs retain their existing authorization/session boundary. Guest mutations remain localStorage-only.

## Data Models

### TypeScript authoring model

```ts
type PracticeFormat = "atom" | "lexicon" | "stack";

type Mechanism =
  | "elision"
  | "reduction"
  | "coalescence"
  | "t_variation"
  | "linking"
  | "syllabic_consonant";

type CatalogCard = {
  id: string;
  text: string;
  pattern: string;
  ipa: string;
  kind: PracticeFormat;
  mechanisms: readonly [Mechanism, ...Mechanism[]];
  rank: number;
  searchQuery?: string;
  alternateQuery?: string;
};
```

The module uses `as const satisfies CatalogDefinition` so invalid kind/mechanism literals fail type-checking. Runtime integrity tests cover properties the type system cannot guarantee, including uniqueness, counts, rank sequence, pattern balance, and migration mappings.

### D1 model

`phrases` remains the shared identity and user-content table. `text`, `source_type`, `owner_id`, translation/context, and timestamps stay there. Existing `pattern`/`ipa` columns remain during the compatible rollout but no longer determine whether analysis exists.

New optional one-to-one table:

```text
catalog_phrase_analysis
  phrase_id        PK, FK -> phrases.id
  kind             atom | lexicon | stack
  rank             positive integer
  pattern          non-empty text
  ipa              non-empty text
  search_query     non-empty text
  alternate_query  nullable text
  active           0 | 1
```

New many-to-many table:

```text
phrase_mechanisms
  phrase_id       FK -> phrases.id
  mechanism       semantic mechanism slug
  display_order   non-negative integer
  PK (phrase_id, mechanism)
```

Existing `phrase_progress(user_id, phrase_id)`, `phrase_examples(..., phrase_id)`, and `saved_videos.origin_phrase_id` remain unchanged. A custom phrase has no `catalog_phrase_analysis` row and no `phrase_mechanisms` rows.

### API representation

```ts
type PhraseAnalysis = {
  kind: PracticeFormat;
  rank: number;
  pattern: string;
  ipa: string;
  mechanisms: Mechanism[];
} | null;

type PhraseView = {
  id: string;
  text: string;
  sourceType: "catalog" | "custom" | "legacy";
  status: "pick" | "to_learn" | "learning_now" | "learnt";
  analysis: PhraseAnalysis;
};
```

Catalog records always return non-null analysis. Custom and unmatched legacy records return `analysis: null`. Provider query selection is `analysis.searchQuery ?? text`; `alternateQuery` remains internal provider fallback metadata.

## API Design

### `GET /api/catalog`

- Public, read-only, cacheable catalog response.
- Returns active analyzed cards, mechanism definitions, practice-format definitions, and stable ordering data.
- Optional query parameters `kind`, `mechanism`, and `q` may narrow results; the first implementation may fetch all 140 cards once and filter client-side because the bounded payload is small.
- Never returns user identity, progress, secrets, saved examples, or custom phrases.

### Existing phrase/progress APIs

- Authenticated `GET /api/phrases` joins optional analysis and ordered mechanisms onto catalog phrases and returns `analysis: null` for custom/legacy rows.
- Catalog status mutations continue to identify the card by stable `id`.
- `POST /api/phrases` for custom input accepts text and existing optional translation/context only. Catalog fields are ignored/rejected and never required.
- Guest Library fetches the public catalog and merges statuses by stable ID from localStorage. Guest custom phrases retain their existing local record shape plus `analysis: null` at the UI boundary.

## Component Breakdown

- `lib/catalog/connected-speech-catalog.ts`: typed mechanisms, formats, active cards, reuse mapping, and legacy compatibility definitions.
- `scripts/generate-connected-speech-migration.mjs`: deterministic SQL projection with safe escaping and stable order.
- D1 migration: creates optional-analysis tables, upserts catalog phrases, inserts mechanism joins, and retains legacy references.
- `/api/catalog`: public catalog projection.
- Phrase API mapper: discriminated `analysis` response for account phrases.
- `/library`: compact catalog header, visible mechanism selector, three practice-format tabs, search/sort controls, analyzed card grid, and custom phrase form.
- `/practice`: keeps To Learn/Learning Now/Learnt and renders analysis only when present.
- Guest storage migration: reuses stable IDs and preserves non-pick unmatched legacy entries.
- Site navigation/Worker allowlist: route Library to `/library` and expose/cache the read-only page/API without widening mutation access.

## Migration and Compatibility

1. The generator verifies the 140-card TypeScript catalog and emits schema/data SQL.
2. For 36 exact-text matches, active cards use their existing `preset-*` IDs rather than replacing referenced identities with the input JSON IDs.
3. New cards receive stable explicit IDs that never depend on array position.
4. The 14 unmatched presets remain in `phrases` without active analysis. Existing account progress/examples/video references stay valid.
5. Guest migration retains matching statuses automatically through reused IDs. The legacy compatibility map supplies text for an unmatched phrase only when old localStorage shows a non-`pick` status.
6. Library queries require active analysis, so retired rows do not appear as discoverable cards. Practice queries include custom/legacy rows when the user already owns progress.
7. Migrations use `CREATE TABLE IF NOT EXISTS`, `INSERT ... ON CONFLICT`, and deterministic join replacement/upsert semantics so reapplication cannot duplicate state.

No existing phrase row or user progress is deleted in this feature.

## Design Decisions

- **Typed TypeScript over JSON:** the catalog has one current consumer stack, benefits from literal types, and has no external authoring requirement.
- **D1 runtime projection:** existing relational references make an API-only/static catalog less safe than retaining phrase rows in D1.
- **Optional analysis table:** custom phrases remain valid base phrases without nullable-analysis ambiguity; curated catalog import remains strict.
- **Semantic mechanism slugs:** A–F are import concepts only. Stable slugs make filters and API responses readable while UI titles remain changeable.
- **One selected mechanism filter:** avoids ambiguous any/all multi-filter semantics. Cards still display all assigned mechanisms.
- **Stable existing identity over pretty imported IDs:** preserving progress and references outweighs retaining JSON prefixes for the 36 overlaps.
- **Retire, do not delete:** unmatched presets leave the active catalog but remain referentially and behaviorally available where already used.

## Non-Functional Requirements

- Catalog generation is deterministic: identical TypeScript input produces byte-identical data SQL.
- A single bounded catalog fetch is acceptable for 140 cards; responses should use explicit cache headers and avoid per-card requests.
- Catalog API is read-only and contains no account data. Existing mutation/authentication boundaries remain unchanged.
- Malformed catalog data fails tests/generation before deployment; request handlers never create schema or seed catalog rows.
- Card and mechanism controls are keyboard accessible, keep text labels in addition to color, and work at 390px and 1200px widths.
- Empty, loading, no-match, added, undo, and analysis-unavailable states are explicit.
- Production migration precedes application deployment; preview and production D1 bindings remain isolated.
