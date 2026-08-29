import {
  AI_CHAT_LIMITS,
  isMeaningMode,
  normalizeMeaning,
  type AiChatMeaningMode,
  type AiChatTargetInput,
} from "./contracts.ts";

export const AI_CHAT_LEGACY_MEANING_ID = "legacy";
export const AI_CHAT_PENDING_LEASE_MS = AI_CHAT_LIMITS.upstreamTimeoutMs + 10_000;

export type AiChatRepositoryErrorCode =
  | "not_found"
  | "conflict"
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

export type AiChatMeaning = {
  id: string | null;
  source: "legacy" | "personal";
  translation: string;
  context: string;
};

export type AiChatMeaningList = {
  phraseId: string;
  text: string;
  meanings: AiChatMeaning[];
};

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

export type AiChatTurn = {
  state: "created" | "existing" | "retrying";
  user: AiChatMessage;
  assistant: AiChatMessage;
};

type RepositoryOptions = {
  createId?: (kind: "meaning" | "chat" | "target" | "message") => string;
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

type TargetDraft = {
  phraseId: string | null;
  text: string;
  meaningMode: AiChatMeaningMode;
  selectedMeaningId: string | null;
  selectedMeaningSnapshot: string;
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

function pendingTurnIsStale(updatedAt: string, referenceTime: string) {
  const updated = Date.parse(updatedAt);
  const reference = Date.parse(referenceTime);
  return Number.isFinite(updated)
    && Number.isFinite(reference)
    && updated <= reference - AI_CHAT_PENDING_LEASE_MS;
}

function defaultCreateId(kind: "meaning" | "chat" | "target" | "message") {
  return `${kind}-${crypto.randomUUID()}`;
}

function mapMeaning(row: MeaningRow): AiChatMeaning {
  return {
    id: row.id,
    source: "personal",
    translation: row.translation,
    context: row.context,
  };
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

  async function listMeanings(
    userId: string,
    phraseId: string,
  ): Promise<AiChatMeaningList | null> {
    const phrase = await visiblePhrase(userId, phraseId);
    if (!phrase) return null;
    const result = await db.prepare(`
      SELECT id, translation, context
      FROM phrase_meanings
      WHERE user_id = ? AND phrase_id = ?
      ORDER BY created_at, id
    `).bind(userId, phraseId).all<MeaningRow>();
    const meanings: AiChatMeaning[] = [];
    if (phrase.translation.trim()) {
      meanings.push({
        id: AI_CHAT_LEGACY_MEANING_ID,
        source: "legacy",
        translation: phrase.translation,
        context: phrase.context,
      });
    }
    meanings.push(...result.results.map(mapMeaning));
    return { phraseId: phrase.id, text: phrase.text, meanings };
  }

  async function addMeaning(
    userId: string,
    input: { phraseId: string; translation: string; context?: string },
  ): Promise<AiChatMeaning> {
    if (!await visiblePhrase(userId, input.phraseId)) {
      repositoryError("not_found", "Phrase not found.");
    }
    const translation = cleanSingleLine(input.translation);
    const normalizedTranslation = normalizeMeaning(translation);
    if (!normalizedTranslation) repositoryError("invalid_target", "Meaning is required.");
    const context = cleanContext(input.context || "");
    const timestamp = now();
    await db.prepare(`
      INSERT INTO phrase_meanings (
        id, user_id, phrase_id, translation, normalized_translation, context, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, phrase_id, normalized_translation) DO UPDATE SET
        translation = excluded.translation,
        context = excluded.context,
        updated_at = excluded.updated_at
    `).bind(
      createId("meaning"),
      userId,
      input.phraseId,
      translation,
      normalizedTranslation,
      context,
      timestamp,
      timestamp,
    ).run();
    const row = await db.prepare(`
      SELECT id, translation, context
      FROM phrase_meanings
      WHERE user_id = ? AND phrase_id = ? AND normalized_translation = ?
      LIMIT 1
    `).bind(userId, input.phraseId, normalizedTranslation).first<MeaningRow>();
    if (!row) repositoryError("conflict", "Meaning could not be persisted.");
    return mapMeaning(row);
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

  async function readCurrentPracticeItems(
    userId: string,
    chatId: string,
  ): Promise<AiChatPracticeItem[]> {
    const result = await db.prepare(`
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
      FROM ai_chat_practice_items AS items
      JOIN ai_chats AS chats ON chats.id = items.chat_id
      LEFT JOIN phrases ON phrases.id = items.phrase_id
      LEFT JOIN phrase_meanings AS meanings
        ON meanings.phrase_id = items.phrase_id AND meanings.user_id = ?
      WHERE items.chat_id = ? AND chats.user_id = ?
      ORDER BY items.created_at, items.rowid, meanings.created_at, meanings.rowid
    `).bind(userId, chatId, userId).all<PracticeItemRow>();

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
      ORDER BY messages.sequence
    `).bind(chatId, userId).all<MessageRow>();
    return result.results.map(mapMessage);
  }

  async function recoverStalePendingTurns(userId: string, chatId: string) {
    const timestamp = now();
    const reference = Date.parse(timestamp);
    if (!Number.isFinite(reference)) return;
    const staleBefore = new Date(reference - AI_CHAT_PENDING_LEASE_MS).toISOString();
    const result = await db.prepare(`
      UPDATE ai_chat_messages
      SET content = '', status = 'failed', provider = NULL, model = NULL,
          usage_json = NULL, error_code = 'provider_timeout', updated_at = ?
      WHERE chat_id = ? AND role = 'assistant' AND status = 'pending' AND updated_at <= ?
        AND EXISTS (
          SELECT 1 FROM ai_chats WHERE ai_chats.id = ? AND ai_chats.user_id = ?
        )
    `).bind(timestamp, chatId, staleBefore, chatId, userId).run();
    if (Number(result.meta.changes || 0) > 0) {
      await db.prepare("UPDATE ai_chats SET updated_at = ? WHERE id = ? AND user_id = ?")
        .bind(timestamp, chatId, userId).run();
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
    `).bind(userId).all<ChatRow>();
    return result.results.map(mapChat);
  }

  async function createChat(
    userId: string,
    input: { targets?: readonly AiChatTargetInput[]; explanationLanguage?: string } = {},
  ) {
    const targets = await resolveTargets(userId, input.targets || []);
    const timestamp = now();
    const chatId = createId("chat");
    const language = truncateCharacters(cleanSingleLine(input.explanationLanguage || "ru"), 35) || "ru";
    await db.batch([
      db.prepare(`
        INSERT INTO ai_chats (
          id, user_id, title, explanation_language, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(chatId, userId, deriveTitle(targets), language, timestamp, timestamp),
      ...targets.map((target) => targetInsert(chatId, target, timestamp)),
    ]);
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
    await db.batch([
      db.prepare(`
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
    return { user, assistant };
  }

  async function reuseTurn(
    userId: string,
    chatId: string,
    input: { clientMessageId: string; content: string },
    turn: { user: AiChatMessage; assistant: AiChatMessage },
  ): Promise<AiChatTurn> {
    if (turn.user.content !== input.content) {
      repositoryError("conflict", "Client message id was already used for different content.");
    }
    const timestamp = now();
    const recoverablePending = turn.assistant.status === "pending"
      && pendingTurnIsStale(turn.assistant.updatedAt, timestamp);
    if (turn.assistant.status !== "failed" && !recoverablePending) {
      return { state: "existing", ...turn };
    }
    const previousStatus = turn.assistant.status;
    const results = await db.batch([
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
      db.prepare("UPDATE ai_chats SET updated_at = ? WHERE id = ? AND user_id = ?")
        .bind(timestamp, chatId, userId),
    ]);
    const retried = await findTurn(userId, chatId, input.clientMessageId);
    if (!retried) repositoryError("conflict", "Turn retry could not be persisted.");
    return Number(results[0]?.meta.changes || 0) === 1
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
        db.prepare("UPDATE ai_chats SET updated_at = ? WHERE id = ? AND user_id = ?")
          .bind(timestamp, chatId, userId),
      ]);
    } catch (error) {
      const raced = await findTurn(userId, chatId, input.clientMessageId);
      if (!raced) throw error;
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
      attemptUpdatedAt: string;
      content: string;
      provider: string;
      model: string;
      usage?: unknown;
    },
  ) {
    await requireOwnedChat(userId, chatId);
    const existing = await findTurn(userId, chatId, clientMessageId);
    if (!existing) repositoryError("not_found", "Turn not found.");
    if (
      existing.assistant.status !== "pending"
      || existing.assistant.updatedAt !== input.attemptUpdatedAt
    ) {
      return { state: "existing", ...existing } satisfies AiChatTurn;
    }
    const timestamp = now();
    const usageJson = input.usage == null ? null : JSON.stringify(input.usage);
    await db.batch([
      db.prepare(`
        UPDATE ai_chat_messages
        SET content = ?, status = 'complete', provider = ?, model = ?, usage_json = ?,
            error_code = NULL, updated_at = ?
        WHERE chat_id = ? AND client_message_id = ? AND role = 'assistant'
          AND status = 'pending' AND updated_at = ?
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
        input.attemptUpdatedAt,
        chatId,
        userId,
      ),
      db.prepare("UPDATE ai_chats SET updated_at = ? WHERE id = ? AND user_id = ?")
        .bind(timestamp, chatId, userId),
    ]);
    const completed = await findTurn(userId, chatId, clientMessageId);
    if (!completed) repositoryError("conflict", "Turn completion could not be persisted.");
    return { state: "existing", ...completed } satisfies AiChatTurn;
  }

  async function failTurn(
    userId: string,
    chatId: string,
    clientMessageId: string,
    errorCode: string,
    attemptUpdatedAt: string,
  ) {
    await requireOwnedChat(userId, chatId);
    const existing = await findTurn(userId, chatId, clientMessageId);
    if (!existing) repositoryError("not_found", "Turn not found.");
    if (
      existing.assistant.status !== "pending"
      || existing.assistant.updatedAt !== attemptUpdatedAt
    ) {
      return { state: "existing", ...existing } satisfies AiChatTurn;
    }
    const timestamp = now();
    await db.batch([
      db.prepare(`
        UPDATE ai_chat_messages
        SET content = '', status = 'failed', provider = NULL, model = NULL,
            usage_json = NULL, error_code = ?, updated_at = ?
        WHERE chat_id = ? AND client_message_id = ? AND role = 'assistant'
          AND status = 'pending' AND updated_at = ?
          AND EXISTS (
            SELECT 1 FROM ai_chats WHERE ai_chats.id = ? AND ai_chats.user_id = ?
          )
      `).bind(
        errorCode,
        timestamp,
        chatId,
        clientMessageId,
        attemptUpdatedAt,
        chatId,
        userId,
      ),
      db.prepare("UPDATE ai_chats SET updated_at = ? WHERE id = ? AND user_id = ?")
        .bind(timestamp, chatId, userId),
    ]);
    const failed = await findTurn(userId, chatId, clientMessageId);
    if (!failed) repositoryError("conflict", "Turn failure could not be persisted.");
    return { state: "existing", ...failed } satisfies AiChatTurn;
  }

  return {
    addMeaning,
    beginTurn,
    createChat,
    failTurn,
    finishTurn,
    getCanonicalHistory,
    getChat,
    getChatSummary,
    getCurrentPracticeItems,
    listChats,
    listMeanings,
    replacePracticeItems,
  };
}
