import { AI_CHAT_LIMITS } from "../../contracts.ts";
import {
  isVocabularyCategoryFilter,
  isVocabularyStateDestination,
  normalizeVocabularyTarget,
  type VocabularyCategoryFilter,
} from "../../../vocabulary/contracts.ts";
import type {
  AddVocabularyEntriesMutationResult,
  AddVocabularyEntryMutationResult,
  AddVocabularyMeaningMutationResult,
  ChangeVocabularyStateMutationResult,
  SetVocabularyCategoryMutationResult,
  UpdateVocabularyMeaningMutationResult,
} from "../../../vocabulary/mutations.ts";
import { VOCABULARY_BULK_ENTRY_LIMIT } from "../../../vocabulary/mutations.ts";
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
  type ProposeVocabularyEntriesInput,
  type ProposeVocabularyStateChangeInput,
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

    async proposeVocabularyEntries(
      input: ProposeVocabularyEntriesInput,
      scope: AiChatToolExecutionScope,
    ) {
      const budgetError = reserveToolCall();
      if (budgetError) return budgetError;
      if (
        !input
        || !Array.isArray(input.entries)
        || input.entries.length < 1
        || input.entries.length > VOCABULARY_BULK_ENTRY_LIMIT
      ) {
        return { ok: false, error: "invalid_input" } as const;
      }
      const entries: ProposeVocabularyEntriesInput["entries"] = [];
      for (const entry of input.entries) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return { ok: false, error: "invalid_input" } as const;
        }
        const text = cleanSingleLine(entry.text, AI_CHAT_LIMITS.targetTextCharacters);
        const translation = entry.translation === undefined
          ? undefined
          : cleanSingleLine(entry.translation, AI_CHAT_LIMITS.meaningCharacters);
        const context = cleanOptionalContext(entry.context);
        if (!text || translation === null || context === null) {
          return { ok: false, error: "invalid_input" } as const;
        }
        entries.push({
          text,
          ...(translation === undefined ? {} : { translation }),
          ...(context === undefined ? {} : { context }),
        });
      }
      const plan = await mutationPlanner.planAddEntries(userId, { entries });
      return scope.proposeMutation<AddVocabularyEntriesMutationResult>(plan, {
        operation: "add_vocabulary_entries",
        items: plan.canonicalArgs.entries.map((entry, index) => ({
          id: `entry-${index + 1}`,
          ...entry,
        })),
      });
    },

    async proposeVocabularyMeaning(
      meaning: AddVocabularyMeaningInput,
      scope: AiChatToolExecutionScope,
    ) {
      const budgetError = reserveToolCall();
      if (budgetError) return budgetError;
      const phraseId = cleanSingleLine(meaning.phraseId, 120);
      const translation = cleanSingleLine(
        meaning.translation,
        AI_CHAT_LIMITS.meaningCharacters,
      );
      const context = cleanOptionalContext(meaning.context);
      if (!phraseId || !translation || context === null) {
        return { ok: false, error: "invalid_input" } as const;
      }
      const entry = await repository.getEntry(userId, phraseId);
      if (!entry) return { ok: false, error: "mutation_conflict" } as const;
      const plan = await mutationPlanner.planAddMeaning(userId, {
        phraseId,
        translation,
        ...(context === undefined ? {} : { context }),
      });
      return scope.proposeMutation(plan, {
        operation: "add_vocabulary_meaning",
        items: [{
          id: "entry-1",
          text: entry.text,
          translation,
          ...(context === undefined ? {} : { context }),
        }],
      });
    },

    async proposeVocabularyMeaningUpdate(
      meaning: UpdateVocabularyMeaningInput,
      scope: AiChatToolExecutionScope,
    ) {
      const budgetError = reserveToolCall();
      if (budgetError) return budgetError;
      const meaningId = cleanSingleLine(meaning.meaningId, 140);
      const translation = cleanSingleLine(
        meaning.translation,
        AI_CHAT_LIMITS.meaningCharacters,
      );
      const context = cleanOptionalContext(meaning.context);
      if (!meaningId || !translation || context === null) {
        return { ok: false, error: "invalid_input" } as const;
      }
      const entry = await repository.getEntryForMeaning(userId, meaningId);
      if (!entry) return { ok: false, error: "mutation_conflict" } as const;
      const plan = await mutationPlanner.planUpdateMeaning(userId, {
        meaningId,
        phraseId: entry.phraseId,
        expectedTranslation: entry.selectedMeaning.translation,
        expectedContext: entry.selectedMeaning.context,
        translation,
        ...(context === undefined ? {} : { context }),
      });
      return scope.proposeMutation(plan, {
        operation: "update_vocabulary_meaning",
        items: [{
          id: "entry-1",
          text: entry.text,
          previousTranslation: entry.selectedMeaning.translation,
          translation,
          ...(context === undefined ? {} : { context }),
        }],
      });
    },

    async proposeVocabularyStateChange(
      input: ProposeVocabularyStateChangeInput,
      scope: AiChatToolExecutionScope,
    ) {
      const budgetError = reserveToolCall();
      if (budgetError) return budgetError;
      if (
        !input
        || !Array.isArray(input.entries)
        || input.entries.length < 1
        || input.entries.length > VOCABULARY_BULK_ENTRY_LIMIT
        || !isVocabularyStateDestination(input.destination)
      ) {
        return { ok: false, error: "invalid_input" } as const;
      }
      const texts: string[] = [];
      const normalizedTexts = new Set<string>();
      for (const entry of input.entries) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return { ok: false, error: "invalid_input" } as const;
        }
        const text = cleanSingleLine(entry.text, AI_CHAT_LIMITS.targetTextCharacters);
        const normalizedText = normalizeVocabularyTarget(text);
        if (!text || normalizedTexts.has(normalizedText)) {
          return { ok: false, error: "invalid_input" } as const;
        }
        normalizedTexts.add(normalizedText);
        texts.push(text);
      }
      const targets = await repository.getStateTargets(userId, texts);
      if (
        targets.length !== texts.length
        || targets.some((target, index) => (
          normalizeVocabularyTarget(target.text) !== normalizeVocabularyTarget(texts[index])
        ))
      ) {
        return { ok: false, error: "mutation_conflict" } as const;
      }
      const plan = await mutationPlanner.planChangeState(userId, {
        destination: input.destination,
        entries: targets.map((target) => ({
          phraseId: target.phraseId,
          text: target.text,
          sourceType: target.sourceType,
          expectedStoredStatus: target.storedStatus,
        })),
      });
      return scope.proposeMutation<ChangeVocabularyStateMutationResult>(plan, {
        operation: "change_vocabulary_state",
        items: targets.map((target) => ({
          id: target.phraseId,
          text: target.text,
          fromCategory: target.category,
          toCategory: input.destination,
        })),
      });
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
