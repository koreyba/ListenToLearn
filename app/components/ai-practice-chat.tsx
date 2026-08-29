"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractiveEnglishText } from "@/app/components/interactive-english-text";
import { SignedInSiteAccount } from "@/app/components/signed-in-site-account";
import { SiteNavigation } from "@/app/components/site-navigation";
import {
  aiChatUiMessageText,
  prepareAiChatMessageRequest,
  toAiChatTargetInput,
  toAiChatUiMessages,
  type AiChatClientDetail,
  type AiChatClientMeaning,
  type AiChatClientSummary,
  type AiChatClientTarget,
  type AiChatTargetRequest,
  type AiChatUiMessage,
} from "@/lib/ai-chat/client";
import type { AiChatMeaningMode } from "@/lib/ai-chat/contracts";
import { accountSession, signInHref, type AccountSessionUser } from "@/lib/client-session";
import { matchesInteractiveSelection } from "@/lib/interactive-english-text";

type PhraseStatus = "pick" | "to_learn" | "learning_now" | "learnt";
type Phrase = { id: string; text: string; translation: string; status: PhraseStatus };
type ApiError = { error?: string | { code?: string } };
type Selection = {
  text: string;
  context: string;
  translation: string;
  pending: boolean;
  error: string;
};

const meaningModeLabels: Record<AiChatMeaningMode, string> = {
  all_saved: "All saved meanings",
  selected: "One saved meaning",
  explore: "Explore a new meaning",
};

const statusLabels: Array<{ value: Exclude<PhraseStatus, "pick">; label: string }> = [
  { value: "to_learn", label: "To Learn" },
  { value: "learning_now", label: "Learning Now" },
  { value: "learnt", label: "Learned" },
];

function apiError(payload: ApiError, fallback: string) {
  if (typeof payload.error === "string") return payload.error;
  switch (payload.error?.code) {
    case "not_configured": return "AI generation is not configured.";
    case "provider_timeout": return "The model timed out. Retry the same message.";
    case "provider_failed": return "The model could not answer. Retry the same message.";
    case "conflict": return "This turn is already being processed. Reopen the chat.";
    default: return fallback;
  }
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

async function translateSelectionRequest(text: string, context: string) {
  const request = {
    method: "POST",
    body: JSON.stringify({ text, context }),
  } satisfies RequestInit;
  const response = await fetch("/api/translate", {
    ...request,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  const result = await response.json().catch(() => ({})) as { translation?: string } & ApiError;
  if (response.ok && result.translation) return { translation: result.translation };
  if (response.status !== 503) {
    throw new Error(apiError(result, "Could not translate the selection."));
  }
  return requestJson<{ translation: string }>("/api/ai/translate", request);
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

function targetWithMode(
  target: AiChatClientTarget,
  meaningMode: AiChatMeaningMode,
  selectedMeaningId?: string,
): AiChatTargetRequest {
  if (!target.phraseId) {
    return { text: target.text, meaningMode: meaningMode === "selected" ? "explore" : meaningMode };
  }
  return meaningMode === "selected"
    ? { phraseId: target.phraseId, meaningMode, selectedMeaningId: selectedMeaningId || "" }
    : { phraseId: target.phraseId, meaningMode };
}

function ChatConversation({
  chat,
  generationConfigured,
  refresh,
  selectText,
}: {
  chat: AiChatClientDetail;
  generationConfigured: boolean;
  refresh: () => Promise<void>;
  selectText: (text: string, context: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const initialMessages = useMemo(() => toAiChatUiMessages(chat.messages), [chat.messages]);
  const transport = useMemo(() => new DefaultChatTransport<AiChatUiMessage>({
    api: `/api/ai/chats/${chat.id}/messages`,
    prepareSendMessagesRequest: prepareAiChatMessageRequest,
  }), [chat.id]);
  const { clearError, error, messages, sendMessage, status } = useChat<AiChatUiMessage>({
    id: chat.id,
    messages: initialMessages,
    transport,
    onFinish: () => void refresh(),
    onError: () => window.setTimeout(() => void refresh(), 0),
  });
  const busy = status === "submitted" || status === "streaming";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || !generationConfigured) return;
    setDraft("");
    clearError();
    await sendMessage({
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text }],
    });
  }

  async function retry(clientMessageId: string) {
    const message = messages.find((item) => item.role === "user" && item.id === clientMessageId);
    if (!message || busy || !generationConfigured) return;
    clearError();
    await sendMessage({ text: aiChatUiMessageText(message), messageId: message.id });
  }

  return (
    <section className="ai-chat-conversation" aria-label="Practice conversation">
      <div className="ai-chat-messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="ai-chat-empty">
            <strong>You lead the practice</strong>
            <span>Ask for examples, another context, an explanation, or a translation exercise.</span>
          </div>
        ) : messages.map((message) => {
          const text = aiChatUiMessageText(message);
          const failed = message.metadata?.status === "failed";
          return (
            <article className={`ai-chat-message ${message.role}`} key={message.id}>
              <span className="ai-chat-message-role">{message.role === "user" ? "You" : "AI"}</span>
              {message.role === "assistant" && text ? (
                <InteractiveEnglishText
                  onPhraseSelect={selectText}
                  onWordActivate={selectText}
                  text={text}
                />
              ) : text ? <span>{text}</span> : !failed ? <span>Preparing a response…</span> : null}
              {failed && (
                <div className="ai-chat-message-failure" role="alert">
                  <span>The response failed.</span>
                  <button
                    disabled={busy || !generationConfigured}
                    onClick={() => void retry(message.metadata!.clientMessageId)}
                    type="button"
                  >Retry</button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="ai-chat-suggestions" aria-label="Request ideas">
        {[
          "Give me another example.",
          "Use a different context.",
          "Write a Russian sentence for me to translate into English.",
        ].map((suggestion) => (
          <button key={suggestion} onClick={() => setDraft(suggestion)} type="button">{suggestion}</button>
        ))}
      </div>
      {!generationConfigured && (
        <p className="ai-chat-inline-error" role="status">AI generation is not configured on the server.</p>
      )}
      {error && <p className="ai-chat-inline-error" role="alert">The response failed. Retry it below.</p>}
      <form className="ai-chat-composer" onSubmit={submit}>
        <label htmlFor={`ai-chat-message-${chat.id}`}>Your practice request</label>
        <textarea
          disabled={!generationConfigured}
          id={`ai-chat-message-${chat.id}`}
          maxLength={4_000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask for an example, change the context, or answer an exercise…"
          rows={3}
          value={draft}
        />
        <button disabled={!draft.trim() || busy || !generationConfigured} type="submit">
          {busy ? "Thinking…" : "Send"}
        </button>
      </form>
    </section>
  );
}

function ChatWorkspace() {
  const [chats, setChats] = useState<AiChatClientSummary[]>([]);
  const [chat, setChat] = useState<AiChatClientDetail | null>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [meanings, setMeanings] = useState<Record<string, AiChatClientMeaning[]>>({});
  const [generationConfigured, setGenerationConfigured] = useState(false);
  const [savedPhraseId, setSavedPhraseId] = useState("");
  const [adHocText, setAdHocText] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [meaningPhraseId, setMeaningPhraseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bootstrapped = useRef(false);

  const loadMeanings = useCallback(async (phraseId: string) => {
    const result = await requestJson<{ meanings: AiChatClientMeaning[] }>(
      `/api/ai/meanings?phraseId=${encodeURIComponent(phraseId)}`,
    );
    setMeanings((current) => ({ ...current, [phraseId]: result.meanings }));
    return result.meanings;
  }, []);

  const openChat = useCallback(async (chatId: string) => {
    const result = await requestJson<{ chat: AiChatClientDetail }>(`/api/ai/chats/${chatId}`);
    setChat(result.chat);
    const phraseIds = [...new Set(result.chat.targets.flatMap((target) =>
      target.phraseId ? [target.phraseId] : []))];
    await Promise.all(phraseIds.map((phraseId) => loadMeanings(phraseId).catch(() => [])));
    return result.chat;
  }, [loadMeanings]);

  const loadChats = useCallback(async (selectedId?: string) => {
    const result = await requestJson<{
      chats: AiChatClientSummary[];
      generationConfigured: boolean;
    }>("/api/ai/chats");
    setChats(result.chats);
    setGenerationConfigured(result.generationConfigured);
    const chatId = selectedId || result.chats[0]?.id;
    if (chatId) await openChat(chatId);
    else setChat(null);
  }, [openChat]);

  const loadPhrases = useCallback(async () => {
    const result = await requestJson<{ phrases: Phrase[] }>("/api/phrases");
    setPhrases(result.phrases);
    setSavedPhraseId((current) => current || result.phrases[0]?.id || "");
    return result.phrases;
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void (async () => {
      setBusy(true);
      try {
        await loadPhrases();
        const params = new URLSearchParams(window.location.search);
        const phraseId = params.get("phraseId");
        if (phraseId) {
          const result = await requestJson<{ chat: AiChatClientDetail }>("/api/ai/chats", {
            method: "POST",
            body: JSON.stringify({ targets: [{ phraseId, meaningMode: "all_saved" }] }),
          });
          setChat(result.chat);
          await loadChats(result.chat.id);
          window.history.replaceState(null, "", "/chat");
        } else {
          await loadChats();
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load practice chats.");
      } finally {
        setBusy(false);
      }
    })();
  }, [loadChats, loadPhrases]);

  async function createChat(targets: AiChatTargetRequest[] = []) {
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<{ chat: AiChatClientDetail }>("/api/ai/chats", {
        method: "POST",
        body: JSON.stringify({ targets }),
      });
      setChat(result.chat);
      setChats((current) => [asSummary(result.chat), ...current]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the chat.");
    } finally {
      setBusy(false);
    }
  }

  async function replaceTargets(targets: AiChatTargetRequest[]) {
    if (!chat) return;
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<{ targets: AiChatClientTarget[] }>(
        `/api/ai/chats/${chat.id}/targets`,
        { method: "PATCH", body: JSON.stringify({ targets }) },
      );
      const updated = {
        ...chat,
        targets: result.targets,
        targetCount: result.targets.length,
        updatedAt: new Date().toISOString(),
      };
      setChat(updated);
      setChats((current) => current.map((item) => item.id === updated.id ? asSummary(updated) : item));
      await Promise.all(result.targets.flatMap((target) => target.phraseId
        ? [loadMeanings(target.phraseId).catch(() => [])]
        : []));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the practice set.");
    } finally {
      setBusy(false);
    }
  }

  async function addSavedTarget() {
    if (!chat || !savedPhraseId || chat.targets.some((target) => target.phraseId === savedPhraseId)) return;
    await replaceTargets([
      ...chat.targets.map(toAiChatTargetInput),
      { phraseId: savedPhraseId, meaningMode: "all_saved" },
    ]);
  }

  async function addAdHocTarget(event: FormEvent) {
    event.preventDefault();
    const text = adHocText.trim();
    if (!chat || !text) return;
    await replaceTargets([...chat.targets.map(toAiChatTargetInput), { text, meaningMode: "explore" }]);
    setAdHocText("");
  }

  async function changeMode(target: AiChatClientTarget, mode: AiChatMeaningMode) {
    if (!chat) return;
    let selectedId: string | undefined;
    if (mode === "selected" && target.phraseId) {
      const available = meanings[target.phraseId] || await loadMeanings(target.phraseId);
      selectedId = target.selectedMeaning?.id || available[0]?.id || undefined;
      if (!selectedId) {
        setError("Add a meaning before selecting one meaning for this target.");
        return;
      }
    }
    await replaceTargets(chat.targets.map((item) => item.id === target.id
      ? targetWithMode(item, mode, selectedId)
      : toAiChatTargetInput(item)));
  }

  async function selectMeaning(target: AiChatClientTarget, selectedId: string) {
    if (!chat) return;
    await replaceTargets(chat.targets.map((item) => item.id === target.id
      ? targetWithMode(item, "selected", selectedId)
      : toAiChatTargetInput(item)));
  }

  async function changeStatus(phraseId: string, status: Exclude<PhraseStatus, "pick">) {
    setBusy(true);
    try {
      await requestJson("/api/phrases", {
        method: "PATCH",
        body: JSON.stringify({ id: phraseId, status }),
      });
      setPhrases((current) => current.map((phrase) => phrase.id === phraseId
        ? { ...phrase, status }
        : phrase));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not change the status.");
    } finally {
      setBusy(false);
    }
  }

  function translateSelection(text: string, context: string) {
    const firstSavedTarget = chat?.targets.find((target) => target.phraseId);
    setMeaningPhraseId(firstSavedTarget?.phraseId || "");
    setSelection({ text, context, translation: "", pending: true, error: "" });
    void translateSelectionRequest(text, context).then((result) => setSelection((current) => matchesInteractiveSelection(current, text, context)
      ? { ...current, translation: result.translation, pending: false }
      : current)).catch((reason) => setSelection((current) => matchesInteractiveSelection(current, text, context)
      ? {
          ...current,
          pending: false,
          error: reason instanceof Error ? reason.message : "Could not translate the selection.",
        }
      : current));
  }

  async function addToLearn() {
    if (!selection?.translation) return;
    setBusy(true);
    try {
      await requestJson("/api/phrases", {
        method: "POST",
        body: JSON.stringify({
          text: selection.text,
          translation: selection.translation,
          context: selection.context,
        }),
      });
      await loadPhrases();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add the selection.");
    } finally {
      setBusy(false);
    }
  }

  async function addMeaning() {
    if (!selection?.translation || !meaningPhraseId) return;
    setBusy(true);
    try {
      await requestJson("/api/ai/meanings", {
        method: "POST",
        body: JSON.stringify({
          phraseId: meaningPhraseId,
          translation: selection.translation,
          context: selection.context,
        }),
      });
      await Promise.all([loadMeanings(meaningPhraseId), chat ? openChat(chat.id) : Promise.resolve()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add the meaning.");
    } finally {
      setBusy(false);
    }
  }

  const savedTargets = chat?.targets.filter((target) => target.phraseId) || [];

  return (
    <div className="ai-chat-workspace">
      <aside className="ai-chat-sidebar" aria-label="Practice chats">
        <div className="ai-chat-sidebar-heading">
          <h2>Chats</h2>
          <button disabled={busy} onClick={() => void createChat()} type="button">New chat</button>
        </div>
        {chats.map((item) => (
          <button
            aria-current={chat?.id === item.id ? "page" : undefined}
            className={chat?.id === item.id ? "ai-chat-list-item active" : "ai-chat-list-item"}
            key={item.id}
            onClick={() => void openChat(item.id)}
            type="button"
          >
            <strong>{item.title}</strong>
            <span>{item.targetCount} targets · {item.messageCount} messages</span>
          </button>
        ))}
      </aside>

      <section className="ai-chat-main">
        {error && <p className="ai-chat-inline-error" role="alert">{error}</p>}
        {!chat ? (
          <div className="ai-chat-empty-panel">
            <h2>Start with a word—or start empty</h2>
            <p>Create a chat, then add one or several saved words and phrases.</p>
            <button disabled={busy} onClick={() => void createChat()} type="button">New chat</button>
          </div>
        ) : (
          <>
            <section className="ai-chat-target-panel" aria-labelledby="ai-chat-targets-title">
              <div className="ai-chat-panel-heading">
                <div>
                  <p className="ai-chat-kicker">Current practice set</p>
                  <h2 id="ai-chat-targets-title">{chat.title}</h2>
                </div>
                <span>{chat.targets.length} / 12 targets</span>
              </div>
              <div className="ai-chat-target-adders">
                <div>
                  <label htmlFor="ai-chat-saved-target">Add saved target</label>
                  <select
                    id="ai-chat-saved-target"
                    onChange={(event) => setSavedPhraseId(event.target.value)}
                    value={savedPhraseId}
                  >
                    {phrases.map((phrase) => <option key={phrase.id} value={phrase.id}>{phrase.text}</option>)}
                  </select>
                  <button disabled={busy || !savedPhraseId} onClick={() => void addSavedTarget()} type="button">
                    Add saved target
                  </button>
                </div>
                <form onSubmit={addAdHocTarget}>
                  <label htmlFor="ai-chat-ad-hoc">Add word or phrase</label>
                  <input
                    id="ai-chat-ad-hoc"
                    maxLength={240}
                    onChange={(event) => setAdHocText(event.target.value)}
                    placeholder="Not saved yet"
                    value={adHocText}
                  />
                  <button disabled={busy || !adHocText.trim()} type="submit">Add word or phrase</button>
                </form>
              </div>
              <div className="ai-chat-targets">
                {chat.targets.map((target) => {
                  const phrase = target.phraseId
                    ? phrases.find((item) => item.id === target.phraseId)
                    : null;
                  const targetMeanings = target.phraseId ? meanings[target.phraseId] || [] : [];
                  return (
                    <article className="ai-chat-target" key={target.id}>
                      <div><strong>{target.text}</strong><span>{target.phraseId ? "Saved" : "Chat only"}</span></div>
                      <label>
                        <span>Meaning scope</span>
                        <select
                          onChange={(event) => void changeMode(target, event.target.value as AiChatMeaningMode)}
                          value={target.meaningMode}
                        >
                          <option value="all_saved">{meaningModeLabels.all_saved}</option>
                          {target.phraseId && <option value="selected">{meaningModeLabels.selected}</option>}
                          <option value="explore">{meaningModeLabels.explore}</option>
                        </select>
                      </label>
                      {target.meaningMode === "selected" && target.phraseId && (
                        <label>
                          <span>Selected meaning</span>
                          <select
                            onChange={(event) => void selectMeaning(target, event.target.value)}
                            value={target.selectedMeaning?.id || ""}
                          >
                            {targetMeanings.map((meaning) => (
                              <option key={meaning.id || meaning.translation} value={meaning.id || ""}>
                                {meaning.translation}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {phrase && (
                        <label>
                          <span>Manual status</span>
                          <select
                            onChange={(event) => void changeStatus(
                              phrase.id,
                              event.target.value as Exclude<PhraseStatus, "pick">,
                            )}
                            value={phrase.status === "pick" ? "" : phrase.status}
                          >
                            {phrase.status === "pick" && <option value="" disabled>Not in Practice</option>}
                            {statusLabels.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button
                        className="ai-chat-target-remove"
                        disabled={busy}
                        onClick={() => void replaceTargets(chat.targets
                          .filter((item) => item.id !== target.id)
                          .map(toAiChatTargetInput))}
                        type="button"
                      >Remove</button>
                    </article>
                  );
                })}
              </div>
            </section>

            <ChatConversation
              chat={chat}
              generationConfigured={generationConfigured}
              key={`${chat.id}:${chat.updatedAt}`}
              refresh={async () => {
                await Promise.all([openChat(chat.id), loadChats(chat.id)]);
              }}
              selectText={translateSelection}
            />

            {selection && (
              <aside className="ai-chat-selection" aria-live="polite">
                <div><span>Selected</span><strong>{selection.text}</strong></div>
                {selection.pending ? <p>Translating…</p> : selection.error ? (
                  <p className="ai-chat-inline-error" role="alert">{selection.error}</p>
                ) : <p>{selection.translation}</p>}
                <div className="ai-chat-selection-actions">
                  <button disabled={busy || !selection.translation} onClick={() => void addToLearn()} type="button">
                    Add to Learn
                  </button>
                  {savedTargets.length > 0 && (
                    <>
                      <label>
                        <span>Attach to</span>
                        <select onChange={(event) => setMeaningPhraseId(event.target.value)} value={meaningPhraseId}>
                          {savedTargets.map((target) => (
                            <option key={target.id} value={target.phraseId || ""}>{target.text}</option>
                          ))}
                        </select>
                      </label>
                      <button disabled={busy || !selection.translation} onClick={() => void addMeaning()} type="button">
                        Add meaning
                      </button>
                    </>
                  )}
                  <button className="secondary" onClick={() => setSelection(null)} type="button">Close</button>
                </div>
              </aside>
            )}
          </>
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
          <p className="ai-chat-kicker">AI vocabulary practice</p>
          <h1 id="ai-chat-title">Practice words in context</h1>
          <p>Bring one or several words and phrases. You lead; AI supplies contexts and feedback.</p>
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
