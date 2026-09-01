import {
  buildAiChatPrompt,
  protectVocabularyOpeningForModel,
} from "./prompts/vocabulary-practice.ts";
import {
  createAiChatPracticeContext,
  readAiChatPracticeContext,
} from "./practice-context.ts";
import {
  AiChatRepositoryError,
  createAiChatRepository,
  type AiChatTurn,
} from "./repository.ts";
import {
  createAiChatRuntime,
  describeAiChatConfiguredProvenance,
  type AiChatServerConfig,
} from "./runtime.ts";
import { startAiChatGeneration } from "./generation.ts";
import type { AiChatErrorCode } from "./contracts.ts";
import {
  recordAiChatOperationalEvent,
  type AiChatOperationalEvent,
} from "./observability.ts";
import {
  createAiVocabularyToolHandlers,
  createAiVocabularyTools,
} from "./vocabulary-tools.ts";
import { readAiVocabularyListContinuation } from "./tools/vocabulary/pagination.ts";
import {
  createAiChatToolExecutor,
  createAiChatToolTraceRepository,
} from "./tool-trace.ts";
import type { ToolSet } from "ai";
import { createVocabularyRepository } from "../vocabulary/repository.ts";
import { createVocabularyMutationPlanner } from "../vocabulary/mutations.ts";

export type AiChatServiceRepository = Pick<
  ReturnType<typeof createAiChatRepository>,
  | "beginTurn"
  | "failTurn"
  | "finishTurn"
  | "getCanonicalHistory"
  | "getChatSummary"
  | "getCurrentPracticeItems"
>;

export type AiChatServiceVocabularyRepository = Pick<
  ReturnType<typeof createVocabularyRepository>,
  | "getCategoryTarget"
  | "getEntry"
  | "getEntryForMeaning"
  | "getStateTargets"
  | "listPage"
  | "search"
>;

export type AiChatServiceMutationPlanner = Pick<
  ReturnType<typeof createVocabularyMutationPlanner>,
  | "planAddEntry"
  | "planAddEntries"
  | "planAddMeaning"
  | "planChangeSet"
  | "planChangeState"
  | "planSetCategory"
  | "planUpdateMeaning"
>;

export type AiChatServiceToolTraceRepository = ReturnType<
  typeof createAiChatToolTraceRepository
>;

export type AiChatGenerationRequest = {
  userId: string;
  chatId: string;
  message: { clientMessageId: string; content: string };
  serverConfig: AiChatServerConfig;
  chatRepository: AiChatServiceRepository;
  vocabularyRepository: AiChatServiceVocabularyRepository;
  vocabularyMutationPlanner: AiChatServiceMutationPlanner;
  toolTraceRepository: AiChatServiceToolTraceRepository;
  abortSignal?: AbortSignal;
};

type AiChatGenerationDependencies = {
  createRuntime: typeof createAiChatRuntime;
  buildPrompt: typeof buildAiChatPrompt;
  startGeneration: typeof startAiChatGeneration;
  createVocabularyTools(input: {
    userId: string;
    currentUserMessage: string;
    repository: AiChatServiceVocabularyRepository;
    mutationPlanner: AiChatServiceMutationPlanner;
    executor: ReturnType<typeof createAiChatToolExecutor>;
  }): ToolSet;
  recordOperationalEvent?(event: AiChatOperationalEvent): unknown;
};

const defaultDependencies: AiChatGenerationDependencies = {
  createRuntime: createAiChatRuntime,
  buildPrompt: buildAiChatPrompt,
  startGeneration: startAiChatGeneration,
  createVocabularyTools: (input) => createAiVocabularyTools(
    createAiVocabularyToolHandlers(input),
    input.executor,
  ),
};

function repositoryFailure(error: unknown): { code: AiChatErrorCode; status: number } {
  if (error instanceof AiChatRepositoryError) {
    return {
      code: error.code,
      status: error.code === "not_found"
        ? 404
        : error.code === "conflict" || error.code === "turn_in_progress"
          ? 409
          : 400,
    };
  }
  return { code: "internal_error", status: 500 };
}

export async function cancelAiChatTurn(input: {
  userId: string;
  chatId: string;
  clientMessageId: string;
  chatRepository: Pick<ReturnType<typeof createAiChatRepository>, "cancelTurn">;
}): Promise<
  | { ok: true; turn: AiChatTurn }
  | { ok: false; error: { code: AiChatErrorCode; status: number } }
> {
  try {
    return {
      ok: true,
      turn: await input.chatRepository.cancelTurn(
        input.userId,
        input.chatId,
        input.clientMessageId,
      ),
    };
  } catch (error) {
    return { ok: false, error: repositoryFailure(error) };
  }
}

export async function prepareAiChatGeneration(
  input: AiChatGenerationRequest,
  dependencies: AiChatGenerationDependencies = defaultDependencies,
): Promise<
  | { ok: true; stream: ReturnType<typeof startAiChatGeneration> }
  | { ok: false; error: { code: AiChatErrorCode; status: number } }
> {
  const recordOperationalEvent = (event: AiChatOperationalEvent) => {
    try {
      (dependencies.recordOperationalEvent || recordAiChatOperationalEvent)(event);
    } catch {
      // Observability must never change generation or persistence behavior.
    }
  };
  let pendingTurn = false;
  let attemptId: string | null = null;
  try {
    const chat = await input.chatRepository.getChatSummary(input.userId, input.chatId);
    if (!chat) return { ok: false, error: { code: "not_found", status: 404 } };

    const currentItems = await input.chatRepository.getCurrentPracticeItems(input.userId, input.chatId);
    const currentPracticeContext = createAiChatPracticeContext(currentItems);
    const turn = await input.chatRepository.beginTurn(input.userId, input.chatId, {
      clientMessageId: input.message.clientMessageId,
      content: input.message.content,
      practiceContext: currentPracticeContext,
      configuredProvenance: describeAiChatConfiguredProvenance(input.serverConfig),
    });
    if (turn.state === "existing") {
      return { ok: false, error: { code: "conflict", status: 409 } };
    }
    pendingTurn = true;
    const currentAttemptId = turn.attempt?.id;
    if (!currentAttemptId || turn.attempt?.status !== "pending") {
      await input.chatRepository.failTurn(
        input.userId,
        input.chatId,
        input.message.clientMessageId,
        "internal_error",
        currentAttemptId || "missing-attempt",
      );
      pendingTurn = false;
      return { ok: false, error: { code: "internal_error", status: 500 } };
    }
    attemptId = currentAttemptId;

    const practiceContext = readAiChatPracticeContext(turn.user.practiceContext);
    if (!practiceContext) {
      await input.chatRepository.failTurn(
        input.userId,
        input.chatId,
        input.message.clientMessageId,
        "internal_error",
        currentAttemptId,
      );
      recordOperationalEvent({
        event: "ai_chat_generation_failed",
        attemptId: currentAttemptId,
        errorCode: "internal_error",
      });
      pendingTurn = false;
      return { ok: false, error: { code: "internal_error", status: 500 } };
    }

    const runtime = dependencies.createRuntime(input.serverConfig);
    if (!runtime.ok) {
      await input.chatRepository.failTurn(
        input.userId,
        input.chatId,
        input.message.clientMessageId,
        runtime.error.code,
        currentAttemptId,
      );
      recordOperationalEvent({
        event: "ai_chat_generation_failed",
        attemptId: currentAttemptId,
        errorCode: runtime.error.code,
      });
      pendingTurn = false;
      return runtime;
    }

    const [history, latestVocabularyListResult] = await Promise.all([
      input.chatRepository.getCanonicalHistory(input.userId, input.chatId, {
        beforeSequence: turn.user.sequence,
      }),
      input.toolTraceRepository.readLatestCompletedToolResult(
        input.userId,
        input.chatId,
        "list_vocabulary",
        { beforeSequence: turn.user.sequence },
      ).catch(() => null),
    ]);
    const prompt = dependencies.buildPrompt({
      explanationLanguage: chat.explanationLanguage,
      targets: practiceContext,
      history: history.map(({ role, content, clientMessageId }) => ({
        role,
        content: role === "assistant" && clientMessageId?.startsWith("opening:")
          ? protectVocabularyOpeningForModel(content)
          : content,
      })),
      currentUserMessage: turn.user.content,
      vocabularyContinuation: readAiVocabularyListContinuation(
        latestVocabularyListResult,
      ),
    });
    const tools = dependencies.createVocabularyTools({
      userId: input.userId,
      currentUserMessage: turn.user.content,
      repository: input.vocabularyRepository,
      mutationPlanner: input.vocabularyMutationPlanner,
      executor: createAiChatToolExecutor(input.toolTraceRepository, {
        userId: input.userId,
        chatId: input.chatId,
        userMessageId: turn.user.id,
        assistantMessageId: turn.assistant.id,
        attemptId: currentAttemptId,
      }),
    });

    try {
      recordOperationalEvent({
        event: "ai_chat_generation_started",
        attemptId: currentAttemptId,
        provider: runtime.value.provenance.provider,
        configuredModel: runtime.value.provenance.model,
        promptId: prompt.id,
        promptVersion: prompt.version,
      });
      const stream = dependencies.startGeneration({
        prompt,
        tools,
        pendingAssistant: { id: turn.assistant.id },
        runtime: runtime.value,
        abortSignal: input.abortSignal,
        repository: {
          completePendingAssistant: async (completion) => {
            if (completion.assistantId !== turn.assistant.id) {
              throw new Error("Unexpected assistant completion id.");
            }
            await input.chatRepository.finishTurn(
              input.userId,
              input.chatId,
              input.message.clientMessageId,
              {
                attemptId: currentAttemptId,
                content: completion.text,
                provider: completion.provider,
                model: completion.model,
                usage: completion.usage,
                terminal: completion.terminal,
              },
            );
            recordOperationalEvent({
              event: "ai_chat_generation_completed",
              attemptId: currentAttemptId,
              provider: completion.provider,
              model: completion.model,
              promptId: prompt.id,
              promptVersion: prompt.version,
              ...completion.terminal,
            });
          },
          failPendingAssistant: async (failure) => {
            if (failure.assistantId !== turn.assistant.id) {
              throw new Error("Unexpected assistant failure id.");
            }
            await input.chatRepository.failTurn(
              input.userId,
              input.chatId,
              input.message.clientMessageId,
              failure.errorCode,
              currentAttemptId,
              failure.terminal,
            );
            recordOperationalEvent({
              event: "ai_chat_generation_failed",
              attemptId: currentAttemptId,
              errorCode: failure.errorCode,
              promptId: prompt.id,
              promptVersion: prompt.version,
              ...failure.terminal,
            });
          },
        },
      });
      pendingTurn = false;
      return { ok: true, stream };
    } catch (error) {
      const failure = runtime.value.mapFailure(error);
      await input.chatRepository.failTurn(
        input.userId,
        input.chatId,
        input.message.clientMessageId,
        failure.code,
        currentAttemptId,
      );
      recordOperationalEvent({
        event: "ai_chat_generation_failed",
        attemptId: currentAttemptId,
        errorCode: failure.code,
        promptId: prompt.id,
        promptVersion: prompt.version,
      });
      pendingTurn = false;
      return { ok: false, error: failure };
    }
  } catch (error) {
    const failure = repositoryFailure(error);
    if (pendingTurn && attemptId) {
      try {
        await input.chatRepository.failTurn(
          input.userId,
          input.chatId,
          input.message.clientMessageId,
          failure.code,
          attemptId,
        );
      } catch {
        // The original stable error remains authoritative when persistence is unavailable.
      }
      recordOperationalEvent({
        event: "ai_chat_generation_failed",
        attemptId,
        errorCode: failure.code,
      });
    }
    return { ok: false, error: failure };
  }
}
