import { readFeedbackPayload } from "./contracts.ts";
import { deliverFeedbackToTelegram } from "./delivery.ts";
import { MAX_FEEDBACK_IMAGE_BYTES, validateFeedbackImage } from "./image.ts";
import type { FeedbackRateLimitResult } from "./rate-limit.ts";
import type { FeedbackRepository } from "./repository.ts";
import type { FeedbackTelegramConfig } from "./telegram.ts";

type FeedbackPostHandlerDependencies = {
  repository: FeedbackRepository;
  getConfig: () => FeedbackTelegramConfig | null;
  schedule: (promise: Promise<void>) => void;
  rateLimit: (request: Request) => Promise<FeedbackRateLimitResult>;
  deliver?: typeof deliverFeedbackToTelegram;
};

const MAX_FEEDBACK_REQUEST_BYTES = 8_192;
const MAX_FEEDBACK_MULTIPART_BYTES = MAX_FEEDBACK_IMAGE_BYTES + 32_768;

class FeedbackRequestTooLargeError extends Error {}

async function readBoundedBody(request: Request, maxBytes: number): Promise<ArrayBuffer> {
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new FeedbackRequestTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(new ArrayBuffer(totalBytes));
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

async function readRequestInput(
  request: Request,
  body: ArrayBuffer,
): Promise<{ input: unknown; image: File | null }> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("multipart/form-data")) {
    return { input: JSON.parse(new TextDecoder().decode(body)), image: null };
  }
  const form = await new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  }).formData();
  const image = form.get("image");
  return {
    input: Object.fromEntries(form),
    image: image instanceof File && image.size > 0 ? image : null,
  };
}

function json(data: unknown, status: number) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function createFeedbackPostHandler({
  repository,
  getConfig,
  schedule,
  rateLimit,
  deliver = deliverFeedbackToTelegram,
}: FeedbackPostHandlerDependencies) {
  return async function postFeedback(request: Request): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (request.headers.get("Origin") !== requestUrl.origin) {
      return json({ error: "Invalid request origin." }, 403);
    }
    const rateLimitResult = await rateLimit(request);
    if (!rateLimitResult.ok) {
      const message = rateLimitResult.status === 429
        ? "Too many feedback requests. Try again later."
        : "Feedback is temporarily unavailable.";
      return json({ error: message }, rateLimitResult.status);
    }
    const contentType = request.headers.get("Content-Type")?.toLowerCase() || "";
    const contentLength = Number(request.headers.get("Content-Length") || 0);
    const maxRequestBytes = contentType.startsWith("multipart/form-data")
      ? MAX_FEEDBACK_MULTIPART_BYTES
      : MAX_FEEDBACK_REQUEST_BYTES;
    if (contentLength > maxRequestBytes) {
      return json({ error: "The request is too large." }, 413);
    }
    let input: unknown;
    let image: File | null;
    try {
      const body = await readBoundedBody(request, maxRequestBytes);
      ({ input, image } = await readRequestInput(request, body));
    } catch (error) {
      if (error instanceof FeedbackRequestTooLargeError) {
        return json({ error: "The request is too large." }, 413);
      }
      return json({ error: "Invalid feedback request." }, 400);
    }
    if (image) {
      const invalidImage = await validateFeedbackImage(image);
      if (invalidImage) return json({ error: invalidImage.error }, invalidImage.status);
    }
    const parsed = readFeedbackPayload(input, requestUrl.origin);
    if (!parsed.ok) {
      if (parsed.spam) return json({ ok: true }, 202);
      return json({ error: parsed.error }, 400);
    }

    const submission = await repository.create({
      ...parsed.value,
      userAgent: (request.headers.get("User-Agent") || "").trim().slice(0, 500),
    });
    schedule(deliver({
      submission,
      image,
      config: getConfig(),
      mark: repository.markTelegramDelivery,
    }));
    return json({ ok: true, id: submission.id }, 201);
  };
}
