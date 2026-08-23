import { env } from "cloudflare:workers";
import {
  deleteIntegrationSecret,
  createIntegrationSession,
  getIntegrationStatus,
  storeIntegrationSecret,
  type IntegrationProvider,
} from "@/lib/integration-secrets";

export const dynamic = "force-dynamic";

const provider = "deepl" satisfies IntegrationProvider;

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function workerSecretConfigured() {
  return Boolean((env as unknown as { DEEPL_API_KEY?: string }).DEEPL_API_KEY);
}

function response(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
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
  try {
    const stored = await getIntegrationStatus(provider);
    const worker = workerSecretConfigured();
    const sessionCookie = await createIntegrationSession(request);
    return response({
      integrations: [{
        provider,
        label: "DeepL",
        configured: stored || worker,
        source: stored ? "integrations" : worker ? "worker_secret" : null,
      }],
    }, 200, sessionCookie ? { "Set-Cookie": sessionCookie } : {});
  } catch (error) {
    console.error("Integrations GET failed:", error);
    return response({ error: "Не удалось проверить интеграции." }, 500);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return response({ error: "Недопустимый источник запроса." }, 403);
    if (!bodyWithinLimit(request)) return response({ error: "Запрос слишком большой." }, 413);
    const payload = (await request.json()) as { provider?: unknown; key?: unknown };
    if (payload.provider !== provider) {
      return response({ error: "Эта интеграция пока не поддерживается." }, 400);
    }
    const key = clean(payload.key, 500);
    if (!key) return response({ error: "Введите API-ключ." }, 400);
    await storeIntegrationSecret(provider, key);
    return response({ ok: true, provider, configured: true });
  } catch (error) {
    console.error("Integrations POST failed:", error);
    return response({ error: "Не удалось сохранить API-ключ." }, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) return response({ error: "Недопустимый источник запроса." }, 403);
    const requestedProvider = new URL(request.url).searchParams.get("provider");
    if (requestedProvider !== provider) {
      return response({ error: "Эта интеграция пока не поддерживается." }, 400);
    }
    await deleteIntegrationSecret(provider);
    return response({ ok: true, provider, configured: workerSecretConfigured() });
  } catch (error) {
    console.error("Integrations DELETE failed:", error);
    return response({ error: "Не удалось удалить API-ключ." }, 500);
  }
}
