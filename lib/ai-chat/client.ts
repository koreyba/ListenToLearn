import type { UIMessage } from "ai";
import type { AiChatMeaningMode } from "./contracts.ts";
import type {
  AiChatPublicDetail,
  AiChatPublicMeaning,
  AiChatPublicMessage,
  AiChatPublicSummary,
  AiChatPublicTarget,
} from "./public-contracts.ts";

export type AiChatClientMeaning = AiChatPublicMeaning;
export type AiChatClientTarget = AiChatPublicTarget;
export type AiChatClientMessage = AiChatPublicMessage;
export type AiChatClientSummary = AiChatPublicSummary;
export type AiChatClientDetail = AiChatPublicDetail;

export type AiChatUiMetadata = {
  status: "complete" | "pending" | "failed";
  clientMessageId: string;
  errorCode: string | null;
};

export type AiChatUiMessage = UIMessage<AiChatUiMetadata>;

export type AiChatTargetRequest =
  | { phraseId: string; meaningMode: AiChatMeaningMode; selectedMeaningId?: string }
  | { text: string; meaningMode: Exclude<AiChatMeaningMode, "selected"> };

export function toAiChatUiMessages(messages: readonly AiChatClientMessage[]): AiChatUiMessage[] {
  return messages.map((message) => ({
    id: message.role === "user" ? message.clientMessageId : message.id,
    role: message.role,
    parts: message.content ? [{ type: "text" as const, text: message.content }] : [],
    metadata: {
      status: message.status,
      clientMessageId: message.clientMessageId,
      errorCode: message.errorCode,
    },
  }));
}

export function aiChatUiMessageText(message: Pick<AiChatUiMessage, "parts">) {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function prepareAiChatMessageRequest(options: { messages: readonly AiChatUiMessage[] }) {
  let lastUserMessage: AiChatUiMessage | undefined;
  for (let index = options.messages.length - 1; index >= 0; index -= 1) {
    if (options.messages[index].role === "user") {
      lastUserMessage = options.messages[index];
      break;
    }
  }
  if (!lastUserMessage) throw new Error("A user message is required.");
  return {
    body: {
      clientMessageId: lastUserMessage.id,
      content: aiChatUiMessageText(lastUserMessage),
    },
  };
}

export function toAiChatTargetInput(target: AiChatClientTarget): AiChatTargetRequest {
  if (!target.phraseId) {
    if (target.meaningMode === "selected") {
      throw new Error("An ad-hoc target cannot select a saved meaning.");
    }
    return { text: target.text, meaningMode: target.meaningMode };
  }
  if (target.meaningMode === "selected") {
    const selectedMeaningId = target.selectedMeaning?.id;
    if (!selectedMeaningId) throw new Error("A selected meaning is required.");
    return {
      phraseId: target.phraseId,
      meaningMode: "selected",
      selectedMeaningId,
    };
  }
  return {
    phraseId: target.phraseId,
    meaningMode: target.meaningMode,
  };
}
