import {
  deleteIntegrationSecret,
  getIntegrationStatus,
  storeIntegrationSecret,
  type IntegrationProvider,
} from "@/lib/integration-secrets";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

const provider = "deepl" satisfies IntegrationProvider;

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function sameOrigin(request: Request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

function bodyWithinLimit(request: Request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  return !length || length <= 4_096;
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const configured = await getIntegrationStatus(user.subject, provider);
    return response({
      integrations: [{
        provider,
        label: "DeepL",
        configured,
        source: configured ? "integrations" : null,
      }],
    });
  } catch (error) {
    console.error("Integrations GET failed:", error);
    return response({ error: "Could not check integrations." }, 500);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    if (!sameOrigin(request)) return response({ error: "Invalid request origin." }, 403);
    if (!bodyWithinLimit(request)) return response({ error: "The request is too large." }, 413);
    const payload = (await request.json()) as { provider?: unknown; key?: unknown };
    if (payload.provider !== provider) {
      return response({ error: "This integration is not supported yet." }, 400);
    }
    const key = clean(payload.key, 500);
    if (!key) return response({ error: "Enter an API key." }, 400);
    await storeIntegrationSecret(user.subject, provider, key);
    return response({ ok: true, provider, configured: true });
  } catch (error) {
    console.error("Integrations POST failed:", error);
    return response({ error: "Could not save the API key." }, 500);
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    if (!sameOrigin(request)) return response({ error: "Invalid request origin." }, 403);
    const requestedProvider = new URL(request.url).searchParams.get("provider");
    if (requestedProvider !== provider) {
      return response({ error: "This integration is not supported yet." }, 400);
    }
    await deleteIntegrationSecret(user.subject, provider);
    return response({ ok: true, provider, configured: false });
  } catch (error) {
    console.error("Integrations DELETE failed:", error);
    return response({ error: "Could not delete the API key." }, 500);
  }
}
