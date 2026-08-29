import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import {
  aiChatErrorResponse,
  readAiMutationPayload,
  readReplaceTargetsPayload,
} from "@/lib/ai-chat/api-contracts";
import { readBoundedText } from "@/lib/ai-chat/contracts";
import { aiChatRouteErrorResponse, noStoreJson } from "@/lib/ai-chat/http";
import { createAiChatRepository } from "@/lib/ai-chat/repository";

export const dynamic = "force-dynamic";

type ChatRouteContext = { params: Promise<{ chatId: string }> };

export async function PATCH(request: Request, context: ChatRouteContext) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const chatId = readBoundedText((await context.params).chatId, 120, { singleLine: true });
  if (!chatId.ok) return aiChatErrorResponse({ code: "not_found", status: 404 });
  const payload = await readAiMutationPayload(request, readReplaceTargetsPayload);
  if (!payload.ok) return aiChatErrorResponse(payload.error);
  try {
    const repository = createAiChatRepository(getD1());
    const targets = await repository.replacePracticeItems(
      user.subject,
      chatId.value,
      payload.value.targets,
    );
    return noStoreJson({ targets });
  } catch (error) {
    return aiChatRouteErrorResponse(error);
  }
}
