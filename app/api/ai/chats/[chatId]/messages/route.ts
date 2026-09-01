import { createUIMessageStreamResponse } from "ai";
import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import {
  aiChatErrorResponse,
  readAiMutationPayload,
  readGenerateMessagePayload,
} from "@/lib/ai-chat/api-contracts";
import { readBoundedText } from "@/lib/ai-chat/contracts";
import { aiChatRouteErrorResponse } from "@/lib/ai-chat/http";
import { recordAiChatOperationalEvent } from "@/lib/ai-chat/observability";
import { enforceAiChatGenerationRateLimit } from "@/lib/ai-chat/rate-limit";
import { createAiChatRepository } from "@/lib/ai-chat/repository";
import {
  getAiChatRateLimitBindings,
  getAiChatServerConfig,
} from "@/lib/ai-chat/server-config";
import { prepareAiChatGeneration } from "@/lib/ai-chat/service";
import { createAiChatToolTraceRepository } from "@/lib/ai-chat/tool-trace";
import { createVocabularyMutationPlanner } from "@/lib/vocabulary/mutations";
import { createVocabularyRepository } from "@/lib/vocabulary/repository";

export const dynamic = "force-dynamic";

type ChatRouteContext = { params: Promise<{ chatId: string }> };

export async function POST(request: Request, context: ChatRouteContext) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const chatId = readBoundedText((await context.params).chatId, 120, { singleLine: true });
  if (!chatId.ok) return aiChatErrorResponse({ code: "not_found", status: 404 });
  const payload = await readAiMutationPayload(request, readGenerateMessagePayload);
  if (!payload.ok) return aiChatErrorResponse(payload.error);
  const rateLimit = await enforceAiChatGenerationRateLimit({
    userId: user.subject,
    ...getAiChatRateLimitBindings(),
  });
  if (!rateLimit.ok) {
    recordAiChatOperationalEvent({
      event: "ai_chat_generation_rejected",
      errorCode: rateLimit.error.code,
    });
    return aiChatErrorResponse(rateLimit.error);
  }

  try {
    const db = getD1();
    const repository = createAiChatRepository(db);
    const vocabularyRepository = createVocabularyRepository(db);
    const generation = await prepareAiChatGeneration({
      userId: user.subject,
      chatId: chatId.value,
      message: payload.value,
      serverConfig: getAiChatServerConfig(),
      chatRepository: repository,
      vocabularyRepository,
      vocabularyMutationPlanner: createVocabularyMutationPlanner(db),
      toolTraceRepository: createAiChatToolTraceRepository(db),
      abortSignal: request.signal,
    });
    if (!generation.ok) return aiChatErrorResponse(generation.error);
    return createUIMessageStreamResponse({
      stream: generation.stream,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return aiChatRouteErrorResponse(error);
  }
}
