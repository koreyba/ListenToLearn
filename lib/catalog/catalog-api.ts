import type {
  ConnectedSpeechMechanism,
  PracticeFormat,
} from "./connected-speech-catalog";

export type PhraseStatus = "pick" | "to_learn" | "learning_now" | "learnt";

export type CatalogAnalysis = {
  kind: PracticeFormat;
  rank: number;
  pattern: string;
  ipa: string;
  searchQuery: string;
  alternateQuery: string | null;
  mechanisms: ConnectedSpeechMechanism[];
};

export type CatalogProjectionRow = {
  id: string;
  text: string;
  analysis_kind: PracticeFormat | null;
  analysis_rank: number | null;
  analysis_pattern: string | null;
  analysis_ipa: string | null;
  analysis_search_query: string | null;
  analysis_alternate_query: string | null;
  mechanism?: ConnectedSpeechMechanism | null;
  mechanism_order?: number | null;
  mechanisms_json?: string | null;
};

export type CatalogJoinedRow = CatalogProjectionRow & {
  pattern: string;
  ipa: string;
  translation: string;
  context: string;
  source_type: "preset" | "custom";
  catalog_order: number | null;
  status: PhraseStatus;
  created_at: string;
  updated_at: string;
};

type MechanismEntry = {
  mechanism: ConnectedSpeechMechanism;
  order: number;
};

function parseMechanismsJson(json: string | null | undefined): MechanismEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as Array<[ConnectedSpeechMechanism, number]>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(([mechanism, order]) => ({ mechanism, order }));
  } catch {
    return [];
  }
}

function analysisFromRow(row: CatalogProjectionRow, mechanisms: MechanismEntry[]): CatalogAnalysis | null {
  if (
    !row.analysis_kind
    || row.analysis_rank === null
    || !row.analysis_pattern
    || !row.analysis_ipa
    || !row.analysis_search_query
  ) return null;

  const orderedMechanisms = mechanisms.sort((left, right) => left.order - right.order);
  return {
    kind: row.analysis_kind,
    rank: row.analysis_rank,
    pattern: row.analysis_pattern,
    ipa: row.analysis_ipa,
    searchQuery: row.analysis_search_query,
    alternateQuery: row.analysis_alternate_query,
    mechanisms: orderedMechanisms.map((entry) => entry.mechanism),
  };
}

function groupRows<Row extends CatalogProjectionRow>(rows: Row[]) {
  const grouped = new Map<string, { row: Row; mechanisms: Map<ConnectedSpeechMechanism, number> }>();
  for (const row of rows) {
    const group = grouped.get(row.id) || { row, mechanisms: new Map() };
    if (row.mechanism) group.mechanisms.set(row.mechanism, row.mechanism_order ?? 0);
    grouped.set(row.id, group);
  }
  return [...grouped.values()];
}

export function mapCatalogRows(rows: CatalogProjectionRow[]) {
  if (rows.length > 0 && "mechanisms_json" in rows[0]) {
    return rows.flatMap((row) => {
      const mechanisms = parseMechanismsJson(row.mechanisms_json);
      const analysis = analysisFromRow(row, mechanisms);
      return analysis ? [{ id: row.id, text: row.text, sourceType: "catalog" as const, analysis }] : [];
    });
  }
  return groupRows(rows).flatMap(({ row, mechanisms }) => {
    const analysis = analysisFromRow(
      row,
      [...mechanisms].map(([mechanism, order]) => ({ mechanism, order })),
    );
    return analysis ? [{ id: row.id, text: row.text, sourceType: "catalog" as const, analysis }] : [];
  });
}

export function mapPhraseRows(rows: CatalogJoinedRow[]) {
  if (rows.length > 0 && "mechanisms_json" in rows[0]) {
    return rows.map((row) => {
      const mechanisms = parseMechanismsJson(row.mechanisms_json);
      const analysis = analysisFromRow(row, mechanisms);
      return {
        id: row.id,
        text: row.text,
        pattern: row.pattern,
        ipa: row.ipa,
        translation: row.translation,
        context: row.context,
        source_type: row.source_type,
        sourceType: analysis ? "catalog" as const : row.source_type === "custom" ? "custom" as const : "legacy" as const,
        catalog_order: row.catalog_order,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        analysis,
      };
    });
  }
  return groupRows(rows).map(({ row, mechanisms }) => {
    const analysis = analysisFromRow(
      row,
      [...mechanisms].map(([mechanism, order]) => ({ mechanism, order })),
    );
    return {
      id: row.id,
      text: row.text,
      pattern: row.pattern,
      ipa: row.ipa,
      translation: row.translation,
      context: row.context,
      source_type: row.source_type,
      sourceType: analysis ? "catalog" as const : row.source_type === "custom" ? "custom" as const : "legacy" as const,
      catalog_order: row.catalog_order,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      analysis,
    };
  });
}
