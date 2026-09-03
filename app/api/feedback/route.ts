import { env, waitUntil } from "cloudflare:workers";
import { createFeedbackPostHandler } from "@/lib/feedback/handler";
import { enforceFeedbackRateLimit } from "@/lib/feedback/rate-limit";
import { createFeedbackRepository } from "@/lib/feedback/repository";
import {
  readFeedbackRateLimitBindings,
  readFeedbackTelegramConfig,
} from "@/lib/feedback/server-config";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const repository = createFeedbackRepository(env.DB);
    const postFeedback = createFeedbackPostHandler({
      repository,
      getConfig: () => readFeedbackTelegramConfig(env),
      schedule: (promise) => waitUntil(promise),
      rateLimit: (incomingRequest) => enforceFeedbackRateLimit(
        incomingRequest,
        readFeedbackRateLimitBindings(env),
      ),
    });
    return await postFeedback(request);
  } catch (error) {
    console.error(JSON.stringify({
      message: "feedback.submission_failed",
      error: error instanceof Error ? error.message : "Unknown error",
    }));
    return Response.json(
      { error: "Could not save the feedback. Try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
