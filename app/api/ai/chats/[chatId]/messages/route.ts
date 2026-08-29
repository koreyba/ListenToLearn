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
import { createAiChatRepository } from "@/lib/ai-chat/repository";
import { getAiChatServerConfig } from "@/lib/ai-chat/server-config";
import { prepareAiChatGeneration } from "@/lib/ai-chat/service";

export const dynamic = "force-dynamic";

type ChatRouteContext = { params: Promise<{ chatId: string }> };

export async function POST(request: Request, context: ChatRouteContext) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const chatId = readBoundedText((await context.params).chatId, 120, { singleLine: true });
  if (!chatId.ok) return aiChatErrorResponse({ code: "not_found", status: 404 });
  const payload = await readAiMutationPayload(request, readGenerateMessagePayload);
  if (!payload.ok) return aiChatErrorResponse(payload.error);

  try {
    const repository = createAiChatRepository(getD1());
    const generation = await prepareAiChatGeneration({
      userId: user.subject,
      chatId: chatId.value,
      message: payload.value,
      serverConfig: getAiChatServerConfig(),
      repository,
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
