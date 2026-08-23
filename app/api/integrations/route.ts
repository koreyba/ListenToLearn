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
    return response({ error: "Не удалось проверить интеграции." }, 500);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    if (!sameOrigin(request)) return response({ error: "Недопустимый источник запроса." }, 403);
    if (!bodyWithinLimit(request)) return response({ error: "Запрос слишком большой." }, 413);
    const payload = (await request.json()) as { provider?: unknown; key?: unknown };
    if (payload.provider !== provider) {
      return response({ error: "Эта интеграция пока не поддерживается." }, 400);
    }
    const key = clean(payload.key, 500);
    if (!key) return response({ error: "Введите API-ключ." }, 400);
    await storeIntegrationSecret(user.subject, provider, key);
    return response({ ok: true, provider, configured: true });
  } catch (error) {
    console.error("Integrations POST failed:", error);
    return response({ error: "Не удалось сохранить API-ключ." }, 500);
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorizedResponse();

  try {
    if (!sameOrigin(request)) return response({ error: "Недопустимый источник запроса." }, 403);
    const requestedProvider = new URL(request.url).searchParams.get("provider");
    if (requestedProvider !== provider) {
      return response({ error: "Эта интеграция пока не поддерживается." }, 400);
    }
    await deleteIntegrationSecret(user.subject, provider);
    return response({ ok: true, provider, configured: false });
  } catch (error) {
    console.error("Integrations DELETE failed:", error);
    return response({ error: "Не удалось удалить API-ключ." }, 500);
  }
}
