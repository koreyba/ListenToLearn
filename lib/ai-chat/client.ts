import type { UIMessage } from "ai";
import type { AiChatMeaningMode } from "./contracts.ts";

export type AiChatClientMeaning = {
  id: string | null;
  source: "legacy" | "personal";
  translation: string;
  context: string;
};

export type AiChatClientTarget = {
  id: string;
  phraseId: string | null;
  text: string;
  meaningMode: AiChatMeaningMode;
  selectedMeaningId: string | null;
  selectedMeaningSnapshot: string;
  selectedMeaning: AiChatClientMeaning | null;
  knownMeanings: AiChatClientMeaning[];
  createdAt: string;
  updatedAt: string;
};

export type AiChatClientMessage = {
  id: string;
  role: "user" | "assistant";
  sequence: number;
  content: string;
  status: "complete" | "pending" | "failed";
  practiceContext: unknown;
  clientMessageId: string;
  provider: string | null;
  model: string | null;
  usage: unknown;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatClientSummary = {
  id: string;
  title: string;
  explanationLanguage: string;
  targetCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AiChatClientDetail = AiChatClientSummary & {
  targets: AiChatClientTarget[];
  messages: AiChatClientMessage[];
};

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
