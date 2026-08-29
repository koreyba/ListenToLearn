import {
  AiChatRepositoryError,
  type AiChatDetail,
} from "./repository.ts";
import { aiChatErrorResponse } from "./api-contracts.ts";
import type { AiChatErrorCode } from "./contracts.ts";
import type {
  AiChatPublicDetail,
  AiChatPublicMessage,
} from "./public-contracts.ts";

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export type PublicAiChatMessage = AiChatPublicMessage;
export type PublicAiChatDetail = AiChatPublicDetail;

export function toPublicAiChatDetail(chat: AiChatDetail): PublicAiChatDetail {
  return {
    id: chat.id,
    title: chat.title,
    explanationLanguage: chat.explanationLanguage,
    targetCount: chat.targetCount,
    messageCount: chat.messageCount,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    targets: chat.targets.map((target) => ({
      id: target.id,
      phraseId: target.phraseId,
      text: target.text,
      meaningMode: target.meaningMode,
      selectedMeaningId: target.selectedMeaningId,
      selectedMeaningSnapshot: target.selectedMeaningSnapshot,
      selectedMeaning: target.selectedMeaning && {
        id: target.selectedMeaning.id,
        source: target.selectedMeaning.source,
        translation: target.selectedMeaning.translation,
        context: target.selectedMeaning.context,
      },
      knownMeanings: target.knownMeanings.map((meaning) => ({
        id: meaning.id,
        source: meaning.source,
        translation: meaning.translation,
        context: meaning.context,
      })),
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
    })),
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
