import type {
  VocabularyCategory,
  VocabularyCategoryFilter,
  VocabularyPageCursor,
  VocabularyStateDestination,
} from "../../../vocabulary/contracts.ts";
import type { createVocabularyMutationPlanner } from "../../../vocabulary/mutations.ts";
import type {
  VocabularyCategoryTarget,
  VocabularyEntry,
  VocabularyEntryForMeaning,
  VocabularyMeaning,
  VocabularyPage,
  VocabularyStateTarget,
} from "../../../vocabulary/repository.ts";
import type { createAiChatToolExecutor } from "../../tool-trace.ts";
import type { AiChatToolMutationPlan } from "../../tool-trace.ts";

export const AI_VOCABULARY_MAX_TOOL_RESULTS = 10;
export const AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN = 2;
export const AI_VOCABULARY_MAX_TOOL_RESULT_JSON_CHARACTERS = 7_800;
export const AI_VOCABULARY_CHANGE_SET_LIMIT = 30;

export const AI_VOCABULARY_TOOL_NAMES = Object.freeze([
  "list_vocabulary",
  "find_vocabulary",
  "propose_vocabulary_change_set",
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
  getStateTargets(userId: string, texts: readonly string[]): Promise<VocabularyStateTarget[]>;
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
  | "planChangeState"
  | "planSetCategory"
  | "planUpdateMeaning"
> & {
  planChangeSet(
    userId: string,
    input: ProposeVocabularyChangeSetInput,
  ): Promise<AiChatToolMutationPlan<unknown> & {
    publicItems: ProposeVocabularyChangeSetPublicItem[];
  }>;
};

export type AiChatToolExecutor = ReturnType<typeof createAiChatToolExecutor>;

export type ToolPolicyError = {
  ok: false;
  error:
    | "explicit_user_command_required"
    | "explicit_values_required"
    | "invalid_input"
    | "missing_target"
    | "ambiguous_meaning"
    | "conflicting_changes"
    | "change_limit_exceeded"
    | "unsupported_change"
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

export type ProposeVocabularyStateChangeInput = {
  entries: Array<{ text: string }>;
  destination: VocabularyStateDestination;
};

export type ProposeVocabularyChange =
  | {
      action: "add_entry";
      text: string;
      translation?: string;
      context?: string;
    }
  | {
      action: "add_meaning";
      text: string;
      translation: string;
      context?: string;
    }
  | {
      action: "update_meaning";
      text: string;
      currentTranslation?: string;
      translation: string;
      context?: string;
    }
  | {
      action: "change_state";
      text: string;
      destination: VocabularyStateDestination;
    }
  | {
      action: "change_recent_state";
      count: number;
      destination: VocabularyStateDestination;
    };

export type ProposeVocabularyChangeSetInput = {
  changes: ProposeVocabularyChange[];
};

export type ProposeVocabularyChangeSetPublicItem = {
  id: string;
  actionType: ProposeVocabularyChange["action"];
  text?: string;
  translation?: string;
  currentTranslation?: string;
  context?: string;
  count?: number;
  destination?: VocabularyStateDestination;
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
