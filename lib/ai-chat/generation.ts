import { stepCountIs, streamText, toUIMessageStream, type ToolSet } from "ai";
import { AI_CHAT_ERROR_CODES, type AiChatErrorCode } from "./contracts.ts";
import type { AiChatPrompt } from "./prompt.ts";
import {
  mapAiChatRuntimeFailure,
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

function normalizeModelId(value: string, fallback: string): string {
  const model = value.trim();
  return model && model.length <= 240 && /^[a-z0-9._:/-]+$/iu.test(model)
    ? model
    : fallback;
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
    onEnd: async ({ text, model, usage }) => {
      const normalizedText = normalizeAiChatAssistantText(text);
      if (!normalizedText.ok) {
        await failPendingAssistant(normalizedText.error.code);
        return;
      }
      await finalizeOnce(
        () => input.repository.completePendingAssistant({
          assistantId: input.pendingAssistant.id,
          text: normalizedText.value,
          provider: input.runtime.provenance.provider,
          model: normalizeModelId(model.modelId, input.runtime.provenance.model),
          usage: {
            inputTokens: normalizeTokenCount(usage.inputTokens),
            outputTokens: normalizeTokenCount(usage.outputTokens),
            totalTokens: normalizeTokenCount(usage.totalTokens),
          },
        }),
      );
    },
    onError: async ({ error }) => {
      await failPendingAssistant(mapAiChatRuntimeFailure(error).code);
    },
    onAbort: async () => {
      await failPendingAssistant(AI_CHAT_ERROR_CODES.providerTimeout);
    },
  });

  const uiStream = dependencies.toUIMessageStream({
    stream: result.stream,
    generateMessageId: () => input.pendingAssistant.id,
    onError: (error) => mapAiChatRuntimeFailure(error).code,
    sendReasoning: false,
    sendSources: false,
  });
  return withConsumerCancellation(
    uiStream,
    () => failPendingAssistant(AI_CHAT_ERROR_CODES.providerTimeout),
  );
}
