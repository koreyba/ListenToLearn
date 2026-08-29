import { AiChatRepositoryError } from "./repository.ts";
import { aiChatErrorResponse } from "./api-contracts.ts";
import type { AiChatErrorCode } from "./contracts.ts";

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export function aiChatRouteErrorResponse(error: unknown) {
  if (error instanceof AiChatRepositoryError) {
    const status = error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 400;
    return aiChatErrorResponse({ code: error.code, status });
  }
  return aiChatErrorResponse({ code: "internal_error" satisfies AiChatErrorCode, status: 500 });
}
