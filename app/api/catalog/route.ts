import { getD1 } from "@/db";
import {
  mapCatalogRows,
  type CatalogProjectionRow,
} from "@/lib/catalog/catalog-api";
import {
  CONNECTED_SPEECH_MECHANISMS,
  PRACTICE_FORMATS,
} from "@/lib/catalog/connected-speech-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const result = await getD1().prepare(`
      SELECT
        phrases.id,
        phrases.text,
        analysis.kind AS analysis_kind,
        analysis.rank AS analysis_rank,
        analysis.pattern AS analysis_pattern,
        analysis.ipa AS analysis_ipa,
        analysis.search_query AS analysis_search_query,
        analysis.alternate_query AS analysis_alternate_query,
        CASE WHEN count(mechanisms.mechanism) > 0
          THEN json_group_array(json_array(mechanisms.mechanism, mechanisms.display_order))
          ELSE '[]'
        END AS mechanisms_json
      FROM catalog_phrase_analysis AS analysis
      INNER JOIN phrases ON phrases.id = analysis.phrase_id
      LEFT JOIN phrase_mechanisms AS mechanisms ON mechanisms.phrase_id = phrases.id
      WHERE analysis.active = 1
      GROUP BY phrases.id
      ORDER BY
        CASE analysis.kind WHEN 'atom' THEN 1 WHEN 'lexicon' THEN 2 ELSE 3 END,
        analysis.rank
    `).all<CatalogProjectionRow>();

    const cards = mapCatalogRows(result.results);
    const etag = `W/"catalog-${cards.length}"`;
    const cacheHeaders = {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      ETag: etag,
    };

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: cacheHeaders });
    }

    return Response.json({
      cards,
      formats: PRACTICE_FORMATS,
      mechanisms: CONNECTED_SPEECH_MECHANISMS,
    }, {
      headers: cacheHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the catalog.";
    return Response.json({ error: message }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
