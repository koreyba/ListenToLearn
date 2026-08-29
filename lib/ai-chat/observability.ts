import {
  AI_CHAT_ERROR_CODES,
  type AiChatErrorCode,
} from "./contracts.ts";

export type AiChatOperationalEvent =
  | {
      event: "ai_chat_generation_started";
      attemptId: string;
      provider: string;
      configuredModel: string;
      promptId: string;
      promptVersion: string;
    }
  | {
      event: "ai_chat_generation_completed";
      attemptId: string;
      provider: string;
      model: string;
      promptId: string;
      promptVersion: string;
    }
  | {
      event: "ai_chat_generation_failed";
      attemptId: string;
      errorCode: AiChatErrorCode;
      promptId?: string;
      promptVersion?: string;
    }
  | {
      event: "ai_chat_generation_rejected";
      errorCode: AiChatErrorCode;
    };

type OperationalRecord = Record<string, string>;
type OperationalSink = (record: OperationalRecord) => void;

const knownErrorCodes = new Set<string>(Object.values(AI_CHAT_ERROR_CODES));

function safeTag(value: unknown, maximum = 240) {
  if (typeof value !== "string") return "unknown";
  const tag = value.trim();
  return tag
    && tag.length <= maximum
    && /^@?[a-z0-9][a-z0-9._:/-]*$/iu.test(tag)
    ? tag
    : "unknown";
}

function safeErrorCode(value: unknown) {
  return typeof value === "string" && knownErrorCodes.has(value)
    ? value
    : AI_CHAT_ERROR_CODES.internalError;
}

function allowlistedRecord(event: AiChatOperationalEvent): OperationalRecord | null {
  switch (event?.event) {
    case "ai_chat_generation_started":
      return {
        event: event.event,
        attemptId: safeTag(event.attemptId, 120),
        provider: safeTag(event.provider, 80),
        configuredModel: safeTag(event.configuredModel),
        promptId: safeTag(event.promptId, 120),
        promptVersion: safeTag(event.promptVersion, 40),
      };
    case "ai_chat_generation_completed":
      return {
        event: event.event,
        attemptId: safeTag(event.attemptId, 120),
        provider: safeTag(event.provider, 80),
        model: safeTag(event.model),
        promptId: safeTag(event.promptId, 120),
        promptVersion: safeTag(event.promptVersion, 40),
      };
    case "ai_chat_generation_failed":
      return {
        event: event.event,
        attemptId: safeTag(event.attemptId, 120),
        errorCode: safeErrorCode(event.errorCode),
        ...(event.promptId && event.promptVersion
          ? {
              promptId: safeTag(event.promptId, 120),
              promptVersion: safeTag(event.promptVersion, 40),
            }
          : {}),
      };
    case "ai_chat_generation_rejected":
      return {
        event: event.event,
        errorCode: safeErrorCode(event.errorCode),
      };
    default:
      return null;
  }
}

export function recordAiChatOperationalEvent(
  event: AiChatOperationalEvent,
  sink: OperationalSink = (record) => console.info(record),
) {
  const record = allowlistedRecord(event);
  if (!record) return false;
  try {
    sink(record);
    return true;
  } catch {
    return false;
  }
}
