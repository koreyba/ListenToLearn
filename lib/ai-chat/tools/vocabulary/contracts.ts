import type {
  VocabularyCategory,
  VocabularyCategoryFilter,
  VocabularyPageCursor,
} from "../../../vocabulary/contracts.ts";
import type { createVocabularyMutationPlanner } from "../../../vocabulary/mutations.ts";
import type {
  VocabularyCategoryTarget,
  VocabularyEntry,
  VocabularyEntryForMeaning,
  VocabularyMeaning,
  VocabularyPage,
} from "../../../vocabulary/repository.ts";
import type { createAiChatToolExecutor } from "../../tool-trace.ts";

export const AI_VOCABULARY_MAX_TOOL_RESULTS = 10;
export const AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN = 2;
export const AI_VOCABULARY_MAX_TOOL_RESULT_JSON_CHARACTERS = 7_800;

export const AI_VOCABULARY_TOOL_NAMES = Object.freeze([
  "list_vocabulary",
  "find_vocabulary",
  "propose_vocabulary_entries",
  "propose_vocabulary_meaning",
  "propose_vocabulary_meaning_update",
  "propose_vocabulary_category",
] as const);

export type VocabularyToolName = (typeof AI_VOCABULARY_TOOL_NAMES)[number];

export type VocabularyToolRepository = {
  listPage(
    userId: string,
    input: {
      category?: VocabularyCategoryFilter;
      limit?: number;
      cursor?: VocabularyPageCursor | null;
    },
  ): Promise<VocabularyPage>;
  search(userId: string, query: string, limit: number): Promise<VocabularyEntry[]>;
  getEntry(userId: string, phraseId: string): Promise<VocabularyEntry | null>;
  getCategoryTarget(
    userId: string,
    phraseId: string,
  ): Promise<VocabularyCategoryTarget | null>;
  getEntryForMeaning(
    userId: string,
    meaningId: string,
  ): Promise<VocabularyEntryForMeaning | null>;
};

export type VocabularyMutationPlanner = Pick<
  ReturnType<typeof createVocabularyMutationPlanner>,
  | "planAddEntry"
  | "planAddEntries"
  | "planAddMeaning"
  | "planSetCategory"
  | "planUpdateMeaning"
>;

export type AiChatToolExecutor = ReturnType<typeof createAiChatToolExecutor>;

export type ToolPolicyError = {
  ok: false;
  error:
    | "explicit_user_command_required"
    | "explicit_values_required"
    | "invalid_input"
    | "mutation_conflict"
    | "tool_budget_exceeded";
};

export type ToolResult<Value extends object> = ({ ok: true } & Value) | ToolPolicyError;

export type ListVocabularyInput = {
  category?: VocabularyCategoryFilter;
  limit?: number;
  cursor?: string;
};

export type FindVocabularyInput = { query: string; limit?: number };

export type AddVocabularyEntryInput = {
  text: string;
  translation?: string;
  context?: string;
};

export type ProposeVocabularyEntriesInput = {
  entries: AddVocabularyEntryInput[];
};

export type AddVocabularyMeaningInput = {
  phraseId: string;
  translation: string;
  context?: string;
};

export type UpdateVocabularyMeaningInput = {
  meaningId: string;
  translation: string;
  context?: string;
};

export type SetVocabularyCategoryInput = {
  phraseId: string;
  category: VocabularyCategory;
};

export type AiVocabularyToolEntry = Pick<
  VocabularyEntry,
  "phraseId" | "text"
> & {
  category: Exclude<VocabularyCategoryFilter, "all">;
  meanings: VocabularyMeaning[];
  meaningCount: number;
  meaningsTruncated: boolean;
  detailsTruncated: boolean;
};
