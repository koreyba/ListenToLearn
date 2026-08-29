import { AI_CHAT_LIMITS } from "../../contracts.ts";
import {
  isVocabularyCategoryFilter,
  type VocabularyCategoryFilter,
} from "../../../vocabulary/contracts.ts";
import type {
  AddVocabularyEntryMutationResult,
  AddVocabularyMeaningMutationResult,
  SetVocabularyCategoryMutationResult,
  UpdateVocabularyMeaningMutationResult,
} from "../../../vocabulary/mutations.ts";
import { createVocabularySearchPattern } from "../../../vocabulary/repository.ts";
import type { AiChatToolExecutionScope } from "../../tool-trace.ts";

import {
  AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN,
  AI_VOCABULARY_MAX_TOOL_RESULTS,
  type AddVocabularyEntryInput,
  type AddVocabularyMeaningInput,
  type AiVocabularyToolEntry,
  type FindVocabularyInput,
  type ListVocabularyInput,
  type SetVocabularyCategoryInput,
  type ToolPolicyError,
  type ToolResult,
  type UpdateVocabularyMeaningInput,
  type VocabularyMutationPlanner,
  type VocabularyToolRepository,
} from "./contracts.ts";
import {
  pageCursorFromListCursor,
  readAiVocabularyListCursor,
} from "./pagination.ts";
import {
  exactCommandValue,
  isExplicitVocabularyWriteOperation,
  optionalCommandValueMatches,
  parseAddEntryCommands,
  parseAddMeaningCommand,
  parseSetCategoryCommand,
  parseUpdateMeaningCommand,
  type VocabularyWriteOperation,
} from "./policy.ts";
import { boundedToolEntries, boundedVocabularyPage } from "./results.ts";

function cleanSingleLine(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  return cleaned && [...cleaned].length <= maximum ? cleaned : null;
}

function cleanOptionalContext(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const cleaned = value.normalize("NFC").trim().replace(/\r\n?/gu, "\n");
  return cleaned && [...cleaned].length <= AI_CHAT_LIMITS.contextCharacters
    ? cleaned
    : null;
}

function boundedLimit(value: unknown, fallback: number) {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? Math.min(Number(value), AI_VOCABULARY_MAX_TOOL_RESULTS)
    : fallback;
}

export function createAiVocabularyToolHandlers(input: {
  userId: string;
  currentUserMessage: string;
  repository: VocabularyToolRepository;
  mutationPlanner: VocabularyMutationPlanner;
}) {
  const { userId, currentUserMessage, repository, mutationPlanner } = input;
  let toolCallCount = 0;

  function reserveToolCall(): ToolPolicyError | null {
    toolCallCount += 1;
    return toolCallCount <= AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN
      ? null
      : { ok: false, error: "tool_budget_exceeded" };
  }

  function authorizeWrite(
    operation: VocabularyWriteOperation,
    semanticValuesMatch = true,
  ): ToolPolicyError | null {
    if (!isExplicitVocabularyWriteOperation(currentUserMessage, operation)) {
      return { ok: false, error: "explicit_user_command_required" };
    }
    if (!semanticValuesMatch) {
      return { ok: false, error: "explicit_values_required" };
    }
    return null;
  }

  return {
    async listVocabulary(input: ListVocabularyInput): Promise<ToolResult<{
      category: VocabularyCategoryFilter;
      entries: AiVocabularyToolEntry[];
      hasMore: boolean;
      nextCursor: string | null;
    }>> {
      const budgetError = reserveToolCall();
      if (budgetError) return budgetError;
      const suppliedCategory = input.category;
      if (suppliedCategory !== undefined && !isVocabularyCategoryFilter(suppliedCategory)) {
        return { ok: false, error: "invalid_input" };
      }
      const decodedCursor = input.cursor === undefined
        ? null
        : readAiVocabularyListCursor(input.cursor, suppliedCategory);
      if (input.cursor !== undefined && !decodedCursor) {
        return { ok: false, error: "invalid_input" };
      }
      const category = suppliedCategory || decodedCursor?.category || "all";
      const page = await repository.listPage(userId, {
        category,
        limit: boundedLimit(input.limit, 5),
        cursor: decodedCursor ? pageCursorFromListCursor(decodedCursor) : null,
      });
      return boundedVocabularyPage(page, category);
    },

    async findVocabulary({ query, limit }: FindVocabularyInput): Promise<ToolResult<{
      entries: AiVocabularyToolEntry[];
    }>> {
      const budgetError = reserveToolCall();
      if (budgetError) return budgetError;
      const searchPattern = createVocabularySearchPattern(query);
      if (!searchPattern) return { ok: false, error: "invalid_input" };
      return {
        ok: true,
        entries: boundedToolEntries(await repository.search(
          userId,
          searchPattern.query,
          boundedLimit(limit, 10),
        )),
      };
    },

    async addVocabularyEntry(
      entry: AddVocabularyEntryInput,
      scope: AiChatToolExecutionScope,
    ): Promise<ToolResult<AddVocabularyEntryMutationResult> | Awaited<
      ReturnType<AiChatToolExecutionScope["commitMutation"]>
    >> {
      const budgetError = reserveToolCall();
      if (budgetError) return budgetError;
      const text = cleanSingleLine(entry.text, AI_CHAT_LIMITS.targetTextCharacters);
      const translation = entry.translation === undefined
        ? ""
        : cleanSingleLine(entry.translation, AI_CHAT_LIMITS.meaningCharacters);
      const context = cleanOptionalContext(entry.context);
      if (!text || translation === null || context === null) {
        return { ok: false, error: "invalid_input" };
      }
      const commands = parseAddEntryCommands(currentUserMessage);
      const authorization = authorizeWrite("add_entry", commands.some((command) => (
        exactCommandValue(command.text, entry.text)
        && (translation
          ? exactCommandValue(command.translation, entry.translation || "")
          : command.translation === undefined)
        && optionalCommandValueMatches(command.context, entry.context)
      )));
      if (authorization) return authorization;
      const plan = await mutationPlanner.planAddEntry(userId, {
        text,
        translation,
        ...(context === undefined ? {} : { context }),
      });
      return scope.commitMutation(plan);
    },

    async addVocabularyMeaning(
      meaning: AddVocabularyMeaningInput,
      scope: AiChatToolExecutionScope,
    ): Promise<ToolResult<AddVocabularyMeaningMutationResult> | Awaited<
      ReturnType<AiChatToolExecutionScope["commitMutation"]>
    >> {
      const budgetError = reserveToolCall();
      if (budgetError) return budgetError;
      const phraseId = cleanSingleLine(meaning.phraseId, 120);
      const translation = cleanSingleLine(
        meaning.translation,
        AI_CHAT_LIMITS.meaningCharacters,
      );
      const context = cleanOptionalContext(meaning.context);
      if (!phraseId || !translation || context === null) {
        return { ok: false, error: "invalid_input" };
      }
      const command = parseAddMeaningCommand(currentUserMessage);
      const operationAuthorization = authorizeWrite("add_meaning", Boolean(command)
        && exactCommandValue(command?.translation, meaning.translation)
        && optionalCommandValueMatches(command?.context, meaning.context));
      if (operationAuthorization) return operationAuthorization;
      const entry = await repository.getEntry(userId, phraseId);
      if (!entry) return { ok: false, error: "invalid_input" };
      const valueAuthorization = authorizeWrite("add_meaning", Boolean(command)
        && exactCommandValue(command?.entry, entry.text)
      );
      if (valueAuthorization) return valueAuthorization;
      const plan = await mutationPlanner.planAddMeaning(userId, {
        phraseId,
        translation,
        ...(context === undefined ? {} : { context }),
      });
      return scope.commitMutation(plan);
    },

    async updateVocabularyMeaning(
      meaning: UpdateVocabularyMeaningInput,
      scope: AiChatToolExecutionScope,
    ): Promise<ToolResult<UpdateVocabularyMeaningMutationResult> | Awaited<
      ReturnType<AiChatToolExecutionScope["commitMutation"]>
    >> {
      const budgetError = reserveToolCall();
      if (budgetError) return budgetError;
      const meaningId = cleanSingleLine(meaning.meaningId, 140);
      const translation = cleanSingleLine(
        meaning.translation,
        AI_CHAT_LIMITS.meaningCharacters,
      );
      const context = cleanOptionalContext(meaning.context);
      if (!meaningId || !translation || context === null) {
        return { ok: false, error: "invalid_input" };
      }
      const operationAuthorization = authorizeWrite("update_meaning");
      if (operationAuthorization) return operationAuthorization;
      const entry = await repository.getEntryForMeaning(userId, meaningId);
      if (!entry) return { ok: false, error: "mutation_conflict" };
      const command = parseUpdateMeaningCommand(currentUserMessage);
      const valueAuthorization = authorizeWrite("update_meaning", Boolean(command)
        && exactCommandValue(command?.entry, entry.text)
        && exactCommandValue(
          command?.oldTranslation,
          entry.selectedMeaning.translation,
        )
        && exactCommandValue(command?.translation, meaning.translation)
        && optionalCommandValueMatches(command?.context, meaning.context));
      if (valueAuthorization) return valueAuthorization;
      const plan = await mutationPlanner.planUpdateMeaning(userId, {
        meaningId,
        phraseId: entry.phraseId,
        expectedTranslation: entry.selectedMeaning.translation,
        expectedContext: entry.selectedMeaning.context,
        translation,
        ...(context === undefined ? {} : { context }),
      });
      return scope.commitMutation(plan);
    },

    async setVocabularyCategory(
      input: SetVocabularyCategoryInput,
      scope: AiChatToolExecutionScope,
    ): Promise<ToolResult<SetVocabularyCategoryMutationResult> | Awaited<
      ReturnType<AiChatToolExecutionScope["commitMutation"]>
    >> {
      const budgetError = reserveToolCall();
      if (budgetError) return budgetError;
      const phraseId = cleanSingleLine(input.phraseId, 120);
      if (!phraseId || !["to_learn", "learning", "learned"].includes(input.category)) {
        return { ok: false, error: "invalid_input" };
      }
      const command = parseSetCategoryCommand(currentUserMessage);
      const operationAuthorization = authorizeWrite(
        "set_category",
        Boolean(command) && command?.category === input.category,
      );
      if (operationAuthorization) return operationAuthorization;
      const target = await repository.getCategoryTarget(userId, phraseId);
      if (!target) return { ok: false, error: "mutation_conflict" };
      const valueAuthorization = authorizeWrite(
        "set_category",
        Boolean(command) && exactCommandValue(command?.entry, target.text),
      );
      if (valueAuthorization) return valueAuthorization;
      const plan = await mutationPlanner.planSetCategory(userId, {
        phraseId,
        expectedStoredStatus: target.storedStatus,
        category: input.category,
      });
      return scope.commitMutation(plan);
    },
  };
}

export type AiVocabularyToolHandlers = ReturnType<typeof createAiVocabularyToolHandlers>;
