import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

type TranslationResponse = {
  translations?: Array<{ text?: string }>;
  message?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function POST(request: Request) {
  try {
    const siteUrl = new URL(request.url);
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== siteUrl.host) {
      return Response.json({ error: "Cross-site translation is not allowed." }, { status: 403 });
    }

    const payload = (await request.json()) as { text?: unknown; context?: unknown };
    const text = cleanText(payload.text);
    const context = cleanText(payload.context).slice(0, 1_000);
    if (!text) return Response.json({ error: "Выдели слово или фразу." }, { status: 400 });
    if (text.length > 500) return Response.json({ error: "Для перевода выбери не больше 500 символов." }, { status: 400 });

    const { DEEPL_API_KEY } = env as unknown as { DEEPL_API_KEY?: string };
    if (!DEEPL_API_KEY) {
      return Response.json({ error: "Перевод временно не настроен." }, { status: 503 });
    }

    const endpoint = DEEPL_API_KEY.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [text],
        source_lang: "EN",
        target_lang: "RU",
        ...(context && context !== text ? { context } : {}),
      }),
    });

    const data = (await response.json().catch(() => null)) as TranslationResponse | null;
    if (!response.ok) {
      const message = data?.message || `DeepL returned HTTP ${response.status}`;
      console.error("DeepL translation failed:", message);
      return Response.json({ error: "Не удалось получить перевод. Попробуй ещё раз." }, { status: 502 });
    }

    const translation = cleanText(data?.translations?.[0]?.text);
    if (!translation) {
      return Response.json({ error: "DeepL вернул пустой перевод." }, { status: 502 });
    }

    return Response.json({ translation });
  } catch (error) {
    console.error("Translation route failed:", error);
    return Response.json({ error: "Не удалось получить перевод. Попробуй ещё раз." }, { status: 500 });
  }
}
