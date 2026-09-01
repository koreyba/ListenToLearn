import type { AiChatUiMetadata } from "./client.ts";

type ApiError = { error?: string | { code?: string } };

function responseIncompleteMessage(terminal: AiChatUiMetadata["terminal"]) {
  switch (terminal?.finishReason) {
    case "length":
      return "The model reached its response limit before finishing. Retry with a shorter request.";
    case "content-filter":
      return "The provider stopped this response because of its safety filter. Try rephrasing the request.";
    case "tool-calls":
      return "The model stopped before it finished the requested vocabulary action. Nothing was changed.";
    case "error":
      return "The provider ended this response with an error. Nothing was changed. Retry the same message.";
    default:
      return "The provider ended the response before it was complete. Nothing was changed. Retry the same message.";
  }
}

export function aiChatApiError(
  payload: ApiError,
  fallback: string,
  terminal: AiChatUiMetadata["terminal"] = null,
) {
  if (typeof payload.error === "string") return payload.error;
  switch (payload.error?.code) {
    case "not_configured":
      return "AI generation is not configured.";
    case "provider_timeout":
      return "The model timed out. Retry the same message.";
    case "provider_rate_limited":
      return "The AI usage limit has been reached. Try again later.";
    case "turn_in_progress":
      return "Another message is still being answered in this chat.";
    case "provider_failed":
      return "The model could not answer. Retry the same message.";
    case "response_incomplete":
      return responseIncompleteMessage(terminal);
    case "generation_cancelled":
      return "You stopped this response. Retry it if needed.";
    case "generation_interrupted":
      return "The live connection was interrupted before the response was saved. You can retry safely.";
    case "tool_timeout":
      return "The chat action timed out. Nothing was changed. You can continue or retry.";
    case "tool_failed":
      return "The chat action failed. Nothing was changed. You can continue or retry.";
    case "tool_budget_exceeded":
      return "This request needed more vocabulary lookups than one response can safely run. Nothing was changed. Split it into smaller requests.";
    case "conflict":
      return "This turn is already being processed. Reopen the chat.";
    default:
      return fallback;
  }
}

export async function requestAiChatJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) {
    throw new Error(aiChatApiError(body, "The request could not be completed."));
  }
  return body;
}
