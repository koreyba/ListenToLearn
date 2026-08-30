import {
  AI_CHAT_ERROR_CODES,
  type AiChatErrorCode,
} from "./contracts.ts";

type AiChatTerminalOperationalTelemetry = {
  elapsedMs?: number;
  finishReason?: string;
  stepCount?: number;
  toolCallCount?: number;
  outputCharacters?: number;
  requiredToolRetries?: number;
  requiredToolFallbacks?: number;
};

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
    } & AiChatTerminalOperationalTelemetry
  | {
      event: "ai_chat_generation_failed";
      attemptId: string;
      errorCode: AiChatErrorCode;
      promptId?: string;
      promptVersion?: string;
    } & AiChatTerminalOperationalTelemetry
  | {
      event: "ai_chat_generation_rejected";
      errorCode: AiChatErrorCode;
    };

type OperationalRecord = Record<string, string | number>;
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

function safeMetric(value: unknown, maximum: number) {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= maximum
    ? value
    : null;
}

function terminalRecord(event: AiChatTerminalOperationalTelemetry): OperationalRecord {
  const elapsedMs = safeMetric(event.elapsedMs, 86_400_000);
  const stepCount = safeMetric(event.stepCount, 100);
  const toolCallCount = safeMetric(event.toolCallCount, 100);
  const outputCharacters = safeMetric(event.outputCharacters, 1_000_000);
  const requiredToolRetries = safeMetric(event.requiredToolRetries, 10);
  const requiredToolFallbacks = safeMetric(event.requiredToolFallbacks, 10);
  const finishReason = typeof event.finishReason === "string"
    && ["stop", "length", "content-filter", "tool-calls", "error", "other", "unknown"]
      .includes(event.finishReason)
    ? event.finishReason
    : null;
  return {
    ...(elapsedMs === null ? {} : { elapsedMs }),
    ...(finishReason === null ? {} : { finishReason }),
    ...(stepCount === null ? {} : { stepCount }),
    ...(toolCallCount === null ? {} : { toolCallCount }),
    ...(outputCharacters === null ? {} : { outputCharacters }),
    ...(requiredToolRetries === null ? {} : { requiredToolRetries }),
    ...(requiredToolFallbacks === null ? {} : { requiredToolFallbacks }),
  };
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
        ...terminalRecord(event),
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
        ...terminalRecord(event),
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
