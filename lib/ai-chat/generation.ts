import {
  stepCountIs,
  streamText,
  toUIMessageStream,
  type TextStreamPart,
  type ToolSet,
} from "ai";
import { AI_CHAT_ERROR_CODES, type AiChatErrorCode } from "./contracts.ts";
import type { AiChatPrompt } from "./prompts/vocabulary-practice.ts";
import {
  normalizeAiChatAssistantText,
  type AiChatRuntime,
} from "./runtime.ts";

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

export type AiChatGenerationRepository = {
  completePendingAssistant(input: {
    assistantId: string;
    text: string;
    provider: string;
    model: string;
    usage: AiChatGenerationUsage;
  }): Promise<void>;
  failPendingAssistant(input: {
    assistantId: string;
    errorCode: AiChatErrorCode;
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
};

const defaultDependencies: AiChatGenerationDependencies = {
  streamText,
  toUIMessageStream,
};

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
      const sourceCancellation = reader.cancel(reason).catch(() => undefined);
      await onCancel();
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
  const failPendingAssistant = (errorCode: AiChatErrorCode) => finalizeOnce(
    () => input.repository.failPendingAssistant({
      assistantId: input.pendingAssistant.id,
      errorCode,
    }),
  );
  const result = dependencies.streamText({
    model: input.runtime.model,
    abortSignal: input.abortSignal,
    system: input.prompt.system,
    messages: input.prompt.messages,
    maxOutputTokens: input.runtime.maxOutputTokens,
    timeout: input.runtime.timeoutMs,
    maxRetries: 0,
    tools: input.tools,
    stopWhen: stepCountIs(5),
    prepareStep: ({ stepNumber }) => stepNumber >= 4
      ? { activeTools: [], toolChoice: "none" }
      : undefined,
    onEnd: async ({ text, usage, steps, finalStep }) => {
      const normalizedText = normalizeAiChatAssistantText(text);
      if (!normalizedText.ok) {
        await failPendingAssistant(normalizedText.error.code);
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
        }),
      );
    },
    onError: async ({ error }) => {
      await failPendingAssistant(input.runtime.mapFailure(error).code);
    },
    onAbort: async () => {
      await failPendingAssistant(AI_CHAT_ERROR_CODES.providerTimeout);
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
    () => failPendingAssistant(AI_CHAT_ERROR_CODES.providerTimeout),
  );
}
