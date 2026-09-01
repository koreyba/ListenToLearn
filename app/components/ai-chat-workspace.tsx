"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatConversation } from "@/app/components/ai-chat-conversation";
import type { AiChatRefreshOptions } from "@/app/components/use-ai-chat-turn-controller";
import {
  type AiChatClientDetail,
  type AiChatClientSummary,
} from "@/lib/ai-chat/client";
import { requestAiChatJson } from "@/lib/ai-chat/client-http";

type HistoryMode = "none" | "push" | "replace";

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

export function ChatWorkspace() {
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
      const result = await requestAiChatJson<{ chat: AiChatClientDetail }>(`/api/ai/chats/${chatId}`, {
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
        const list = await requestAiChatJson<{
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
        const detail = await requestAiChatJson<{ chat: AiChatClientDetail }>(`/api/ai/chats/${targetId}`, {
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
      const result = await requestAiChatJson<{ chat: AiChatClientDetail }>("/api/ai/chats", {
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

  const refreshWorkspace = useCallback(async (
    chatId: string,
    signal?: AbortSignal,
    options?: AiChatRefreshOptions,
  ): Promise<AiChatClientDetail | null> => {
    const requestGuard = openRequestId.current;
    try {
      const [detail, list] = await Promise.all([
        requestAiChatJson<{ chat: AiChatClientDetail }>(`/api/ai/chats/${chatId}`, { signal }),
        options?.detailOnly
          ? Promise.resolve(null)
          : requestAiChatJson<{ chats: AiChatClientSummary[]; generationConfigured: boolean }>(
              "/api/ai/chats",
              { signal },
            ),
      ]);
      if (requestGuard !== openRequestId.current) return null;
      setChat((current) => current?.id === chatId ? detail.chat : current);
      if (list) {
        setChats(list.chats);
        setGenerationConfigured(list.generationConfigured);
      } else {
        setChats((current) => [
          asSummary(detail.chat),
          ...current.filter((item) => item.id !== detail.chat.id),
        ]);
      }
      setError("");
      return detail.chat;
    } catch (reason) {
      if (!options?.quiet && !signal?.aborted && requestGuard === openRequestId.current) {
        setError(reason instanceof Error ? reason.message : "Could not refresh this chat.");
      }
      return null;
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
            refresh={(signal, options) => refreshWorkspace(chat.id, signal, options)}
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
