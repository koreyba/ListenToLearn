export const FEEDBACK_CATEGORIES = ["bug", "idea", "other"] as const;
export const MAX_FEEDBACK_MESSAGE_LENGTH = 2_000;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export type FeedbackPayload = {
  category: FeedbackCategory;
  message: string;
  pageUrl: string;
};

type FeedbackPayloadResult =
  | { ok: true; value: FeedbackPayload }
  | { ok: false; error: string; spam?: boolean };

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && FEEDBACK_CATEGORIES.some((category) => category === value);
}

function sameOriginPage(value: unknown, requestOrigin: string) {
  try {
    const page = new URL(clean(value, 2_000), requestOrigin);
    if (page.origin !== requestOrigin) return "/";
    return `${page.pathname}${page.search}`.slice(0, 1_000) || "/";
  } catch {
    return "/";
  }
}

export function readFeedbackPayload(input: unknown, requestOrigin: string): FeedbackPayloadResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid feedback request." };
  }

  const body = input as Record<string, unknown>;
  if (clean(body.website, 200)) {
    return { ok: false, error: "Thanks for the feedback.", spam: true };
  }
  const category = body.category;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!isFeedbackCategory(category) || !message) {
    return { ok: false, error: "Choose a type and write a message." };
  }
  if (message.length > MAX_FEEDBACK_MESSAGE_LENGTH) {
    return { ok: false, error: `Keep the message under ${MAX_FEEDBACK_MESSAGE_LENGTH} characters.` };
  }

  return {
    ok: true,
    value: {
      category,
      message,
      pageUrl: sameOriginPage(body.pageUrl, requestOrigin),
    },
  };
}
