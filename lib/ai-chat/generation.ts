import {
  stepCountIs,
  streamText,
  toUIMessageStream,
  wrapLanguageModel,
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
import {
  parseAiChatProposalFallback,
  routeAiChatProposalIntent,
} from "./proposal-intent.ts";
import { createRequiredToolRetryMiddleware } from "./required-tool-retry.ts";

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

export type AiChatGenerationTerminalTelemetry = {
  elapsedMs: number;
  finishReason?: string;
  stepCount?: number;
  toolCallCount?: number;
  outputCharacters?: number;
  requiredToolRetries?: number;
  requiredToolFallbacks?: number;
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
  wrapLanguageModel?: typeof wrapLanguageModel;
  now?: () => number;
};

const defaultDependencies: AiChatGenerationDependencies = {
  streamText,
  toUIMessageStream,
};

type AiChatGenerationStep = { toolCalls?: readonly unknown[] };

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
      const terminalCancellation = onCancel();
      const sourceCancellation = reader.cancel(reason).catch(() => undefined);
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
  const currentUserMessage = [...input.prompt.messages]
    .reverse()
    .find((message) => message.role === "user")?.content || "";
  const routedProposalTool = routeAiChatProposalIntent(currentUserMessage);
  const proposalFallback = routedProposalTool
    ? parseAiChatProposalFallback(currentUserMessage)
    : null;
  let requiredToolRetries = 0;
  let requiredToolFallbacks = 0;
  const model = routedProposalTool && typeof input.runtime.model !== "string"
    ? (dependencies.wrapLanguageModel || wrapLanguageModel)({
        model: input.runtime.model,
        middleware: createRequiredToolRetryMiddleware({
          onRetry: () => {
            requiredToolRetries += 1;
          },
          fallbackToolCall: () => (
            proposalFallback?.toolName === routedProposalTool
              ? proposalFallback
              : null
          ),
          onFallback: () => {
            requiredToolFallbacks += 1;
          },
        }),
      })
    : input.runtime.model;
  const now = dependencies.now || Date.now;
  const startedAt = now();
  const terminalTelemetry = (options: {
    finishReason?: unknown;
    steps?: readonly AiChatGenerationStep[];
    text?: string;
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
    ...(requiredToolRetries > 0 ? { requiredToolRetries } : {}),
    ...(requiredToolFallbacks > 0 ? { requiredToolFallbacks } : {}),
  });
  let terminalTransitionComplete = false;
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
    model,
    abortSignal: input.abortSignal,
    system: input.prompt.system,
    messages: input.prompt.messages,
    maxOutputTokens: input.runtime.maxOutputTokens,
    timeout: input.runtime.timeout,
    maxRetries: 0,
    tools: input.tools,
    stopWhen: stepCountIs(5),
    prepareStep: ({ stepNumber, steps }) => {
      if (
        stepNumber >= 4
        || providerToolCallCount(steps) >= AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN
      ) {
        return { activeTools: [], toolChoice: "none" };
      }
      if (stepNumber === 0 && routedProposalTool) {
        return {
          activeTools: [routedProposalTool],
          toolChoice: "required",
        };
      }
      return undefined;
    },
    onEnd: async ({ text, finishReason, usage, steps, finalStep }) => {
      const terminal = terminalTelemetry({ finishReason, steps: steps || [], text });
      if (terminal.finishReason !== "stop") {
        await failPendingAssistant(AI_CHAT_ERROR_CODES.responseIncomplete, terminal);
        return;
      }
      const normalizedText = normalizeAiChatAssistantText(text);
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
        input.abortSignal?.aborted
          ? AI_CHAT_ERROR_CODES.generationCancelled
          : AI_CHAT_ERROR_CODES.providerTimeout,
        terminalTelemetry({ steps }),
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
    () => failPendingAssistant(
      AI_CHAT_ERROR_CODES.generationCancelled,
      terminalTelemetry(),
    ),
  );
}
