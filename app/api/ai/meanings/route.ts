import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import {
  aiChatErrorResponse,
  readAiMutationPayload,
  readCreateMeaningPayload,
} from "@/lib/ai-chat/api-contracts";
import { readBoundedText } from "@/lib/ai-chat/contracts";
import { aiChatRouteErrorResponse, noStoreJson } from "@/lib/ai-chat/http";
import { createAiChatRepository } from "@/lib/ai-chat/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const phraseId = readBoundedText(new URL(request.url).searchParams.get("phraseId"), 120, {
    singleLine: true,
  });
  if (!phraseId.ok) return aiChatErrorResponse({ code: "not_found", status: 404 });
  try {
    const repository = createAiChatRepository(getD1());
    const result = await repository.listMeanings(user.subject, phraseId.value);
    return result
      ? noStoreJson(result)
      : aiChatErrorResponse({ code: "not_found", status: 404 });
  } catch (error) {
    return aiChatRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const payload = await readAiMutationPayload(request, readCreateMeaningPayload);
  if (!payload.ok) return aiChatErrorResponse(payload.error);
  try {
    const repository = createAiChatRepository(getD1());
    const meaning = await repository.addMeaning(user.subject, payload.value);
    return noStoreJson({ meaning }, { status: 201 });
  } catch (error) {
    return aiChatRouteErrorResponse(error);
  }
}
