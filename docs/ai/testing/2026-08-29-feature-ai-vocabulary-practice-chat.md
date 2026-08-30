---
phase: testing
title: AI Vocabulary Practice Chat Testing
description: Verified agent-tool contracts and remaining end-to-end gates
---

# AI Vocabulary Practice Chat Testing

## Fresh Automated Evidence

Fresh 2026-08-31 evidence passes full `npm test` 598/598, including the production
build, plus typecheck, diff check, and lint with zero errors and three existing
warnings. Earlier focused UI evidence passes 95/95 and exact-diff backend evidence on
2026-08-29 passes focused backend tests 219/219, plus Drizzle validation, dependency
audit, lifecycle lint, diff check, tracked-secret check, and ignore check.
Independent final review found no P0/P1.

### Covered in the current test tree

- [x] New chat reads the owner-bound latest five and persists a deterministic
  complete assistant opening without a synthetic user message or model call; when
  reused in model history it is escaped inside `UNTRUSTED_VOCABULARY_OPENING`.
- [x] `list_vocabulary` pages `all`, `to_learn`, `learning`, and `learned` newest-
  first with no overall entry cap. Versioned opaque cursors are canonical,
  category-bound, and rejected before D1 when malformed/mismatched; `learnt` and
  legacy `learned` map to the public `learned` category. Mixed legacy SQLite, ISO-
  seconds, and ISO-milliseconds timestamps traverse chronologically through
  `julianday` without duplicates while cursors retain the raw stored boundary.
- [x] Page/search limits default/cap correctly; provider output exposes at most six
  meanings per entry and 7,800 JSON characters with honest truncation. Two calls per
  turn preserve D1 headroom, while the latest completed list exposes only a validated
  `{ category, cursor }` to a later turn for continuation.
- [x] Search rejects queries over 48 characters and escaped wildcard patterns over
  50 UTF-8 bytes, including Unicode and escape-expansion boundaries.
- [x] Legacy, unregistered direct-write compatibility handlers still reject
  practice sentences, examples, negation, implied/history-only intent, and values
  absent from the current message; active provider tools use reviewable proposals
  and do not use this regex gate.
- [x] Legacy literal binding preserves case and compatibility characters (`Polish` is not
  `polish`), while command parsing still recognizes its grammar; revocation text
  inside the literal phrase (for example `never mind`) is not treated as cancellation.
  Quoted terminal punctuation is preserved (`"wow!"` cannot authorize `wow`). Write
  persistence/canonical args retain NFC literals, and entry receipt keys match
  SQLite `NOCASE` with NFC plus ASCII fold, never NFKC compatibility folding.
- [x] Entry/meaning writes bind server identity, reject foreign/inactive targets,
  normalize duplicates, preserve omitted context, keep preset legacy fields
  immutable, and store every new user translation as a personal meaning.
- [x] Update-meaning requires current translation plus entry text in the same turn;
  owner/phrase/meaning/old translation/context CAS rejects stale/wrong state as a
  traced `mutation_conflict`. Historical owner-custom legacy meanings promote to a
  personal meaning and clear legacy fields atomically.
- [x] New/`pick` add becomes `to_learn`; all already active statuses remain
  unchanged across entry duplicates and meaning writes. Reactivating `pick`
  refreshes progress `created_at`, while active duplicates preserve recency.
  Historical `set_vocabulary_category`
  changes only one owner-visible entry after a literal current-turn entry/category
  command and CAS; practice, description, wrong destination, negation, revocation,
  and autonomous mastery inference are denied.
- [x] Manual preset phrase `PATCH` stores a generated fallback as a personal meaning,
  leaves shared preset fields unchanged, and commits meaning plus status atomically.
- [x] Migration 0017 merges historical ASCII-`NOCASE` custom duplicates while
  preserving progress, meaning translation/context/latest-update metadata,
  examples, videos, and chat references; Unicode case variants remain distinct.
  Migration 0018 covers attempts/ledger/receipts, and 0019 repairs duplicate
  pending attempts before enforcing one pending attempt per chat. Migration 0020
  backfills configured attempt provenance without inventing an actual routed model.
- [x] Every within-budget read/rejection/write has a bounded ledger row; call three
  onward returns `tool_budget_exceeded` before trace persistence, changed call
  identity is rejected, and stale/foreign attempts cannot register or mutate.
- [x] Same-step provider calls are serialized before the shared limit/circuit. Any
  failed or thrown mutation opens the per-turn circuit; the next queued provider
  tool returns `tool_budget_exceeded` before the traced executor and performs no
  second tool-side D1 call.
- [x] Domain mutation, postcondition receipt, and terminal tool-call result commit
  atomically; false postcondition rolls back, equivalent concurrency converges,
  ambiguous post-commit response resolves from the receipt, and changed arguments
  at the same `(userMessage, operation, target)` conflict.
- [x] Instrumented cold full-turn tests count each D1 statement inside a batch:
  maximum reads use 35, two cold proposals 40, one ambiguous proposal 42,
  proposal rollback/circuit 32, rollback plus ambiguous terminal failure 34, and
  meaning-update rollback plus ambiguous terminal failure 37. Maximum 12-target create-
  chat ambiguous recovery remains the exact 49/50 worst case. Call three is
  rejected before trace work. A Promise-all regression combines legacy full
  rollback, a concurrent duplicate update, and ambiguous failed terminal at 37;
  the duplicate is rejected without D1.
- [x] One and ten exact state-change targets resolve in one set query. Removal
  proposal generation costs 30 D1 statements for either size; confirmation costs
  10 for either size. Mixed preset/custom confirmation is atomic and owner-safe,
  stale snapshots fully roll back, cancel performs no domain write, shared Library
  rows remain, and owned custom children cascade.
- [x] A mutation-batch failure is never retried blindly. Tests distinguish receipt
  recovery, stale-attempt rejection, proven CAS `mutation_conflict`, and otherwise
  `operation_failed`, without a partial mutation.
- [x] Failed/stale assistant retries create a new attempt, preserve the logical
  messages and their immutable <=48,000-character practice snapshot, ignore stale
  callbacks, replay receipts, and build older-turn context without later messages.
- [x] Assistant and tool completion plus receipt insert/commit/replay require a
  pending unexpired lease; exact fresh IDs recover ambiguous committed begin/retry
  batches and continue generation. Finish/fail use owner-scoped `findTurn` without a
  redundant ownership query and return normal successful terminal state without an
  unconditional readback; ambiguous/failed-postcondition paths use exact readback.
  Failed attempts retain configured provider/model provenance.
- [x] Prompt, structured generation timeouts, 2,400-token output, abort/cancel/error
  mapping, five-step/two-tool bound with a final text-only step, compact HTTP
  transport, owner-scoped routes, and the chat-only UI source contract are covered.
  Any non-`stop` finish is retryable `response_incomplete`; explicit cancellation
  wins the abort race as `generation_cancelled`.
  The public stream allowlist drops tool/reasoning/source/file/step/raw/provider
  metadata, and provider 429 maps to `provider_rate_limited`.
- [x] Mutation intent routing exposes only the intended proposal tool with required
  tool choice. Required-tool recovery buffers only mutation streams, discards and
  retries text-only provider drift at most twice, then permits a conservative
  explicit-value fallback that still creates only a pending proposal. Tests reject
  ambiguous/reference/negated fallbacks and prove ordinary chat remains streamed.
- [x] Each English token is rendered without changing message text, exposes a subtle
  clickable treatment, and participates in one roving tab stop per message. Keyboard
  arrows/Home/End and Enter/Space work, while a >=450ms mobile long press or completed
  range selection suppresses the synthetic single-word click. Separate desktop and
  mobile regressions prove a later short tap/click replaces a still-live old range.
- [x] Consecutive selections reset translation/save UI. Component integration proves
  `first` then `second` sends two distinct `/api/translate` bodies and that Add sends
  only `second` with its matching translation/context; stale identity results cannot
  leak into the new panel.
- [x] Compact composer CSS has no resize handle, internal scrollbar, or inner
  textarea focus outline; the rounded shell owns focus. Source and browser checks
  cover auto-grow, full-screen dialog, focus trap/restoration, Escape, shared draft,
  and desktop/mobile layouts.
- [x] Prompt tests import `lib/ai-chat/prompts/vocabulary-practice.ts`, assert ID
  `unmumble.vocabulary-practice`/version `4`, learner-led/category/removal rules,
  same-turn fresh reads for current/latest claims, bounded continuation, and prompt
  ID/version on allowlisted lifecycle events.
- [x] Compatibility targets accept bounded saved/ad-hoc entries and all three
  meaning modes through atomic whole-array `PATCH` only. The unused standalone AI
  translation route/module are absent, preventing a second untraced provider path.
- [x] Account chat creation/listing is capped at 100, detail at the latest 200
  messages, model history at 40/32,000, and public DTOs omit internal context and
  provider/model/usage data.
- [x] Meaning-list reads return no more than 50 personal meanings plus an optional
  legacy meaning, while `meaningCount` and `meaningsTruncated` disclose the full
  visible total and truncation.
- [x] Ordinary `ensureUser` is one statement; atomic idempotent legacy-owner transfer
  is covered on login/session bootstrap and excluded from AI routes.
- [x] AI chat delegates saved-target resolution and the cross-table practice
  projection to a read-only vocabulary module; owner/legacy/selected semantics and
  the exact 49/50 D1 worst-case boundary remain intact.
- [x] Runtime tests reject presets/unlisted models and drive the real OpenRouter
  provider serializer through fake fetch: the outbound request names the concrete
  code-owned DeepSeek model, has no preset/fallback fields, disables plugins,
  preserves one local AI SDK tool, requires data-collection denial plus ZDR and
  full request-parameter support, sanitizes telemetry, and maps provider failures
  to stable public codes.
- [x] Separate hashed-account and per-location aggregate-edge Cloudflare limits deny
  before D1/provider work and fail closed when bindings are absent or fail.
  Deployment configs bind 10/account/minute and approximate 100/location/minute
  guards with distinct namespaces; tests do not claim global atomicity.
- [x] Operational events expose only the exact safe metadata allowlist, including
  bounded terminal elapsed/finish/step/tool/output-size and required-tool
  retry/fallback fields; unknown events or
  logger failures cannot affect persistence or leak private payloads.
- [x] Server/browser use shared explicit public DTOs and every vocabulary tool is
  constructed through one traced budget wrapper/registry. Source-boundary tests
  keep contracts/policy/results/handlers/registry/pagination separate and the old
  `vocabulary-tools.ts` module as a thin facade.
- [x] `npm audit --omit=dev` reports zero vulnerabilities with exact Next.js 16.3.3.

## Repository Verification

- [x] Fresh focused backend suite: 219/219, including the concurrent tool-call
  serialization/circuit, byte-compatible Unicode cursor, and linear-time
  adversarial literal-policy regressions.
- [x] Fresh focused UI/selection suite: 95/95 on the exact diff.
- [x] Fresh full `npm test`: 598/598 on the exact diff, including production build.
- [x] Fresh typecheck, Drizzle, dependency audit, tracked-secret, ignore, lifecycle,
  and diff checks pass; full lint has zero errors and three existing warnings.
- [x] Independent final review reports no P0/P1.
- [x] Pushed backend commit `8f671288`: PR #32 CodeQL, Analyze, Sonar, and Workers checks are
  green.

## Preview Data Evidence

- [x] Read-only preview D1 preflight found no owner-custom ASCII-`NOCASE`
  duplicates before 0017 deployment, as documented in commit `c970f80`.
- [x] Preview's older applied 0017 is explicitly accepted as behaviorally equivalent
  to corrected 0017 because the preflight proved there were no duplicates to merge;
  no preview re-baseline or forward migration is needed. Fresh production will run
  corrected 0017.
- [x] Read-only preview evidence confirms 0019 applied, the
  `idx_ai_chat_assistant_attempts_one_pending_chat` index present, and
  `PRAGMA foreign_key_check` clean.
- [x] Preview migration 0020 is applied; `configured_provider` and
  `configured_model` columns are present and backfilled. The pending-chat index
  remains present and `PRAGMA foreign_key_check` remains clean.

## Manual Authenticated Smoke

- [x] Branch-preview New Chat creation visibly shows all available latest entries
  and saved translations without a provider call (two entries existed in the
  inspected account).
- [x] A live direct OpenRouter request to concrete DeepSeek returned a tool call to
  `list_vocabulary`. This proves model/tool-schema compatibility, not authenticated
  route execution, ledger persistence, cursor continuation, or D1 ownership.
- [x] A real published follow-up maps the observed OpenRouter usage-limit response
  to the dedicated safe UI error without exposing provider internals.
- [x] Authenticated provider-backed preview requests for latest ten/all available
  and category `To Learn` each returned the account's two matching entries. They
  performed no user-data mutation.
- [x] Authenticated local real-model stability smoke completed 25/25 turns with a
  2,067-character long answer, all eight expected inline proposals, six confirms,
  two cancels, and zero failed/pending attempts or proposals. Direct D1 audit found
  fresh same-turn list/find tool traces after mutations and six distinct committed
  receipts.
- [ ] With an account containing more than ten entries, manually verify pagination
  and cross-turn continuation beyond the first page.
- [ ] Manually verify explicit write denial/commit and interruption/replay without a
  duplicate user-data mutation.

Automated tests use local D1 and controlled model/tool adapters. They never read,
print, snapshot, or call a real provider credential.
