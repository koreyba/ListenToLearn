import {
  AiChatRepositoryError,
  type AiChatDetail,
  type AiChatMessage,
} from "./repository.ts";
import { aiChatErrorResponse } from "./api-contracts.ts";
import type { AiChatErrorCode } from "./contracts.ts";

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export type PublicAiChatMessage = Omit<
  AiChatMessage,
  "practiceContext" | "provider" | "model" | "usage"
>;

export type PublicAiChatDetail = Omit<AiChatDetail, "messages"> & {
  messages: PublicAiChatMessage[];
};

export function toPublicAiChatDetail(chat: AiChatDetail): PublicAiChatDetail {
  return {
    id: chat.id,
    title: chat.title,
    explanationLanguage: chat.explanationLanguage,
    targetCount: chat.targetCount,
    messageCount: chat.messageCount,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    targets: chat.targets,
    messages: chat.messages.map((message) => ({
      id: message.id,
      role: message.role,
      sequence: message.sequence,
      content: message.content,
      status: message.status,
      clientMessageId: message.clientMessageId,
      errorCode: message.errorCode,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    })),
  };
}

export function aiChatRouteErrorResponse(error: unknown) {
  if (error instanceof AiChatRepositoryError) {
    const status = error.code === "not_found"
      ? 404
      : error.code === "conflict" || error.code === "turn_in_progress"
        ? 409
        : 400;
    return aiChatErrorResponse({ code: error.code, status });
  }
  return aiChatErrorResponse({ code: "internal_error" satisfies AiChatErrorCode, status: 500 });
}
