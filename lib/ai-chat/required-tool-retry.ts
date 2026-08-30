import type { LanguageModelMiddleware } from "ai";

const DEFAULT_MAX_ATTEMPTS = 3;

type RequiredToolRetryOptions = {
  maxAttempts?: number;
  onRetry?: (completedAttempt: number) => void;
  fallbackToolCall?: () => {
    toolName: string;
    input: Record<string, unknown>;
  } | null;
  onFallback?: () => void;
};

type StreamChunk = {
  type: string;
  [key: string]: unknown;
};

function boundedAttempts(value: number | undefined) {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? Math.min(3, Math.max(1, value))
    : DEFAULT_MAX_ATTEMPTS;
}

function requiredToolWasCalled(chunks: readonly StreamChunk[]) {
  return chunks.some((chunk) => chunk.type === "tool-call");
}

function streamHasError(chunks: readonly StreamChunk[]) {
  return chunks.some((chunk) => chunk.type === "error");
}

function requiredToolError(): StreamChunk {
  const error = new Error("The required proposal tool was not called.");
  error.name = "RequiredToolNotCalledError";
  return { type: "error", error };
}

function fallbackToolChunks(
  providerChunks: readonly StreamChunk[],
  fallback: { toolName: string; input: Record<string, unknown> },
) {
  const chunks = providerChunks.filter((chunk) => (
    chunk.type === "stream-start" || chunk.type === "response-metadata"
  ));
  chunks.push({
    type: "tool-call",
    toolCallId: `server-fallback-${crypto.randomUUID()}`,
    toolName: fallback.toolName,
    input: JSON.stringify(fallback.input),
  });
  const providerFinish = [...providerChunks]
    .reverse()
    .find((chunk) => chunk.type === "finish");
  if (providerFinish) {
    chunks.push({
      ...providerFinish,
      finishReason: { unified: "tool-calls", raw: undefined },
    });
  }
  return chunks;
}

/**
 * Some OpenAI-compatible providers occasionally return plain text even when a
 * tool is required. Buffer only those forced-tool model calls, discard an
 * ungrounded text-only response, and retry within the caller's existing step
 * and first-chunk deadlines. Ordinary chat responses keep streaming normally.
 */
export function createRequiredToolRetryMiddleware(
  options: RequiredToolRetryOptions = {},
): LanguageModelMiddleware {
  const maxAttempts = boundedAttempts(options.maxAttempts);
  return {
    specificationVersion: "v4",
    async wrapStream({ doStream, params }) {
      const first = await doStream();
      if (params.toolChoice?.type !== "required" || maxAttempts === 1) {
        return first;
      }

      let activeReader: ReadableStreamDefaultReader<StreamChunk> | null = null;
      let cancelled = false;
      const retryingStream = new ReadableStream<StreamChunk>({
        async start(controller) {
          let current = first;
          try {
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
              const chunks: StreamChunk[] = [];
              activeReader = current.stream.getReader() as ReadableStreamDefaultReader<StreamChunk>;
              for (;;) {
                const next = await activeReader.read();
                if (next.done) break;
                chunks.push(next.value);
              }
              activeReader = null;
              if (cancelled) return;

              if (requiredToolWasCalled(chunks) || streamHasError(chunks)) {
                for (const chunk of chunks) controller.enqueue(chunk);
                controller.close();
                return;
              }
              if (attempt === maxAttempts) {
                const fallback = options.fallbackToolCall?.();
                if (fallback) {
                  options.onFallback?.();
                  for (const chunk of fallbackToolChunks(chunks, fallback)) {
                    controller.enqueue(chunk);
                  }
                } else {
                  controller.enqueue(requiredToolError());
                }
                controller.close();
                return;
              }

              options.onRetry?.(attempt);
              current = await doStream();
            }
          } catch (error) {
            if (!cancelled) controller.error(error);
          }
        },
        async cancel(reason) {
          cancelled = true;
          await activeReader?.cancel(reason);
        },
      });

      return {
        ...first,
        stream: retryingStream as typeof first.stream,
      };
    },
  };
}
