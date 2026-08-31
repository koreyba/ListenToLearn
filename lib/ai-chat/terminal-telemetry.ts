export const AI_CHAT_TERMINAL_TELEMETRY_MAX_BYTES = 2_048;

const PUBLIC_FINISH_REASONS = new Set([
  "stop",
  "length",
  "content-filter",
  "tool-calls",
  "error",
  "other",
  "unknown",
]);

const PUBLIC_TERMINATIONS = new Set(["lease_expired"]);

export type AiChatTerminalTelemetry = {
  elapsedMs?: number;
  finishReason?: string;
  stepCount?: number;
  toolCallCount?: number;
  outputCharacters?: number;
  termination?: "lease_expired";
};

function boundedCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  const normalized = Math.trunc(value);
  return Number.isSafeInteger(normalized) ? normalized : undefined;
}

export function normalizeAiChatTerminalTelemetry(
  value: unknown,
): AiChatTerminalTelemetry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const normalized: AiChatTerminalTelemetry = {};
  const numericFields = [
    "elapsedMs",
    "stepCount",
    "toolCallCount",
    "outputCharacters",
  ] as const;
  for (const field of numericFields) {
    const count = boundedCount(record[field]);
    if (count !== undefined) normalized[field] = count;
  }
  if (typeof record.finishReason === "string" && PUBLIC_FINISH_REASONS.has(record.finishReason)) {
    normalized.finishReason = record.finishReason;
  }
  if (typeof record.termination === "string" && PUBLIC_TERMINATIONS.has(record.termination)) {
    normalized.termination = record.termination as "lease_expired";
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function serializeAiChatTerminalTelemetry(value: unknown): string | null {
  const normalized = normalizeAiChatTerminalTelemetry(value);
  if (!normalized) return null;
  const serialized = JSON.stringify(normalized);
  return new TextEncoder().encode(serialized).byteLength <= AI_CHAT_TERMINAL_TELEMETRY_MAX_BYTES
    ? serialized
    : null;
}

export function parseAiChatTerminalTelemetry(value: string | null): AiChatTerminalTelemetry | null {
  if (!value || new TextEncoder().encode(value).byteLength > AI_CHAT_TERMINAL_TELEMETRY_MAX_BYTES) {
    return null;
  }
  try {
    return normalizeAiChatTerminalTelemetry(JSON.parse(value));
  } catch {
    return null;
  }
}
