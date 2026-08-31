import type { UIMessage } from "ai";
import type { AiChatMeaningMode } from "./contracts.ts";
import type { AiChatTerminalTelemetry } from "./terminal-telemetry.ts";
import type {
  AiChatPublicDetail,
  AiChatPublicMeaning,
  AiChatPublicMessage,
  AiChatPublicSummary,
  AiChatPublicTarget,
} from "./public-contracts.ts";

export type AiChatClientMeaning = AiChatPublicMeaning;
export type AiChatClientTarget = AiChatPublicTarget;
export type AiChatClientMessage = AiChatPublicMessage;
export type AiChatClientSummary = AiChatPublicSummary;
export type AiChatClientDetail = AiChatPublicDetail;

export type AiChatUiMetadata = {
  status: "complete" | "pending" | "failed";
  clientMessageId: string;
  errorCode: string | null;
  terminal: AiChatTerminalTelemetry | null;
};

export type AiChatUiMessage = UIMessage<AiChatUiMetadata>;

export type AiChatOutboundTurn = {
  clientMessageId: string;
  text: string;
};

export const AI_CHAT_CANCEL_RECOVERY_TIMEOUT_MS = 8_000;

export async function withAiChatCancelDeadline<Result>(
  operation: (signal: AbortSignal) => Promise<Result>,
  timeoutMs = AI_CHAT_CANCEL_RECOVERY_TIMEOUT_MS,
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new Error("AI chat cancellation timed out.");
      error.name = "TimeoutError";
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function shouldRecoverAiChatFinishedStream(input: {
  isAbort: boolean;
  isDisconnect: boolean;
  isError: boolean;
  finishReason?: string;
}) {
  return input.isAbort
    || input.isDisconnect
    || input.isError
    || !input.finishReason;
}

export const AI_CHAT_CANONICAL_RECOVERY_DELAYS_MS = [0, 250, 500, 1_000, 2_000, 4_000] as const;

function waitForAiChatRecovery(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (delayMs <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(signal.reason);
    }, { once: true });
  });
}

export async function recoverAiChatCanonicalTurn(input: {
  clientMessageId: string;
  refresh: (signal?: AbortSignal) => Promise<AiChatClientDetail | null>;
  signal?: AbortSignal;
  delaysMs?: readonly number[];
  wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}) {
  let lastDetail: AiChatClientDetail | null = null;
  let pendingDetail: AiChatClientDetail | null = null;
  const wait = input.wait || waitForAiChatRecovery;
  for (const delayMs of input.delaysMs || AI_CHAT_CANONICAL_RECOVERY_DELAYS_MS) {
    await wait(delayMs, input.signal);
    const detail = await input.refresh(input.signal).catch(() => null);
    if (!detail) continue;
    lastDetail = detail;
    const assistant = detail.messages.find((message) => (
      message.role === "assistant"
      && message.clientMessageId === input.clientMessageId
    ));
    if (!assistant) continue;
    if (assistant.status !== "pending") {
      return { state: "terminal" as const, detail };
    }
    pendingDetail = detail;
  }
  if (pendingDetail) return { state: "pending" as const, detail: pendingDetail };
  return { state: "unavailable" as const, detail: lastDetail };
}

export function isAiChatTurnBlocked(input: {
  streamBusy: boolean;
  canonicalPendingClientMessageId: string | null;
  activeClientMessageId: string | null;
  cancelling: boolean;
}) {
  return input.streamBusy
    || Boolean(input.canonicalPendingClientMessageId)
    || Boolean(input.activeClientMessageId)
    || input.cancelling;
}

export function shouldSettleAiChatStreamFromCanonical(input: {
  streamBusy: boolean;
  activeClientMessageId: string | null;
  canonicalMessages: readonly AiChatUiMessage[];
}) {
  if (!input.streamBusy || !input.activeClientMessageId) return false;
  return input.canonicalMessages.some((message) => (
    message.role === "assistant"
    && message.metadata?.clientMessageId === input.activeClientMessageId
    && message.metadata.status !== "pending"
  ));
}

export function reconcileAiChatOutboundTurn(input: {
  outbound: AiChatOutboundTurn;
  canonicalMessages: readonly AiChatClientMessage[];
  currentDraft: string;
}) {
  const accepted = input.canonicalMessages.some((message) => (
    message.role === "user" && message.clientMessageId === input.outbound.clientMessageId
  ));
  if (accepted) {
    return { accepted: true, draft: input.currentDraft, recoverable: null };
  }
  if (!input.currentDraft) {
    return { accepted: false, draft: input.outbound.text, recoverable: null };
  }
  return { accepted: false, draft: input.currentDraft, recoverable: input.outbound };
}

export function preserveUnverifiedAiChatOutboundTurn(input: {
  outbound: AiChatOutboundTurn;
  currentDraft: string;
}) {
  return { draft: input.currentDraft, recoverable: input.outbound };
}

export type AiChatTargetRequest =
  | { phraseId: string; meaningMode: AiChatMeaningMode; selectedMeaningId?: string }
  | { text: string; meaningMode: Exclude<AiChatMeaningMode, "selected"> };

export function toAiChatUiMessages(messages: readonly AiChatClientMessage[]): AiChatUiMessage[] {
  return messages.map((message) => ({
    id: message.role === "user" ? message.clientMessageId : message.id,
    role: message.role,
    parts: message.content ? [{ type: "text" as const, text: message.content }] : [],
    metadata: {
      status: message.status,
      clientMessageId: message.clientMessageId,
      errorCode: message.errorCode,
      terminal: message.terminal || null,
    },
  }));
}

export function aiChatUiMessageText(message: Pick<AiChatUiMessage, "parts">) {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function prepareAiChatMessageRequest(options: { messages: readonly AiChatUiMessage[] }) {
  let lastUserMessage: AiChatUiMessage | undefined;
  for (let index = options.messages.length - 1; index >= 0; index -= 1) {
    if (options.messages[index].role === "user") {
      lastUserMessage = options.messages[index];
      break;
    }
  }
  if (!lastUserMessage) throw new Error("A user message is required.");
  return {
    body: {
      clientMessageId: lastUserMessage.id,
      content: aiChatUiMessageText(lastUserMessage),
    },
  };
}

export function toAiChatTargetInput(target: AiChatClientTarget): AiChatTargetRequest {
  if (!target.phraseId) {
    if (target.meaningMode === "selected") {
      throw new Error("An ad-hoc target cannot select a saved meaning.");
    }
    return { text: target.text, meaningMode: target.meaningMode };
  }
  if (target.meaningMode === "selected") {
    const selectedMeaningId = target.selectedMeaning?.id;
    if (!selectedMeaningId) throw new Error("A selected meaning is required.");
    return {
      phraseId: target.phraseId,
      meaningMode: "selected",
      selectedMeaningId,
    };
  }
  return {
    phraseId: target.phraseId,
    meaningMode: target.meaningMode,
  };
}
