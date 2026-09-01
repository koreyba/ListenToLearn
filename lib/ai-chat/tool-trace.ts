const TRACE_LIMITS = {
  argsJsonCharacters: 4_096,
  resultJsonCharacters: 8_192,
  toolCallIdCharacters: 240,
  toolNameCharacters: 120,
} as const;

export type AiChatToolTraceContext = {
  userId: string;
  chatId: string;
  userMessageId: string;
  assistantMessageId: string;
  attemptId: string;
};

export type AiChatToolMutationPlan<Result = unknown> = {
  operation: string;
  targetKey: string;
  canonicalArgs: unknown;
  canonicalResult: Result;
  entityType?: string | null;
  entityId?: string | null;
  statements: readonly D1PreparedStatement[];
  receiptGuard: {
    /** Fixed internal SQL expression. Values must be supplied only as bindings. */
    sql: string;
    bindings: readonly unknown[];
  };
  conflictGuard?: {
    /** Fixed internal precondition expression used only to classify rollback. */
    sql: string;
    bindings: readonly unknown[];
  };
};

export type AiChatToolCall = {
  id: string;
  providerToolCallId: string;
  toolName: string;
  argsSha256: string;
  status: "received" | "succeeded" | "committed" | "replayed" | "rejected" | "failed";
  result: unknown;
  errorCode: string | null;
  receiptId: string | null;
};

export type AiChatToolExecutionScope = {
  commitMutation<Result>(plan: AiChatToolMutationPlan<Result>): Promise<Result | ToolExecutionError>;
  proposeMutation<Result>(
    plan: AiChatToolMutationPlan<Result>,
    publicPayload: unknown,
  ): Promise<AiChatToolProposalResult | ToolExecutionError>;
};

export type AiChatToolProposalResult = {
  ok: true;
  proposed: true;
  approvalRequired: true;
  proposalId: string;
};

export type ToolExecutionError = {
  ok: false;
  error:
    | "invalid_trace_context"
    | "invalid_target"
    | "mutation_conflict"
    | "operation_failed"
    | "result_too_large"
    | "stale_attempt"
    | "tool_call_conflict"
    | "tool_execution_in_progress";
};

type TraceRepositoryOptions = {
  createId?: (kind: "tool-call" | "receipt" | "proposal") => string;
  now?: () => string;
};

type ToolCallRow = {
  id: string;
  provider_tool_call_id: string;
  tool_name: string;
  args_sha256: string;
  status: AiChatToolCall["status"];
  result_json: string | null;
  error_code: string | null;
  receipt_id: string | null;
};

type ReceiptRow = {
  id: string;
  args_sha256: string;
  result_json: string;
};

type ProposalRow = {
  id: string;
  mutation_input_sha256: string;
};

export class AiChatToolTraceError extends Error {
  readonly code: ToolExecutionError["error"];

  constructor(code: ToolExecutionError["error"], message: string) {
    super(message);
    this.name = "AiChatToolTraceError";
    this.code = code;
  }
}

function defaultCreateId(kind: "tool-call" | "receipt" | "proposal") {
  return `${kind}-${crypto.randomUUID()}`;
}

function parseJson(value: string | null) {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Trace JSON contains a non-finite number.");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  throw new TypeError("Trace JSON contains an unsupported value.");
}

export function canonicalTraceJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function cleanIdentifier(value: string, maximum: number) {
  const cleaned = value.normalize("NFKC").trim();
  return cleaned && [...cleaned].length <= maximum ? cleaned : null;
}

function mapToolCall(row: ToolCallRow): AiChatToolCall {
  return {
    id: row.id,
    providerToolCallId: row.provider_tool_call_id,
    toolName: row.tool_name,
    argsSha256: row.args_sha256,
    status: row.status,
    result: parseJson(row.result_json),
    errorCode: row.error_code,
    receiptId: row.receipt_id,
  };
}

function boundedResult(value: unknown) {
  const json = canonicalTraceJson(value);
  if (json.length <= TRACE_LIMITS.resultJsonCharacters) return { value, json };
  const fallback: ToolExecutionError = { ok: false, error: "result_too_large" };
  return { value: fallback, json: canonicalTraceJson(fallback) };
}

function stableFailure(error: ToolExecutionError["error"]): ToolExecutionError {
  return { ok: false, error };
}

export function createAiChatToolTraceRepository(
  db: D1Database,
  options: TraceRepositoryOptions = {},
) {
  const createId = options.createId || defaultCreateId;
  const now = options.now || (() => new Date().toISOString());

  async function readCall(attemptId: string, providerToolCallId: string) {
    const row = await db.prepare(`
      SELECT
        id, provider_tool_call_id, tool_name, args_sha256, status,
        result_json, error_code, receipt_id
      FROM ai_chat_tool_calls
      WHERE assistant_attempt_id = ? AND provider_tool_call_id = ?
      LIMIT 1
    `).bind(attemptId, providerToolCallId).first<ToolCallRow>();
    return row ? mapToolCall(row) : null;
  }

  async function readCallById(
    context: AiChatToolTraceContext,
    callId: string,
  ) {
    const row = await db.prepare(`
      SELECT
        id, provider_tool_call_id, tool_name, args_sha256, status,
        result_json, error_code, receipt_id
      FROM ai_chat_tool_calls
      WHERE id = ? AND user_id = ? AND chat_id = ? AND user_message_id = ?
        AND assistant_attempt_id = ?
      LIMIT 1
    `).bind(
      callId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
    ).first<ToolCallRow>();
    return row ? mapToolCall(row) : null;
  }

  async function readCreatedCallByIdentity(
    context: AiChatToolTraceContext,
    input: {
      callId: string;
      providerToolCallId: string;
      toolName: string;
      argsJson: string;
      argsSha256: string;
    },
  ) {
    const row = await db.prepare(`
      SELECT
        id, provider_tool_call_id, tool_name, args_sha256, status,
        result_json, error_code, receipt_id
      FROM ai_chat_tool_calls
      WHERE id = ? AND user_id = ? AND chat_id = ? AND user_message_id = ?
        AND assistant_attempt_id = ? AND provider_tool_call_id = ?
        AND tool_name = ? AND args_json = ? AND args_sha256 = ?
      LIMIT 1
    `).bind(
      input.callId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
      input.providerToolCallId,
      input.toolName,
      input.argsJson,
      input.argsSha256,
    ).first<ToolCallRow>();
    return row ? mapToolCall(row) : null;
  }

  async function attemptIsActive(
    context: AiChatToolTraceContext,
    referenceTime: string,
  ) {
    const row = await db.prepare(`
      SELECT 1 AS active
      FROM ai_chat_assistant_attempts AS attempts
      JOIN ai_chats AS chats ON chats.id = attempts.chat_id
      JOIN ai_chat_messages AS user_messages
        ON user_messages.id = attempts.user_message_id
      JOIN ai_chat_messages AS assistant_messages
        ON assistant_messages.id = attempts.assistant_message_id
      WHERE attempts.id = ?
        AND attempts.user_id = ?
        AND attempts.chat_id = ?
        AND attempts.user_message_id = ?
        AND attempts.assistant_message_id = ?
        AND attempts.status = 'pending'
        AND attempts.lease_expires_at > ?
        AND chats.user_id = ?
        AND user_messages.chat_id = ?
        AND user_messages.role = 'user'
        AND user_messages.status = 'complete'
        AND assistant_messages.chat_id = ?
        AND assistant_messages.role = 'assistant'
        AND assistant_messages.status = 'pending'
      LIMIT 1
    `).bind(
      context.attemptId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.assistantMessageId,
      referenceTime,
      context.userId,
      context.chatId,
      context.chatId,
    ).first<{ active: number }>();
    return Number(row?.active || 0) === 1;
  }

  async function rejectStaleCall(
    context: AiChatToolTraceContext,
    callId: string,
    timestamp: string,
  ) {
    const stale = stableFailure("stale_attempt");
    await db.prepare(`
      UPDATE ai_chat_tool_calls
      SET status = 'rejected', result_json = ?, error_code = 'stale_attempt',
          completed_at = ?
      WHERE id = ? AND user_id = ? AND chat_id = ? AND user_message_id = ?
        AND assistant_attempt_id = ? AND status = 'received'
    `).bind(
      canonicalTraceJson(stale),
      timestamp,
      callId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
    ).run();
    return stale;
  }

  async function beginCall(
    context: AiChatToolTraceContext,
    input: { providerToolCallId: string; toolName: string; args: unknown },
  ) {
    const providerToolCallId = cleanIdentifier(
      input.providerToolCallId,
      TRACE_LIMITS.toolCallIdCharacters,
    );
    const toolName = cleanIdentifier(input.toolName, TRACE_LIMITS.toolNameCharacters);
    if (!providerToolCallId || !toolName) {
      throw new AiChatToolTraceError("invalid_trace_context", "Tool trace metadata is invalid.");
    }
    const argsJson = canonicalTraceJson(input.args);
    if (argsJson.length > TRACE_LIMITS.argsJsonCharacters) {
      throw new AiChatToolTraceError("invalid_trace_context", "Tool arguments exceed the trace limit.");
    }
    const argsSha256 = await sha256Hex(argsJson);
    const timestamp = now();
    const callId = createId("tool-call");
    const insertStatement = db.prepare(`
      INSERT OR IGNORE INTO ai_chat_tool_calls (
        id, user_id, chat_id, user_message_id, assistant_attempt_id,
        provider_tool_call_id, tool_name, args_json, args_sha256, status, created_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?
      WHERE EXISTS (
        SELECT 1
        FROM ai_chat_assistant_attempts AS attempts
        JOIN ai_chats AS chats ON chats.id = attempts.chat_id
        JOIN ai_chat_messages AS user_messages
          ON user_messages.id = attempts.user_message_id
        JOIN ai_chat_messages AS assistant_messages
          ON assistant_messages.id = attempts.assistant_message_id
        WHERE attempts.id = ?
          AND attempts.user_id = ?
          AND attempts.chat_id = ?
          AND attempts.user_message_id = ?
          AND attempts.assistant_message_id = ?
          AND attempts.status = 'pending'
          AND attempts.lease_expires_at > ?
          AND chats.user_id = ?
          AND user_messages.chat_id = ?
          AND user_messages.role = 'user'
          AND user_messages.status = 'complete'
          AND assistant_messages.chat_id = ?
          AND assistant_messages.role = 'assistant'
          AND assistant_messages.status = 'pending'
      )
    `).bind(
      callId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
      providerToolCallId,
      toolName,
      argsJson,
      argsSha256,
      timestamp,
      context.attemptId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.assistantMessageId,
      timestamp,
      context.userId,
      context.chatId,
      context.chatId,
    );
    let call: AiChatToolCall | null = null;
    let created = false;
    let activeReferenceTime = timestamp;
    try {
      const inserted = await insertStatement.run();
      created = Number(inserted.meta.changes || 0) === 1;
      call = await readCall(context.attemptId, providerToolCallId);
    } catch (error) {
      activeReferenceTime = now();
      const recoveredCreatedCall = await readCreatedCallByIdentity(context, {
        callId,
        providerToolCallId,
        toolName,
        argsJson,
        argsSha256,
      });
      if (recoveredCreatedCall) {
        call = recoveredCreatedCall;
        created = true;
      } else {
        if (await readCallById(context, callId)) {
          throw new AiChatToolTraceError(
            "tool_call_conflict",
            "Generated tool-call identity collided with an existing invocation.",
          );
        }
        call = await readCall(context.attemptId, providerToolCallId);
        if (!call) {
          if (!await attemptIsActive(context, activeReferenceTime)) {
            throw new AiChatToolTraceError(
              "stale_attempt",
              "Assistant attempt is no longer active.",
            );
          }
          throw error;
        }
      }
    }
    if (!call) {
      throw new AiChatToolTraceError("stale_attempt", "Assistant attempt is no longer active.");
    }
    if (!await attemptIsActive(context, activeReferenceTime)) {
      await rejectStaleCall(context, call.id, activeReferenceTime);
      throw new AiChatToolTraceError("stale_attempt", "Assistant attempt lease has expired.");
    }
    if (
      call.providerToolCallId !== providerToolCallId
      || call.toolName !== toolName
      || call.argsSha256 !== argsSha256
    ) {
      throw new AiChatToolTraceError("tool_call_conflict", "Tool-call identity was reused.");
    }
    return {
      state: created ? "created" as const : "existing" as const,
      call,
    };
  }

  async function finishCall(
    context: AiChatToolTraceContext,
    callId: string,
    status: "succeeded" | "rejected" | "failed",
    result: unknown,
    errorCode: string | null = null,
  ) {
    const bounded = boundedResult(result);
    const resultWasTooLarge = bounded.value !== result;
    const timestamp = now();
    const updated = await db.prepare(`
      UPDATE ai_chat_tool_calls
      SET status = ?, result_json = ?, error_code = ?, completed_at = ?
      WHERE id = ? AND user_id = ? AND chat_id = ? AND user_message_id = ?
        AND assistant_attempt_id = ? AND status = 'received'
        AND EXISTS (
          SELECT 1
          FROM ai_chat_assistant_attempts AS attempts
          WHERE attempts.id = ai_chat_tool_calls.assistant_attempt_id
            AND attempts.assistant_message_id = ?
            AND attempts.status = 'pending'
            AND attempts.lease_expires_at > ?
        )
    `).bind(
      resultWasTooLarge ? "failed" : status,
      bounded.json,
      resultWasTooLarge ? "result_too_large" : errorCode,
      timestamp,
      callId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
      context.assistantMessageId,
      timestamp,
    ).run();
    if (Number(updated.meta.changes || 0) === 1) return bounded.value;
    const stored = await readCallById(context, callId);
    if (stored && stored.status !== "received") return stored.result;
    return rejectStaleCall(context, callId, timestamp);
  }

  async function readReceipt(
    context: AiChatToolTraceContext,
    operation: string,
    targetKey: string,
  ) {
    return db.prepare(`
      SELECT id, args_sha256, result_json
      FROM ai_chat_tool_mutation_receipts
      WHERE user_id = ? AND chat_id = ? AND user_message_id = ?
        AND operation = ? AND target_key = ?
      LIMIT 1
    `).bind(
      context.userId,
      context.chatId,
      context.userMessageId,
      operation,
      targetKey,
    ).first<ReceiptRow>();
  }

  async function readProposal(
    context: AiChatToolTraceContext,
    operation: string,
    targetKey: string,
  ) {
    return db.prepare(`
      SELECT id, mutation_input_sha256
      FROM ai_chat_vocabulary_write_proposals
      WHERE user_id = ? AND chat_id = ? AND user_message_id = ?
        AND origin_attempt_id = ? AND operation = ? AND target_key = ?
      LIMIT 1
    `).bind(
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
      operation,
      targetKey,
    ).first<ProposalRow>();
  }

  async function readLatestCompletedToolResult(
    userId: string,
    chatId: string,
    toolNameValue: string,
    options: { beforeSequence?: number } = {},
  ) {
    const scopedUserId = cleanIdentifier(userId, 240);
    const scopedChatId = cleanIdentifier(chatId, 120);
    const toolName = cleanIdentifier(toolNameValue, TRACE_LIMITS.toolNameCharacters);
    if (!scopedUserId || !scopedChatId || !toolName) return null;
    const beforeSequence = Number.isSafeInteger(options.beforeSequence)
      && Number(options.beforeSequence) > 0
      ? Number(options.beforeSequence)
      : null;
    const sequencePredicate = beforeSequence === null
      ? ""
      : "AND assistant_messages.sequence < ?";
    const bindings: unknown[] = [
      scopedUserId,
      scopedChatId,
      toolName,
      scopedUserId,
    ];
    if (beforeSequence !== null) bindings.push(beforeSequence);
    const row = await db.prepare(`
      SELECT calls.result_json
      FROM ai_chat_tool_calls AS calls
      JOIN ai_chat_assistant_attempts AS attempts
        ON attempts.id = calls.assistant_attempt_id
      JOIN ai_chat_messages AS assistant_messages
        ON assistant_messages.id = attempts.assistant_message_id
      JOIN ai_chats AS chats ON chats.id = calls.chat_id
      WHERE calls.user_id = ? AND calls.chat_id = ? AND calls.tool_name = ?
        AND calls.status = 'succeeded' AND calls.result_json IS NOT NULL
        AND attempts.status = 'complete'
        AND assistant_messages.status = 'complete'
        AND chats.user_id = ?
        ${sequencePredicate}
      ORDER BY calls.completed_at DESC, calls.id DESC
      LIMIT 1
    `).bind(...bindings).first<{ result_json: string }>();
    return row ? parseJson(row.result_json) : null;
  }

  async function replayReceipt(
    context: AiChatToolTraceContext,
    callId: string,
    receipt: ReceiptRow,
  ) {
    const timestamp = now();
    const updated = await db.prepare(`
      UPDATE ai_chat_tool_calls
      SET status = 'replayed', result_json = ?, error_code = NULL,
          receipt_id = ?, completed_at = ?
      WHERE id = ? AND user_id = ? AND chat_id = ? AND user_message_id = ?
        AND assistant_attempt_id = ? AND status = 'received'
        AND EXISTS (
          SELECT 1
          FROM ai_chat_assistant_attempts AS attempts
          WHERE attempts.id = ai_chat_tool_calls.assistant_attempt_id
            AND attempts.assistant_message_id = ?
            AND attempts.status = 'pending'
            AND attempts.lease_expires_at > ?
        )
    `).bind(
      receipt.result_json,
      receipt.id,
      timestamp,
      callId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
      context.assistantMessageId,
      timestamp,
    ).run();
    if (Number(updated.meta.changes || 0) === 1) return parseJson(receipt.result_json);
    const stored = await readCallById(context, callId);
    if (stored && stored.status !== "received") return stored.result;
    return rejectStaleCall(context, callId, timestamp);
  }

  async function rejectMutationConflict(
    context: AiChatToolTraceContext,
    callId: string,
  ) {
    const result = stableFailure("mutation_conflict");
    return finishCall(context, callId, "rejected", result, "mutation_conflict");
  }

  async function callIsActive(
    context: AiChatToolTraceContext,
    callId: string,
  ) {
    const row = await db.prepare(`
      SELECT 1 AS active
      FROM ai_chat_tool_calls AS calls
      JOIN ai_chat_assistant_attempts AS attempts
        ON attempts.id = calls.assistant_attempt_id
      WHERE calls.id = ?
        AND calls.user_id = ?
        AND calls.chat_id = ?
        AND calls.user_message_id = ?
        AND calls.assistant_attempt_id = ?
        AND calls.status = 'received'
        AND attempts.assistant_message_id = ?
        AND attempts.status = 'pending'
        AND attempts.lease_expires_at > ?
      LIMIT 1
    `).bind(
      callId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
      context.assistantMessageId,
      now(),
    ).first<{ active: number }>();
    return Number(row?.active || 0) === 1;
  }

  async function mutationConflictDetected(
    plan: AiChatToolMutationPlan,
  ): Promise<boolean | null> {
    if (!plan.conflictGuard) return false;
    try {
      const row = await db.prepare(`
        SELECT CASE WHEN (${plan.conflictGuard.sql}) THEN 1 ELSE 0 END AS allowed
      `).bind(...plan.conflictGuard.bindings).first<{ allowed: number }>();
      return Number(row?.allowed || 0) !== 1;
    } catch {
      // An unavailable classifier is not evidence of a domain conflict. The
      // idempotent atomic batch below remains the authoritative retry path.
      return null;
    }
  }

  async function commitMutation<Result>(
    context: AiChatToolTraceContext,
    call: AiChatToolCall,
    plan: AiChatToolMutationPlan<Result>,
  ): Promise<Result | ToolExecutionError> {
    const argsJson = canonicalTraceJson(plan.canonicalArgs);
    const result = boundedResult(plan.canonicalResult);
    if (
      argsJson.length > TRACE_LIMITS.argsJsonCharacters
      || result.value !== plan.canonicalResult
    ) {
      return finishCall(
        context,
        call.id,
        "rejected",
        stableFailure("result_too_large"),
        "result_too_large",
      ) as Promise<ToolExecutionError>;
    }
    const argsSha256 = await sha256Hex(argsJson);
    const existing = await readReceipt(context, plan.operation, plan.targetKey);
    if (existing) {
      return existing.args_sha256 === argsSha256
        ? await replayReceipt(context, call.id, existing) as Result
        : await rejectMutationConflict(context, call.id) as ToolExecutionError;
    }

    const receiptId = createId("receipt");
    const timestamp = now();
    const receiptSql = `
      WITH validation(ok) AS (
        SELECT (
          EXISTS (
            SELECT 1
            FROM ai_chat_tool_calls AS calls
            JOIN ai_chat_assistant_attempts AS attempts
              ON attempts.id = calls.assistant_attempt_id
            WHERE calls.id = ?
              AND calls.user_id = ?
              AND calls.chat_id = ?
              AND calls.user_message_id = ?
              AND calls.assistant_attempt_id = ?
              AND calls.provider_tool_call_id = ?
              AND calls.tool_name = ?
              AND calls.status = 'received'
              AND attempts.assistant_message_id = ?
              AND attempts.status = 'pending'
              AND attempts.lease_expires_at > ?
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
    `;
    const receiptStatement = db.prepare(receiptSql).bind(
      call.id,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
      call.providerToolCallId,
      call.toolName,
      context.assistantMessageId,
      timestamp,
      ...plan.receiptGuard.bindings,
      receiptId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
      call.providerToolCallId,
      call.toolName,
      plan.operation,
      plan.targetKey,
      argsJson,
      argsSha256,
      result.json,
      plan.entityType || null,
      plan.entityId || null,
      timestamp,
      timestamp,
    );
    const completeCall = db.prepare(`
      UPDATE ai_chat_tool_calls
      SET status = 'committed', result_json = ?, error_code = NULL,
          receipt_id = ?, completed_at = ?
      WHERE id = ? AND status = 'received'
        AND EXISTS (
          SELECT 1
          FROM ai_chat_assistant_attempts AS attempts
          WHERE attempts.id = ai_chat_tool_calls.assistant_attempt_id
            AND attempts.assistant_message_id = ?
            AND attempts.status = 'pending'
            AND attempts.lease_expires_at > ?
        )
    `).bind(
      result.json,
      receiptId,
      timestamp,
      call.id,
      context.assistantMessageId,
      timestamp,
    );

    try {
      await db.batch([...plan.statements, receiptStatement, completeCall]);
      return result.value as Result;
    } catch {
      const racedReceipt = await readReceipt(context, plan.operation, plan.targetKey);
      if (racedReceipt) {
        if (racedReceipt.args_sha256 !== argsSha256) {
          return rejectMutationConflict(context, call.id) as Promise<ToolExecutionError>;
        }
        // A receipt written by this atomic batch means its call completion was
        // committed too. Read it first so an ambiguous post-commit response is
        // recovered without a guaranteed-to-miss replay UPDATE plus readback.
        const committedCall = await readCallById(context, call.id);
        if (committedCall && committedCall.status !== "received") {
          return committedCall.result as Result;
        }
        return replayReceipt(context, call.id, racedReceipt) as Promise<Result>;
      }
      if (!await callIsActive(context, call.id)) {
        return finishCall(
          context,
          call.id,
          "rejected",
          stableFailure("stale_attempt"),
          "stale_attempt",
        ) as Promise<ToolExecutionError>;
      }
      if (await mutationConflictDetected(plan) === true) {
        return rejectMutationConflict(context, call.id) as Promise<ToolExecutionError>;
      }
    }
    return finishCall(
      context,
      call.id,
      "failed",
      stableFailure("operation_failed"),
      "operation_failed",
    ) as Promise<ToolExecutionError>;
  }

  async function proposeMutation<Result>(
    context: AiChatToolTraceContext,
    call: AiChatToolCall,
    plan: AiChatToolMutationPlan<Result>,
    publicPayload: unknown,
  ): Promise<AiChatToolProposalResult | ToolExecutionError> {
    const operation = cleanIdentifier(plan.operation, 120);
    const targetKey = cleanIdentifier(plan.targetKey, 1_400);
    let mutationInputJson: string;
    let publicJson: string;
    try {
      mutationInputJson = canonicalTraceJson({
        args: plan.canonicalArgs,
        result: plan.canonicalResult,
      });
      publicJson = canonicalTraceJson(publicPayload);
    } catch {
      return finishCall(
        context,
        call.id,
        "rejected",
        stableFailure("invalid_target"),
        "invalid_target",
      ) as Promise<ToolExecutionError>;
    }
    if (
      !operation
      || !targetKey
      || mutationInputJson.length > TRACE_LIMITS.argsJsonCharacters
      || publicJson.length > TRACE_LIMITS.argsJsonCharacters
    ) {
      return finishCall(
        context,
        call.id,
        "rejected",
        stableFailure("result_too_large"),
        "result_too_large",
      ) as Promise<ToolExecutionError>;
    }
    const mutationInputSha256 = await sha256Hex(mutationInputJson);
    const existing = await readProposal(context, operation, targetKey);
    if (existing) {
      if (existing.mutation_input_sha256 !== mutationInputSha256) {
        return rejectMutationConflict(context, call.id) as Promise<ToolExecutionError>;
      }
      const result: AiChatToolProposalResult = {
        ok: true,
        proposed: true,
        approvalRequired: true,
        proposalId: existing.id,
      };
      return finishCall(context, call.id, "succeeded", result) as Promise<AiChatToolProposalResult>;
    }

    const proposalId = createId("proposal");
    const timestamp = now();
    const result: AiChatToolProposalResult = {
      ok: true,
      proposed: true,
      approvalRequired: true,
      proposalId,
    };
    const resultJson = canonicalTraceJson(result);
    const insertProposal = db.prepare(`
      INSERT OR IGNORE INTO ai_chat_vocabulary_write_proposals (
        id, user_id, chat_id, user_message_id, assistant_message_id,
        origin_attempt_id, origin_tool_call_id, operation, target_key,
        mutation_input_json, mutation_input_sha256, public_json, status,
        created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?
      WHERE EXISTS (
        SELECT 1
        FROM ai_chat_tool_calls AS calls
        JOIN ai_chat_assistant_attempts AS attempts
          ON attempts.id = calls.assistant_attempt_id
        WHERE calls.id = ?
          AND calls.user_id = ?
          AND calls.chat_id = ?
          AND calls.user_message_id = ?
          AND calls.assistant_attempt_id = ?
          AND calls.status = 'received'
          AND attempts.assistant_message_id = ?
          AND attempts.status = 'pending'
          AND attempts.lease_expires_at > ?
      )
    `).bind(
      proposalId,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.assistantMessageId,
      context.attemptId,
      call.id,
      operation,
      targetKey,
      mutationInputJson,
      mutationInputSha256,
      publicJson,
      timestamp,
      timestamp,
      call.id,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
      context.assistantMessageId,
      timestamp,
    );
    const completeCall = db.prepare(`
      UPDATE ai_chat_tool_calls
      SET status = 'succeeded', result_json = ?, error_code = NULL,
          completed_at = ?
      WHERE id = ? AND user_id = ? AND chat_id = ? AND user_message_id = ?
        AND assistant_attempt_id = ? AND status = 'received'
        AND EXISTS (
          SELECT 1
          FROM ai_chat_assistant_attempts AS attempts
          WHERE attempts.id = ai_chat_tool_calls.assistant_attempt_id
            AND attempts.assistant_message_id = ?
            AND attempts.status = 'pending'
            AND attempts.lease_expires_at > ?
        )
        AND EXISTS (
          SELECT 1
          FROM ai_chat_vocabulary_write_proposals AS proposals
          WHERE proposals.id = ?
            AND proposals.user_id = ai_chat_tool_calls.user_id
            AND proposals.chat_id = ai_chat_tool_calls.chat_id
            AND proposals.user_message_id = ai_chat_tool_calls.user_message_id
            AND proposals.origin_tool_call_id = ai_chat_tool_calls.id
            AND proposals.mutation_input_sha256 = ?
        )
    `).bind(
      resultJson,
      timestamp,
      call.id,
      context.userId,
      context.chatId,
      context.userMessageId,
      context.attemptId,
      context.assistantMessageId,
      timestamp,
      proposalId,
      mutationInputSha256,
    );

    try {
      const batch = await db.batch([insertProposal, completeCall]);
      if (
        Number(batch[0]?.meta.changes || 0) === 1
        && Number(batch[1]?.meta.changes || 0) === 1
      ) {
        return result;
      }
    } catch {
      // Resolve an ambiguous commit by reading the immutable proposal below.
    }

    const recovered = await readProposal(context, operation, targetKey);
    if (recovered) {
      if (recovered.mutation_input_sha256 !== mutationInputSha256) {
        return rejectMutationConflict(context, call.id) as Promise<ToolExecutionError>;
      }
      const recoveredResult: AiChatToolProposalResult = {
        ok: true,
        proposed: true,
        approvalRequired: true,
        proposalId: recovered.id,
      };
      const storedCall = await readCallById(context, call.id);
      if (storedCall && storedCall.status !== "received") {
        return storedCall.result as AiChatToolProposalResult;
      }
      return finishCall(
        context,
        call.id,
        "succeeded",
        recoveredResult,
      ) as Promise<AiChatToolProposalResult>;
    }
    return finishCall(
      context,
      call.id,
      "failed",
      stableFailure("operation_failed"),
      "operation_failed",
    ) as Promise<ToolExecutionError>;
  }

  return {
    beginCall,
    commitMutation,
    finishCall,
    readCall,
    readLatestCompletedToolResult,
    readReceipt,
    proposeMutation,
  };
}

export function createAiChatToolExecutor(
  repository: ReturnType<typeof createAiChatToolTraceRepository>,
  context: AiChatToolTraceContext,
) {
  return {
    async execute<Result>(input: {
      providerToolCallId: string;
      toolName: string;
      args: unknown;
      run(scope: AiChatToolExecutionScope): Promise<Result>;
    }): Promise<Result | ToolExecutionError> {
      let call: AiChatToolCall;
      try {
        const begun = await repository.beginCall(context, input);
        call = begun.call;
        if (begun.state === "existing") {
          if (call.status !== "received") return call.result as Result | ToolExecutionError;
          return stableFailure("tool_execution_in_progress");
        }
      } catch (error) {
        const code = error instanceof AiChatToolTraceError
          ? error.code
          : "operation_failed";
        return stableFailure(code);
      }

      let scopePersisted = false;
      try {
        const result = await input.run({
          commitMutation: async (plan) => {
            scopePersisted = true;
            return repository.commitMutation(context, call, plan);
          },
          proposeMutation: async (plan, publicPayload) => {
            scopePersisted = true;
            return repository.proposeMutation(context, call, plan, publicPayload);
          },
        });
        if (scopePersisted) return result;
        const rejected = Boolean(
          result
          && typeof result === "object"
          && (result as { ok?: unknown }).ok === false,
        );
        return await repository.finishCall(
          context,
          call.id,
          rejected ? "rejected" : "succeeded",
          result,
          rejected && typeof (result as { error?: unknown }).error === "string"
            ? String((result as { error: string }).error)
            : null,
        ) as Result | ToolExecutionError;
      } catch {
        return await repository.finishCall(
          context,
          call.id,
          "failed",
          stableFailure("operation_failed"),
          "operation_failed",
        ) as ToolExecutionError;
      }
    },
  };
}
