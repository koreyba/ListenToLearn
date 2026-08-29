import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import {
  aiChatErrorResponse,
  readAiMutationPayload,
  readAiTranslatePayload,
} from "@/lib/ai-chat/api-contracts";
import { noStoreJson } from "@/lib/ai-chat/http";
import { getAiChatServerConfig } from "@/lib/ai-chat/server-config";
import { translateSelectionWithAi } from "@/lib/ai-chat/translation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const payload = await readAiMutationPayload(request, readAiTranslatePayload);
  if (!payload.ok) return aiChatErrorResponse(payload.error);

  const translation = await translateSelectionWithAi(
    payload.value,
    getAiChatServerConfig(),
  );
  return translation.ok
    ? noStoreJson(translation.value)
    : aiChatErrorResponse(translation.error);
}
