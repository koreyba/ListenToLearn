import type {
  AddVocabularyEntriesMutationArgs,
  AddVocabularyMeaningMutationArgs,
  ChangeVocabularyStateMutationInput,
  SetVocabularyCategoryMutationInput,
  UpdateVocabularyMeaningMutationArgs,
  VocabularyChangeSetMutationArgs,
  createVocabularyMutationPlanner,
} from "../vocabulary/mutations.ts";
import { VOCABULARY_MUTATION_OPERATIONS } from "../vocabulary/mutations.ts";
import {
  canonicalTraceJson,
  sha256Hex,
  type AiChatToolMutationPlan,
} from "./tool-trace.ts";

export type AiChatWriteProposalDecision = "confirm" | "cancel";
export type AiChatWriteProposalOperation =
  | "add_vocabulary_entries"
  | "add_vocabulary_meaning"
  | "update_vocabulary_meaning"
  | "change_vocabulary_state"
  | "set_vocabulary_category"
  | "vocabulary_change_set";

export type AiChatWriteProposalItem = {
  id: string;
  text: string;
  actionType?: "add_entry" | "add_meaning" | "update_meaning" | "change_state";
  translation?: string;
  context?: string;
  previousTranslation?: string;
  fromCategory?: string;
  toCategory?: string;
};

export type AiChatPublicWriteProposal = {
  id: string;
  assistantMessageId: string;
  operation: AiChatWriteProposalOperation;
  items: AiChatWriteProposalItem[];
  status: "pending" | "confirmed" | "cancelled" | "failed";
  result: unknown;
  errorCode: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type AiChatWriteProposalErrorCode =
  | "conflict"
  | "invalid_input"
  | "not_found"
  | "operation_failed";

export class AiChatWriteProposalError extends Error {
  readonly code: AiChatWriteProposalErrorCode;

  constructor(code: AiChatWriteProposalErrorCode, message: string) {
    super(message);
    this.name = "AiChatWriteProposalError";
    this.code = code;
  }
}

type ProposalStatus = "pending" | "committed" | "cancelled" | "conflict";

type ProposalRow = {
  id: string;
  user_message_id: string;
  assistant_message_id: string;
  origin_attempt_id: string;
  provider_tool_call_id: string;
  tool_name: string;
  operation: string;
  target_key: string;
  mutation_input_json: string;
  mutation_input_sha256: string;
  public_json: string;
  status: ProposalStatus;
  result_json: string | null;
  error_code: string | null;
  created_at: string;
  decided_at: string | null;
  assistant_status: string;
};

type MutationEnvelope = {
  args: Record<string, unknown>;
  result: unknown;
};

type RepositoryOptions = {
  createId?: (kind: "receipt") => string;
  now?: () => string;
};

const PUBLIC_OPERATIONS = new Set<AiChatWriteProposalOperation>([
  "add_vocabulary_entries",
  "add_vocabulary_meaning",
  "update_vocabulary_meaning",
  "change_vocabulary_state",
  "set_vocabulary_category",
  "vocabulary_change_set",
]);

const PUBLIC_ACTION_TYPES = new Set<NonNullable<AiChatWriteProposalItem["actionType"]>>([
  "add_entry",
  "add_meaning",
  "update_meaning",
  "change_state",
]);

function proposalError(code: AiChatWriteProposalErrorCode, message: string): never {
  throw new AiChatWriteProposalError(code, message);
}

function parseJson(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readPublicPayload(value: string) {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.operation !== "string"
    || !PUBLIC_OPERATIONS.has(record.operation as AiChatWriteProposalOperation)
    || !Array.isArray(record.items)
    || record.items.length < 1
    || record.items.length > 30
  ) return null;
  const items: AiChatWriteProposalItem[] = [];
  for (const value of record.items) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.id !== "string"
      || !item.id
      || typeof item.text !== "string"
      || !item.text
      || (item.actionType !== undefined && (
        typeof item.actionType !== "string"
        || !PUBLIC_ACTION_TYPES.has(item.actionType as NonNullable<AiChatWriteProposalItem["actionType"]>)
      ))
    ) return null;
    const optionalKeys = [
      "translation",
      "context",
      "previousTranslation",
      "fromCategory",
      "toCategory",
    ] as const;
    if (optionalKeys.some((key) => item[key] !== undefined && typeof item[key] !== "string")) {
      return null;
    }
    items.push({
      id: item.id,
      text: item.text,
      ...(typeof item.actionType === "string"
        ? { actionType: item.actionType as NonNullable<AiChatWriteProposalItem["actionType"]> }
        : {}),
      ...(typeof item.translation === "string" ? { translation: item.translation } : {}),
      ...(typeof item.context === "string" ? { context: item.context } : {}),
      ...(typeof item.previousTranslation === "string"
        ? { previousTranslation: item.previousTranslation }
        : {}),
      ...(typeof item.fromCategory === "string" ? { fromCategory: item.fromCategory } : {}),
      ...(typeof item.toCategory === "string" ? { toCategory: item.toCategory } : {}),
    });
  }
  return {
    operation: record.operation as AiChatWriteProposalOperation,
    items,
  };
}

function mapPublicProposal(row: ProposalRow): AiChatPublicWriteProposal | null {
  const payload = readPublicPayload(row.public_json);
  if (!payload) return null;
  const status = row.status === "committed"
    ? "confirmed"
    : row.status === "conflict"
      ? "failed"
      : row.status;
  return {
    id: row.id,
    assistantMessageId: row.assistant_message_id,
    operation: payload.operation,
    items: payload.items,
    status,
    result: parseJson(row.result_json),
    errorCode: row.error_code,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}

function readMutationEnvelope(value: string): MutationEnvelope | null {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (!record.args || typeof record.args !== "object" || Array.isArray(record.args)) {
    return null;
  }
  if (!("result" in record)) return null;
  return {
    args: record.args as Record<string, unknown>,
    result: record.result,
  };
}

export function createAiChatWriteProposalRepository(
  db: D1Database,
  mutationPlanner: ReturnType<typeof createVocabularyMutationPlanner>,
  options: RepositoryOptions = {},
) {
  const createId = options.createId || ((kind: "receipt") => `${kind}-${crypto.randomUUID()}`);
  const now = options.now || (() => new Date().toISOString());

  async function readOwned(userId: string, chatId: string, proposalId: string) {
    return db.prepare(`
      SELECT
        proposals.id,
        proposals.user_message_id,
        proposals.assistant_message_id,
        proposals.origin_attempt_id,
        calls.provider_tool_call_id,
        calls.tool_name,
        proposals.operation,
        proposals.target_key,
        proposals.mutation_input_json,
        proposals.mutation_input_sha256,
        proposals.public_json,
        proposals.status,
        proposals.result_json,
        proposals.error_code,
        proposals.created_at,
        proposals.decided_at,
        assistant_messages.status AS assistant_status
      FROM ai_chat_vocabulary_write_proposals AS proposals
      JOIN ai_chats AS chats ON chats.id = proposals.chat_id
      JOIN ai_chat_messages AS assistant_messages
        ON assistant_messages.id = proposals.assistant_message_id
      JOIN ai_chat_assistant_attempts AS origin_attempts
        ON origin_attempts.id = proposals.origin_attempt_id
      JOIN ai_chat_tool_calls AS calls
        ON calls.id = proposals.origin_tool_call_id
      WHERE proposals.id = ?
        AND proposals.user_id = ?
        AND proposals.chat_id = ?
        AND chats.user_id = ?
        AND assistant_messages.chat_id = ?
        AND assistant_messages.role = 'assistant'
        AND origin_attempts.user_id = proposals.user_id
        AND origin_attempts.chat_id = proposals.chat_id
        AND origin_attempts.assistant_message_id = proposals.assistant_message_id
        AND origin_attempts.status = 'complete'
        AND calls.assistant_attempt_id = origin_attempts.id
      LIMIT 1
    `).bind(
      proposalId,
      userId,
      chatId,
      userId,
      chatId,
    ).first<ProposalRow>();
  }

  async function listForChat(userId: string, chatId: string) {
    const rows = await db.prepare(`
      SELECT
        proposals.id,
        proposals.user_message_id,
        proposals.assistant_message_id,
        proposals.origin_attempt_id,
        calls.provider_tool_call_id,
        calls.tool_name,
        proposals.operation,
        proposals.target_key,
        proposals.mutation_input_json,
        proposals.mutation_input_sha256,
        proposals.public_json,
        proposals.status,
        proposals.result_json,
        proposals.error_code,
        proposals.created_at,
        proposals.decided_at,
        assistant_messages.status AS assistant_status
      FROM ai_chat_vocabulary_write_proposals AS proposals
      JOIN ai_chats AS chats ON chats.id = proposals.chat_id
      JOIN ai_chat_messages AS assistant_messages
        ON assistant_messages.id = proposals.assistant_message_id
      JOIN ai_chat_assistant_attempts AS origin_attempts
        ON origin_attempts.id = proposals.origin_attempt_id
      JOIN ai_chat_tool_calls AS calls
        ON calls.id = proposals.origin_tool_call_id
      WHERE proposals.user_id = ?
        AND proposals.chat_id = ?
        AND chats.user_id = ?
        AND assistant_messages.chat_id = ?
        AND assistant_messages.role = 'assistant'
        AND assistant_messages.status = 'complete'
        AND origin_attempts.user_id = proposals.user_id
        AND origin_attempts.chat_id = proposals.chat_id
        AND origin_attempts.assistant_message_id = proposals.assistant_message_id
        AND origin_attempts.status = 'complete'
        AND calls.assistant_attempt_id = origin_attempts.id
      ORDER BY proposals.created_at, proposals.id
    `).bind(userId, chatId, userId, chatId).all<ProposalRow>();
    return (rows.results || [])
      .map(mapPublicProposal)
      .filter((proposal): proposal is AiChatPublicWriteProposal => proposal !== null);
  }

  async function buildPlan(userId: string, row: ProposalRow, envelope: MutationEnvelope) {
    let plan: AiChatToolMutationPlan<unknown>;
    switch (row.operation) {
      case VOCABULARY_MUTATION_OPERATIONS.addEntries:
        plan = await mutationPlanner.planAddEntries(
          userId,
          envelope.args as AddVocabularyEntriesMutationArgs,
        );
        break;
      case VOCABULARY_MUTATION_OPERATIONS.addMeaning:
        plan = await mutationPlanner.planAddMeaning(
          userId,
          envelope.args as AddVocabularyMeaningMutationArgs,
        );
        break;
      case VOCABULARY_MUTATION_OPERATIONS.updateMeaning:
        plan = await mutationPlanner.planUpdateMeaning(
          userId,
          envelope.args as UpdateVocabularyMeaningMutationArgs,
        );
        break;
      case VOCABULARY_MUTATION_OPERATIONS.changeState:
        plan = await mutationPlanner.planChangeState(
          userId,
          envelope.args as ChangeVocabularyStateMutationInput,
        );
        break;
      case VOCABULARY_MUTATION_OPERATIONS.setCategory:
        plan = await mutationPlanner.planSetCategory(
          userId,
          envelope.args as SetVocabularyCategoryMutationInput,
        );
        break;
      case VOCABULARY_MUTATION_OPERATIONS.changeSet:
        plan = await mutationPlanner.planChangeSet(
          userId,
          envelope.args as VocabularyChangeSetMutationArgs,
        );
        break;
      default:
        return proposalError("operation_failed", "Stored proposal operation is unsupported.");
    }
    if (
      plan.operation !== row.operation
      || plan.targetKey !== row.target_key
      || canonicalTraceJson(plan.canonicalArgs) !== canonicalTraceJson(envelope.args)
    ) {
      return proposalError("operation_failed", "Stored proposal input is inconsistent.");
    }
    return { ...plan, canonicalResult: envelope.result };
  }

  async function markConflict(
    userId: string,
    chatId: string,
    proposalId: string,
  ) {
    const timestamp = now();
    try {
      await db.prepare(`
        UPDATE ai_chat_vocabulary_write_proposals
        SET status = 'conflict', error_code = 'mutation_conflict',
            updated_at = ?, decided_at = ?
        WHERE id = ? AND user_id = ? AND chat_id = ? AND status = 'pending'
      `).bind(timestamp, timestamp, proposalId, userId, chatId).run();
    } catch {
      // A terminal read below is authoritative after an ambiguous response.
    }
    const row = await readOwned(userId, chatId, proposalId);
    const proposal = row && mapPublicProposal(row);
    if (proposal?.status === "failed") return proposal;
    proposalError("operation_failed", "The proposal conflict could not be persisted.");
  }

  async function cancel(
    userId: string,
    chatId: string,
    row: ProposalRow,
  ) {
    if (row.status === "cancelled") {
      const proposal = mapPublicProposal(row);
      if (proposal) return proposal;
      proposalError("operation_failed", "Stored proposal display is invalid.");
    }
    if (row.status !== "pending") {
      proposalError("conflict", "The proposal already has a different decision.");
    }
    const timestamp = now();
    try {
      await db.prepare(`
        UPDATE ai_chat_vocabulary_write_proposals
        SET status = 'cancelled', updated_at = ?, decided_at = ?
        WHERE id = ? AND user_id = ? AND chat_id = ? AND status = 'pending'
      `).bind(timestamp, timestamp, row.id, userId, chatId).run();
    } catch {
      // Read through ambiguous completion below.
    }
    const decided = await readOwned(userId, chatId, row.id);
    if (!decided) proposalError("not_found", "Proposal was not found.");
    if (decided.status === "cancelled") {
      const proposal = mapPublicProposal(decided);
      if (proposal) return proposal;
      proposalError("operation_failed", "Stored proposal display is invalid.");
    }
    if (decided.status !== "pending") {
      proposalError("conflict", "The proposal already has a different decision.");
    }
    proposalError("operation_failed", "Proposal cancellation did not complete.");
  }

  async function confirm(
    userId: string,
    chatId: string,
    row: ProposalRow,
  ) {
    if (row.status === "committed") {
      const proposal = mapPublicProposal(row);
      if (proposal) return proposal;
      proposalError("operation_failed", "Stored proposal display is invalid.");
    }
    if (row.status !== "pending") {
      proposalError("conflict", "The proposal already has a different decision.");
    }
    const inputHash = await sha256Hex(row.mutation_input_json);
    const envelope = readMutationEnvelope(row.mutation_input_json);
    if (inputHash !== row.mutation_input_sha256 || !envelope) {
      proposalError("operation_failed", "Stored proposal input is invalid.");
    }
    const plan = await buildPlan(userId, row, envelope);
    const argsJson = canonicalTraceJson(plan.canonicalArgs);
    const argsSha256 = await sha256Hex(argsJson);
    const resultJson = canonicalTraceJson(plan.canonicalResult);
    if (argsJson.length > 4_096 || resultJson.length > 8_192) {
      proposalError("operation_failed", "Stored proposal exceeds execution limits.");
    }
    const receiptId = createId("receipt");
    const timestamp = now();
    const receiptStatement = db.prepare(`
      WITH validation(ok) AS (
        SELECT (
          EXISTS (
            SELECT 1
            FROM ai_chat_vocabulary_write_proposals AS proposals
            JOIN ai_chats AS chats ON chats.id = proposals.chat_id
            JOIN ai_chat_messages AS assistant_messages
              ON assistant_messages.id = proposals.assistant_message_id
            JOIN ai_chat_assistant_attempts AS origin_attempts
              ON origin_attempts.id = proposals.origin_attempt_id
            WHERE proposals.id = ?
              AND proposals.user_id = ?
              AND proposals.chat_id = ?
              AND proposals.status = 'pending'
              AND proposals.mutation_input_sha256 = ?
              AND chats.user_id = ?
              AND assistant_messages.chat_id = ?
              AND assistant_messages.role = 'assistant'
              AND assistant_messages.status = 'complete'
              AND origin_attempts.user_id = proposals.user_id
              AND origin_attempts.chat_id = proposals.chat_id
              AND origin_attempts.assistant_message_id = proposals.assistant_message_id
              AND origin_attempts.status = 'complete'
          )
          AND (${plan.receiptGuard.sql})
        )
      )
      INSERT INTO ai_chat_tool_mutation_receipts (
        id, user_id, chat_id, user_message_id, committed_by_attempt_id,
        provider_tool_call_id, tool_name, operation, target_key,
        args_json, args_sha256, status, result_json, error_code,
        entity_type, entity_id, created_at, completed_at
      )
      SELECT
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        CASE WHEN ok = 1 THEN ? ELSE '' END,
        'committed', ?, NULL, ?, ?, ?, ?
      FROM validation
    `).bind(
      row.id,
      userId,
      chatId,
      row.mutation_input_sha256,
      userId,
      chatId,
      ...plan.receiptGuard.bindings,
      receiptId,
      userId,
      chatId,
      row.user_message_id,
      row.origin_attempt_id,
      row.provider_tool_call_id,
      row.tool_name,
      plan.operation,
      plan.targetKey,
      argsJson,
      argsSha256,
      resultJson,
      plan.entityType || null,
      plan.entityId || null,
      timestamp,
      timestamp,
    );
    const completeProposal = db.prepare(`
      UPDATE ai_chat_vocabulary_write_proposals
      SET status = 'committed', result_json = ?, error_code = NULL,
          receipt_id = ?, updated_at = ?, decided_at = ?
      WHERE id = ? AND user_id = ? AND chat_id = ? AND status = 'pending'
        AND mutation_input_sha256 = ?
        AND EXISTS (
          SELECT 1 FROM ai_chat_tool_mutation_receipts AS receipts
          WHERE receipts.id = ?
            AND receipts.user_id = ai_chat_vocabulary_write_proposals.user_id
            AND receipts.chat_id = ai_chat_vocabulary_write_proposals.chat_id
            AND receipts.user_message_id = ai_chat_vocabulary_write_proposals.user_message_id
            AND receipts.operation = ai_chat_vocabulary_write_proposals.operation
            AND receipts.target_key = ai_chat_vocabulary_write_proposals.target_key
            AND receipts.args_sha256 = ?
        )
    `).bind(
      resultJson,
      receiptId,
      timestamp,
      timestamp,
      row.id,
      userId,
      chatId,
      row.mutation_input_sha256,
      receiptId,
      argsSha256,
    );

    try {
      await db.batch([...plan.statements, receiptStatement, completeProposal]);
    } catch {
      const recovered = await readOwned(userId, chatId, row.id);
      if (!recovered) proposalError("not_found", "Proposal was not found.");
      if (recovered.status === "committed") {
        const proposal = mapPublicProposal(recovered);
        if (proposal) return proposal;
        proposalError("operation_failed", "Stored proposal display is invalid.");
      }
      if (recovered.status !== "pending") {
        proposalError("conflict", "The proposal already has a different decision.");
      }
      if (plan.conflictGuard) {
        try {
          const conflict = await db.prepare(`
            SELECT CASE WHEN (${plan.conflictGuard.sql}) THEN 0 ELSE 1 END AS conflict
          `).bind(...plan.conflictGuard.bindings).first<{ conflict: number }>();
          if (Number(conflict?.conflict || 0) === 1) {
            return markConflict(userId, chatId, row.id);
          }
        } catch {
          // An unavailable classifier is not proof of a stale domain value.
        }
      }
      proposalError("operation_failed", "Proposal confirmation did not complete.");
    }
    const committed = await readOwned(userId, chatId, row.id);
    if (!committed) proposalError("not_found", "Proposal was not found.");
    if (committed.status !== "committed") {
      proposalError("operation_failed", "Proposal confirmation did not complete.");
    }
    const proposal = mapPublicProposal(committed);
    if (!proposal) proposalError("operation_failed", "Stored proposal display is invalid.");
    return proposal;
  }

  async function decide(
    userId: string,
    chatId: string,
    proposalId: string,
    decision: AiChatWriteProposalDecision,
  ) {
    if (!userId || !chatId || !proposalId || !["confirm", "cancel"].includes(decision)) {
      proposalError("invalid_input", "Proposal decision is invalid.");
    }
    const row = await readOwned(userId, chatId, proposalId);
    if (!row) proposalError("not_found", "Proposal was not found.");
    if (row.assistant_status !== "complete") {
      proposalError("conflict", "The assistant response is not complete.");
    }
    return decision === "cancel"
      ? cancel(userId, chatId, row)
      : confirm(userId, chatId, row);
  }

  return { decide, listForChat };
}
