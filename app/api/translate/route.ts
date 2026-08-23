import { cleanTranslationText, DeepLError, translateEnglishToRussian } from "@/lib/deepl";

export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  return cleanTranslationText(value);
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

    const [translation] = await translateEnglishToRussian(
      [text],
      context && context !== text ? context : "",
      { request },
    );

    return Response.json({ translation });
  } catch (error) {
    console.error("Translation route failed:", error);
    if (error instanceof DeepLError) {
      const status = error.code === "not_configured" ? 503 : 502;
      const message = error.code === "not_configured"
        ? error.message
        : "Не удалось получить перевод. Попробуй ещё раз.";
      return Response.json({ error: message }, { status });
    }
    return Response.json({ error: "Не удалось получить перевод. Попробуй ещё раз." }, { status: 500 });
  }
}
