import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import {
  aiChatErrorResponse,
  readAiMutationPayload,
  readCreateMeaningPayload,
} from "@/lib/ai-chat/api-contracts";
import { readBoundedText } from "@/lib/ai-chat/contracts";
import { aiChatRouteErrorResponse, noStoreJson } from "@/lib/ai-chat/http";
import {
  createVocabularyRepository,
  VocabularyRepositoryError,
} from "@/lib/vocabulary/repository";

export const dynamic = "force-dynamic";

function meaningRouteErrorResponse(error: unknown) {
  if (error instanceof VocabularyRepositoryError) {
    const status = error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 400;
    return aiChatErrorResponse({ code: error.code, status });
  }
  return aiChatRouteErrorResponse(error);
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const phraseId = readBoundedText(new URL(request.url).searchParams.get("phraseId"), 120, {
    singleLine: true,
  });
  if (!phraseId.ok) return aiChatErrorResponse({ code: "not_found", status: 404 });
  try {
    const repository = createVocabularyRepository(getD1());
    const result = await repository.listMeanings(user.subject, phraseId.value);
    return result
      ? noStoreJson(result)
      : aiChatErrorResponse({ code: "not_found", status: 404 });
  } catch (error) {
    return meaningRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const payload = await readAiMutationPayload(request, readCreateMeaningPayload);
  if (!payload.ok) return aiChatErrorResponse(payload.error);
  try {
    const repository = createVocabularyRepository(getD1());
    const meaning = await repository.addMeaning(user.subject, payload.value);
    return noStoreJson({ meaning }, { status: 201 });
  } catch (error) {
    return meaningRouteErrorResponse(error);
  }
}
