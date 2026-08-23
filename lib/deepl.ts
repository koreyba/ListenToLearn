import { env } from "cloudflare:workers";

type TranslationResponse = {
  translations?: Array<{ text?: string }>;
  message?: string;
};

export class DeepLError extends Error {
  constructor(
    message: string,
    public readonly code: "not_configured" | "upstream" | "empty",
  ) {
    super(message);
  }
}

const DEEPL_TIMEOUT_MS = 8_000;

export function cleanTranslationText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function translateEnglishToRussian(
  texts: string[],
  context = "",
): Promise<string[]> {
  const cleaned = texts.map(cleanTranslationText).filter(Boolean);
  if (!cleaned.length) return [];

  const { DEEPL_API_KEY } = env as unknown as { DEEPL_API_KEY?: string };
  if (!DEEPL_API_KEY) {
    throw new DeepLError("Перевод временно не настроен.", "not_configured");
  }

  const endpoint = DEEPL_API_KEY.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEEPL_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: cleaned,
        source_lang: "EN",
        target_lang: "RU",
        ...(cleanTranslationText(context) ? { context: cleanTranslationText(context) } : {}),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "DeepL не ответил вовремя."
      : "DeepL временно недоступен.";
    throw new DeepLError(message, "upstream");
  } finally {
    clearTimeout(timeout);
  }

  const data = (await response.json().catch(() => null)) as TranslationResponse | null;
  if (!response.ok) {
    const message = data?.message || `DeepL returned HTTP ${response.status}`;
    throw new DeepLError(message, "upstream");
  }

  const translations = (data?.translations || []).map((item) => cleanTranslationText(item.text));
  if (translations.length !== cleaned.length || translations.some((item) => !item)) {
    throw new DeepLError("DeepL вернул пустой перевод.", "empty");
  }
  return translations;
}
