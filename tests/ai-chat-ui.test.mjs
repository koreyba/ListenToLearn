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
  assert.match(chatSource, /disabled=\{!draft\.trim\(\) \|\| busy \|\| !generationConfigured\}/);
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
