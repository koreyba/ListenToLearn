"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type UIEvent as ReactUIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatSelectionActions } from "@/app/components/ai-chat-selection-actions";
import { AiChatWriteProposal } from "@/app/components/ai-chat-write-proposal";
import { InteractiveEnglishText } from "@/app/components/interactive-english-text";
import { SignedInSiteAccount } from "@/app/components/signed-in-site-account";
import { SiteNavigation } from "@/app/components/site-navigation";
import {
  aiChatUiMessageText,
  prepareAiChatMessageRequest,
  toAiChatUiMessages,
  type AiChatClientDetail,
  type AiChatClientSummary,
  type AiChatUiMessage,
} from "@/lib/ai-chat/client";
import { observeCanonicalMessages } from "@/lib/ai-chat/canonical-sync";
import {
  readComposerSelection,
  restoreComposerSelection,
  type ComposerSelection,
} from "@/lib/ai-chat/composer-selection";
import { isSameChatSelection, type ChatTextSelection } from "@/lib/ai-chat/selection";
import { interactiveEnglishContext, readInteractiveSelection } from "@/lib/interactive-english-text";
import { accountSession, signInHref, type AccountSessionUser } from "@/lib/client-session";

type ApiError = { error?: string | { code?: string } };
type HistoryMode = "none" | "push" | "replace";

function apiError(payload: ApiError, fallback: string) {
  if (typeof payload.error === "string") return payload.error;
  switch (payload.error?.code) {
    case "not_configured": return "AI generation is not configured.";
    case "provider_timeout": return "The model timed out. Retry the same message.";
    case "provider_rate_limited": return "The AI usage limit has been reached. Try again later.";
    case "turn_in_progress": return "Another message is still being answered in this chat.";
    case "provider_failed": return "The model could not answer. Retry the same message.";
    case "response_incomplete": return "The response ended before completion. Retry the same message.";
    case "generation_cancelled": return "The response was stopped. Retry it if needed.";
    case "conflict": return "This turn is already being processed. Reopen the chat.";
    default: return fallback;
  }
}

function generationFailureMessage(errorCode: string | null | undefined) {
  return apiError({ error: { code: errorCode || undefined } }, "The response failed.");
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(apiError(body, "The request could not be completed."));
  return body;
}

function asSummary(chat: AiChatClientDetail): AiChatClientSummary {
  return {
    id: chat.id,
    title: chat.title,
    explanationLanguage: chat.explanationLanguage,
    targetCount: chat.targetCount,
    messageCount: chat.messageCount,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

function selectedChatIdFromUrl() {
  return new URL(window.location.href).searchParams.get("chat") || "";
}

function updateChatUrl(chatId: string, mode: Exclude<HistoryMode, "none">) {
  const url = new URL(window.location.href);
  if (chatId) url.searchParams.set("chat", chatId);
  else url.searchParams.delete("chat");
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (mode === "push") window.history.pushState({}, "", next);
  else window.history.replaceState({}, "", next);
}

function chatListTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function closestMessageSurface(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest<HTMLElement>("[data-chat-message-id]") || null;
}

function ChatConversation({
  chat,
  draft,
  generationConfigured,
  onDraftChange,
  onOpenSidebar,
  refresh,
  sidebarOpen,
}: {
  chat: AiChatClientDetail;
  draft: string;
  generationConfigured: boolean;
  onDraftChange: (value: string) => void;
  onOpenSidebar: () => void;
  refresh: () => Promise<void>;
  sidebarOpen: boolean;
}) {
  const [selection, setSelection] = useState<ChatTextSelection | null>(null);
  const [following, setFollowing] = useState(true);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [proposalDecision, setProposalDecision] = useState<{
    proposalId: string;
    decision: "confirm" | "cancel";
  } | null>(null);
  const [proposalErrors, setProposalErrors] = useState<Record<string, string>>({});
  const compactComposer = useRef<HTMLTextAreaElement | null>(null);
  const expandedComposer = useRef<HTMLTextAreaElement | null>(null);
  const composerSelection = useRef<ComposerSelection | null>(null);
  const composerHasExpanded = useRef(false);
  const composerDialog = useRef<HTMLDivElement | null>(null);
  const expandComposerButton = useRef<HTMLButtonElement | null>(null);
  const messageEnd = useRef<HTMLDivElement | null>(null);
  const messageTexts = useRef(new Map<string, string>());
  const canonicalMessages = useMemo(() => toAiChatUiMessages(chat.messages), [chat.messages]);
  const observedCanonicalMessages = useRef(canonicalMessages);
  const transport = useMemo(() => new DefaultChatTransport<AiChatUiMessage>({
    api: `/api/ai/chats/${chat.id}/messages`,
    prepareSendMessagesRequest: prepareAiChatMessageRequest,
  }), [chat.id]);
  const {
    clearError,
    error,
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat<AiChatUiMessage>({
    id: chat.id,
    messages: canonicalMessages,
    transport,
    onFinish: () => void refresh(),
    onError: () => window.setTimeout(() => void refresh(), 0),
  });
  const busy = status === "submitted" || status === "streaming";

  useLayoutEffect(() => {
    const input = compactComposer.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.max(48, Math.min(input.scrollHeight, 112))}px`;
  }, [draft]);

  useEffect(() => {
    if (!composerExpanded) {
      if (!composerHasExpanded.current) return;
      const frame = window.requestAnimationFrame(() => {
        restoreComposerSelection(compactComposer.current, composerSelection.current);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    composerHasExpanded.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      restoreComposerSelection(expandedComposer.current, composerSelection.current);
    });

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        composerSelection.current = readComposerSelection(expandedComposer.current);
        setComposerExpanded(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = composerDialog.current;
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [composerExpanded]);

  useEffect(() => {
    messageTexts.current = new Map(
      messages.map((message) => [message.id, aiChatUiMessageText(message)]),
    );
  }, [messages]);

  useEffect(() => {
    const sync = observeCanonicalMessages(
      observedCanonicalMessages.current,
      canonicalMessages,
      busy,
    );
    observedCanonicalMessages.current = sync.observed;
    if (sync.apply) setMessages(canonicalMessages);
  }, [busy, canonicalMessages, setMessages]);

  useEffect(() => {
    if (following) messageEnd.current?.scrollIntoView({ block: "end" });
  }, [following, messages, status]);

  useEffect(() => {
    let frame = 0;
    function captureBrowserSelection() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nativeSelection = window.getSelection();
        if (!nativeSelection || nativeSelection.isCollapsed || nativeSelection.rangeCount !== 1) return;
        const range = nativeSelection.getRangeAt(0);
        const startSurface = closestMessageSurface(range.startContainer);
        const endSurface = closestMessageSurface(range.endContainer);
        if (!startSurface || startSurface !== endSurface) return;
        const messageId = startSurface.dataset.chatMessageId || "";
        const source = messageTexts.current.get(messageId) || "";
        const text = readInteractiveSelection(startSurface, nativeSelection, 500);
        if (!messageId || !source || !text) return;
        const prefix = range.cloneRange();
        prefix.selectNodeContents(startSurface);
        prefix.setEnd(range.startContainer, range.startOffset);
        const start = prefix.toString().length;
        const rect = range.getBoundingClientRect();
        const next: ChatTextSelection = {
          messageId,
          text,
          context: interactiveEnglishContext(source, start, start + range.toString().length),
          anchor: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        };
        setSelection((current) => isSameChatSelection(current, next) ? current : next);
      });
    }
    document.addEventListener("selectionchange", captureBrowserSelection);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", captureBrowserSelection);
    };
  }, [chat.id]);

  useEffect(() => {
    const dismiss = () => setSelection(null);
    window.addEventListener("resize", dismiss);
    return () => window.removeEventListener("resize", dismiss);
  }, []);

  async function sendDraft() {
    const text = draft.trim();
    if (!text || busy || !generationConfigured) return;
    onDraftChange("");
    clearError();
    setFollowing(true);
    await sendMessage({
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text }],
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendDraft();
  }

  function submitExpanded(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy || !generationConfigured) return;
    composerSelection.current = readComposerSelection(expandedComposer.current);
    setComposerExpanded(false);
    void sendDraft();
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter"
      || event.shiftKey
      || event.nativeEvent.isComposing
      || window.matchMedia("(pointer: coarse)").matches
    ) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function handleExpandedComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter"
      || (!event.metaKey && !event.ctrlKey)
      || event.nativeEvent.isComposing
    ) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function retry(clientMessageId: string) {
    const message = messages.find((item) => item.role === "user" && item.id === clientMessageId);
    if (!message || busy || !generationConfigured) return;
    clearError();
    setFollowing(true);
    await sendMessage({ text: aiChatUiMessageText(message), messageId: message.id });
  }

  async function decideWriteProposal(
    proposalId: string,
    command: { decision: "confirm" | "cancel" },
  ) {
    const { decision } = command;
    if (proposalDecision) return;
    setProposalDecision({ proposalId, decision });
    setProposalErrors((current) => ({ ...current, [proposalId]: "" }));
    try {
      await requestJson(`/api/ai/chats/${chat.id}/write-proposals/${proposalId}`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      await refresh();
    } catch (decisionError) {
      setProposalErrors((current) => ({
        ...current,
        [proposalId]: decisionError instanceof Error
          ? decisionError.message
          : "The proposal could not be updated. Try again.",
      }));
    } finally {
      setProposalDecision(null);
    }
  }

  function handleMessageScroll(event: ReactUIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
    setFollowing(nearBottom);
    if (selection) setSelection(null);
  }

  function chooseText(
    messageId: string,
    text: string,
    context: string,
    anchor: ChatTextSelection["anchor"],
  ) {
    const next = { messageId, text, context, anchor };
    setSelection((current) => isSameChatSelection(current, next) ? current : next);
  }

  return (
    <section className="ai-chat-conversation" aria-label={`Conversation: ${chat.title}`}>
      <header className="ai-chat-conversation-header">
        <button
          aria-controls="ai-chat-sidebar"
          aria-expanded={sidebarOpen}
          className="ai-chat-mobile-chats"
          onClick={onOpenSidebar}
          type="button"
        >
          <span aria-hidden="true">☰</span>
          Chats
        </button>
        <div>
          <span className="ai-chat-conversation-label">Vocabulary practice</span>
          <h2>{chat.title}</h2>
        </div>
        <span className={`ai-chat-generation-status ${busy ? "busy" : ""}`} aria-live="polite">
          {status === "submitted" ? "Thinking" : status === "streaming" ? "Responding" : "Ready"}
        </span>
      </header>

      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="ai-chat-messages"
        onScroll={handleMessageScroll}
        role="log"
      >
        {messages.length === 0 ? (
          <div className="ai-chat-empty">
            <strong>You lead the practice</strong>
            <span>Ask for examples, another context, an explanation, or a translation exercise.</span>
          </div>
        ) : messages.map((message) => {
          const text = aiChatUiMessageText(message);
          const failed = message.metadata?.status === "failed";
          const writeProposals = (chat.writeProposals || []).filter(
            (proposal) => proposal.assistantMessageId === message.id,
          );
          return (
            <article className={`ai-chat-message ${message.role}`} key={message.id}>
              <span className="ai-chat-message-role">{message.role === "user" ? "You" : "Unmumble AI"}</span>
              {text ? (
                <span className="ai-chat-message-text" data-chat-message-id={message.id}>
                  <InteractiveEnglishText
                    maxSelectionCharacters={500}
                    onPhraseSelect={(phrase, context, details) => chooseText(
                      message.id,
                      phrase,
                      context,
                      details.anchor,
                    )}
                    onWordActivate={(word, context, details) => chooseText(
                      message.id,
                      word,
                      context,
                      details.anchor,
                    )}
                    text={text}
                  />
                </span>
              ) : !failed ? <span className="ai-chat-thinking">Preparing a response…</span> : null}
              {failed && (
                <div className="ai-chat-message-failure" role="alert">
                  <span>{generationFailureMessage(message.metadata?.errorCode)}</span>
                  <button
                    disabled={busy || !generationConfigured}
                    onClick={() => void retry(message.metadata!.clientMessageId)}
                    type="button"
                  >Retry</button>
                </div>
              )}
              {writeProposals.map((proposal) => {
                const deciding = proposalDecision?.proposalId === proposal.id;
                const errorMessage = proposalErrors[proposal.id]
                  || (proposal.errorCode === "mutation_conflict"
                    ? "Your vocabulary changed after this proposal was prepared. Nothing was overwritten."
                    : undefined);
                return (
                  <AiChatWriteProposal
                    errorMessage={errorMessage}
                    items={proposal.items}
                    key={proposal.id}
                    onCancel={(proposalId) => void decideWriteProposal(proposalId, {
                      decision: "cancel",
                    })}
                    onConfirm={(proposalId) => void decideWriteProposal(proposalId, {
                      decision: "confirm",
                    })}
                    operation={proposal.operation}
                    proposalId={proposal.id}
                    result={proposal.result}
                    status={deciding ? "busy" : proposal.status}
                  />
                );
              })}
            </article>
          );
        })}
        <div aria-hidden="true" className="ai-chat-message-end" ref={messageEnd} />
      </div>

      {!following && (
        <button
          className="ai-chat-jump-latest"
          onClick={() => {
            setFollowing(true);
            messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
          }}
          type="button"
        >↓ Jump to latest</button>
      )}

      {selection && (
        <ChatSelectionActions
          key={`${selection.messageId}:${selection.text}:${selection.context}`}
          onDismiss={() => setSelection(null)}
          selection={selection}
        />
      )}

      <div className="ai-chat-composer-region">
        {!generationConfigured && (
          <p className="ai-chat-inline-error" role="status">AI generation is not configured on the server.</p>
        )}
        {error && <p className="ai-chat-inline-error" role="alert">The response failed. Retry it below.</p>}
        <form className="ai-chat-composer" onSubmit={submit}>
          <label className="ai-chat-visually-hidden" htmlFor={`ai-chat-message-${chat.id}`}>
            Your practice request
          </label>
          <div className={`ai-chat-composer-field ${draft ? "has-draft" : ""}`}>
            <textarea
              disabled={!generationConfigured}
              id={`ai-chat-message-${chat.id}`}
              maxLength={4_000}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Message Unmumble…"
              ref={compactComposer}
              rows={1}
              value={draft}
            />
            {draft && (
              <button
                aria-expanded={composerExpanded}
                aria-haspopup="dialog"
                aria-label="Expand composer"
                className="ai-chat-composer-expand"
                onClick={() => {
                  composerSelection.current = readComposerSelection(compactComposer.current);
                  setSelection(null);
                  setComposerExpanded(true);
                }}
                ref={expandComposerButton}
                type="button"
              >
                <span aria-hidden="true">⤢</span>
              </button>
            )}
          </div>
          {busy ? (
            <button aria-label="Stop response" className="ai-chat-stop" onClick={stop} type="button">
              <span aria-hidden="true">■</span>
            </button>
          ) : (
            <button
              aria-label="Send message"
              className="ai-chat-send"
              disabled={!draft.trim() || !generationConfigured}
              type="submit"
            >
              <span aria-hidden="true">↑</span>
            </button>
          )}
        </form>
        <p className="ai-chat-composer-hint">Enter to send · Shift+Enter for a new line</p>
      </div>

      {composerExpanded && (
        <div
          aria-labelledby={`ai-chat-composer-dialog-title-${chat.id}`}
          aria-modal="true"
          className="ai-chat-composer-dialog"
          ref={composerDialog}
          role="dialog"
        >
          <header>
            <div>
              <span>AI vocabulary practice</span>
              <h2 id={`ai-chat-composer-dialog-title-${chat.id}`}>Compose message</h2>
            </div>
            <button
              aria-label="Close expanded composer"
              onClick={() => {
                composerSelection.current = readComposerSelection(expandedComposer.current);
                setComposerExpanded(false);
              }}
              type="button"
            >×</button>
          </header>
          <form className="ai-chat-composer-dialog-editor" onSubmit={submitExpanded}>
            <label className="ai-chat-visually-hidden" htmlFor={`ai-chat-expanded-message-${chat.id}`}>
              Expanded practice request
            </label>
            <textarea
              id={`ai-chat-expanded-message-${chat.id}`}
              maxLength={4_000}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={handleExpandedComposerKeyDown}
              placeholder="Ask for an example, change the context, or write a longer answer…"
              ref={expandedComposer}
              value={draft}
            />
            <footer>
              <span>{draft.length.toLocaleString()} / 4,000</span>
              <span>⌘/Ctrl+Enter to send</span>
              <button disabled={!draft.trim() || busy || !generationConfigured} type="submit">
                Send message
                <span aria-hidden="true">↑</span>
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function ChatWorkspace() {
  const [chats, setChats] = useState<AiChatClientSummary[]>([]);
  const [chat, setChat] = useState<AiChatClientDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [generationConfigured, setGenerationConfigured] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openingChatId, setOpeningChatId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const bootstrapped = useRef(false);
  const createInFlight = useRef(false);
  const openRequestId = useRef(0);
  const openController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!sidebarOpen) return;
    function closeSidebarOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSidebarOpen(false);
    }
    document.addEventListener("keydown", closeSidebarOnEscape);
    return () => document.removeEventListener("keydown", closeSidebarOnEscape);
  }, [sidebarOpen]);

  const openChat = useCallback(async (chatId: string, historyMode: HistoryMode = "push") => {
    const requestId = ++openRequestId.current;
    openController.current?.abort();
    const controller = new AbortController();
    openController.current = controller;
    setOpeningChatId(chatId);
    setError("");
    try {
      const result = await requestJson<{ chat: AiChatClientDetail }>(`/api/ai/chats/${chatId}`, {
        signal: controller.signal,
      });
      if (requestId !== openRequestId.current) return;
      setChat(result.chat);
      setSidebarOpen(false);
      if (historyMode !== "none") updateChatUrl(chatId, historyMode);
    } catch (reason) {
      if (controller.signal.aborted || requestId !== openRequestId.current) return;
      setError(reason instanceof Error ? reason.message : "Could not open this chat.");
    } finally {
      if (requestId === openRequestId.current) {
        setOpeningChatId("");
        if (openController.current === controller) openController.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const requestId = ++openRequestId.current;
    const controller = new AbortController();
    openController.current = controller;
    void (async () => {
      try {
        const list = await requestJson<{
          chats: AiChatClientSummary[];
          generationConfigured: boolean;
        }>("/api/ai/chats", { signal: controller.signal });
        if (requestId !== openRequestId.current) return;
        setChats(list.chats);
        setGenerationConfigured(list.generationConfigured);
        const requestedId = selectedChatIdFromUrl();
        const targetId = list.chats.some((item) => item.id === requestedId)
          ? requestedId
          : list.chats[0]?.id || "";
        if (!targetId) {
          setChat(null);
          updateChatUrl("", "replace");
          return;
        }
        setOpeningChatId(targetId);
        const detail = await requestJson<{ chat: AiChatClientDetail }>(`/api/ai/chats/${targetId}`, {
          signal: controller.signal,
        });
        if (requestId !== openRequestId.current) return;
        setChat(detail.chat);
        updateChatUrl(targetId, "replace");
      } catch (reason) {
        if (!controller.signal.aborted && requestId === openRequestId.current) {
          setError(reason instanceof Error ? reason.message : "Could not load practice chats.");
        }
      } finally {
        if (requestId === openRequestId.current) {
          setOpeningChatId("");
          setInitialLoading(false);
        }
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function restoreUrlChat() {
      const chatId = selectedChatIdFromUrl();
      if (chatId) void openChat(chatId, "none");
    }
    window.addEventListener("popstate", restoreUrlChat);
    return () => window.removeEventListener("popstate", restoreUrlChat);
  }, [openChat]);

  useEffect(() => () => openController.current?.abort(), []);

  async function createChat() {
    if (createInFlight.current) return;
    createInFlight.current = true;
    setCreating(true);
    setError("");
    openController.current?.abort();
    ++openRequestId.current;
    try {
      const result = await requestJson<{ chat: AiChatClientDetail }>("/api/ai/chats", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setChat(result.chat);
      setChats((current) => [asSummary(result.chat), ...current.filter((item) => item.id !== result.chat.id)]);
      setSidebarOpen(false);
      updateChatUrl(result.chat.id, "push");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the chat.");
    } finally {
      createInFlight.current = false;
      setCreating(false);
    }
  }

  const refreshWorkspace = useCallback(async (chatId: string) => {
    const requestGuard = openRequestId.current;
    try {
      const [detail, list] = await Promise.all([
        requestJson<{ chat: AiChatClientDetail }>(`/api/ai/chats/${chatId}`),
        requestJson<{ chats: AiChatClientSummary[]; generationConfigured: boolean }>("/api/ai/chats"),
      ]);
      if (requestGuard !== openRequestId.current) return;
      setChat((current) => current?.id === chatId ? detail.chat : current);
      setChats(list.chats);
      setGenerationConfigured(list.generationConfigured);
    } catch (reason) {
      if (requestGuard === openRequestId.current) {
        setError(reason instanceof Error ? reason.message : "Could not refresh this chat.");
      }
    }
  }, []);

  return (
    <div className="ai-chat-workspace">
      <button
        aria-label="Close chat list"
        className={`ai-chat-sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        tabIndex={sidebarOpen ? 0 : -1}
        type="button"
      />
      <aside className={`ai-chat-sidebar ${sidebarOpen ? "open" : ""}`} id="ai-chat-sidebar">
        <div className="ai-chat-sidebar-heading">
          <div>
            <span>Practice space</span>
            <h2>Chats</h2>
          </div>
          <button
            aria-label="Close chat list"
            className="ai-chat-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            type="button"
          >×</button>
        </div>
        <button className="ai-chat-new ai-chat-primary-action" disabled={creating} onClick={() => void createChat()} type="button">New Chat</button>
        <nav aria-busy={initialLoading} aria-label="Practice chats" className="ai-chat-list">
          {initialLoading ? (
            <div className="ai-chat-list-loading" aria-label="Loading chats" role="status">
              <i /><i /><i />
            </div>
          ) : chats.length === 0 ? (
            <p className="ai-chat-list-empty">No chats yet. Start one when you are ready.</p>
          ) : (
            <ul>
              {chats.map((item) => (
                <li key={item.id}>
                  <button
                    aria-current={chat?.id === item.id ? "page" : undefined}
                    className={chat?.id === item.id ? "ai-chat-list-item active" : "ai-chat-list-item"}
                    disabled={openingChatId === item.id}
                    onClick={() => void openChat(item.id)}
                    type="button"
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.messageCount} {item.messageCount === 1 ? "message" : "messages"}
                      {chatListTime(item.updatedAt) ? ` · ${chatListTime(item.updatedAt)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>

      <section aria-busy={Boolean(openingChatId)} className="ai-chat-main">
        {error && <p className="ai-chat-inline-error ai-chat-workspace-error" role="alert">{error}</p>}
        {initialLoading ? (
          <div className="ai-chat-conversation-loading" aria-label="Loading conversation" role="status">
            <i /><i /><i />
          </div>
        ) : !chat ? (
          <div className="ai-chat-empty-panel">
            <span aria-hidden="true" className="ai-chat-empty-icon">✦</span>
            <h2>Start a conversation</h2>
            <p>Create a chat, choose a word or phrase, and practise it in a real context.</p>
            <button className="ai-chat-primary-action" disabled={creating} onClick={() => void createChat()} type="button">New Chat</button>
          </div>
        ) : (
          <ChatConversation
            chat={chat}
            draft={drafts[chat.id] || ""}
            generationConfigured={generationConfigured}
            key={chat.id}
            onDraftChange={(value) => setDrafts((current) => ({ ...current, [chat.id]: value }))}
            onOpenSidebar={() => setSidebarOpen(true)}
            refresh={() => refreshWorkspace(chat.id)}
            sidebarOpen={sidebarOpen}
          />
        )}
        {openingChatId && chat && openingChatId !== chat.id && (
          <div className="ai-chat-opening" role="status">Opening chat…</div>
        )}
      </section>
    </div>
  );
}

export function AiPracticeChat() {
  const [viewer, setViewer] = useState<AccountSessionUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [returnTo, setReturnTo] = useState("/chat");

  useEffect(() => {
    let active = true;
    void accountSession().then((user) => {
      if (!active) return;
      setReturnTo(`${window.location.pathname}${window.location.search}`);
      setViewer(user);
      setSessionReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const account = viewer
    ? <SignedInSiteAccount user={viewer} />
    : sessionReady
      ? <a className="site-account-link" href={signInHref(returnTo)}>Sign in</a>
      : <span aria-live="polite" className="site-account-name">Checking account…</span>;

  return (
    <>
      <SiteNavigation active="chat" account={account} />
      <main className="ai-chat-shell">
        <section className="ai-chat-intro" aria-labelledby="ai-chat-title">
          <div>
            <p className="ai-chat-kicker">AI vocabulary practice</p>
            <h1 id="ai-chat-title">Turn words into conversation</h1>
          </div>
          <p>Practice in context, then select any useful phrase to translate or add to learning.</p>
        </section>
        {!sessionReady ? (
          <p aria-live="polite" className="ai-chat-account-state">Checking your account…</p>
        ) : viewer ? <ChatWorkspace /> : (
          <section className="ai-chat-sign-in">
            <h2>Keep the words and the conversation together</h2>
            <p>Sign in with Google to start and keep your practice chats.</p>
            <a className="landing-button landing-button-primary" href={signInHref(returnTo)}>
              Sign in with Google
            </a>
          </section>
        )}
      </main>
    </>
  );
}
