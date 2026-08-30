import { getD1 } from "@/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";
import {
  aiChatErrorResponse,
  readAiMutationPayload,
  readWriteProposalDecisionPayload,
} from "@/lib/ai-chat/api-contracts";
import { readBoundedText } from "@/lib/ai-chat/contracts";
import { noStoreJson } from "@/lib/ai-chat/http";
import {
  AiChatWriteProposalError,
  createAiChatWriteProposalRepository,
} from "@/lib/ai-chat/write-proposals";
import { createVocabularyMutationPlanner } from "@/lib/vocabulary/mutations";

export const dynamic = "force-dynamic";

type WriteProposalRouteContext = {
  params: Promise<{ chatId: string; proposalId: string }>;
};

export async function PATCH(request: Request, context: WriteProposalRouteContext) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();
  const params = await context.params;
  const chatId = readBoundedText(params.chatId, 120, { singleLine: true });
  const proposalId = readBoundedText(params.proposalId, 160, { singleLine: true });
  if (!chatId.ok || !proposalId.ok) {
    return aiChatErrorResponse({ code: "not_found", status: 404 });
  }
  const payload = await readAiMutationPayload(request, readWriteProposalDecisionPayload);
  if (!payload.ok) return aiChatErrorResponse(payload.error);

  try {
    const db = getD1();
    const repository = createAiChatWriteProposalRepository(db, createVocabularyMutationPlanner(db));
    const proposal = await repository.decide(
      user.subject,
      chatId.value,
      proposalId.value,
      payload.value.decision,
    );
    return noStoreJson({ proposal });
  } catch (error) {
    if (error instanceof AiChatWriteProposalError) {
      const status = error.code === "not_found"
        ? 404
        : error.code === "conflict"
          ? 409
          : error.code === "invalid_input"
            ? 400
            : 503;
      const code = error.code === "invalid_input"
        ? "invalid_request"
        : error.code === "operation_failed"
          ? "internal_error"
          : error.code;
      return aiChatErrorResponse({ code, status });
    }
    return aiChatErrorResponse({ code: "internal_error", status: 500 });
  }
}
