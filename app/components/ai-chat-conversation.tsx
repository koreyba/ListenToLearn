"use client";

import {
  type UIEvent as ReactUIEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChatSelectionActions } from "@/app/components/ai-chat-selection-actions";
import { AiChatComposer } from "@/app/components/ai-chat-composer";
import { AiChatWriteProposal } from "@/app/components/ai-chat-write-proposal";
import { InteractiveEnglishText } from "@/app/components/interactive-english-text";
import {
  useAiChatTurnController,
  type AiChatRefreshOptions,
} from "@/app/components/use-ai-chat-turn-controller";
import {
  aiChatUiMessageText,
  type AiChatClientDetail,
  type AiChatUiMetadata,
} from "@/lib/ai-chat/client";
import { aiChatApiError, requestAiChatJson } from "@/lib/ai-chat/client-http";
import { isSameChatSelection, type ChatTextSelection } from "@/lib/ai-chat/selection";

function generationFailureMessage(metadata: AiChatUiMetadata | undefined) {
  return aiChatApiError(
    { error: { code: metadata?.errorCode || undefined } },
    "The response failed.",
    metadata?.terminal || null,
  );
}

export function ChatConversation({
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
  refresh: (signal?: AbortSignal, options?: AiChatRefreshOptions) => Promise<AiChatClientDetail | null>;
  sidebarOpen: boolean;
}) {
  const [selection, setSelection] = useState<ChatTextSelection | null>(null);
  const [following, setFollowing] = useState(true);
  const [proposalDecision, setProposalDecision] = useState<{
    proposalId: string;
    decision: "confirm" | "cancel";
  } | null>(null);
  const [proposalErrors, setProposalErrors] = useState<Record<string, string>>({});
  const messageEnd = useRef<HTMLDivElement | null>(null);
  const followLatest = useCallback(() => setFollowing(true), []);
  const {
    cancelling,
    error,
    hasRetryableAssistantFailure,
    messages,
    recoverableOutbound,
    retry,
    retryRecoverableOutbound,
    sendDraft,
    status,
    stopPendingTurn,
    turnBusy,
    turnControlError,
    turnRecoveryNotice,
    updateDraft,
    waitingForResponse,
  } = useAiChatTurnController({
    chat,
    draft,
    generationConfigured,
    onDraftChange,
    onFollowLatest: followLatest,
    refresh,
  });

  useEffect(() => {
    if (following) messageEnd.current?.scrollIntoView({ block: "end" });
  }, [following, messages, status]);

  useEffect(() => {
    const dismiss = () => setSelection(null);
    window.addEventListener("resize", dismiss);
    return () => window.removeEventListener("resize", dismiss);
  }, []);

  async function decideWriteProposal(
    proposalId: string,
    command: { decision: "confirm" | "cancel" },
  ) {
    const { decision } = command;
    if (proposalDecision) return;
    setProposalDecision({ proposalId, decision });
    setProposalErrors((current) => ({ ...current, [proposalId]: "" }));
    try {
      await requestAiChatJson(`/api/ai/chats/${chat.id}/write-proposals/${proposalId}`, {
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
        <span className={`ai-chat-generation-status ${turnBusy ? "busy" : ""}`} aria-live="polite">
          {cancelling
            ? "Stopping"
            : status === "submitted"
            ? "Thinking"
            : status === "streaming"
              ? "Responding"
              : waitingForResponse ? "Waiting" : "Ready"}
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
                <div className="ai-chat-message-text" data-chat-message-id={message.id}>
                  <InteractiveEnglishText
                    markdown={message.role === "assistant"}
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
                </div>
              ) : !failed ? <span className="ai-chat-thinking">Preparing a response…</span> : null}
              {failed && (
                <div className="ai-chat-message-failure" role="alert">
                  <span>{generationFailureMessage(message.metadata)}</span>
                  <button
                    disabled={turnBusy || !generationConfigured}
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
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            messageEnd.current?.scrollIntoView({
              behavior: reduceMotion ? "auto" : "smooth",
              block: "end",
            });
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

      <AiChatComposer
        cancelling={cancelling}
        chatId={chat.id}
        draft={draft}
        generationConfigured={generationConfigured}
        onDraftChange={updateDraft}
        onExpand={() => setSelection(null)}
        onRetryRecoverable={() => void retryRecoverableOutbound()}
        onSend={sendDraft}
        onStop={stopPendingTurn}
        showRecoverableOutbound={Boolean(recoverableOutbound)}
        showRetryFailure={Boolean(
          error
          && hasRetryableAssistantFailure
          && !turnRecoveryNotice
          && !recoverableOutbound
        )}
        turnBusy={turnBusy}
        turnControlError={turnControlError}
        turnRecoveryNotice={turnRecoveryNotice}
      />
    </section>
  );
}
