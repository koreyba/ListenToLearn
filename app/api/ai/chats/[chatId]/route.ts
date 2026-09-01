import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import { aiChatErrorResponse } from "@/lib/ai-chat/api-contracts";
import {
  aiChatRouteErrorResponse,
  noStoreJson,
  toPublicAiChatDetail,
} from "@/lib/ai-chat/http";
import { createAiChatRepository } from "@/lib/ai-chat/repository";
import { createAiChatWriteProposalRepository } from "@/lib/ai-chat/write-proposals";
import { createVocabularyMutationPlanner } from "@/lib/vocabulary/mutations";
import { readBoundedText } from "@/lib/ai-chat/contracts";

export const dynamic = "force-dynamic";

type ChatRouteContext = { params: Promise<{ chatId: string }> };

export async function GET(request: Request, context: ChatRouteContext) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const chatId = readBoundedText((await context.params).chatId, 120, { singleLine: true });
  if (!chatId.ok) return aiChatErrorResponse({ code: "not_found", status: 404 });
  try {
    const db = getD1();
    const repository = createAiChatRepository(db);
    const chat = await repository.getChat(user.subject, chatId.value);
    if (!chat) return aiChatErrorResponse({ code: "not_found", status: 404 });
    const writeProposals = await createAiChatWriteProposalRepository(
      db,
      createVocabularyMutationPlanner(db),
    ).listForChat(user.subject, chatId.value);
    const publicChat = toPublicAiChatDetail(chat);
    publicChat.writeProposals = writeProposals;
    return chat
      ? noStoreJson({ chat: publicChat })
      : aiChatErrorResponse({ code: "not_found", status: 404 });
  } catch (error) {
    return aiChatRouteErrorResponse(error);
  }
}
