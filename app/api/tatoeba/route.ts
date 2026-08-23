export const dynamic = "force-dynamic";

type TatoebaAudio = {
  id?: number;
  author?: string;
  license?: string;
  licence?: string;
  attribution_url?: string;
};

type TatoebaSentence = {
  id?: number;
  text?: string;
  audios?: TatoebaAudio[];
  translations?: Array<{ text?: string; lang?: string }>;
};

type TatoebaResponse = {
  data?: TatoebaSentence[];
  paging?: { total?: number };
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function GET(request: Request) {
  try {
    const query = cleanText(new URL(request.url).searchParams.get("q"));
    if (!query) return Response.json({ error: "Введите фразу." }, { status: 400 });
    if (query.length > 240) return Response.json({ error: "Фраза слишком длинная." }, { status: 400 });

    const params = new URLSearchParams({
      lang: "eng",
      q: query,
      has_audio: "yes",
      is_unapproved: "no",
      sort: "relevance",
      include: "audios",
      "showtrans:lang": "rus",
      limit: "20",
    });

    const response = await fetch(`https://api.tatoeba.org/v1/sentences?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      console.error("Tatoeba search failed:", response.status);
      return Response.json({ error: "Tatoeba временно не отвечает." }, { status: 502 });
    }

    const data = (await response.json()) as TatoebaResponse;
    const tracks = (data.data || []).flatMap((sentence) => {
      const text = cleanText(sentence.text);
      const audio = sentence.audios?.find((item) => Number.isInteger(item.id));
      if (!text || !audio?.id) return [];

      const translation = cleanText(
        sentence.translations?.find((item) => item.lang === "rus")?.text,
      );
      return [{
        sentenceId: sentence.id,
        text,
        audioId: audio.id,
        author: cleanText(audio.author) || "Tatoeba contributor",
        license: cleanText(audio.license || audio.licence) || "See Tatoeba",
        attributionUrl: cleanText(audio.attribution_url) || `https://tatoeba.org/en/sentences/show/${sentence.id}`,
        translation,
      }];
    });

    return Response.json(
      { tracks, total: Number(data.paging?.total) || tracks.length },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    console.error("Tatoeba route failed:", error);
    return Response.json({ error: "Не удалось найти аудио в Tatoeba." }, { status: 500 });
  }
}
