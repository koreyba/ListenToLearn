import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import {
  aiChatErrorResponse,
  readAiMutationPayload,
  readCancelTurnPayload,
} from "@/lib/ai-chat/api-contracts";
import { readBoundedText } from "@/lib/ai-chat/contracts";
import {
  aiChatRouteErrorResponse,
  noStoreJson,
  toPublicAiChatTurnTerminal,
} from "@/lib/ai-chat/http";
import { createAiChatRepository } from "@/lib/ai-chat/repository";
import { recordAiChatOperationalEvent } from "@/lib/ai-chat/observability";
import { cancelAiChatTurn } from "@/lib/ai-chat/service";

export const dynamic = "force-dynamic";

type CancelTurnRouteContext = {
  params: Promise<{ chatId: string; clientMessageId: string }>;
};

export async function POST(request: Request, context: CancelTurnRouteContext) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const params = await context.params;
  const chatId = readBoundedText(params.chatId, 120, { singleLine: true });
  const clientMessageId = readBoundedText(params.clientMessageId, 120, {
    singleLine: true,
  });
  if (!chatId.ok || !clientMessageId.ok) {
    return aiChatErrorResponse({ code: "not_found", status: 404 });
  }
  const payload = await readAiMutationPayload(request, readCancelTurnPayload);
  if (!payload.ok) return aiChatErrorResponse(payload.error);

  try {
    const result = await cancelAiChatTurn({
      userId: user.subject,
      chatId: chatId.value,
      clientMessageId: clientMessageId.value,
      chatRepository: createAiChatRepository(getD1()),
    });
    if (!result.ok) return aiChatErrorResponse(result.error);
    if (
      result.turn.assistant.errorCode === "generation_cancelled"
      && result.turn.attempt?.id
    ) {
      recordAiChatOperationalEvent({
        event: "ai_chat_turn_cancelled",
        attemptId: result.turn.attempt.id,
      });
    }
    return noStoreJson({ turn: toPublicAiChatTurnTerminal(result.turn) });
  } catch (error) {
    return aiChatRouteErrorResponse(error);
  }
}
