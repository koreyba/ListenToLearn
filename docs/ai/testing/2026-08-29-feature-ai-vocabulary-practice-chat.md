---
phase: testing
title: AI Vocabulary Practice Chat Testing
description: Verified agent-tool contracts and remaining end-to-end gates
---

# AI Vocabulary Practice Chat Testing

## 2026-09-01 Reliability Audit Addendum

The post-merge reliability branch adds the missing behavioral layers identified in
the audit:

- a Cloudflare Workers Vitest test applies every D1 migration inside `workerd` and
  proves idempotent logical-turn reuse, the one-pending-attempt invariant, terminal
  completion, and subsequent-chat usability against real D1 semantics;
- a client regression test proves that a canonical-detail request which never
  settles is aborted at its own deadline and cannot freeze later recovery probes;
- Playwright intercepts the actual browser network boundary and proves interrupted
  Retry convergence plus explicit Stop on both desktop Chromium and a mobile coarse-
  pointer viewport. Stop leaves Retry available and the composer unlocked;
- PR CI installs Chromium, retains screenshots on failure, and records a trace on the
  first retry.

These tests complement rather than replace the existing Node suites: source-boundary
assertions remain architecture tripwires, Node tests own exhaustive deterministic
failure injection, Workers Vitest owns runtime/storage parity, and Playwright owns
browser transport and interaction behavior. See the dedicated
`2026-09-01-feature-ai-chat-reliability-audit` design document for the invariant and
failure matrix.

## Fresh Automated Evidence

Fresh post-merge reliability evidence passes the Vite 8.2.2 production build,
654/654 Node tests, 1/1 Workers-runtime D1 test, and 4/4 Playwright journeys across
desktop and mobile Chromium. TypeScript passes; ESLint reports zero errors and the
same three generated/existing warnings. Production dependencies report zero known
audit vulnerabilities. The remaining full-tree audit findings are confined to
development transitive dependencies in pinned `vinext`/`drizzle-kit`; their offered
fixes require breaking toolchain changes and are not force-applied in this reliability
PR. PR #32's earlier preview evidence remains historical; the new reliability branch
still requires its own PR checks and preview smoke.

The current browser run at 319px and desktop master-detail breakpoints verified
Markdown, Stop, Retry, a successful post-cancellation follow-up, one three-addition
inline proposal cancelled without vocabulary writes, full-screen composer focus/body
lock, and zero document/drawer/sidebar/conversation horizontal overflow. Exact
middle-caret transfer remains covered programmatically because the browser driver
cannot place a textarea caret at a deterministic character offset.

The recovery follow-up also repeated Retry -> live Stop -> Ready, then received a
normal Markdown response in the same authenticated chat. Bold output rendered as
`strong`, a new word selection cleared the previous translation state, the browser
console had no errors, and document/composer widths remained overflow-free at 390px.
Local DeepL was not configured, so provider translation itself was not claimed.

### Covered in the current test tree

- [x] UI source contracts span the auth shell, workspace, conversation, composer,
  turn controller, and client HTTP boundary instead of depending on one monolithic
  component. Behavioral tests retain send/retry/stop, canonical recovery,
  full-screen composition, caret restoration, safe errors, Markdown, and responsive
  interaction contracts.
- [x] The stable vocabulary mutation facade delegates mixed changes through an
  explicit staged planner and atomic plan builder. Existing 1/10/30-change,
  rollback, ambiguity, cancellation, exact statement-count, and postcondition tests
  exercise that delegated production path.

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
  maximum reads use 35, one cold mixed proposal 36, its ambiguous completion or
  provider-failure envelope 38, proposal rollback/circuit 32, and rollback plus
  ambiguous terminal recovery 34. Maximum 12-target create-
  chat ambiguous recovery remains the exact 49/50 worst case. Call three is
  rejected before trace work. A Promise-all regression combines legacy full
  rollback, a concurrent duplicate update, and ambiguous failed terminal at 37;
  the duplicate is rejected without D1.
- [x] One, ten, and thirty concrete changes resolve with set-based queries and
  writes. Removal proposal generation costs 30 D1 statements for every tested size;
  confirmation costs 15 for one, ten, or thirty additions/removals. Mixed
  preset/custom confirmation is atomic and owner-safe,
  stale snapshots fully roll back, cancel performs no domain write, shared Library
  rows remain, and owned custom children cascade.
- [x] The production ID generator uses 16 random bytes encoded as 22 URL-safe
  Base64 characters plus a kind prefix. Thirty translated additions fit the
  3,600-byte canonical planner limit and execute atomically with those real IDs.
- [x] Two meaning actions for the same phrase cannot converge on one normalized
  translation. The planner reports `conflicting_changes` before proposal storage.
- [x] Editing a shared preset legacy meaning reports the typed
  `unsupported_change` reason. The handler exposes no private planner detail and
  generation completes deterministically with the supported alternative.
- [x] Reactivating `pick` refreshes `created_at`, making that entry the deterministic
  latest target; an already-active duplicate preserves its prior recency.
- [x] A mutation-batch failure is never retried blindly. Tests distinguish receipt
  recovery, stale-attempt rejection, proven CAS `mutation_conflict`, and otherwise
  `operation_failed`, without a partial mutation.
- [x] Failed/stale assistant retries create a new attempt, preserve the logical
  messages and their immutable <=48,000-character practice snapshot, ignore stale
  callbacks, replay receipts, and build older-turn context without later messages.
  Canonical history excludes both the failed/pending assistant and its paired user
  message until that logical turn completes successfully.
- [x] Assistant and tool completion plus receipt insert/commit/replay require a
  pending unexpired lease; exact fresh IDs recover ambiguous committed begin/retry
  batches and continue generation. Finish/fail use owner-scoped `findTurn` without a
  redundant ownership query and return normal successful terminal state without an
  unconditional readback; ambiguous/failed-postcondition paths use exact readback.
  Failed attempts retain configured provider/model provenance. Terminal success and
  failure callbacks persist sanitized aggregate telemetry in the existing
  finish/fail batch, while lease expiry records `generation_interrupted` with
  `lease_expired` telemetry and adds no D1 statement.
- [x] Proposal listing and confirmation require both a complete assistant message
  and the exact immutable origin attempt to be complete. A proposal from a failed
  origin attempt remains pending internally but is hidden and unconfirmable even if
  a later retry completes the shared assistant message.
  Migration 0023 makes the proposal uniqueness key
  `(origin_attempt_id, operation, target_key)`, so that retry creates a distinct
  immutable proposal and only the successful retry origin becomes visible.
- [x] Prompt, structured generation timeouts, 2,400-token output, abort/cancel/error
  mapping, two-tool bound, compact HTTP transport, owner-scoped routes, and the
  chat-only UI source contract are covered. A successful proposal terminates with
  deterministic review text and no second provider step; a read permits one answer
  step. Tool timeout/failure is terminal without provider resubmission. Any other
  non-`stop` finish is retryable `response_incomplete`; explicit cancellation wins
  the abort race as `generation_cancelled`.
  The public stream allowlist drops tool/reasoning/source/file/step/raw/provider
  metadata, and provider 429 maps to `provider_rate_limited`.
- [x] The dedicated turn-cancellation route requires auth, exact origin, and an empty
  command. Repository tests cover immediate active/elapsed-lease terminalization,
  cancelled/complete/failed replay, owner isolation, and finish/fail callback
  fencing; the public response omits attempt/provider/model/usage data. The
  repository cancellation path is exactly five D1 statements (two owner-scoped
  reads plus a three-statement batch) in a separate invocation, so normal generation
  envelopes are unchanged.
- [x] Client cancellation remains a blocking `Stopping` phase after the local stream
  aborts, preventing Stop-to-Send races. Focused reconciliation tests prove that a
  pre-accept rejection restores an empty draft, preserves a newer non-empty draft
  with a meaningful retry for the unsent text, and clears recovery only after the
  canonical detail acknowledges the same `clientMessageId`. Cancellation plus
  reconciliation has an eight-second hard deadline, and a quiet EOF/undefined finish
  enters the same recovery path rather than being mistaken for success. Interrupted
  recovery continues past the fast probes with bounded exponential polling through
  the server lease, uses detail-only refreshes, survives temporary detail-read
  failures, and aborts with the conversation lifecycle.
- [x] The registry exposes exactly two read tools plus one mixed proposal tool. The
  model uses automatic tool choice; there is no regex intent router, required-tool
  middleware, provider resubmission, or application-generated fallback call.
  Natural unambiguous references use bounded canonical history, while server-side
  validation rejects the specific ambiguous/conflicting target.
- [x] Each English token is rendered without changing message text, exposes a subtle
  clickable treatment, and participates in one roving tab stop per message. Keyboard
  arrows/Home/End and Enter/Space work, while a >=450ms mobile long press or completed
  range selection suppresses the synthetic single-word click. Separate desktop and
  mobile regressions prove a later short tap/click replaces a still-live old range.
- [x] The interactive message surface is the only selection owner. A Markdown phrase
  selected after earlier emphasis syntax uses rendered-text offsets and returns the
  correct visible sentence context; no conversation-level raw-source listener can
  overwrite it.
- [x] Consecutive selections reset translation/save UI. Component integration proves
  `first` then `second` sends two distinct `/api/translate` bodies and that Add sends
  only `second` with its matching translation/context; stale identity results cannot
  leak into the new panel.
- [x] Compact composer CSS has no resize handle, internal scrollbar, or inner
  textarea focus outline; the rounded shell owns focus. Source and browser checks
  cover auto-grow, full-screen dialog, focus trap/restoration, Escape, shared draft,
  and desktop/mobile layouts.
- [x] Prompt tests import `lib/ai-chat/prompts/vocabulary-practice.ts`, assert ID
  `unmumble.vocabulary-practice`/version `7`, learner-led/category/removal rules,
  English-learning scope with vocabulary-operation exceptions, same-turn fresh reads
  for current/latest claims, bounded continuation, and prompt ID/version on allowlisted
  lifecycle events.
- [x] Runtime/generation contract tests prove that active semantic chunks are not
  subject to an absolute total or per-step deadline while first-chunk, inter-chunk,
  and tool inactivity deadlines remain bounded.
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
  bounded terminal elapsed/finish/step/tool/output-size fields; unknown events or
  logger failures cannot affect persistence or leak private payloads.
- [x] Server/browser use shared explicit public DTOs and every vocabulary tool is
  constructed through one traced budget wrapper/registry. Source-boundary tests
  keep contracts/policy/results/handlers/registry/pagination separate and the old
  `vocabulary-tools.ts` module as a thin facade.
- [x] `npm audit --omit=dev` reports zero vulnerabilities with exact Next.js 16.3.3.

## Repository Verification

- [x] Fresh focused resource-first backend suite: 134/134.
- [x] Fresh full test/build suite on the exact resource-first diff: 633/633.
- [x] Authenticated local real-model browser E2E at desktop and 390px mobile:
  grouped three-add and mixed add/update/remove proposals, atomic confirmation,
  live Stop, post-cancel continuation, composer/card/drawer overflow checks.
- [x] Independent final backend/UI P0/P1 audits found no confirmed blocker.
- [ ] Publish the exact diff to the PR preview only after the local gates pass.

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

## Historical Manual Evidence (Not Rerun for This Slice)

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
