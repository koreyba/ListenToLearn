import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import {
  aiChatErrorResponse,
  readAiMutationPayload,
  readCreateChatPayload,
} from "@/lib/ai-chat/api-contracts";
import { aiChatRouteErrorResponse, noStoreJson } from "@/lib/ai-chat/http";
import { createAiChatRepository } from "@/lib/ai-chat/repository";
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
    const repository = createAiChatRepository(getD1());
    const chat = await repository.createChat(user.subject, payload.value);
    return noStoreJson({ chat }, { status: 201 });
  } catch (error) {
    return aiChatRouteErrorResponse(error);
  }
}
