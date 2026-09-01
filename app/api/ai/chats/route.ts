import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import {
  aiChatErrorResponse,
  readAiMutationPayload,
  readCreateChatPayload,
} from "@/lib/ai-chat/api-contracts";
import {
  aiChatRouteErrorResponse,
  noStoreJson,
  toPublicAiChatDetail,
} from "@/lib/ai-chat/http";
import { createChatWithVocabularyOpening } from "@/lib/ai-chat/chat-creation";
import { createAiChatRepository } from "@/lib/ai-chat/repository";
import { createVocabularyRepository } from "@/lib/vocabulary/repository";
import { isAiChatServerConfigured } from "@/lib/ai-chat/server-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  try {
    const repository = createAiChatRepository(getD1());
    const chats = await repository.listChats(user.subject);
    return noStoreJson({ chats, generationConfigured: isAiChatServerConfigured() });
  } catch (error) {
    return aiChatRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const payload = await readAiMutationPayload(request, readCreateChatPayload);
  if (!payload.ok) return aiChatErrorResponse(payload.error);
  try {
    const db = getD1();
    const chat = await createChatWithVocabularyOpening({
      chatRepository: createAiChatRepository(db),
      vocabularyRepository: createVocabularyRepository(db),
      userId: user.subject,
      targets: payload.value.targets,
    });
    return noStoreJson({ chat: toPublicAiChatDetail(chat) }, { status: 201 });
  } catch (error) {
    return aiChatRouteErrorResponse(error);
  }
}
