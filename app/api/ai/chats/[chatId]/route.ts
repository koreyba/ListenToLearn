import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import { aiChatErrorResponse } from "@/lib/ai-chat/api-contracts";
import {
  aiChatRouteErrorResponse,
  noStoreJson,
  toPublicAiChatDetail,
} from "@/lib/ai-chat/http";
import { createAiChatRepository } from "@/lib/ai-chat/repository";
import { readBoundedText } from "@/lib/ai-chat/contracts";

export const dynamic = "force-dynamic";

type ChatRouteContext = { params: Promise<{ chatId: string }> };

export async function GET(request: Request, context: ChatRouteContext) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const chatId = readBoundedText((await context.params).chatId, 120, { singleLine: true });
  if (!chatId.ok) return aiChatErrorResponse({ code: "not_found", status: 404 });
  try {
    const repository = createAiChatRepository(getD1());
    const chat = await repository.getChat(user.subject, chatId.value);
    return chat
      ? noStoreJson({ chat: toPublicAiChatDetail(chat) })
      : aiChatErrorResponse({ code: "not_found", status: 404 });
  } catch (error) {
    return aiChatRouteErrorResponse(error);
  }
}
