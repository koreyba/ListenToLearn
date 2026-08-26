import type { CatalogAnalysis, PhraseStatus } from "./catalog-api";

const GUEST_PRESET_CREATED_AT = "1970-01-01T00:00:00.000Z";

type GuestCatalogState = {
  statuses: Record<string, PhraseStatus>;
  customPhrases: Array<{
    id: string;
    text: string;
    pattern: string;
    ipa: string;
    translation: string;
    context: string;
    status: PhraseStatus;
    createdAt: string;
    updatedAt: string;
  }>;
};

type PublicCatalogCard = {
  id: string;
  text: string;
  sourceType: "catalog";
  analysis: CatalogAnalysis;
};

type LegacyPhrase = {
  id: string;
  text: string;
  pattern: string;
  ipa: string;
};

export type WorkspacePhrase = {
  id: string;
  text: string;
  pattern: string;
  ipa: string;
  translation: string;
  context: string;
  source_type: "preset" | "custom";
  sourceType: "catalog" | "custom" | "legacy";
  catalog_order: number | null;
  status: PhraseStatus;
  created_at: string;
  updated_at: string;
  analysis: CatalogAnalysis | null;
};

export function mergeGuestCatalog(
  state: GuestCatalogState,
  cards: PublicCatalogCard[],
  legacyPhrases: readonly LegacyPhrase[],
): WorkspacePhrase[] {
  const active = cards.map((card, index): WorkspacePhrase => ({
    id: card.id,
    text: card.text,
    pattern: card.analysis.pattern,
    ipa: card.analysis.ipa,
    translation: "",
    context: "",
    source_type: "preset",
    sourceType: "catalog",
    catalog_order: index + 1,
    status: state.statuses[card.id] || "pick",
    created_at: GUEST_PRESET_CREATED_AT,
    updated_at: GUEST_PRESET_CREATED_AT,
    analysis: card.analysis,
  }));

  const legacy = legacyPhrases.flatMap((phrase): WorkspacePhrase[] => {
    const status = state.statuses[phrase.id];
    return status && status !== "pick" ? [{
      id: phrase.id,
      text: phrase.text,
      pattern: phrase.pattern,
      ipa: phrase.ipa,
      translation: "",
      context: "",
      source_type: "preset",
      sourceType: "legacy",
      catalog_order: null,
      status,
      created_at: GUEST_PRESET_CREATED_AT,
      updated_at: GUEST_PRESET_CREATED_AT,
      analysis: null,
    }] : [];
  });

  const custom = state.customPhrases.map((phrase): WorkspacePhrase => ({
    id: phrase.id,
    text: phrase.text,
    pattern: phrase.text,
    ipa: "",
    translation: phrase.translation,
    context: phrase.context,
    source_type: "custom",
    sourceType: "custom",
    catalog_order: null,
    status: phrase.status,
    created_at: phrase.createdAt,
    updated_at: phrase.updatedAt,
    analysis: null,
  }));

  return [...active, ...legacy, ...custom];
}
