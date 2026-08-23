export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!/^\d+$/.test(id)) {
      return Response.json({ error: "Invalid audio identifier." }, { status: 400 });
    }

    const range = request.headers.get("range");
    const response = await fetch(`https://api.tatoeba.org/v1/audios/${id}/file`, {
      headers: range ? { Range: range } : undefined,
      redirect: "follow",
    });
    if (!response.ok || !response.body) {
      console.error("Tatoeba audio failed:", response.status, id);
      return Response.json({ error: "Tatoeba audio is unavailable." }, { status: 502 });
    }

    const headers = new Headers({
      "Content-Type": response.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "public, max-age=86400, immutable",
      "Accept-Ranges": response.headers.get("accept-ranges") || "bytes",
    });
    for (const name of ["content-length", "content-range"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    console.error("Tatoeba audio route failed:", error);
    return Response.json({ error: "Could not load Tatoeba audio." }, { status: 500 });
  }
}
