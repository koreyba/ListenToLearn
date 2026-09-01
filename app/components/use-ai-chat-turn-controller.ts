"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AI_CHAT_CANONICAL_RECOVERY_WINDOW_MS,
  aiChatUiMessageText,
  isAiChatTurnBlocked,
  preserveUnverifiedAiChatOutboundTurn,
  prepareAiChatMessageRequest,
  recoverAiChatCanonicalTurn,
  reconcileAiChatOutboundTurn,
  shouldRecoverAiChatFinishedStream,
  shouldSettleAiChatStreamFromCanonical,
  toAiChatUiMessages,
  withAiChatCancelDeadline,
  type AiChatClientDetail,
  type AiChatOutboundTurn,
  type AiChatUiMessage,
} from "@/lib/ai-chat/client";
import { observeCanonicalMessages } from "@/lib/ai-chat/canonical-sync";
import { requestAiChatJson } from "@/lib/ai-chat/client-http";

export type AiChatRefreshOptions = { quiet?: boolean; detailOnly?: boolean };

type TurnControllerOptions = {
  chat: AiChatClientDetail;
  draft: string;
  generationConfigured: boolean;
  onDraftChange: (value: string) => void;
  onFollowLatest: () => void;
  refresh: (
    signal?: AbortSignal,
    options?: AiChatRefreshOptions,
  ) => Promise<AiChatClientDetail | null>;
};

export function useAiChatTurnController({
  chat,
  draft,
  generationConfigured,
  onDraftChange,
  onFollowLatest,
  refresh,
}: TurnControllerOptions) {
  const [turnControlError, setTurnControlError] = useState("");
  const [turnRecoveryNotice, setTurnRecoveryNotice] = useState("");
  const [recoverableOutbound, setRecoverableOutbound] = useState<AiChatOutboundTurn | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [locallyTerminalClientMessageId, setLocallyTerminalClientMessageId] = useState<string | null>(null);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const canonicalMessages = useMemo(() => toAiChatUiMessages(chat.messages), [chat.messages]);
  const canonicalPendingClientMessageId = useMemo(() => (
    [...chat.messages].reverse().find((message) => (
      message.role === "assistant" && message.status === "pending"
    ))?.clientMessageId || null
  ), [chat.messages]);
  const effectiveCanonicalPendingClientMessageId = canonicalPendingClientMessageId
    === locallyTerminalClientMessageId
    ? null
    : canonicalPendingClientMessageId;

  const observedCanonicalMessages = useRef(canonicalMessages);
  const activeClientMessageId = useRef<string | null>(canonicalPendingClientMessageId);
  const [activeClientMessageIdState, setActiveClientMessageIdState] = useState<string | null>(
    canonicalPendingClientMessageId,
  );
  const outboundTurn = useRef<AiChatOutboundTurn | null>(null);
  const retryTerminalBaseline = useRef<{
    clientMessageId: string;
    updatedAt: string;
  } | null>(null);
  const activeCancellation = useRef<Promise<void> | null>(null);
  const activeRecovery = useRef<Promise<void> | null>(null);
  const activeRecoveryController = useRef<AbortController | null>(null);

  useEffect(() => () => {
    activeRecoveryController.current?.abort();
  }, [chat.id]);

  const transport = useMemo(() => new DefaultChatTransport<AiChatUiMessage>({
    api: `/api/ai/chats/${chat.id}/messages`,
    prepareSendMessagesRequest: prepareAiChatMessageRequest,
  }), [chat.id]);

  const updateDraft = useCallback((value: string) => {
    draftRef.current = value;
    onDraftChange(value);
  }, [onDraftChange]);

  const updateActiveClientMessageId = useCallback((value: string | null) => {
    activeClientMessageId.current = value;
    setActiveClientMessageIdState(value);
  }, []);

  const reconcileCanonicalDetail = useCallback((detail: AiChatClientDetail) => {
    const outbound = outboundTurn.current;
    if (outbound) {
      const reconciliation = reconcileAiChatOutboundTurn({
        outbound,
        canonicalMessages: detail.messages,
        currentDraft: draftRef.current,
      });
      outboundTurn.current = null;
      if (reconciliation.draft !== draftRef.current) {
        updateDraft(reconciliation.draft);
      }
      if (!reconciliation.accepted) {
        if (reconciliation.recoverable) {
          setRecoverableOutbound(reconciliation.recoverable);
        }
        setTurnRecoveryNotice(reconciliation.recoverable
          ? ""
          : "Your message was not sent. Its text has been restored.");
      }
    }

    const pendingClientMessageId = [...detail.messages].reverse().find((message) => (
      message.role === "assistant" && message.status === "pending"
    ))?.clientMessageId || null;
    setLocallyTerminalClientMessageId(null);
    updateActiveClientMessageId(pendingClientMessageId);
    return detail;
  }, [updateActiveClientMessageId, updateDraft]);

  const reconcileAfterRefresh = useCallback(async (
    signal?: AbortSignal,
    options?: AiChatRefreshOptions,
  ) => {
    const detail = await refresh(signal, options);
    return detail ? reconcileCanonicalDetail(detail) : null;
  }, [reconcileCanonicalDetail, refresh]);

  const cancelPendingTurn = useCallback(() => {
    if (activeCancellation.current) return activeCancellation.current;
    const clientMessageId = activeClientMessageId.current;
    if (!clientMessageId) return Promise.resolve();

    setTurnControlError("");
    setCancelling(true);
    const cancellation = withAiChatCancelDeadline(async (signal) => {
      try {
        await requestAiChatJson(
          `/api/ai/chats/${encodeURIComponent(chat.id)}/messages/${encodeURIComponent(clientMessageId)}/cancel`,
          { method: "POST", body: JSON.stringify({}), signal },
        );
        signal.throwIfAborted();
        outboundTurn.current = null;
        retryTerminalBaseline.current = null;
        setLocallyTerminalClientMessageId(clientMessageId);
        if (activeClientMessageId.current === clientMessageId) {
          updateActiveClientMessageId(null);
        }
        void refresh(undefined, { quiet: true });
      } catch (cancelError) {
        signal.throwIfAborted();
        const detail = await reconcileAfterRefresh(signal, { quiet: true });
        signal.throwIfAborted();
        if (!detail) throw cancelError;
        const stillPending = detail.messages.some((message) => (
          message.role === "assistant"
          && message.status === "pending"
          && message.clientMessageId === clientMessageId
        ));
        if (stillPending) {
          setTurnControlError(cancelError instanceof Error
            ? cancelError.message
            : "The active response could not be stopped. Try again.");
        }
      }
    }).catch(() => {
      const outbound = outboundTurn.current;
      if (outbound) {
        const recovery = preserveUnverifiedAiChatOutboundTurn({
          outbound,
          currentDraft: draftRef.current,
        });
        outboundTurn.current = null;
        setRecoverableOutbound(recovery.recoverable);
        if (recovery.draft !== draftRef.current) updateDraft(recovery.draft);
      }
      if (canonicalPendingClientMessageId !== clientMessageId) {
        updateActiveClientMessageId(null);
      }
      setTurnControlError(
        "We couldn't verify delivery. You can safely retry the same message when the connection is back.",
      );
    }).finally(() => {
      activeCancellation.current = null;
      setCancelling(false);
    });
    activeCancellation.current = cancellation;
    return cancellation;
  }, [
    canonicalPendingClientMessageId,
    chat.id,
    reconcileAfterRefresh,
    refresh,
    updateActiveClientMessageId,
    updateDraft,
  ]);

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
    onFinish: ({ finishReason, isAbort, isDisconnect, isError }) => {
      if (shouldRecoverAiChatFinishedStream({
        finishReason,
        isAbort,
        isDisconnect,
        isError,
      })) {
        void recoverPendingTurn();
        return;
      }
      retryTerminalBaseline.current = null;
      setLocallyTerminalClientMessageId(activeClientMessageId.current);
      outboundTurn.current = null;
      updateActiveClientMessageId(null);
      void refresh(undefined, { quiet: true });
    },
    onError: () => void recoverPendingTurn(),
  });

  function recoverPendingTurn() {
    if (activeRecovery.current) return activeRecovery.current;
    const clientMessageId = activeClientMessageId.current;
    clearError();
    if (!clientMessageId) return Promise.resolve();

    setTurnControlError("");
    setTurnRecoveryNotice("The live connection was interrupted. Checking the saved response…");
    const recoveryController = new AbortController();
    activeRecoveryController.current = recoveryController;
    const terminalBaselineUpdatedAt = retryTerminalBaseline.current?.clientMessageId === clientMessageId
      ? retryTerminalBaseline.current.updatedAt
      : null;
    const recovery = recoverAiChatCanonicalTurn({
      clientMessageId,
      terminalBaselineUpdatedAt,
      recoveryWindowMs: AI_CHAT_CANONICAL_RECOVERY_WINDOW_MS,
      refresh: (signal) => refresh(signal, { quiet: true, detailOnly: true }),
      signal: recoveryController.signal,
    }).then((result) => {
      clearError();
      if (result.detail) reconcileCanonicalDetail(result.detail);
      if (result.state === "terminal") {
        retryTerminalBaseline.current = null;
        setTurnRecoveryNotice("");
      } else if (result.state === "pending") {
        retryTerminalBaseline.current = null;
        setTurnRecoveryNotice(
          "We couldn't confirm a final response before recovery timed out. You can stop this turn or reopen the chat after the connection returns.",
        );
      } else {
        const outbound = outboundTurn.current;
        if (outbound) {
          const preserved = preserveUnverifiedAiChatOutboundTurn({
            outbound,
            currentDraft: draftRef.current,
          });
          outboundTurn.current = null;
          setRecoverableOutbound(preserved.recoverable);
          if (preserved.draft !== draftRef.current) updateDraft(preserved.draft);
        }
        setLocallyTerminalClientMessageId(clientMessageId);
        updateActiveClientMessageId(null);
        setTurnRecoveryNotice(
          "We couldn't verify the saved response. Your message is available to retry safely when the connection is back.",
        );
      }
    }).catch((recoveryError) => {
      if (recoveryController.signal.aborted) return;
      setTurnControlError(recoveryError instanceof Error
        ? recoveryError.message
        : "The saved response could not be checked. Try again when the connection is back.");
    }).finally(() => {
      activeRecovery.current = null;
      if (activeRecoveryController.current === recoveryController) {
        activeRecoveryController.current = null;
      }
    });
    activeRecovery.current = recovery;
    return recovery;
  }

  const busy = status === "submitted" || status === "streaming";
  const turnBusy = isAiChatTurnBlocked({
    streamBusy: busy,
    canonicalPendingClientMessageId: effectiveCanonicalPendingClientMessageId,
    activeClientMessageId: activeClientMessageIdState,
    cancelling,
  });
  const latestMessage = messages[messages.length - 1];
  const hasRetryableAssistantFailure = latestMessage?.role === "assistant"
    && latestMessage.metadata?.status === "failed";

  useEffect(() => {
    if (effectiveCanonicalPendingClientMessageId) {
      activeClientMessageId.current = effectiveCanonicalPendingClientMessageId;
    }
  }, [
    effectiveCanonicalPendingClientMessageId,
  ]);

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
    const clientMessageId = activeClientMessageId.current;
    const terminalBaselineUpdatedAt = retryTerminalBaseline.current?.clientMessageId === clientMessageId
      ? retryTerminalBaseline.current.updatedAt
      : null;
    if (!shouldSettleAiChatStreamFromCanonical({
      streamBusy: busy,
      activeClientMessageId: clientMessageId,
      canonicalMessages: chat.messages,
      terminalBaselineUpdatedAt,
    })) return;
    outboundTurn.current = null;
    retryTerminalBaseline.current = null;
    setLocallyTerminalClientMessageId(clientMessageId);
    updateActiveClientMessageId(null);
    clearError();
    stop();
  }, [busy, chat.messages, clearError, stop, updateActiveClientMessageId]);

  async function sendDraft() {
    const text = draft.trim();
    if (!text || turnBusy || !generationConfigured) return;
    const clientMessageId = crypto.randomUUID();
    outboundTurn.current = { clientMessageId, text };
    retryTerminalBaseline.current = null;
    setLocallyTerminalClientMessageId(null);
    updateActiveClientMessageId(clientMessageId);
    updateDraft("");
    setTurnControlError("");
    setTurnRecoveryNotice("");
    clearError();
    onFollowLatest();
    await sendMessage({
      id: clientMessageId,
      role: "user",
      parts: [{ type: "text", text }],
    });
  }

  async function retry(clientMessageId: string) {
    const message = messages.find((item) => item.role === "user" && item.id === clientMessageId);
    if (!message || turnBusy || !generationConfigured) return;
    const text = aiChatUiMessageText(message);
    const terminal = chat.messages.find((item) => (
      item.role === "assistant"
      && item.clientMessageId === clientMessageId
      && item.status !== "pending"
    ));
    retryTerminalBaseline.current = terminal
      ? { clientMessageId, updatedAt: terminal.updatedAt }
      : null;
    setLocallyTerminalClientMessageId(null);
    updateActiveClientMessageId(message.id);
    setTurnControlError("");
    setTurnRecoveryNotice("");
    clearError();
    onFollowLatest();
    await sendMessage({ text, messageId: message.id });
  }

  async function retryRecoverableOutbound() {
    if (!recoverableOutbound || turnBusy || !generationConfigured) return;
    const outbound = recoverableOutbound;
    const existingMessage = messages.find((message) => (
      message.role === "user" && message.id === outbound.clientMessageId
    ));
    outboundTurn.current = outbound;
    const terminal = chat.messages.find((message) => (
      message.role === "assistant"
      && message.clientMessageId === outbound.clientMessageId
      && message.status !== "pending"
    ));
    retryTerminalBaseline.current = terminal
      ? { clientMessageId: outbound.clientMessageId, updatedAt: terminal.updatedAt }
      : null;
    setRecoverableOutbound(null);
    setTurnRecoveryNotice("");
    setTurnControlError("");
    setLocallyTerminalClientMessageId(null);
    updateActiveClientMessageId(outbound.clientMessageId);
    clearError();
    onFollowLatest();
    if (existingMessage) {
      await sendMessage({ text: outbound.text, messageId: outbound.clientMessageId });
      return;
    }
    await sendMessage({
      id: outbound.clientMessageId,
      role: "user",
      parts: [{ type: "text", text: outbound.text }],
    });
  }

  function stopPendingTurn() {
    stop();
    void cancelPendingTurn();
  }

  return {
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
    waitingForResponse: Boolean(activeClientMessageIdState),
  };
}
