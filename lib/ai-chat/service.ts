import { buildAiChatPrompt } from "./prompt.ts";
import {
  createAiChatPracticeContext,
  readAiChatPracticeContext,
} from "./practice-context.ts";
import {
  AiChatRepositoryError,
  createAiChatRepository,
} from "./repository.ts";
import {
  createAiChatRuntime,
  mapAiChatRuntimeFailure,
  type AiChatServerConfig,
} from "./runtime.ts";
import { startAiChatGeneration } from "./generation.ts";
import type { AiChatErrorCode } from "./contracts.ts";

export type AiChatServiceRepository = Pick<
  ReturnType<typeof createAiChatRepository>,
  | "beginTurn"
  | "failTurn"
  | "finishTurn"
  | "getCanonicalHistory"
  | "getChatSummary"
  | "getCurrentPracticeItems"
>;

export type AiChatGenerationRequest = {
  userId: string;
  chatId: string;
  message: { clientMessageId: string; content: string };
  serverConfig: AiChatServerConfig;
  repository: AiChatServiceRepository;
  abortSignal?: AbortSignal;
};

type AiChatGenerationDependencies = {
  createRuntime: typeof createAiChatRuntime;
  buildPrompt: typeof buildAiChatPrompt;
  startGeneration: typeof startAiChatGeneration;
};

const defaultDependencies: AiChatGenerationDependencies = {
  createRuntime: createAiChatRuntime,
  buildPrompt: buildAiChatPrompt,
  startGeneration: startAiChatGeneration,
};

function repositoryFailure(error: unknown): { code: AiChatErrorCode; status: number } {
  if (error instanceof AiChatRepositoryError) {
    return {
      code: error.code,
      status: error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 400,
    };
  }
  return { code: "internal_error", status: 500 };
}

export async function prepareAiChatGeneration(
  input: AiChatGenerationRequest,
  dependencies: AiChatGenerationDependencies = defaultDependencies,
): Promise<
  | { ok: true; stream: ReturnType<typeof startAiChatGeneration> }
  | { ok: false; error: { code: AiChatErrorCode; status: number } }
> {
  let pendingTurn = false;
  let attemptUpdatedAt: string | null = null;
  try {
    const chat = await input.repository.getChatSummary(input.userId, input.chatId);
    if (!chat) return { ok: false, error: { code: "not_found", status: 404 } };

    const currentItems = await input.repository.getCurrentPracticeItems(input.userId, input.chatId);
    const currentPracticeContext = createAiChatPracticeContext(currentItems);
    const turn = await input.repository.beginTurn(input.userId, input.chatId, {
      clientMessageId: input.message.clientMessageId,
      content: input.message.content,
      practiceContext: currentPracticeContext,
    });
    if (turn.state === "existing") {
      return { ok: false, error: { code: "conflict", status: 409 } };
    }
    pendingTurn = true;
    const currentAttemptUpdatedAt = turn.assistant.updatedAt;
    attemptUpdatedAt = currentAttemptUpdatedAt;

    const practiceContext = readAiChatPracticeContext(turn.user.practiceContext);
    if (!practiceContext) {
      await input.repository.failTurn(
        input.userId,
        input.chatId,
        input.message.clientMessageId,
        "internal_error",
        currentAttemptUpdatedAt,
      );
      pendingTurn = false;
      return { ok: false, error: { code: "internal_error", status: 500 } };
    }

    const runtime = dependencies.createRuntime(input.serverConfig);
    if (!runtime.ok) {
      await input.repository.failTurn(
        input.userId,
        input.chatId,
        input.message.clientMessageId,
        runtime.error.code,
        currentAttemptUpdatedAt,
      );
      pendingTurn = false;
      return runtime;
    }

    const history = await input.repository.getCanonicalHistory(input.userId, input.chatId, {
      beforeSequence: turn.user.sequence,
    });
    const prompt = dependencies.buildPrompt({
      explanationLanguage: chat.explanationLanguage,
      targets: practiceContext,
      history: history.map(({ role, content }) => ({ role, content })),
      currentUserMessage: turn.user.content,
    });

    try {
      const stream = dependencies.startGeneration({
        prompt,
        pendingAssistant: { id: turn.assistant.id },
        runtime: runtime.value,
        abortSignal: input.abortSignal,
        repository: {
          completePendingAssistant: async (completion) => {
            if (completion.assistantId !== turn.assistant.id) {
              throw new Error("Unexpected assistant completion id.");
            }
            await input.repository.finishTurn(
              input.userId,
              input.chatId,
              input.message.clientMessageId,
              {
                attemptUpdatedAt: currentAttemptUpdatedAt,
                content: completion.text,
                provider: completion.provider,
                model: completion.model,
                usage: completion.usage,
              },
            );
          },
          failPendingAssistant: async (failure) => {
            if (failure.assistantId !== turn.assistant.id) {
              throw new Error("Unexpected assistant failure id.");
            }
            await input.repository.failTurn(
              input.userId,
              input.chatId,
              input.message.clientMessageId,
              failure.errorCode,
              currentAttemptUpdatedAt,
            );
          },
        },
      });
      pendingTurn = false;
      return { ok: true, stream };
    } catch (error) {
      const failure = mapAiChatRuntimeFailure(error);
      await input.repository.failTurn(
        input.userId,
        input.chatId,
        input.message.clientMessageId,
        failure.code,
        currentAttemptUpdatedAt,
      );
      pendingTurn = false;
      return { ok: false, error: failure };
    }
  } catch (error) {
    const failure = repositoryFailure(error);
    if (pendingTurn && attemptUpdatedAt) {
      try {
        await input.repository.failTurn(
          input.userId,
          input.chatId,
          input.message.clientMessageId,
          failure.code,
          attemptUpdatedAt,
        );
      } catch {
        // The original stable error remains authoritative when persistence is unavailable.
      }
    }
    return { ok: false, error: failure };
  }
}
