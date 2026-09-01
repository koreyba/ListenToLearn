import type { AiChatClientDetail, AiChatClientMessage } from "./client.ts";

export type AiChatOutboundTurn = {
  clientMessageId: string;
  text: string;
};

export const AI_CHAT_CANCEL_RECOVERY_TIMEOUT_MS = 8_000;
export const AI_CHAT_CANONICAL_RECOVERY_PROBE_TIMEOUT_MS = 8_000;
export const AI_CHAT_CANONICAL_RECOVERY_DELAYS_MS = [0, 250, 500, 1_000, 2_000, 4_000] as const;
export const AI_CHAT_CANONICAL_RECOVERY_POLL_MS = 5_000;
export const AI_CHAT_CANONICAL_RECOVERY_MAX_POLL_MS = 15_000;
export const AI_CHAT_CANONICAL_RECOVERY_WINDOW_MS = 5 * 60_000 + 10_000;

async function withAiChatDeadline<Result>(input: {
  operation: (signal: AbortSignal) => Promise<Result>;
  parentSignal?: AbortSignal;
  timeoutMs: number;
  timeoutMessage: string;
}) {
  if (input.parentSignal?.aborted) throw input.parentSignal.reason;

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortFromParent: (() => void) | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    const rejectWithParentReason = () => {
      const reason = input.parentSignal?.reason || new DOMException("Aborted", "AbortError");
      controller.abort(reason);
      reject(reason);
    };
    abortFromParent = rejectWithParentReason;
    input.parentSignal?.addEventListener("abort", rejectWithParentReason, { once: true });
    timeout = setTimeout(() => {
      const error = new Error(input.timeoutMessage);
      error.name = "TimeoutError";
      controller.abort(error);
      reject(error);
    }, input.timeoutMs);
  });

  try {
    return await Promise.race([input.operation(controller.signal), deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    if (abortFromParent) input.parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

export async function withAiChatCancelDeadline<Result>(
  operation: (signal: AbortSignal) => Promise<Result>,
  timeoutMs = AI_CHAT_CANCEL_RECOVERY_TIMEOUT_MS,
) {
  return withAiChatDeadline({
    operation,
    timeoutMs,
    timeoutMessage: "AI chat cancellation timed out.",
  });
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

function waitForAiChatRecovery(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (delayMs <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const settle = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    const timeout = setTimeout(settle, delayMs);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export type AiChatCanonicalRecoveryResult =
  | { state: "terminal"; detail: AiChatClientDetail }
  | { state: "pending"; detail: AiChatClientDetail }
  | { state: "unavailable"; detail: AiChatClientDetail | null };

export async function recoverAiChatCanonicalTurn(input: {
  clientMessageId: string;
  terminalBaselineUpdatedAt?: string | null;
  refresh: (signal?: AbortSignal) => Promise<AiChatClientDetail | null>;
  signal?: AbortSignal;
  delaysMs?: readonly number[];
  recoveryWindowMs?: number;
  pollIntervalMs?: number;
  maxPollIntervalMs?: number;
  probeTimeoutMs?: number;
  now?: () => number;
  wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}): Promise<AiChatCanonicalRecoveryResult> {
  let lastDetail: AiChatClientDetail | null = null;
  let pendingDetail: AiChatClientDetail | null = null;
  const wait = input.wait || waitForAiChatRecovery;
  const now = input.now || Date.now;
  const recoveryStartedAt = now();

  async function refreshCanonicalTurn() {
    let detail: AiChatClientDetail | null;
    try {
      detail = await withAiChatDeadline({
        operation: input.refresh,
        parentSignal: input.signal,
        timeoutMs: Math.max(
          1,
          input.probeTimeoutMs || AI_CHAT_CANONICAL_RECOVERY_PROBE_TIMEOUT_MS,
        ),
        timeoutMessage: "AI chat canonical recovery probe timed out.",
      });
    } catch (error) {
      if (input.signal?.aborted) throw error;
      return null;
    }
    if (!detail) return null;
    lastDetail = detail;
    const assistant = detail.messages.find((message) => (
      message.role === "assistant"
      && message.clientMessageId === input.clientMessageId
    ));
    if (!assistant) return null;
    if (assistant.status === "pending") {
      pendingDetail = detail;
      return null;
    }
    if (
      input.terminalBaselineUpdatedAt
      && assistant.updatedAt === input.terminalBaselineUpdatedAt
    ) return null;
    return { state: "terminal" as const, detail };
  }

  for (const delayMs of input.delaysMs || AI_CHAT_CANONICAL_RECOVERY_DELAYS_MS) {
    await wait(delayMs, input.signal);
    const terminal = await refreshCanonicalTurn();
    if (terminal) return terminal;
  }

  const recoveryWindowMs = Math.max(0, input.recoveryWindowMs || 0);
  let pollIntervalMs = Math.max(1, input.pollIntervalMs || AI_CHAT_CANONICAL_RECOVERY_POLL_MS);
  const maxPollIntervalMs = Math.max(
    pollIntervalMs,
    input.maxPollIntervalMs || AI_CHAT_CANONICAL_RECOVERY_MAX_POLL_MS,
  );
  while (now() - recoveryStartedAt < recoveryWindowMs) {
    const remainingMs = recoveryWindowMs - (now() - recoveryStartedAt);
    await wait(Math.min(pollIntervalMs, remainingMs), input.signal);
    const terminal = await refreshCanonicalTurn();
    if (terminal) return terminal;
    pollIntervalMs = Math.min(maxPollIntervalMs, pollIntervalMs * 2);
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
  canonicalMessages: readonly AiChatClientMessage[];
  terminalBaselineUpdatedAt?: string | null;
}) {
  if (!input.streamBusy || !input.activeClientMessageId) return false;
  return input.canonicalMessages.some((message) => (
    message.role === "assistant"
    && message.clientMessageId === input.activeClientMessageId
    && message.status !== "pending"
    && (
      !input.terminalBaselineUpdatedAt
      || message.updatedAt !== input.terminalBaselineUpdatedAt
    )
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
