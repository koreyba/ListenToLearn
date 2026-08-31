import {
  streamText,
  toUIMessageStream,
  type TextStreamPart,
  type ToolSet,
} from "ai";
import { AI_CHAT_ERROR_CODES, type AiChatErrorCode } from "./contracts.ts";
import type { AiChatPrompt } from "./prompts/vocabulary-practice.ts";
import { AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN } from "./tools/vocabulary/contracts.ts";
import {
  normalizeAiChatAssistantText,
  type AiChatRuntime,
} from "./runtime.ts";
import type { AiChatTerminalTelemetry } from "./terminal-telemetry.ts";

export type AiChatPendingAssistantTurn = {
  id: string;
};

export type AiChatGenerationUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  configuredModel: string;
  promptId: string;
  promptVersion: string;
  routedProviders: string[];
  cost: number | null;
  upstreamInferenceCost: number | null;
};

export type AiChatGenerationTerminalTelemetry = AiChatTerminalTelemetry & {
  elapsedMs: number;
};

export type AiChatGenerationRepository = {
  completePendingAssistant(input: {
    assistantId: string;
    text: string;
    provider: string;
    model: string;
    usage: AiChatGenerationUsage;
    terminal: AiChatGenerationTerminalTelemetry;
  }): Promise<void>;
  failPendingAssistant(input: {
    assistantId: string;
    errorCode: AiChatErrorCode;
    terminal: AiChatGenerationTerminalTelemetry;
  }): Promise<void>;
};

export type AiChatGenerationInput = {
  prompt: AiChatPrompt;
  pendingAssistant: AiChatPendingAssistantTurn;
  runtime: AiChatRuntime;
  tools: ToolSet;
  repository: AiChatGenerationRepository;
  abortSignal?: AbortSignal;
};

type AiChatGenerationDependencies = {
  streamText: typeof streamText;
  toUIMessageStream: typeof toUIMessageStream;
  now?: () => number;
};

const defaultDependencies: AiChatGenerationDependencies = {
  streamText,
  toUIMessageStream,
};

type AiChatGenerationToolPart = {
  type?: unknown;
  toolName?: unknown;
  output?: unknown;
  error?: unknown;
};

type AiChatGenerationStep = {
  toolCalls?: readonly unknown[];
  toolResults?: readonly AiChatGenerationToolPart[];
  content?: readonly AiChatGenerationToolPart[];
};

const AI_CHAT_VALIDATION_TEXT = Object.freeze({
  missing_target: "I couldn't find every requested saved word or enough recent entries. No changes were prepared.",
  ambiguous_meaning: "I found more than one possible saved meaning. Name the current translation you want to change.",
  conflicting_changes: "Some requested vocabulary changes conflict with each other. Clarify or split those items.",
  change_limit_exceeded: "I can prepare up to 30 vocabulary changes at once. Shorten or split this request.",
  unsupported_change: "That shared preset meaning can't be edited. Ask me to add a personal meaning instead.",
  invalid_input: "I couldn't safely resolve every requested vocabulary change. Clarify the request and try again.",
});

type AiChatValidationError = keyof typeof AI_CHAT_VALIDATION_TEXT;
type AiChatToolLoopOutcome =
  | { kind: "none" }
  | { kind: "proposal_ready" }
  | { kind: "validation_error"; error: AiChatValidationError }
  | { kind: "tool_timeout" }
  | { kind: "tool_budget_exceeded" }
  | { kind: "tool_failed" };

const AI_CHAT_MUTATION_TOOL = "propose_vocabulary_change_set";
const AI_CHAT_READ_TOOLS = new Set(["list_vocabulary", "find_vocabulary"]);
export const AI_CHAT_PROPOSAL_READY_TEXT = "Review the proposed changes below.";

const PUBLIC_FINISH_REASONS = new Set([
  "stop",
  "length",
  "content-filter",
  "tool-calls",
  "error",
  "other",
  "unknown",
]);

function publicFinishReason(value: unknown) {
  return typeof value === "string" && PUBLIC_FINISH_REASONS.has(value)
    ? value
    : "unknown";
}

function providerToolCallCount(steps: readonly AiChatGenerationStep[] | undefined) {
  return (steps || []).reduce(
    (total, step) => total + (Array.isArray(step.toolCalls) ? step.toolCalls.length : 0),
    0,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toolParts(step: AiChatGenerationStep): AiChatGenerationToolPart[] {
  const content = Array.isArray(step.content)
    ? step.content.filter((part) => (
        part?.type === "tool-result" || part?.type === "tool-error"
      ))
    : [];
  return [
    ...content,
    ...(Array.isArray(step.toolResults) ? step.toolResults : []),
  ];
}

function errorIsTimeout(error: unknown, depth = 0): boolean {
  if (depth > 3 || !isRecord(error)) return false;
  if (error.name === "TimeoutError") return true;
  return errorIsTimeout(error.cause, depth + 1)
    || errorIsTimeout(error.reason, depth + 1);
}

function toolLoopOutcome(steps: readonly AiChatGenerationStep[]): AiChatToolLoopOutcome {
  let proposalReady = false;
  let validationError: AiChatValidationError | null = null;
  for (const step of steps) {
    for (const part of toolParts(step)) {
      if (part.type === "tool-error") {
        return { kind: errorIsTimeout(part.error) ? "tool_timeout" : "tool_failed" };
      }
      if (part.type !== "tool-result" || !isRecord(part.output)) continue;
      if (part.output.ok === false) {
        if (part.output.error === "tool_budget_exceeded") {
          return { kind: "tool_budget_exceeded" };
        }
        if (
          part.toolName === AI_CHAT_MUTATION_TOOL
          && typeof part.output.error === "string"
          && Object.hasOwn(AI_CHAT_VALIDATION_TEXT, part.output.error)
        ) {
          validationError = part.output.error as AiChatValidationError;
          continue;
        }
        return { kind: "tool_failed" };
      }
      if (
        part.toolName === AI_CHAT_MUTATION_TOOL
        && part.output.ok === true
        && part.output.proposed === true
        && part.output.approvalRequired === true
        && typeof part.output.proposalId === "string"
        && part.output.proposalId.length > 0
      ) {
        proposalReady = true;
      }
    }
  }
  if (proposalReady && validationError) return { kind: "tool_failed" };
  if (proposalReady) return { kind: "proposal_ready" };
  if (validationError) return { kind: "validation_error", error: validationError };
  return { kind: "none" };
}

function stepHasSuccessfulRead(step: AiChatGenerationStep) {
  return toolParts(step).some((part) => (
    part.type === "tool-result"
    && typeof part.toolName === "string"
    && AI_CHAT_READ_TOOLS.has(part.toolName)
    && isRecord(part.output)
    && part.output.ok === true
  ));
}

function stopAiChatToolLoop({ steps }: { steps: AiChatGenerationStep[] }) {
  if (toolLoopOutcome(steps).kind !== "none") return true;
  const firstReadStep = steps.findIndex(stepHasSuccessfulRead);
  return firstReadStep >= 0 && steps.length >= firstReadStep + 2;
}

function publicTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function publicAiChatProviderStream(stream: ReadableStream<TextStreamPart<ToolSet>>) {
  const publicTextIds = new Map<string, string>();
  let nextTextId = 0;
  const publicTextId = (providerTextId: string) => {
    const existing = publicTextIds.get(providerTextId);
    if (existing) return existing;
    nextTextId += 1;
    const created = `text-${nextTextId}`;
    publicTextIds.set(providerTextId, created);
    return created;
  };

  return stream.pipeThrough(new TransformStream<
    TextStreamPart<ToolSet>,
    TextStreamPart<ToolSet>
  >({
    transform(part, controller) {
      switch (part.type) {
        case "start":
          controller.enqueue({ type: "start" });
          return;
        case "text-start":
          controller.enqueue({ type: "text-start", id: publicTextId(part.id) });
          return;
        case "text-delta":
          controller.enqueue({
            type: "text-delta",
            id: publicTextId(part.id),
            text: part.text,
          });
          return;
        case "text-end":
          controller.enqueue({ type: "text-end", id: publicTextId(part.id) });
          return;
        case "finish":
          controller.enqueue({
            type: "finish",
            finishReason: part.finishReason,
            rawFinishReason: undefined,
            totalUsage: {
              inputTokens: publicTokenCount(part.totalUsage.inputTokens),
              inputTokenDetails: {
                noCacheTokens: publicTokenCount(part.totalUsage.inputTokenDetails.noCacheTokens),
                cacheReadTokens: publicTokenCount(part.totalUsage.inputTokenDetails.cacheReadTokens),
                cacheWriteTokens: publicTokenCount(part.totalUsage.inputTokenDetails.cacheWriteTokens),
              },
              outputTokens: publicTokenCount(part.totalUsage.outputTokens),
              outputTokenDetails: {
                textTokens: publicTokenCount(part.totalUsage.outputTokenDetails.textTokens),
                reasoningTokens: publicTokenCount(
                  part.totalUsage.outputTokenDetails.reasoningTokens,
                ),
              },
              totalTokens: publicTokenCount(part.totalUsage.totalTokens),
              raw: undefined,
            },
          });
          return;
        case "error":
          controller.enqueue({ type: "error", error: part.error });
          return;
        case "abort":
          controller.enqueue({ type: "abort" });
          return;
        default:
          // Tool, reasoning, source, file, custom, step, and raw chunks are
          // server-only. The browser receives only the assistant's final text.
          return;
      }
    },
  }));
}

function withConsumerCancellation<Chunk>(
  stream: ReadableStream<Chunk>,
  onCancelStart: () => void,
  onCancel: () => Promise<void>,
) {
  const reader = stream.getReader();
  return new ReadableStream<Chunk>({
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      onCancelStart();
      const sourceCancellation = reader.cancel(reason).catch(() => undefined);
      const terminalCancellation = onCancel();
      await terminalCancellation;
      await sourceCancellation;
    },
  });
}

function normalizeTokenCount(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null;
}

function normalizeModelId(value: unknown, fallback: string): string {
  const model = typeof value === "string" ? value.trim() : "";
  if (model && model.length <= 240 && /^@?[a-z0-9][a-z0-9._:/-]*$/iu.test(model)) {
    return model;
  }
  const safeFallback = fallback.trim();
  return safeFallback
    && safeFallback.length <= 240
    && /^@?[a-z0-9][a-z0-9._:/-]*$/iu.test(safeFallback)
    ? safeFallback
    : "unknown";
}

export function startAiChatGeneration(
  input: AiChatGenerationInput,
  dependencies: AiChatGenerationDependencies = defaultDependencies,
) {
  const now = dependencies.now || Date.now;
  const startedAt = now();
  const terminalTelemetry = (options: {
    finishReason?: unknown;
    steps?: readonly AiChatGenerationStep[];
    text?: string;
    termination?: AiChatTerminalTelemetry["termination"];
  } = {}): AiChatGenerationTerminalTelemetry => ({
    elapsedMs: Math.max(0, Math.trunc(now() - startedAt)),
    ...(options.finishReason === undefined
      ? {}
      : { finishReason: publicFinishReason(options.finishReason) }),
    ...(options.steps === undefined
      ? {}
      : {
          stepCount: options.steps.length,
          toolCallCount: providerToolCallCount(options.steps),
        }),
    ...(options.text === undefined
      ? {}
      : {
          outputCharacters: [...options.text.replace(/\r\n?/gu, "\n").trim()].length,
        }),
    ...(options.termination === undefined
      ? {}
      : { termination: options.termination }),
  });
  let terminalTransitionComplete = false;
  let consumerCancellationStarted = false;
  let activeTerminalTransition: Promise<void> | null = null;
  const finalizeOnce = async (transition: () => Promise<void>) => {
    for (;;) {
      if (terminalTransitionComplete) return;
      if (activeTerminalTransition) {
        try {
          await activeTerminalTransition;
        } catch {
          // A later terminal callback may retry the persistence transition.
        }
        continue;
      }
      const attempt = (async () => {
        await transition();
        terminalTransitionComplete = true;
      })();
      activeTerminalTransition = attempt;
      try {
        await attempt;
      } finally {
        if (activeTerminalTransition === attempt) activeTerminalTransition = null;
      }
      return;
    }
  };
  const failPendingAssistant = (
    errorCode: AiChatErrorCode,
    terminal: AiChatGenerationTerminalTelemetry,
  ) => finalizeOnce(
    () => input.repository.failPendingAssistant({
      assistantId: input.pendingAssistant.id,
      errorCode,
      terminal,
    }),
  );
  const result = dependencies.streamText({
    model: input.runtime.model,
    abortSignal: input.abortSignal,
    system: input.prompt.system,
    messages: input.prompt.messages,
    maxOutputTokens: input.runtime.maxOutputTokens,
    timeout: input.runtime.timeout,
    maxRetries: 0,
    tools: input.tools,
    stopWhen: stopAiChatToolLoop,
    prepareStep: ({ stepNumber, steps }) => {
      if (
        stepNumber >= 4
        || providerToolCallCount(steps) >= AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN
      ) {
        return { activeTools: [], toolChoice: "none" };
      }
      return undefined;
    },
    onEnd: async ({ text, finishReason, usage, steps, finalStep }) => {
      const completedSteps = steps || [];
      const outcome = toolLoopOutcome(completedSteps);
      const completionText = outcome.kind === "proposal_ready"
        ? AI_CHAT_PROPOSAL_READY_TEXT
        : outcome.kind === "validation_error"
          ? AI_CHAT_VALIDATION_TEXT[outcome.error]
          : text;
      const terminal = terminalTelemetry({
        finishReason,
        steps: completedSteps,
        text: completionText,
      });
      if (
        outcome.kind === "tool_timeout"
        || outcome.kind === "tool_budget_exceeded"
        || outcome.kind === "tool_failed"
      ) {
        await failPendingAssistant(
          outcome.kind === "tool_timeout"
            ? AI_CHAT_ERROR_CODES.toolTimeout
            : outcome.kind === "tool_budget_exceeded"
              ? AI_CHAT_ERROR_CODES.toolBudgetExceeded
              : AI_CHAT_ERROR_CODES.toolFailed,
          terminal,
        );
        return;
      }
      if (outcome.kind === "none" && terminal.finishReason !== "stop") {
        await failPendingAssistant(AI_CHAT_ERROR_CODES.responseIncomplete, terminal);
        return;
      }
      const normalizedText = normalizeAiChatAssistantText(completionText);
      if (!normalizedText.ok) {
        await failPendingAssistant(normalizedText.error.code, terminal);
        return;
      }
      const configuredModel = normalizeModelId(input.runtime.provenance.model, "unknown");
      const telemetry = input.runtime.normalizeTelemetry(steps || []);
      await finalizeOnce(
        () => input.repository.completePendingAssistant({
          assistantId: input.pendingAssistant.id,
          text: normalizedText.value,
          provider: input.runtime.provenance.provider,
          model: normalizeModelId(finalStep?.response?.modelId, configuredModel),
          usage: {
            inputTokens: normalizeTokenCount(usage.inputTokens),
            outputTokens: normalizeTokenCount(usage.outputTokens),
            totalTokens: normalizeTokenCount(usage.totalTokens),
            configuredModel,
            promptId: input.prompt.id,
            promptVersion: input.prompt.version,
            ...telemetry,
          },
          terminal,
        }),
      );
    },
    onError: async ({ error }) => {
      await failPendingAssistant(
        input.runtime.mapFailure(error).code,
        terminalTelemetry(),
      );
    },
    onAbort: async ({ steps }) => {
      await failPendingAssistant(
        input.abortSignal?.aborted || consumerCancellationStarted
          ? AI_CHAT_ERROR_CODES.generationInterrupted
          : AI_CHAT_ERROR_CODES.providerTimeout,
        terminalTelemetry({
          steps,
          ...(input.abortSignal?.aborted || consumerCancellationStarted
            ? { termination: "transport_disconnected" as const }
            : {}),
        }),
      );
    },
  });

  const uiStream = dependencies.toUIMessageStream({
    stream: publicAiChatProviderStream(result.stream),
    generateMessageId: () => input.pendingAssistant.id,
    onError: (error) => input.runtime.mapFailure(error).code,
    sendReasoning: false,
    sendSources: false,
  });
  return withConsumerCancellation(
    uiStream,
    () => {
      consumerCancellationStarted = true;
    },
    () => failPendingAssistant(
      AI_CHAT_ERROR_CODES.generationInterrupted,
      terminalTelemetry({ termination: "transport_disconnected" }),
    ),
  );
}
