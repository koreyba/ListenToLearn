"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { accountSession, signInHref, type AccountSessionUser } from "@/lib/client-session";

type ApiError = { error?: string | { code?: string } };

function apiError(payload: ApiError, fallback: string) {
  if (typeof payload.error === "string") return payload.error;
  switch (payload.error?.code) {
    case "not_configured": return "AI generation is not configured.";
    case "provider_timeout": return "The model timed out. Retry the same message.";
    case "provider_rate_limited": return "The AI usage limit has been reached. Try again later.";
    case "turn_in_progress": return "Another message is still being answered in this chat.";
    case "provider_failed": return "The model could not answer. Retry the same message.";
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

function ChatConversation({
  chat,
  generationConfigured,
  refresh,
}: {
  chat: AiChatClientDetail;
  generationConfigured: boolean;
  refresh: () => Promise<void>;
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
              {text ? <span>{text}</span> : !failed ? <span>Preparing a response…</span> : null}
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
            </article>
          );
        })}
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
  const [generationConfigured, setGenerationConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bootstrapped = useRef(false);

  const openChat = useCallback(async (chatId: string) => {
    const result = await requestJson<{ chat: AiChatClientDetail }>(`/api/ai/chats/${chatId}`);
    setChat(result.chat);
    return result.chat;
  }, []);

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

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void (async () => {
      setBusy(true);
      try {
        await loadChats();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load practice chats.");
      } finally {
        setBusy(false);
      }
    })();
  }, [loadChats]);

  async function createChat() {
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<{ chat: AiChatClientDetail }>("/api/ai/chats", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setChat(result.chat);
      setChats((current) => [asSummary(result.chat), ...current]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the chat.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-chat-workspace">
      <aside className="ai-chat-sidebar" aria-label="Practice chats">
        <div className="ai-chat-sidebar-heading">
          <h2>Chats</h2>
          <button disabled={busy} onClick={() => void createChat()} type="button">New Chat</button>
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
            <span>{item.messageCount} messages</span>
          </button>
        ))}
      </aside>

      <section className="ai-chat-main">
        {error && <p className="ai-chat-inline-error" role="alert">{error}</p>}
        {!chat ? (
          <div className="ai-chat-empty-panel">
            <h2>Start a conversation</h2>
            <p>Create a chat and tell the AI what you want to practice.</p>
            <button disabled={busy} onClick={() => void createChat()} type="button">New Chat</button>
          </div>
        ) : (
          <ChatConversation
            chat={chat}
            generationConfigured={generationConfigured}
            key={`${chat.id}:${chat.updatedAt}`}
            refresh={async () => {
              await Promise.all([openChat(chat.id), loadChats(chat.id)]);
            }}
          />
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
