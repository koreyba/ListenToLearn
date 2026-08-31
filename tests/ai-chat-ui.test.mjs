import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../app/components/ai-practice-chat.tsx", import.meta.url);
const selectionActionsUrl = new URL("../app/components/ai-chat-selection-actions.tsx", import.meta.url);
const phraseWorkspaceUrl = new URL("../app/components/phrase-workspace.tsx", import.meta.url);
const stylesUrl = new URL("../app/globals.css", import.meta.url);

test("signed-in chat uses AI SDK useChat with the compact canonical transport", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /useChat<AiChatUiMessage>/);
  assert.match(source, /new DefaultChatTransport/);
  assert.match(source, /prepareSendMessagesRequest: prepareAiChatMessageRequest/);
  assert.match(source, /\/api\/ai\/chats\/\$\{chat\.id\}\/messages/);
  assert.match(source, /sendMessage\(/);
  assert.match(source, /Retry/);
  assert.match(source, /provider_rate_limited/);
  assert.match(source, /turn_in_progress/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test("retryable terminal failures explain exact safe causes and stopped responses", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(
    source,
    /case "response_incomplete": return responseIncompleteMessage\(terminal\);/,
  );
  assert.match(
    source,
    /case "generation_cancelled": return "You stopped this response\. Retry it if needed\.";/,
  );
  assert.match(
    source,
    /case "generation_interrupted": return "The live connection was interrupted before the response was saved\. You can retry safely\.";/,
  );
  assert.match(
    source,
    /case "tool_timeout": return "The chat action timed out\. Nothing was changed\. You can continue or retry\.";/,
  );
  assert.match(
    source,
    /case "tool_failed": return "The chat action failed\. Nothing was changed\. You can continue or retry\.";/,
  );
  assert.match(
    source,
    /case "tool_budget_exceeded": return "This request needed more vocabulary lookups than one response can safely run\. Nothing was changed\. Split it into smaller requests\.";/,
  );
  assert.match(source, /case "length": return "The model reached its response limit before finishing\. Retry with a shorter request\.";/);
  assert.match(source, /case "content-filter": return "The provider stopped this response because of its safety filter\. Try rephrasing the request\.";/);
  assert.match(source, /case "tool-calls": return "The model stopped before it finished the requested vocabulary action\. Nothing was changed\.";/);
});

test("only explicit Stop cancels the server turn while transport errors reconcile quietly", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(
    source,
    /const activeClientMessageId = useRef<string \| null>\(canonicalPendingClientMessageId\)/,
  );
  assert.match(source, /const cancelPendingTurn = useCallback\(\(\) =>/);
  assert.match(
    source,
    /\/api\/ai\/chats\/\$\{encodeURIComponent\(chat\.id\)\}\/messages\/\$\{encodeURIComponent\(clientMessageId\)\}\/cancel/,
  );
  assert.match(source, /body: JSON\.stringify\(\{\}\)/);
  assert.match(source, /function stopPendingTurn\(\)/);
  assert.match(source, /stop\(\);\s*void cancelPendingTurn\(\);/s);
  assert.match(source, /onError: \(\) => void recoverPendingTurn\(\)/);
  assert.doesNotMatch(source, /onError: \(\) => void cancelPendingTurn\(\)/);
  assert.match(source, /shouldRecoverAiChatFinishedStream\(\{/);
  assert.match(source, /shouldSettleAiChatStreamFromCanonical\(\{/);
  assert.match(source, /setLocallyTerminalClientMessageId\(clientMessageId\);\s*updateActiveClientMessageId\(null\);\s*clearError\(\);\s*stop\(\);/s);
  assert.match(source, /recoverAiChatCanonicalTurn\(\{/);
  assert.match(source, /refresh\(signal, \{ quiet: true \}\)/);
  assert.match(source, /withAiChatCancelDeadline\(async \(signal\) =>/);
  assert.match(source, /signal,/);
  assert.match(source, /onClick=\{stopPendingTurn\}/);
});

test("stopping blocks a second send and rejected outbound text remains recoverable", async () => {
  const [source, styles] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(source, /const \[cancelling, setCancelling\] = useState\(false\)/);
  assert.match(source, /isAiChatTurnBlocked\(\{/);
  assert.match(source, /cancelling,/);
  assert.match(source, /aria-label=\{cancelling \? "Stopping response" : "Stop response"\}/);
  assert.match(source, /disabled=\{cancelling\}/);
  assert.match(source, /reconcileAiChatOutboundTurn\(\{/);
  assert.match(source, /preserveUnverifiedAiChatOutboundTurn\(\{/);
  assert.match(source, /Retry message/);
  assert.match(source, /Promise<AiChatClientDetail \| null>/);
  assert.match(styles, /\.ai-chat-outbound-recovery \{[^}]*display:\s*flex;/s);
  assert.match(styles, /\.ai-chat-outbound-recovery button \{[^}]*min-height:\s*44px;/s);
  assert.match(styles, /@media \(max-width: 760px\) \{[\s\S]*?\.ai-chat-outbound-recovery \{[^}]*flex-direction:\s*column;/s);
});

test("chat UI exposes separate list/dialog panes and contextual selection actions", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /<nav[^>]+aria-label="Practice chats"/s);
  assert.match(source, /id="ai-chat-sidebar"/);
  assert.match(source, /aria-controls="ai-chat-sidebar"/);
  assert.match(source, /aria-expanded=\{sidebarOpen\}/);
  assert.match(source, />New Chat<\/button>/);
  assert.match(source, /role="log"/);
  assert.match(source, /aria-relevant="additions text"/);
  assert.match(source, /className="ai-chat-composer"/);
  assert.match(source, /InteractiveEnglishText/);
  assert.match(source, /onWordActivate=/);
  assert.match(source, /ChatSelectionActions/);
  assert.doesNotMatch(source, /ai-chat-target-panel/);
  assert.doesNotMatch(source, /ai-chat-target-adders/);
  assert.doesNotMatch(source, /ai-chat-suggestions/);
  assert.doesNotMatch(source, /Add saved target|Add word or phrase|Meaning scope|Request ideas/);
});

test("agent writes render as inline proposal cards and confirm without another chat turn", async () => {
  const [source, styles] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);
  assert.match(source, /AiChatWriteProposal/);
  assert.match(source, /\(chat\.writeProposals \|\| \[\]\)\.filter\(/);
  assert.match(source, /write-proposals\/\$\{proposalId\}/);
  assert.match(source, /method:\s*"PATCH"/);
  assert.match(source, /decision:\s*"confirm"/);
  assert.match(source, /decision:\s*"cancel"/);
  assert.match(source, /await refresh\(\)/);
  assert.doesNotMatch(source, /sendMessage\([^)]*proposal/u);
  assert.match(styles, /\.ai-chat-write-proposal \{/);
  assert.match(styles, /\.ai-chat-write-proposal-actions/);
});

test("chat selection actions reuse DeepL and vocabulary APIs without a new provider path", async () => {
  const source = await readFile(selectionActionsUrl, "utf8");
  assert.match(source, /role="toolbar"/);
  assert.match(source, /"Translate"/);
  assert.match(source, /"Add to learning"/);
  assert.match(source, /Selected phrase/);
  assert.match(source, /"Word"/);
  assert.match(source, /"\/api\/translate"/);
  assert.match(source, /"\/api\/phrases"/);
  assert.doesNotMatch(source, /\/api\/ai\/translate/);
});

test("new chat and add-to-learning actions share the primary button treatment", async () => {
  const [chatSource, selectionSource, styles] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(selectionActionsUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(chatSource, /className="ai-chat-new ai-chat-primary-action"/);
  assert.match(chatSource, /<button className="ai-chat-primary-action"[\s\S]*?type="button">New Chat<\/button>/);
  assert.match(selectionSource, /className="primary ai-chat-primary-action"/);
  assert.match(styles, /\.ai-chat-primary-action \{[^}]*border:[^}]*border-radius:[^}]*background:[^}]*color:[^}]*font-weight:[^}]*box-shadow:/s);
});

test("chat styles provide responsive drawer, selection sheet, and comfortable targets", async () => {
  const source = await readFile(stylesUrl, "utf8");
  assert.doesNotMatch(source, /\.ai-chat-target(?:-|\s|,)/);
  assert.doesNotMatch(source, /\.ai-chat-suggestions(?:\s|\{|,)/);
  assert.match(source, /\.ai-chat-sidebar-overlay/);
  assert.match(source, /\.ai-chat-selection-actions/);
  assert.match(source, /\[data-interactive-english-word\]/);
  assert.match(source, /text-decoration-style:\s*dotted/);
  assert.match(source, /min-height:\s*44px/);
  assert.match(source, /env\(safe-area-inset-bottom\)/);
});

test("assistant messages opt into safe Markdown while user messages stay literal", async () => {
  const [source, styles] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(source, /markdown=\{message\.role === "assistant"\}/);
  assert.match(styles, /\.ai-chat-message-text \.interactive-english-text > :first-child \{ margin-top:\s*0; \}/);
  assert.match(styles, /\.ai-chat-message-text (?:ul|ol),/);
  assert.match(styles, /\.ai-chat-message-text code \{/);
  assert.match(styles, /\.ai-chat-message-text a \{/);
});

test("signed-out chat content starts below the navigation without stretching empty grid space", async () => {
  const source = await readFile(stylesUrl, "utf8");

  assert.match(source, /\.ai-chat-shell \{[^}]*align-content:\s*start;/s);
});

test("chat list never scrolls sideways and the compact status is a centered circle", async () => {
  const source = await readFile(stylesUrl, "utf8");

  assert.match(source, /\.ai-chat-list \{[^}]*min-width:\s*0;[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/s);
  assert.doesNotMatch(source, /\.ai-chat-list-item:hover \{[^}]*transform:/s);
  assert.match(source, /@media \(max-width: 760px\) \{[\s\S]*?\.ai-chat-generation-status \{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*flex:\s*0 0 32px;[^}]*gap:\s*0;[^}]*border-radius:\s*50%;/s);
});

test("chat feedback and transient surfaces expose truthful, interruptible states", async () => {
  const [chatSource, selectionSource, styles] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(selectionActionsUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(selectionSource, /const \[saveError, setSaveError\] = useState\(""\)/);
  assert.match(selectionSource, /saveError && <p className="ai-chat-selection-error" role="alert">/);
  assert.match(chatSource, /disabled=\{!draft\.trim\(\) \|\| turnBusy \|\| !generationConfigured\}/);
  assert.match(chatSource, /function closeSidebarOnEscape\(event: KeyboardEvent\)/);
  assert.match(chatSource, /event\.key !== "Escape"/);
  assert.match(chatSource, /setSidebarOpen\(false\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.ai-chat-list-loading i,[\s\S]*?animation:\s*none;/s);
});

test("chat switching is last-request-wins and refresh does not remount away drafts", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /openRequestId/);
  assert.match(source, /key=\{chat\.id\}/);
  assert.doesNotMatch(source, /key=\{`\$\{chat\.id\}:\$\{chat\.updatedAt\}`\}/);
  assert.match(source, /drafts/);
  assert.match(source, /window\.history\.(?:pushState|replaceState)/);
  assert.match(source, /isComposing/);
  assert.match(source, /shiftKey/);
});

test("a terminal stream stays visible until canonical history actually changes", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(source, /observeCanonicalMessages\(\s*observedCanonicalMessages\.current,\s*canonicalMessages,\s*busy,/s);
  assert.match(source, /observedCanonicalMessages\.current = sync\.observed/);
  assert.match(source, /if \(sync\.apply\) setMessages\(canonicalMessages\)/);
  assert.doesNotMatch(source, /if \(!busy\) setMessages\(canonicalMessages\)/);
});

test("compact composer has no internal scrollbar and expands into a full-screen editor", async () => {
  const [source, styles] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(source, /aria-label="Expand composer"/);
  assert.match(source, /aria-label="Close expanded composer"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /Compose message/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /useLayoutEffect/);
  assert.match(source, /readComposerSelection\(compactComposer\.current\)/);
  assert.match(source, /restoreComposerSelection\(expandedComposer\.current/);
  assert.match(source, /readComposerSelection\(expandedComposer\.current\)/);
  assert.match(source, /restoreComposerSelection\(compactComposer\.current/);
  assert.match(styles, /\.ai-chat-composer textarea \{[^}]*resize:\s*none;[^}]*overflow-y:\s*hidden;/s);
  assert.match(styles, /\.ai-chat-composer:focus-within \{[^}]*border-color:[^}]*box-shadow:/s);
  assert.doesNotMatch(styles, /\.ai-chat-workspace textarea:focus-visible/);
  assert.match(styles, /\.ai-chat-composer-dialog \{/);
  assert.match(styles, /\.ai-chat-composer-dialog-editor textarea \{/);
});

test("chat entry points do not preselect hidden practice targets", async () => {
  const [chatSource, phraseSource] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(phraseWorkspaceUrl, "utf8"),
  ]);
  assert.doesNotMatch(chatSource, /URLSearchParams|phraseId|AiChatTargetRequest/);
  assert.doesNotMatch(phraseSource, /Practice with AI|openAiPractice|\/chat\?/);
});
