import {
  AI_CHAT_LIMITS,
  isMeaningMode,
  normalizeMeaning,
  type AiChatMeaningMode,
  type AiChatTargetInput,
} from "./contracts.ts";
import {
  VOCABULARY_LEGACY_MEANING_ID,
  type VocabularyMeaning,
} from "../vocabulary/contracts.ts";

export const AI_CHAT_LEGACY_MEANING_ID = VOCABULARY_LEGACY_MEANING_ID;
export const AI_CHAT_PENDING_LEASE_MS = AI_CHAT_LIMITS.upstreamTimeoutMs + 10_000;
export const AI_CHAT_ACCOUNT_LIMIT = 100;
export const AI_CHAT_LIST_LIMIT = 100;
export const AI_CHAT_MESSAGE_LIST_LIMIT = 200;

export type AiChatRepositoryErrorCode =
  | "not_found"
  | "conflict"
  | "turn_in_progress"
  | "invalid_target"
  | "target_limit";

export class AiChatRepositoryError extends Error {
  readonly code: AiChatRepositoryErrorCode;

  constructor(code: AiChatRepositoryErrorCode, message: string) {
    super(message);
    this.name = "AiChatRepositoryError";
    this.code = code;
  }
}

export type AiChatMeaning = VocabularyMeaning;

export type AiChatPracticeItem = {
  id: string;
  phraseId: string | null;
  text: string;
  meaningMode: AiChatMeaningMode;
  selectedMeaningId: string | null;
  selectedMeaningSnapshot: string;
  selectedMeaning: AiChatMeaning | null;
  knownMeanings: AiChatMeaning[];
  createdAt: string;
  updatedAt: string;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  sequence: number;
  content: string;
  status: "complete" | "pending" | "failed";
  practiceContext: unknown;
  clientMessageId: string;
  provider: string | null;
  model: string | null;
  usage: unknown;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatSummary = {
  id: string;
  title: string;
  explanationLanguage: string;
  targetCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AiChatDetail = AiChatSummary & {
  targets: AiChatPracticeItem[];
  messages: AiChatMessage[];
};

export type AiChatCanonicalMessage = Pick<
  AiChatMessage,
  "id" | "role" | "sequence" | "content" | "clientMessageId"
>;

export type AiChatAssistantAttempt = {
  id: string;
  attemptNumber: number;
  status: "pending" | "complete" | "failed" | "expired";
  leaseExpiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AiChatTurn = {
  state: "created" | "existing" | "retrying";
  user: AiChatMessage;
  assistant: AiChatMessage;
  attempt: AiChatAssistantAttempt | null;
};

type RepositoryOptions = {
  createId?: (kind: "chat" | "target" | "message" | "attempt") => string;
  now?: () => string;
};

type PhraseRow = {
  id: string;
  text: string;
  translation: string;
  context: string;
};

type MeaningRow = {
  id: string;
  translation: string;
  context: string;
};

type ChatRow = {
  id: string;
  title: string;
  explanation_language: string;
  target_count: number;
  message_count: number;
  created_at: string;
  updated_at: string;
};

type PracticeItemRow = {
  item_id: string;
  phrase_id: string | null;
  text_snapshot: string;
  meaning_mode: AiChatMeaningMode;
  selected_meaning_id: string | null;
  selected_meaning_snapshot: string;
  item_created_at: string;
  item_updated_at: string;
  legacy_translation: string | null;
  legacy_context: string | null;
  meaning_id: string | null;
  meaning_translation: string | null;
  meaning_context: string | null;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  sequence: number;
  content: string;
  status: "complete" | "pending" | "failed";
  practice_context_json: string;
  client_message_id: string;
  provider: string | null;
  model: string | null;
  usage_json: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

type AttemptRow = {
  id: string;
  attempt_number: number;
  status: "pending" | "complete" | "failed" | "expired";
  lease_expires_at: string;
  created_at: string;
  updated_at: string;
};

type TargetDraft = {
  phraseId: string | null;
  text: string;
  meaningMode: AiChatMeaningMode;
  selectedMeaningId: string | null;
  selectedMeaningSnapshot: string;
};

type CreatedTargetDraft = TargetDraft & { id: string };

type CreatedChatPayloadRow = {
  chat_id: string;
  chat_title: string;
  explanation_language: string;
  chat_created_at: string;
  chat_updated_at: string;
  target_id: string | null;
  target_phrase_id: string | null;
  target_text_snapshot: string | null;
  target_meaning_mode: AiChatMeaningMode | null;
  target_selected_meaning_id: string | null;
  target_selected_meaning_snapshot: string | null;
  target_created_at: string | null;
  target_updated_at: string | null;
  message_id: string | null;
  message_role: "user" | "assistant" | null;
  message_sequence: number | null;
  message_content: string | null;
  message_status: "complete" | "pending" | "failed" | null;
  message_practice_context_json: string | null;
  message_client_message_id: string | null;
  message_provider: string | null;
  message_model: string | null;
  message_usage_json: string | null;
  message_error_code: string | null;
  message_created_at: string | null;
  message_updated_at: string | null;
};

function repositoryError(code: AiChatRepositoryErrorCode, message: string): never {
  throw new AiChatRepositoryError(code, message);
}

function cleanSingleLine(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function cleanContext(value: string) {
  return value.normalize("NFKC").trim().replace(/\r\n?/gu, "\n");
}

function truncateCharacters(value: string, maximum: number) {
  return [...value].slice(0, maximum).join("");
}

function parseJson(value: string | null, fallback: unknown) {
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}

function pendingTurnIsStale(leaseExpiresAt: string, referenceTime: string) {
  const expires = Date.parse(leaseExpiresAt);
  const reference = Date.parse(referenceTime);
  return Number.isFinite(expires)
    && Number.isFinite(reference)
    && expires <= reference;
}

function attemptLeaseExpiresAt(timestamp: string) {
  const started = Date.parse(timestamp);
  return Number.isFinite(started)
    ? new Date(started + AI_CHAT_PENDING_LEASE_MS).toISOString()
    : timestamp;
}

function defaultCreateId(kind: "chat" | "target" | "message" | "attempt") {
  return `${kind}-${crypto.randomUUID()}`;
}

function mapChat(row: ChatRow): AiChatSummary {
  return {
    id: row.id,
    title: row.title,
    explanationLanguage: row.explanation_language,
    targetCount: Number(row.target_count),
    messageCount: Number(row.message_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): AiChatMessage {
  return {
    id: row.id,
    role: row.role,
    sequence: Number(row.sequence),
    content: row.content,
    status: row.status,
    practiceContext: parseJson(row.practice_context_json, []),
    clientMessageId: row.client_message_id,
    provider: row.provider,
    model: row.model,
    usage: parseJson(row.usage_json, null),
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttempt(row: AttemptRow): AiChatAssistantAttempt {
  return {
    id: row.id,
    attemptNumber: Number(row.attempt_number),
    status: row.status,
    leaseExpiresAt: row.lease_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function deriveTitle(targets: readonly TargetDraft[]) {
  if (!targets.length) return "New vocabulary practice";
  const first = truncateCharacters(targets[0].text, 72);
  return targets.length === 1 ? first : `${first} +${targets.length - 1}`;
}

export function createAiChatRepository(
  db: D1Database,
  options: RepositoryOptions = {},
) {
  const createId = options.createId || defaultCreateId;
  const now = options.now || (() => new Date().toISOString());

  async function visiblePhrase(userId: string, phraseId: string) {
    return db.prepare(`
      SELECT id, text, translation, context
      FROM phrases
      WHERE id = ? AND (source_type = 'preset' OR owner_id = ?)
      LIMIT 1
    `).bind(phraseId, userId).first<PhraseRow>();
  }

  async function ownedChat(userId: string, chatId: string) {
    return db.prepare(`
      SELECT
        chats.id,
        chats.title,
        chats.explanation_language,
        (SELECT COUNT(*) FROM ai_chat_practice_items AS items WHERE items.chat_id = chats.id) AS target_count,
        (SELECT COUNT(*) FROM ai_chat_messages AS messages WHERE messages.chat_id = chats.id) AS message_count,
        chats.created_at,
        chats.updated_at
      FROM ai_chats AS chats
      WHERE chats.id = ? AND chats.user_id = ?
      LIMIT 1
    `).bind(chatId, userId).first<ChatRow>();
  }

  async function requireOwnedChat(userId: string, chatId: string) {
    const chat = await ownedChat(userId, chatId);
    if (!chat) repositoryError("not_found", "Chat not found.");
    return chat;
  }

  async function resolveTarget(userId: string, input: AiChatTargetInput): Promise<TargetDraft> {
    const meaningMode: unknown = input.meaningMode;
    if (!isMeaningMode(meaningMode)) {
      repositoryError("invalid_target", "Unsupported meaning mode.");
    }
    if (input.source === "ad_hoc") {
      const text = cleanSingleLine(input.text);
      if (
        !text
        || [...text].length > AI_CHAT_LIMITS.targetTextCharacters
        || meaningMode === "selected"
      ) {
        repositoryError("invalid_target", "Invalid ad-hoc target.");
      }
      return {
        phraseId: null,
        text,
        meaningMode,
        selectedMeaningId: null,
        selectedMeaningSnapshot: "",
      };
    }

    const phrase = await visiblePhrase(userId, input.phraseId);
    if (!phrase) repositoryError("invalid_target", "Saved target is not visible.");
    if (meaningMode !== "selected") {
      return {
        phraseId: phrase.id,
        text: phrase.text,
        meaningMode,
        selectedMeaningId: null,
        selectedMeaningSnapshot: "",
      };
    }

    if (input.selectedMeaningId === AI_CHAT_LEGACY_MEANING_ID) {
      if (!phrase.translation.trim()) {
        repositoryError("invalid_target", "This target has no legacy meaning to select.");
      }
      return {
        phraseId: phrase.id,
        text: phrase.text,
        meaningMode: "selected",
        selectedMeaningId: null,
        selectedMeaningSnapshot: phrase.translation,
      };
    }

    const selectedMeaning = await db.prepare(`
      SELECT id, translation, context
      FROM phrase_meanings
      WHERE id = ? AND user_id = ? AND phrase_id = ?
      LIMIT 1
    `).bind(input.selectedMeaningId || "", userId, phrase.id).first<MeaningRow>();
    if (!selectedMeaning) {
      repositoryError("invalid_target", "Selected meaning is not owned for this target.");
    }
    return {
      phraseId: phrase.id,
      text: phrase.text,
      meaningMode: "selected",
      selectedMeaningId: selectedMeaning.id,
      selectedMeaningSnapshot: selectedMeaning.translation,
    };
  }

  async function resolveTargets(userId: string, targets: readonly AiChatTargetInput[]) {
    if (targets.length > AI_CHAT_LIMITS.targetCount) {
      repositoryError("target_limit", "Too many practice targets.");
    }
    const resolved: TargetDraft[] = [];
    for (const target of targets) resolved.push(await resolveTarget(userId, target));
    return resolved;
  }

  function targetInsert(chatId: string, target: TargetDraft, timestamp: string) {
    return db.prepare(`
      INSERT INTO ai_chat_practice_items (
        id, chat_id, phrase_id, text_snapshot, meaning_mode, selected_meaning_id,
        selected_meaning_snapshot, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      createId("target"),
      chatId,
      target.phraseId,
      target.text,
      target.meaningMode,
      target.selectedMeaningId,
      target.selectedMeaningSnapshot,
      timestamp,
      timestamp,
    );
  }

  function createTargetInsert(
    userId: string,
    chatId: string,
    target: CreatedTargetDraft,
    timestamp: string,
  ) {
    return db.prepare(`
      INSERT INTO ai_chat_practice_items (
        id, chat_id, phrase_id, text_snapshot, meaning_mode, selected_meaning_id,
        selected_meaning_snapshot, created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM ai_chats WHERE id = ? AND user_id = ?
      )
    `).bind(
      target.id,
      chatId,
      target.phraseId,
      target.text,
      target.meaningMode,
      target.selectedMeaningId,
      target.selectedMeaningSnapshot,
      timestamp,
      timestamp,
      chatId,
      userId,
    );
  }

  async function createdChatPayloadMatches(input: {
    userId: string;
    chatId: string;
    title: string;
    explanationLanguage: string;
    timestamp: string;
    targets: readonly CreatedTargetDraft[];
    openingMessageId: string | null;
    openingMessage: string;
  }) {
    const result = await db.prepare(`
      SELECT
        chats.id AS chat_id,
        chats.title AS chat_title,
        chats.explanation_language,
        chats.created_at AS chat_created_at,
        chats.updated_at AS chat_updated_at,
        items.id AS target_id,
        items.phrase_id AS target_phrase_id,
        items.text_snapshot AS target_text_snapshot,
        items.meaning_mode AS target_meaning_mode,
        items.selected_meaning_id AS target_selected_meaning_id,
        items.selected_meaning_snapshot AS target_selected_meaning_snapshot,
        items.created_at AS target_created_at,
        items.updated_at AS target_updated_at,
        messages.id AS message_id,
        messages.role AS message_role,
        messages.sequence AS message_sequence,
        messages.content AS message_content,
        messages.status AS message_status,
        messages.practice_context_json AS message_practice_context_json,
        messages.client_message_id AS message_client_message_id,
        messages.provider AS message_provider,
        messages.model AS message_model,
        messages.usage_json AS message_usage_json,
        messages.error_code AS message_error_code,
        messages.created_at AS message_created_at,
        messages.updated_at AS message_updated_at
      FROM ai_chats AS chats
      LEFT JOIN ai_chat_practice_items AS items ON items.chat_id = chats.id
      LEFT JOIN ai_chat_messages AS messages ON messages.chat_id = chats.id
      WHERE chats.id = ? AND chats.user_id = ?
    `).bind(input.chatId, input.userId).all<CreatedChatPayloadRow>();
    if (!result.results.length) return false;

    const targetRows = new Map<string, CreatedChatPayloadRow>();
    const messageRows = new Map<string, CreatedChatPayloadRow>();
    for (const row of result.results) {
      if (
        row.chat_id !== input.chatId
        || row.chat_title !== input.title
        || row.explanation_language !== input.explanationLanguage
        || row.chat_created_at !== input.timestamp
        || row.chat_updated_at !== input.timestamp
      ) {
        return false;
      }
      if (row.target_id) targetRows.set(row.target_id, row);
      if (row.message_id) messageRows.set(row.message_id, row);
    }
    if (targetRows.size !== input.targets.length) return false;
    for (const target of input.targets) {
      const row = targetRows.get(target.id);
      if (
        !row
        || row.target_phrase_id !== target.phraseId
        || row.target_text_snapshot !== target.text
        || row.target_meaning_mode !== target.meaningMode
        || row.target_selected_meaning_id !== target.selectedMeaningId
        || row.target_selected_meaning_snapshot !== target.selectedMeaningSnapshot
        || row.target_created_at !== input.timestamp
        || row.target_updated_at !== input.timestamp
      ) {
        return false;
      }
    }

    if (!input.openingMessageId) return messageRows.size === 0;
    if (messageRows.size !== 1) return false;
    const message = messageRows.get(input.openingMessageId);
    return Boolean(
      message
      && message.message_role === "assistant"
      && Number(message.message_sequence) === 1
      && message.message_content === input.openingMessage
      && message.message_status === "complete"
      && message.message_practice_context_json === "[]"
      && message.message_client_message_id === `opening:${input.chatId}`
      && message.message_provider === null
      && message.message_model === null
      && message.message_usage_json === null
      && message.message_error_code === null
      && message.message_created_at === input.timestamp
      && message.message_updated_at === input.timestamp
    );
  }

  async function readCurrentPracticeItems(
    userId: string,
    chatId: string,
  ): Promise<AiChatPracticeItem[]> {
    const result = await db.prepare(`
      WITH owned_items AS (
        SELECT items.*, items.rowid AS item_rowid
        FROM ai_chat_practice_items AS items
        JOIN ai_chats AS chats ON chats.id = items.chat_id
        WHERE items.chat_id = ? AND chats.user_id = ?
      ),
      ranked_meanings AS (
        SELECT
          meanings.id,
          meanings.phrase_id,
          meanings.translation,
          meanings.context,
          ROW_NUMBER() OVER (
            PARTITION BY meanings.phrase_id
            ORDER BY meanings.created_at, meanings.id
          ) AS meaning_rank
        FROM phrase_meanings AS meanings
        WHERE meanings.user_id = ?
          AND EXISTS (
            SELECT 1
            FROM owned_items
            WHERE owned_items.phrase_id = meanings.phrase_id
          )
      )
      SELECT
        items.id AS item_id,
        items.phrase_id,
        items.text_snapshot,
        items.meaning_mode,
        items.selected_meaning_id,
        items.selected_meaning_snapshot,
        items.created_at AS item_created_at,
        items.updated_at AS item_updated_at,
        phrases.translation AS legacy_translation,
        phrases.context AS legacy_context,
        meanings.id AS meaning_id,
        meanings.translation AS meaning_translation,
        meanings.context AS meaning_context
      FROM owned_items AS items
      LEFT JOIN phrases ON phrases.id = items.phrase_id
      LEFT JOIN ranked_meanings AS meanings
        ON meanings.phrase_id = items.phrase_id
        AND (
          (
            items.meaning_mode = 'selected'
            AND meanings.id = items.selected_meaning_id
          )
          OR (
            items.meaning_mode <> 'selected'
            AND meanings.meaning_rank
              + CASE WHEN TRIM(COALESCE(phrases.translation, '')) <> '' THEN 1 ELSE 0 END
              <= ?
          )
        )
      ORDER BY items.created_at, items.item_rowid, meanings.meaning_rank
    `).bind(chatId, userId, userId, AI_CHAT_LIMITS.meaningsPerTarget).all<PracticeItemRow>();

    const targets: AiChatPracticeItem[] = [];
    const byId = new Map<string, AiChatPracticeItem>();
    for (const row of result.results) {
      let target = byId.get(row.item_id);
      if (!target) {
        const legacySnapshot = normalizeMeaning(row.selected_meaning_snapshot);
        const selectedMeaningIsLegacy = row.meaning_mode === "selected"
          && row.selected_meaning_id === null
          && Boolean(legacySnapshot)
          && legacySnapshot === normalizeMeaning(row.legacy_translation || "");
        const selectedMeaning: AiChatMeaning | null = row.meaning_mode === "selected"
          ? {
              id: selectedMeaningIsLegacy ? AI_CHAT_LEGACY_MEANING_ID : row.selected_meaning_id,
              source: selectedMeaningIsLegacy ? "legacy" : "personal",
              translation: row.selected_meaning_snapshot,
              context: selectedMeaningIsLegacy ? row.legacy_context || "" : "",
            }
          : null;
        target = {
          id: row.item_id,
          phraseId: row.phrase_id,
          text: row.text_snapshot,
          meaningMode: row.meaning_mode,
          selectedMeaningId: row.selected_meaning_id,
          selectedMeaningSnapshot: row.selected_meaning_snapshot,
          selectedMeaning,
          knownMeanings: [],
          createdAt: row.item_created_at,
          updatedAt: row.item_updated_at,
        };
        if (row.meaning_mode !== "selected" && row.legacy_translation?.trim()) {
          target.knownMeanings.push({
            id: AI_CHAT_LEGACY_MEANING_ID,
            source: "legacy",
            translation: row.legacy_translation,
            context: row.legacy_context || "",
          });
        }
        targets.push(target);
        byId.set(row.item_id, target);
      }
      if (
        row.meaning_mode === "selected"
        && row.selected_meaning_id
        && row.meaning_id === row.selected_meaning_id
        && target.selectedMeaning
      ) {
        target.selectedMeaning.context = row.meaning_context || "";
      }
      if (
        row.meaning_mode !== "selected"
        && row.meaning_id
        && row.meaning_translation !== null
      ) {
        target.knownMeanings.push({
          id: row.meaning_id,
          source: "personal",
          translation: row.meaning_translation,
          context: row.meaning_context || "",
        });
      }
    }
    return targets;
  }

  async function getCurrentPracticeItems(userId: string, chatId: string) {
    await requireOwnedChat(userId, chatId);
    return readCurrentPracticeItems(userId, chatId);
  }

  async function listMessages(userId: string, chatId: string) {
    const result = await db.prepare(`
      SELECT
        bounded.id,
        bounded.role,
        bounded.sequence,
        bounded.content,
        bounded.status,
        bounded.practice_context_json,
        bounded.client_message_id,
        bounded.provider,
        bounded.model,
        bounded.usage_json,
        bounded.error_code,
        bounded.created_at,
        bounded.updated_at
      FROM (
        SELECT
          messages.id,
          messages.role,
          messages.sequence,
          messages.content,
          messages.status,
          messages.practice_context_json,
          messages.client_message_id,
          messages.provider,
          messages.model,
          messages.usage_json,
          messages.error_code,
          messages.created_at,
          messages.updated_at
        FROM ai_chat_messages AS messages
        JOIN ai_chats AS chats ON chats.id = messages.chat_id
        WHERE messages.chat_id = ? AND chats.user_id = ?
        ORDER BY messages.sequence DESC
        LIMIT ?
      ) AS bounded
      ORDER BY bounded.sequence
    `).bind(chatId, userId, AI_CHAT_MESSAGE_LIST_LIMIT).all<MessageRow>();
    return result.results.map(mapMessage);
  }

  async function recoverStalePendingTurns(userId: string, chatId: string) {
    const timestamp = now();
    const reference = Date.parse(timestamp);
    if (!Number.isFinite(reference)) return;
    const staleBefore = new Date(reference - AI_CHAT_PENDING_LEASE_MS).toISOString();
    const results = await db.batch([
      db.prepare(`
        UPDATE ai_chat_assistant_attempts
        SET status = 'expired', error_code = 'provider_timeout',
            updated_at = ?, completed_at = ?
        WHERE chat_id = ? AND user_id = ? AND status = 'pending'
          AND lease_expires_at <= ?
      `).bind(timestamp, timestamp, chatId, userId, timestamp),
      db.prepare(`
        UPDATE ai_chat_messages
        SET content = '', status = 'failed', provider = NULL, model = NULL,
            usage_json = NULL, error_code = 'provider_timeout', updated_at = ?
        WHERE chat_id = ? AND role = 'assistant' AND status = 'pending'
          AND (
            updated_at <= ?
            OR EXISTS (
              SELECT 1
              FROM ai_chat_assistant_attempts AS attempts
              WHERE attempts.assistant_message_id = ai_chat_messages.id
                AND attempts.status = 'expired'
                AND attempts.completed_at = ?
            )
          )
          AND EXISTS (
            SELECT 1 FROM ai_chats WHERE ai_chats.id = ? AND ai_chats.user_id = ?
          )
      `).bind(timestamp, chatId, staleBefore, timestamp, chatId, userId),
      db.prepare(`
        UPDATE ai_chats
        SET updated_at = ?
        WHERE id = ? AND user_id = ?
          AND EXISTS (
            SELECT 1
            FROM ai_chat_messages
            WHERE chat_id = ? AND role = 'assistant'
              AND status = 'failed' AND updated_at = ?
          )
      `).bind(timestamp, chatId, userId, chatId, timestamp),
    ]);
    if (Number(results[1]?.meta.changes || 0) === 0) {
      return;
    }
  }

  async function getChatSummary(userId: string, chatId: string): Promise<AiChatSummary | null> {
    const row = await ownedChat(userId, chatId);
    return row ? mapChat(row) : null;
  }

  async function getChat(userId: string, chatId: string): Promise<AiChatDetail | null> {
    await recoverStalePendingTurns(userId, chatId);
    const row = await ownedChat(userId, chatId);
    if (!row) return null;
    const [targets, messages] = await Promise.all([
      readCurrentPracticeItems(userId, chatId),
      listMessages(userId, chatId),
    ]);
    return { ...mapChat(row), targets, messages };
  }

  async function listChats(userId: string) {
    const result = await db.prepare(`
      SELECT
        chats.id,
        chats.title,
        chats.explanation_language,
        (SELECT COUNT(*) FROM ai_chat_practice_items AS items WHERE items.chat_id = chats.id) AS target_count,
        (SELECT COUNT(*) FROM ai_chat_messages AS messages WHERE messages.chat_id = chats.id) AS message_count,
        chats.created_at,
        chats.updated_at
      FROM ai_chats AS chats
      WHERE chats.user_id = ?
      ORDER BY chats.updated_at DESC, chats.id DESC
      LIMIT ?
    `).bind(userId, AI_CHAT_LIST_LIMIT).all<ChatRow>();
    return result.results.map(mapChat);
  }

  async function createChat(
    userId: string,
    input: {
      targets?: readonly AiChatTargetInput[];
      explanationLanguage?: string;
      openingMessage?: string;
    } = {},
  ) {
    const targets = await resolveTargets(userId, input.targets || []);
    const timestamp = now();
    const chatId = createId("chat");
    const language = truncateCharacters(cleanSingleLine(input.explanationLanguage || "ru"), 35) || "ru";
    const title = deriveTitle(targets);
    const openingMessage = input.openingMessage === undefined
      ? ""
      : cleanContext(input.openingMessage);
    if ([...openingMessage].length > AI_CHAT_LIMITS.messageCharacters) {
      repositoryError("invalid_target", "Opening message is too long.");
    }
    const createdTargets = targets.map((target): CreatedTargetDraft => ({
      id: createId("target"),
      ...target,
    }));
    const openingMessageId = openingMessage ? createId("message") : null;
    const statements = [
      db.prepare(`
        INSERT INTO ai_chats (
          id, user_id, title, explanation_language, created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?
        WHERE (
          SELECT COUNT(*) FROM ai_chats WHERE user_id = ?
        ) < ?
      `).bind(
        chatId,
        userId,
        title,
        language,
        timestamp,
        timestamp,
        userId,
        AI_CHAT_ACCOUNT_LIMIT,
      ),
      ...createdTargets.map((target) => createTargetInsert(userId, chatId, target, timestamp)),
    ];
    if (openingMessage) {
      statements.push(db.prepare(`
        INSERT INTO ai_chat_messages (
          id, chat_id, role, sequence, content, status, practice_context_json,
          client_message_id, provider, model, usage_json, error_code, created_at, updated_at
        )
        SELECT ?, ?, 'assistant', 1, ?, 'complete', '[]', ?,
          NULL, NULL, NULL, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM ai_chats WHERE id = ? AND user_id = ?
        )
      `).bind(
        openingMessageId,
        chatId,
        openingMessage,
        `opening:${chatId}`,
        timestamp,
        timestamp,
        chatId,
        userId,
      ));
    }
    let results: D1Result<unknown>[];
    try {
      results = await db.batch(statements);
    } catch (error) {
      const exactPayloadCommitted = await createdChatPayloadMatches({
        userId,
        chatId,
        title,
        explanationLanguage: language,
        timestamp,
        targets: createdTargets,
        openingMessageId,
        openingMessage,
      });
      if (!exactPayloadCommitted) throw error;
      const recovered = await getChat(userId, chatId);
      if (!recovered) repositoryError("conflict", "Chat could not be recovered.");
      return recovered;
    }
    if (Number(results[0]?.meta.changes || 0) !== 1) {
      repositoryError("conflict", "Chat account limit reached.");
    }
    const chat = await getChat(userId, chatId);
    if (!chat) repositoryError("conflict", "Chat could not be persisted.");
    return chat;
  }

  async function replacePracticeItems(
    userId: string,
    chatId: string,
    inputs: readonly AiChatTargetInput[],
  ) {
    await requireOwnedChat(userId, chatId);
    const targets = await resolveTargets(userId, inputs);
    const timestamp = now();
    await db.batch([db.prepare(`
        DELETE FROM ai_chat_practice_items
        WHERE chat_id = ?
          AND EXISTS (
            SELECT 1 FROM ai_chats WHERE ai_chats.id = ? AND ai_chats.user_id = ?
          )
      `).bind(chatId, chatId, userId),
      ...targets.map((target) => targetInsert(chatId, target, timestamp)),
      db.prepare("UPDATE ai_chats SET updated_at = ? WHERE id = ? AND user_id = ?")
        .bind(timestamp, chatId, userId),
    ]);
    return readCurrentPracticeItems(userId, chatId);
  }

  async function getCanonicalHistory(
    userId: string,
    chatId: string,
    options: { excludeClientMessageId?: string; beforeSequence?: number } = {},
  ): Promise<AiChatCanonicalMessage[]> {
    await requireOwnedChat(userId, chatId);
    const exclusion = options.excludeClientMessageId
      ? "AND messages.client_message_id <> ?"
      : "";
    const beforeSequence = Number.isSafeInteger(options.beforeSequence)
      && Number(options.beforeSequence) > 0
      ? Number(options.beforeSequence)
      : null;
    const sequenceBoundary = beforeSequence === null
      ? ""
      : "AND messages.sequence < ?";
    const bindings: unknown[] = [chatId, userId];
    if (options.excludeClientMessageId) bindings.push(options.excludeClientMessageId);
    if (beforeSequence !== null) bindings.push(beforeSequence);
    bindings.push(AI_CHAT_LIMITS.historyMessages);
    const result = await db.prepare(`
      SELECT id, role, sequence, content, client_message_id
      FROM (
        SELECT
          messages.id,
          messages.role,
          messages.sequence,
          messages.content,
          messages.client_message_id
        FROM ai_chat_messages AS messages
        JOIN ai_chats AS chats ON chats.id = messages.chat_id
        WHERE messages.chat_id = ?
          AND chats.user_id = ?
          AND messages.status = 'complete'
          ${exclusion}
          ${sequenceBoundary}
        ORDER BY messages.sequence DESC
        LIMIT ?
      )
      ORDER BY sequence
    `).bind(...bindings).all<Pick<
      MessageRow,
      "id" | "role" | "sequence" | "content" | "client_message_id"
    >>();
    return result.results.map((row) => ({
      id: row.id,
      role: row.role,
      sequence: Number(row.sequence),
      content: row.content,
      clientMessageId: row.client_message_id,
    }));
  }

  async function findTurn(userId: string, chatId: string, clientMessageId: string) {
    const result = await db.prepare(`
      SELECT
        messages.id,
        messages.role,
        messages.sequence,
        messages.content,
        messages.status,
        messages.practice_context_json,
        messages.client_message_id,
        messages.provider,
        messages.model,
        messages.usage_json,
        messages.error_code,
        messages.created_at,
        messages.updated_at
      FROM ai_chat_messages AS messages
      JOIN ai_chats AS chats ON chats.id = messages.chat_id
      WHERE messages.chat_id = ?
        AND messages.client_message_id = ?
        AND chats.user_id = ?
      ORDER BY messages.sequence
    `).bind(chatId, clientMessageId, userId).all<MessageRow>();
    if (!result.results.length) return null;
    const messages = result.results.map(mapMessage);
    const user = messages.find((message) => message.role === "user");
    const assistant = messages.find((message) => message.role === "assistant");
    if (!user || !assistant) repositoryError("conflict", "Stored turn is incomplete.");
    const attemptRow = await db.prepare(`
      SELECT
        attempts.id,
        attempts.attempt_number,
        attempts.status,
        attempts.lease_expires_at,
        attempts.created_at,
        attempts.updated_at
      FROM ai_chat_assistant_attempts AS attempts
      WHERE attempts.user_id = ?
        AND attempts.chat_id = ?
        AND attempts.user_message_id = ?
        AND attempts.assistant_message_id = ?
      ORDER BY attempts.attempt_number DESC
      LIMIT 1
    `).bind(userId, chatId, user.id, assistant.id).first<AttemptRow>();
    return { user, assistant, attempt: attemptRow ? mapAttempt(attemptRow) : null };
  }

  async function reuseTurn(
    userId: string,
    chatId: string,
    input: { clientMessageId: string; content: string },
    turn: {
      user: AiChatMessage;
      assistant: AiChatMessage;
      attempt: AiChatAssistantAttempt | null;
    },
  ): Promise<AiChatTurn> {
    if (turn.user.content !== input.content) {
      repositoryError("conflict", "Client message id was already used for different content.");
    }
    const timestamp = now();
    const recoverablePending = turn.assistant.status === "pending"
      && pendingTurnIsStale(
        turn.attempt?.status === "pending"
          ? turn.attempt.leaseExpiresAt
          : attemptLeaseExpiresAt(turn.assistant.updatedAt),
        timestamp,
      );
    if (turn.assistant.status !== "failed" && !recoverablePending) {
      return { state: "existing", ...turn };
    }
    const previousStatus = turn.assistant.status;
    const attemptId = createId("attempt");
    const attemptNumber = (turn.attempt?.attemptNumber || 0) + 1;
    const leaseExpiresAt = attemptLeaseExpiresAt(timestamp);
    let results: D1Result<unknown>[];
    try {
      results = await db.batch([
        db.prepare(`
          UPDATE ai_chat_assistant_attempts
          SET status = 'expired', error_code = 'provider_timeout',
              updated_at = ?, completed_at = ?
          WHERE id = ? AND status = 'pending'
        `).bind(timestamp, timestamp, turn.attempt?.id || ""),
        db.prepare(`
          UPDATE ai_chat_messages
          SET content = '', status = 'pending', provider = NULL, model = NULL,
              usage_json = NULL, error_code = NULL, updated_at = ?
          WHERE id = ? AND chat_id = ? AND status = ? AND updated_at = ?
            AND EXISTS (
              SELECT 1 FROM ai_chats WHERE ai_chats.id = ? AND ai_chats.user_id = ?
            )
        `).bind(
          timestamp,
          turn.assistant.id,
          chatId,
          previousStatus,
          turn.assistant.updatedAt,
          chatId,
          userId,
        ),
        db.prepare(`
          INSERT INTO ai_chat_assistant_attempts (
            id, user_id, chat_id, user_message_id, assistant_message_id,
            attempt_number, status, lease_expires_at, created_at, updated_at
          )
          SELECT ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?
          WHERE EXISTS (
            SELECT 1
            FROM ai_chat_messages AS messages
            JOIN ai_chats AS chats ON chats.id = messages.chat_id
            WHERE messages.id = ? AND messages.chat_id = ?
              AND messages.role = 'assistant' AND messages.status = 'pending'
              AND messages.updated_at = ? AND chats.user_id = ?
          )
        `).bind(
          attemptId,
          userId,
          chatId,
          turn.user.id,
          turn.assistant.id,
          attemptNumber,
          leaseExpiresAt,
          timestamp,
          timestamp,
          turn.assistant.id,
          chatId,
          timestamp,
          userId,
        ),
        db.prepare("UPDATE ai_chats SET updated_at = ? WHERE id = ? AND user_id = ?")
          .bind(timestamp, chatId, userId),
      ]);
    } catch {
      const raced = await findTurn(userId, chatId, input.clientMessageId);
      if (!raced) repositoryError("conflict", "Turn retry could not be persisted.");
      if (
        raced.user.id === turn.user.id
        && raced.assistant.id === turn.assistant.id
        && raced.assistant.status === "pending"
        && raced.attempt?.id === attemptId
        && raced.attempt.status === "pending"
      ) {
        return { state: "retrying", ...raced };
      }
      return { state: "existing", ...raced };
    }
    const retried = await findTurn(userId, chatId, input.clientMessageId);
    if (!retried) repositoryError("conflict", "Turn retry could not be persisted.");
    return Number(results[2]?.meta.changes || 0) === 1
      ? { state: "retrying", ...retried }
      : { state: "existing", ...retried };
  }

  async function beginTurn(
    userId: string,
    chatId: string,
    input: { clientMessageId: string; content: string; practiceContext: unknown },
  ): Promise<AiChatTurn> {
    await requireOwnedChat(userId, chatId);
    const existing = await findTurn(userId, chatId, input.clientMessageId);
    if (existing) return reuseTurn(userId, chatId, input, existing);

    const timestamp = now();
    const practiceContextJson = JSON.stringify(input.practiceContext ?? []);
    const userMessageId = createId("message");
    const assistantMessageId = createId("message");
    const attemptId = createId("attempt");
    const leaseExpiresAt = attemptLeaseExpiresAt(timestamp);
    const expired = await db.prepare(`
      UPDATE ai_chat_assistant_attempts
      SET status = 'expired', error_code = 'provider_timeout',
          updated_at = ?, completed_at = ?
      WHERE user_id = ? AND chat_id = ? AND status = 'pending'
        AND lease_expires_at <= ?
    `).bind(timestamp, timestamp, userId, chatId, timestamp).run();
    if (Number(expired.meta?.changes || 0) > 0) {
      await db.prepare(`
        UPDATE ai_chat_messages
        SET status = 'failed', error_code = 'provider_timeout', updated_at = ?
        WHERE chat_id = ? AND role = 'assistant' AND status = 'pending'
          AND EXISTS (
            SELECT 1
            FROM ai_chat_assistant_attempts AS attempts
            WHERE attempts.assistant_message_id = ai_chat_messages.id
              AND attempts.user_id = ?
              AND attempts.chat_id = ?
              AND attempts.status = 'expired'
              AND attempts.error_code = 'provider_timeout'
              AND attempts.completed_at = ?
          )
          AND NOT EXISTS (
            SELECT 1
            FROM ai_chat_assistant_attempts AS active
            WHERE active.assistant_message_id = ai_chat_messages.id
              AND active.status = 'pending'
          )
      `).bind(timestamp, chatId, userId, chatId, timestamp).run();
    }
    try {
      await db.batch([
        db.prepare(`
          INSERT INTO ai_chat_messages (
            id, chat_id, role, sequence, content, status, practice_context_json,
            client_message_id, created_at, updated_at
          ) VALUES (
            ?, ?, 'user',
            (SELECT COALESCE(MAX(sequence), 0) + 1 FROM ai_chat_messages WHERE chat_id = ?),
            ?, 'complete', ?, ?, ?, ?
          )
        `).bind(
          userMessageId,
          chatId,
          chatId,
          input.content,
          practiceContextJson,
          input.clientMessageId,
          timestamp,
          timestamp,
        ),
        db.prepare(`
          INSERT INTO ai_chat_messages (
            id, chat_id, role, sequence, content, status, practice_context_json,
            client_message_id, created_at, updated_at
          ) VALUES (
            ?, ?, 'assistant',
            (SELECT COALESCE(MAX(sequence), 0) + 1 FROM ai_chat_messages WHERE chat_id = ?),
            '', 'pending', ?, ?, ?, ?
          )
        `).bind(
          assistantMessageId,
          chatId,
          chatId,
          practiceContextJson,
          input.clientMessageId,
          timestamp,
          timestamp,
        ),
        db.prepare(`
          INSERT INTO ai_chat_assistant_attempts (
            id, user_id, chat_id, user_message_id, assistant_message_id,
            attempt_number, status, lease_expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 1, 'pending', ?, ?, ?)
        `).bind(
          attemptId,
          userId,
          chatId,
          userMessageId,
          assistantMessageId,
          leaseExpiresAt,
          timestamp,
          timestamp,
        ),
        db.prepare("UPDATE ai_chats SET updated_at = ? WHERE id = ? AND user_id = ?")
          .bind(timestamp, chatId, userId),
      ]);
    } catch (error) {
      const raced = await findTurn(userId, chatId, input.clientMessageId);
      if (!raced) {
        const active = await db.prepare(`
          SELECT 1 AS active
          FROM ai_chat_assistant_attempts AS attempts
          JOIN ai_chats AS chats ON chats.id = attempts.chat_id
          WHERE attempts.user_id = ? AND attempts.chat_id = ?
            AND attempts.status = 'pending' AND attempts.lease_expires_at > ?
            AND chats.user_id = ?
          LIMIT 1
        `).bind(userId, chatId, timestamp, userId).first<{ active: number }>();
        if (active) repositoryError("turn_in_progress", "Another turn is already running.");
        throw error;
      }
      if (
        raced.user.id === userMessageId
        && raced.assistant.id === assistantMessageId
        && raced.assistant.status === "pending"
        && raced.attempt?.id === attemptId
        && raced.attempt.status === "pending"
      ) {
        return { state: "created", ...raced };
      }
      return reuseTurn(userId, chatId, input, raced);
    }
    const created = await findTurn(userId, chatId, input.clientMessageId);
    if (!created) repositoryError("conflict", "Turn could not be persisted.");
    return { state: "created", ...created };
  }

  async function finishTurn(
    userId: string,
    chatId: string,
    clientMessageId: string,
    input: {
      attemptId: string;
      content: string;
      provider: string;
      model: string;
      usage?: unknown;
    },
  ) {
    await requireOwnedChat(userId, chatId);
    const existing = await findTurn(userId, chatId, clientMessageId);
    if (!existing) repositoryError("not_found", "Turn not found.");
    const timestamp = now();
    if (
      existing.assistant.status !== "pending"
      || existing.attempt?.id !== input.attemptId
      || existing.attempt.status !== "pending"
      || pendingTurnIsStale(existing.attempt.leaseExpiresAt, timestamp)
    ) {
      return { state: "existing", ...existing } satisfies AiChatTurn;
    }
    const usageJson = input.usage == null ? null : JSON.stringify(input.usage);
    const completionStatements = [
      db.prepare(`
        UPDATE ai_chat_messages
        SET content = ?, status = 'complete', provider = ?, model = ?, usage_json = ?,
            error_code = NULL, updated_at = ?
        WHERE chat_id = ? AND client_message_id = ? AND role = 'assistant'
          AND status = 'pending'
          AND EXISTS (
            SELECT 1
            FROM ai_chat_assistant_attempts AS attempts
            WHERE attempts.id = ?
              AND attempts.user_id = ?
              AND attempts.chat_id = ?
              AND attempts.user_message_id = ?
              AND attempts.assistant_message_id = ai_chat_messages.id
              AND attempts.status = 'pending'
              AND attempts.lease_expires_at > ?
          )
          AND EXISTS (
            SELECT 1 FROM ai_chats WHERE ai_chats.id = ? AND ai_chats.user_id = ?
          )
      `).bind(
        input.content,
        input.provider,
        input.model,
        usageJson,
        timestamp,
        chatId,
        clientMessageId,
        input.attemptId,
        userId,
        chatId,
        existing.user.id,
        timestamp,
        chatId,
        userId,
      ),
      db.prepare(`
        UPDATE ai_chat_assistant_attempts
        SET status = 'complete', provider = ?, model = ?, usage_json = ?,
            error_code = NULL, updated_at = ?, completed_at = ?
        WHERE id = ? AND user_id = ? AND chat_id = ? AND status = 'pending'
          AND lease_expires_at > ?
          AND EXISTS (
            SELECT 1
            FROM ai_chat_messages
            WHERE id = ai_chat_assistant_attempts.assistant_message_id
              AND status = 'complete' AND updated_at = ?
          )
      `).bind(
        input.provider,
        input.model,
        usageJson,
        timestamp,
        timestamp,
        input.attemptId,
        userId,
        chatId,
        timestamp,
        timestamp,
      ),
      db.prepare(`
        UPDATE ai_chats SET updated_at = ?
        WHERE id = ? AND user_id = ?
          AND EXISTS (
            SELECT 1 FROM ai_chat_assistant_attempts
            WHERE id = ? AND status = 'complete' AND updated_at = ?
          )
      `).bind(timestamp, chatId, userId, input.attemptId, timestamp),
    ];
    let results: D1Result<unknown>[];
    try {
      results = await db.batch(completionStatements);
    } catch (error) {
      const completed = await findTurn(userId, chatId, clientMessageId);
      if (
        completed?.assistant.status === "complete"
        && completed.attempt?.id === input.attemptId
        && completed.attempt.status === "complete"
      ) {
        return { state: "existing", ...completed } satisfies AiChatTurn;
      }
      throw error;
    }
    if (
      Number(results[0]?.meta.changes || 0) !== 1
      || Number(results[1]?.meta.changes || 0) !== 1
    ) {
      const raced = await findTurn(userId, chatId, clientMessageId);
      if (!raced) repositoryError("conflict", "Turn completion could not be persisted.");
      return { state: "existing", ...raced } satisfies AiChatTurn;
    }
    return {
      state: "existing",
      user: existing.user,
      assistant: {
        ...existing.assistant,
        content: input.content,
        status: "complete",
        provider: input.provider,
        model: input.model,
        usage: input.usage ?? null,
        errorCode: null,
        updatedAt: timestamp,
      },
      attempt: existing.attempt
        ? {
            ...existing.attempt,
            status: "complete",
            updatedAt: timestamp,
          }
        : null,
    } satisfies AiChatTurn;
  }

  async function failTurn(
    userId: string,
    chatId: string,
    clientMessageId: string,
    errorCode: string,
    attemptId: string,
  ) {
    await requireOwnedChat(userId, chatId);
    const existing = await findTurn(userId, chatId, clientMessageId);
    if (!existing) repositoryError("not_found", "Turn not found.");
    const timestamp = now();
    if (
      existing.assistant.status !== "pending"
      || existing.attempt?.id !== attemptId
      || existing.attempt.status !== "pending"
      || pendingTurnIsStale(existing.attempt.leaseExpiresAt, timestamp)
    ) {
      return { state: "existing", ...existing } satisfies AiChatTurn;
    }
    await db.batch([
      db.prepare(`
        UPDATE ai_chat_messages
        SET content = '', status = 'failed', provider = NULL, model = NULL,
            usage_json = NULL, error_code = ?, updated_at = ?
        WHERE chat_id = ? AND client_message_id = ? AND role = 'assistant'
          AND status = 'pending'
          AND EXISTS (
            SELECT 1
            FROM ai_chat_assistant_attempts AS attempts
            WHERE attempts.id = ?
              AND attempts.user_id = ?
              AND attempts.chat_id = ?
              AND attempts.user_message_id = ?
              AND attempts.assistant_message_id = ai_chat_messages.id
              AND attempts.status = 'pending'
              AND attempts.lease_expires_at > ?
          )
          AND EXISTS (
            SELECT 1 FROM ai_chats WHERE ai_chats.id = ? AND ai_chats.user_id = ?
          )
      `).bind(
        errorCode,
        timestamp,
        chatId,
        clientMessageId,
        attemptId,
        userId,
        chatId,
        existing.user.id,
        timestamp,
        chatId,
        userId,
      ),
      db.prepare(`
        UPDATE ai_chat_assistant_attempts
        SET status = 'failed', provider = NULL, model = NULL, usage_json = NULL,
            error_code = ?, updated_at = ?, completed_at = ?
        WHERE id = ? AND user_id = ? AND chat_id = ? AND status = 'pending'
          AND lease_expires_at > ?
          AND EXISTS (
            SELECT 1
            FROM ai_chat_messages
            WHERE id = ai_chat_assistant_attempts.assistant_message_id
              AND status = 'failed' AND updated_at = ?
          )
      `).bind(
        errorCode,
        timestamp,
        timestamp,
        attemptId,
        userId,
        chatId,
        timestamp,
        timestamp,
      ),
      db.prepare(`
        UPDATE ai_chats SET updated_at = ?
        WHERE id = ? AND user_id = ?
          AND EXISTS (
            SELECT 1 FROM ai_chat_assistant_attempts
            WHERE id = ? AND status = 'failed' AND updated_at = ?
          )
      `).bind(timestamp, chatId, userId, attemptId, timestamp),
    ]);
    const failed = await findTurn(userId, chatId, clientMessageId);
    if (!failed) repositoryError("conflict", "Turn failure could not be persisted.");
    return { state: "existing", ...failed } satisfies AiChatTurn;
  }

  return {
    beginTurn,
    createChat,
    failTurn,
    finishTurn,
    getCanonicalHistory,
    getChat,
    getChatSummary,
    getCurrentPracticeItems,
    listChats,
    replacePracticeItems,
  };
}
