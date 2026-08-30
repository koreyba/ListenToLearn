export const CHAT_SELECTION_LIMITS = Object.freeze({
  translationCharacters: 500,
  entryCharacters: 240,
  contextCharacters: 1_000,
});

export type ChatSelectionAnchor = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ChatTextSelection = {
  messageId: string;
  text: string;
  context: string;
  anchor: ChatSelectionAnchor;
};

function characterCount(value: string) {
  return [...value].length;
}

export function canTranslateChatSelection(selection: Pick<ChatTextSelection, "text">) {
  const length = characterCount(selection.text);
  return length > 0 && length <= CHAT_SELECTION_LIMITS.translationCharacters;
}

export function canAddChatSelection(selection: Pick<ChatTextSelection, "text">) {
  const length = characterCount(selection.text);
  return length > 0 && length <= CHAT_SELECTION_LIMITS.entryCharacters;
}

export function isSameChatSelection(
  current: Pick<ChatTextSelection, "messageId" | "text" | "context"> | null,
  candidate: Pick<ChatTextSelection, "messageId" | "text" | "context">,
) {
  return current?.messageId === candidate.messageId
    && current.text === candidate.text
    && current.context === candidate.context;
}

export function chatTranslationPayload(
  selection: Pick<ChatTextSelection, "text" | "context">,
) {
  return { text: selection.text, context: selection.context };
}

export function chatPhrasePayload(
  selection: Pick<ChatTextSelection, "text" | "context">,
  translation = "",
) {
  return {
    text: selection.text,
    context: selection.context,
    ...(translation.trim() ? { translation: translation.trim() } : {}),
  };
}

export function chatVocabularyStatusLabel(status: string) {
  if (status === "learning_now" || status === "learning") return "Learning";
  if (status === "learnt" || status === "learned") return "Learned";
  if (status === "to_learn") return "To Learn";
  return "Vocabulary";
}
