import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const toolsModule = await import("../lib/ai-chat/vocabulary-tools.ts").catch(() => ({}));
const policyModule = await import("../lib/ai-chat/tools/vocabulary/policy.ts").catch(() => ({}));

function entry(overrides = {}) {
  return {
    phraseId: "phrase-run",
    text: "run",
    status: "learning_now",
    sourceType: "preset",
    addedAt: "2026-08-29T10:00:00.000Z",
    updatedAt: "2026-08-29T11:00:00.000Z",
    meanings: [{
      id: "legacy",
      source: "legacy",
      translation: "бежать",
      context: "run every morning",
    }],
    meaningCount: 1,
    ...overrides,
  };
}

function createHarness(currentUserMessage) {
  const calls = [];
  const savedEntry = entry();
  const repositoryResults = [savedEntry];
  const repository = {
    async listPage(userId, options) {
      calls.push({ method: "page", userId, options });
      return {
        entries: repositoryResults,
        hasMore: false,
        nextCursor: null,
      };
    },
    async listRecent(userId, limit) {
      calls.push({ method: "recent", userId, limit });
      return repositoryResults;
    },
    async search(userId, query, limit) {
      calls.push({ method: "search", userId, query, limit });
      return repositoryResults;
    },
    async getEntry(userId, phraseId) {
      calls.push({ method: "getEntry", userId, phraseId });
      return phraseId === savedEntry.phraseId ? savedEntry : null;
    },
    async getCategoryTarget(userId, phraseId) {
      calls.push({ method: "getCategoryTarget", userId, phraseId });
      return phraseId === savedEntry.phraseId
        ? {
            phraseId: savedEntry.phraseId,
            text: savedEntry.text,
            storedStatus: savedEntry.status,
            category: "learning",
          }
        : null;
    },
    async getStateTargets(userId, texts) {
      calls.push({ method: "getStateTargets", userId, texts });
      return texts.includes(savedEntry.text)
        ? [{
            phraseId: savedEntry.phraseId,
            text: savedEntry.text,
            storedStatus: savedEntry.status,
            category: "learning",
            sourceType: savedEntry.sourceType,
          }]
        : [];
    },
    async getEntryForMeaning(userId, meaningId) {
      calls.push({ method: "getEntryForMeaning", userId, meaningId });
      return meaningId === "meaning-owned"
        ? {
            ...savedEntry,
            selectedMeaning: {
              id: "meaning-owned",
              source: "personal",
              translation: "управлять",
              context: "run a company",
            },
          }
        : null;
    },
  };
  const mutationPlanner = {
    async planAddEntries(userId, input) {
      calls.push({ method: "addEntries", userId, input });
      return {
        operation: "vocabulary.add-entries/v1",
        targetKey: "entries",
        canonicalArgs: input,
        canonicalResult: {
          ok: true,
          saved: true,
          entries: input.entries.map(({ text }) => ({ text, state: "added" })),
        },
      };
    },
    async planAddEntry(userId, input) {
      calls.push({ method: "addEntry", userId, input });
      return {
        canonicalResult: { ok: true, saved: true, text: input.text },
      };
    },
    async planAddMeaning(userId, input) {
      calls.push({ method: "addMeaning", userId, input });
      return {
        canonicalResult: {
          ok: true,
          saved: true,
          phraseId: input.phraseId,
          translation: input.translation,
        },
      };
    },
    async planUpdateMeaning(userId, input) {
      calls.push({ method: "updateMeaning", userId, input });
      return {
        canonicalResult: {
          ok: true,
          updated: true,
          meaningId: input.meaningId,
          translation: input.translation,
        },
      };
    },
    async planSetCategory(userId, input) {
      calls.push({ method: "setCategory", userId, input });
      return {
        canonicalResult: {
          ok: true,
          updated: true,
          phraseId: input.phraseId,
          category: input.category,
        },
      };
    },
    async planChangeState(userId, input) {
      calls.push({ method: "changeState", userId, input });
      return {
        operation: "vocabulary.change-state/v1",
        targetKey: "entries",
        canonicalArgs: input,
        canonicalResult: {
          ok: true,
          updated: true,
          entries: input.entries.map((item) => ({
            phraseId: item.phraseId,
            text: item.text,
            state: input.destination,
          })),
        },
      };
    },
  };
  const scope = {
    async commitMutation(plan) {
      return plan.canonicalResult;
    },
    async proposeMutation(plan, publicPayload) {
      calls.push({ method: "propose", plan, publicPayload });
      return {
        ok: true,
        proposed: true,
        approvalRequired: true,
        proposalId: "proposal-test",
      };
    },
  };
  const executor = {
    async execute(input) {
      return input.run(scope);
    },
  };
  assert.equal(
    typeof toolsModule.createAiVocabularyToolHandlers,
    "function",
    "lib/ai-chat/vocabulary-tools.ts must export createAiVocabularyToolHandlers",
  );
  const handlers = toolsModule.createAiVocabularyToolHandlers({
    userId: "user-a",
    currentUserMessage,
    repository,
    mutationPlanner,
  });
  return { calls, executor, handlers, repository, repositoryResults, savedEntry, scope };
}

test("write authorization recognizes explicit commands and rejects practice or negation", () => {
  assert.equal(typeof toolsModule.isExplicitVocabularyWriteRequest, "function");
  for (const message of [
    "Добавь слово serendipity.",
    "Сохрани перевод счастливая случайность.",
    "Исправь значение на руководить.",
    "Please add the phrase break even.",
    "Please add words uncanny and serendipity.",
    "Please add the phrase never add sugar.",
    "Save these translations to my vocabulary.",
    "Update the translation to руководить.",
    "Пожалуйста, добавь слово uncanny.",
    "Давай добавим фразу break even.",
    "Добавь фразу never mind.",
    "Перемести слово run в Learning.",
    "Move run to To Learn.",
  ]) {
    assert.equal(toolsModule.isExplicitVocabularyWriteRequest(message), true, message);
  }
  for (const message of [
    "Давай потренируем run.",
    "Какие последние десять слов?",
    "Не добавляй это слово.",
    "Do not save this translation.",
    "What does ‘add the word run’ mean?",
    "Объясни фразу «добавь слово run».",
    "Добавь ещё одно предложение с run.",
    "Add another example with run.",
    "Add another sentence with the word run.",
    "Add an example for the phrase run.",
    "Add the word run to this sentence.",
    "Добавь слово run в это предложение.",
    "Добавь фразу run в следующий пример.",
    "Обнови перевод run с управлять на руководить — не делай этого.",
    "Update the translation of run from manage to lead — cancel that.",
    "Обнови перевод run с управлять на руководить — не выполняй это.",
    "Обнови перевод run с управлять на руководить — забудь об этом.",
    "Update the translation of run from manage to lead — ignore that instruction.",
    "Update the translation of run from manage to lead — disregard this instruction.",
    "Never mind, add the word run.",
    "Не перемещай run в Learned.",
    "Перемести run в Learned — не делай этого.",
  ]) {
    assert.equal(toolsModule.isExplicitVocabularyWriteRequest(message), false, message);
  }
});

test("write handlers bind the requested operation and semantic value roles", async () => {
  const swappedEntry = createHarness(
    "Добавь слово serendipity — счастливая случайность.",
  );
  assert.deepEqual(await swappedEntry.handlers.addVocabularyEntry({
    text: "счастливая случайность",
    translation: "serendipity",
  }, swappedEntry.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(swappedEntry.calls, []);

  const syntaxAsEntry = createHarness(
    "Добавь слово serendipity — счастливая случайность.",
  );
  assert.deepEqual(await syntaxAsEntry.handlers.addVocabularyEntry({
    text: "слово",
    translation: "serendipity",
  }, syntaxAsEntry.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(syntaxAsEntry.calls, []);

  const swappedMeaning = createHarness("Добавь к run значение управлять.");
  assert.deepEqual(await swappedMeaning.handlers.addVocabularyMeaning({
    phraseId: "phrase-run",
    translation: "run",
  }, swappedMeaning.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(swappedMeaning.calls, []);

  const wrongOperation = createHarness("Добавь слово run — управлять.");
  assert.deepEqual(await wrongOperation.handlers.updateVocabularyMeaning({
    meaningId: "meaning-owned",
    translation: "run",
  }, wrongOperation.scope), { ok: false, error: "explicit_user_command_required" });
  assert.deepEqual(wrongOperation.calls, []);

  const syntaxAsTranslation = createHarness(
    "Обнови перевод run с управлять на руководить.",
  );
  assert.deepEqual(await syntaxAsTranslation.handlers.updateVocabularyMeaning({
    meaningId: "meaning-owned",
    translation: "на",
  }, syntaxAsTranslation.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(syntaxAsTranslation.calls, [{
    method: "getEntryForMeaning",
    userId: "user-a",
    meaningId: "meaning-owned",
  }]);

  const revoked = createHarness(
    "Обнови перевод run с управлять на руководить — не делай этого.",
  );
  assert.deepEqual(await revoked.handlers.updateVocabularyMeaning({
    meaningId: "meaning-owned",
    translation: "руководить",
  }, revoked.scope), { ok: false, error: "explicit_user_command_required" });
  assert.deepEqual(revoked.calls, []);

  for (const message of [
    "Обнови перевод run с управлять на руководить — не выполняй это.",
    "Обнови перевод run с управлять на руководить — забудь об этом.",
    "Update the translation of run from manage to lead — ignore that instruction.",
  ]) {
    const arbitraryRevocation = createHarness(message);
    assert.deepEqual(await arbitraryRevocation.handlers.updateVocabularyMeaning({
      meaningId: "meaning-owned",
      translation: "руководить",
    }, arbitraryRevocation.scope), {
      ok: false,
      error: "explicit_user_command_required",
    });
    assert.deepEqual(arbitraryRevocation.calls, []);
  }
});

test("read handlers bind identity on the server and return bounded vocabulary", async () => {
  const { calls, handlers, savedEntry } = createHarness("Покажи последние десять слов.");

  assert.deepEqual(await handlers.listVocabulary({ limit: 10 }), {
    ok: true,
    category: "all",
    entries: [{
      phraseId: savedEntry.phraseId,
      text: savedEntry.text,
      category: "learning",
      meanings: savedEntry.meanings,
      meaningCount: 1,
      meaningsTruncated: false,
      detailsTruncated: false,
    }],
    hasMore: false,
    nextCursor: null,
  });
  assert.deepEqual(await handlers.findVocabulary({ query: "run", limit: 4 }), {
    ok: true,
    entries: [{
      phraseId: savedEntry.phraseId,
      text: savedEntry.text,
      category: "learning",
      meanings: savedEntry.meanings,
      meaningCount: 1,
      meaningsTruncated: false,
      detailsTruncated: false,
    }],
  });
  assert.deepEqual(calls, [
    {
      method: "page",
      userId: "user-a",
      options: { category: "all", limit: 10, cursor: null },
    },
    { method: "search", userId: "user-a", query: "run", limit: 4 },
  ]);
});

test("natural references create one exact bulk proposal instead of requiring literal regex matches", async () => {
  const harness = createHarness("Да, добавь их.");
  const result = await harness.handlers.proposeVocabularyEntries({
    entries: [
      { text: "uncanny", translation: "странный" },
      { text: "break even", translation: "окупаться" },
    ],
  }, harness.scope);

  assert.deepEqual(result, {
    ok: true,
    proposed: true,
    approvalRequired: true,
    proposalId: "proposal-test",
  });
  assert.equal(harness.calls[0].method, "addEntries");
  assert.deepEqual(harness.calls[0].input, {
    entries: [
      { text: "uncanny", translation: "странный" },
      { text: "break even", translation: "окупаться" },
    ],
  });
  assert.equal(harness.calls[1].method, "propose");
  assert.deepEqual(harness.calls[1].publicPayload, {
    operation: "add_vocabulary_entries",
    items: [
      { id: "entry-1", text: "uncanny", translation: "странный" },
      { id: "entry-2", text: "break even", translation: "окупаться" },
    ],
  });

  const tooMany = createHarness("Добавь их.");
  assert.deepEqual(await tooMany.handlers.proposeVocabularyEntries({
    entries: Array.from({ length: 11 }, (_, index) => ({ text: `word-${index}` })),
  }, tooMany.scope), { ok: false, error: "invalid_input" });
  assert.deepEqual(tooMany.calls, []);
});

test("list handler paginates every category with an opaque validated cursor", async () => {
  const harness = createHarness("Покажи все выученные слова.");
  const firstEntries = [
    entry({
      phraseId: "phrase-modern-learned",
      text: "modern learned",
      status: "learned",
      addedAt: "2026-08-29T12:00:00.000Z",
    }),
    entry({
      phraseId: "phrase-legacy-learnt",
      text: "legacy learnt",
      status: "learnt",
      addedAt: "2026-08-29 11:00:00",
    }),
  ];
  const secondEntries = [entry({
    phraseId: "phrase-last-learned",
    text: "last learned",
    status: "learned",
    addedAt: "2026-08-29T10:00:00.000Z",
  })];
  harness.repository.listPage = async (userId, options) => {
    harness.calls.push({ method: "page", userId, options });
    return options.cursor
      ? { entries: secondEntries, hasMore: false, nextCursor: null }
      : {
          entries: firstEntries,
          hasMore: true,
          nextCursor: {
            addedAt: firstEntries.at(-1).addedAt,
            phraseId: firstEntries.at(-1).phraseId,
          },
        };
  };

  const first = await harness.handlers.listVocabulary({
    category: "learned",
    limit: 2,
  });
  assert.equal(first.ok, true);
  assert.equal(first.category, "learned");
  assert.deepEqual(first.entries.map(({ category }) => category), ["learned", "learned"]);
  assert.equal(first.hasMore, true);
  assert.equal(typeof first.nextCursor, "string");
  assert.match(first.nextCursor, /^[A-Za-z0-9_-]+$/u);

  const second = await harness.handlers.listVocabulary({
    category: "learned",
    limit: 2,
    cursor: first.nextCursor,
  });
  assert.equal(second.ok, true);
  assert.deepEqual(second.entries.map(({ phraseId }) => phraseId), ["phrase-last-learned"]);
  assert.equal(second.hasMore, false);
  assert.equal(second.nextCursor, null);
  assert.deepEqual(harness.calls, [
    {
      method: "page",
      userId: "user-a",
      options: { category: "learned", limit: 2, cursor: null },
    },
    {
      method: "page",
      userId: "user-a",
      options: {
        category: "learned",
        limit: 2,
        cursor: {
          addedAt: "2026-08-29 11:00:00",
          phraseId: "phrase-legacy-learnt",
        },
      },
    },
  ]);
});

test("list cursors preserve every supported historical D1 timestamp boundary", () => {
  for (const addedAt of [
    "2026-08-29 10:00:00",
    "2026-08-29T10:00:00Z",
    "2026-08-29T10:00:00.000Z",
  ]) {
    const encoded = toolsModule.encodeAiVocabularyListCursor({
      category: "all",
      addedAt,
      phraseId: "phrase-run",
    });
    assert.deepEqual(toolsModule.readAiVocabularyListCursor(encoded, "all"), {
      category: "all",
      addedAt,
      phraseId: "phrase-run",
    });
  }
});

test("list cursor codec remains byte-compatible for existing Unicode cursors", () => {
  const cursor = "eyJ2IjoxLCJjYXRlZ29yeSI6ImxlYXJuZWQiLCJhZGRlZEF0IjoiMjAyNi0wOC0yOSAxMTowMDowMCIsInBocmFzZUlkIjoicGhyYXNlLdGR0LbQuNC6LfCfmIAifQ";
  const value = {
    category: "learned",
    addedAt: "2026-08-29 11:00:00",
    phraseId: "phrase-ёжик-😀",
  };

  assert.equal(toolsModule.encodeAiVocabularyListCursor(value), cursor);
  assert.deepEqual(toolsModule.readAiVocabularyListCursor(cursor, "learned"), value);
});

test("list handler rejects malformed or category-mismatched cursors before D1", async () => {
  const malformed = createHarness("Покажи дальше.");
  assert.deepEqual(await malformed.handlers.listVocabulary({
    category: "all",
    cursor: "not+a+base64url+cursor",
  }), { ok: false, error: "invalid_input" });
  assert.deepEqual(malformed.calls, []);

  const first = createHarness("Покажи learning слова.");
  const page = await first.handlers.listVocabulary({ category: "learning" });
  assert.equal(page.ok, true);
  // The default harness has no next page, so create a canonical cursor directly
  // through the exported codec to test category binding independently.
  const cursor = toolsModule.encodeAiVocabularyListCursor({
    category: "learning",
    addedAt: "2026-08-29T10:00:00.000Z",
    phraseId: "phrase-run",
  });
  const mismatch = createHarness("Покажи выученные слова дальше.");
  assert.deepEqual(await mismatch.handlers.listVocabulary({
    category: "learned",
    cursor,
  }), { ok: false, error: "invalid_input" });
  assert.deepEqual(mismatch.calls, []);
});

test("tool reads scope legacy custom meanings while preset legacy stays immutable", async () => {
  const harness = createHarness("Покажи последние слова.");
  const custom = entry({
    phraseId: "phrase-custom",
    text: "break even",
    sourceType: "custom",
    meanings: [{
      id: "legacy",
      source: "legacy",
      translation: "окупаться",
      context: "the business breaks even",
    }],
  });
  const preset = entry();
  harness.repositoryResults.splice(0, harness.repositoryResults.length, custom, preset);

  const result = await harness.handlers.listVocabulary({ limit: 5 });
  assert.equal(result.ok, true);
  assert.equal(result.entries[0].meanings[0].id, "legacy:phrase-custom");
  assert.equal(result.entries[1].meanings[0].id, "legacy");
});

test("explicit update can target an owner-scoped legacy custom meaning", async () => {
  const harness = createHarness(
    "Исправь у break even перевод окупаться на выходить в ноль.",
  );
  harness.repository.getEntryForMeaning = async (userId, meaningId) => {
    harness.calls.push({ method: "getEntryForMeaning", userId, meaningId });
    return meaningId === "legacy:phrase-custom"
      ? {
          ...entry({
            phraseId: "phrase-custom",
            text: "break even",
            sourceType: "custom",
          }),
          selectedMeaning: {
            id: "legacy:phrase-custom",
            source: "legacy",
            translation: "окупаться",
            context: "the business breaks even",
          },
        }
      : null;
  };

  assert.equal((await harness.handlers.updateVocabularyMeaning({
    meaningId: "legacy:phrase-custom",
    translation: "выходить в ноль",
  }, harness.scope)).ok, true);
  assert.deepEqual(harness.calls, [{
    method: "getEntryForMeaning",
    userId: "user-a",
    meaningId: "legacy:phrase-custom",
  }, {
    method: "updateMeaning",
    userId: "user-a",
    input: {
      meaningId: "legacy:phrase-custom",
      phraseId: "phrase-custom",
      expectedTranslation: "окупаться",
      expectedContext: "the business breaks even",
      translation: "выходить в ноль",
    },
  }]);
});

test("find handler enforces the escaped D1 LIKE pattern byte budget for ASCII and Unicode", async () => {
  const acceptedEscapes = createHarness("Найди слова.");
  assert.equal((await acceptedEscapes.handlers.findVocabulary({
    query: "%".repeat(24),
    limit: 10,
  })).ok, true);
  assert.equal(new TextEncoder().encode(`%${"\\%".repeat(24)}%`).byteLength, 50);
  assert.deepEqual(acceptedEscapes.calls, [{
    method: "search",
    userId: "user-a",
    query: "%".repeat(24),
    limit: 10,
  }]);

  const rejectedEscapes = createHarness("Найди слова.");
  assert.deepEqual(await rejectedEscapes.handlers.findVocabulary({
    query: "%".repeat(25),
    limit: 10,
  }), { ok: false, error: "invalid_input" });
  assert.deepEqual(rejectedEscapes.calls, []);

  const acceptedUnicode = createHarness("Найди слова.");
  assert.equal((await acceptedUnicode.handlers.findVocabulary({
    query: "🚀".repeat(12),
    limit: 10,
  })).ok, true);
  assert.equal(new TextEncoder().encode(`%${"🚀".repeat(12)}%`).byteLength, 50);

  const rejectedUnicode = createHarness("Найди слова.");
  assert.deepEqual(await rejectedUnicode.handlers.findVocabulary({
    query: "🚀".repeat(13),
    limit: 10,
  }), { ok: false, error: "invalid_input" });
  assert.deepEqual(rejectedUnicode.calls, []);
});

test("write handlers require an explicit command and literal values from that turn", async () => {
  const denied = createHarness("Давай потренируем serendipity.");
  assert.deepEqual(
    await denied.handlers.addVocabularyEntry({ text: "serendipity" }, denied.scope),
    { ok: false, error: "explicit_user_command_required" },
  );
  assert.deepEqual(denied.calls, []);

  const invented = createHarness("Добавь слово serendipity.");
  assert.deepEqual(
    await invented.handlers.addVocabularyEntry({
      text: "serendipity",
      translation: "счастливая случайность",
    }, invented.scope),
    { ok: false, error: "explicit_values_required" },
  );
  assert.deepEqual(invented.calls, []);

  const substring = createHarness("Добавь слово train.");
  assert.deepEqual(
    await substring.handlers.addVocabularyEntry({ text: "rain" }, substring.scope),
    { ok: false, error: "explicit_values_required" },
  );
  assert.deepEqual(substring.calls, []);

  const allowed = createHarness("Добавь слово serendipity — счастливая случайность.");
  const result = await allowed.handlers.addVocabularyEntry({
    text: "serendipity",
    translation: "счастливая случайность",
  }, allowed.scope);
  assert.equal(result.ok, true);
  assert.deepEqual(allowed.calls, [{
    method: "addEntry",
    userId: "user-a",
    input: {
      text: "serendipity",
      translation: "счастливая случайность",
    },
  }]);
});

test("write handlers preserve literal case and compatibility characters", async () => {
  const caseSensitive = createHarness("Добавь слово Polish.");
  assert.deepEqual(await caseSensitive.handlers.addVocabularyEntry({
    text: "polish",
  }, caseSensitive.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(caseSensitive.calls, []);

  const compatibilityMismatch = createHarness("Добавь слово Polish.");
  assert.deepEqual(await compatibilityMismatch.handlers.addVocabularyEntry({
    text: "Ｐｏｌｉｓｈ",
  }, compatibilityMismatch.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(compatibilityMismatch.calls, []);

  const exact = createHarness("Добавь слово Polish.");
  assert.equal((await exact.handlers.addVocabularyEntry({
    text: "Polish",
  }, exact.scope)).ok, true);
  assert.equal(exact.calls.at(-1).input.text, "Polish");

  const fullWidthExact = createHarness("Добавь слово Ｐｏｌｉｓｈ.");
  assert.equal((await fullWidthExact.handlers.addVocabularyEntry({
    text: "Ｐｏｌｉｓｈ",
  }, fullWidthExact.scope)).ok, true);
  assert.equal(fullWidthExact.calls.at(-1).input.text, "Ｐｏｌｉｓｈ");
});

test("literal write policy stays bounded on adversarial punctuation tails", () => {
  const literal = `${".".repeat(30_000)}x`;
  const startedAt = performance.now();

  assert.equal(policyModule.exactCommandValue(literal, literal), true);

  const elapsedMilliseconds = performance.now() - startedAt;
  assert.ok(
    elapsedMilliseconds < 150,
    `literal comparison took ${elapsedMilliseconds.toFixed(1)}ms`,
  );
});

test("quoted entry commands preserve meaningful terminal punctuation", async () => {
  const altered = createHarness('Добавь фразу "wow!".');
  assert.deepEqual(await altered.handlers.addVocabularyEntry({
    text: "wow",
  }, altered.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(altered.calls, []);

  const exact = createHarness('Добавь фразу "wow!".');
  assert.equal((await exact.handlers.addVocabularyEntry({
    text: "wow!",
  }, exact.scope)).ok, true);
  assert.equal(exact.calls.at(-1).input.text, "wow!");
});

test("category changes require one literal current-turn command and canonical destination", async () => {
  for (const [message, category] of [
    ["Перемести слово run в Learning.", "learning"],
    ["Пометь фразу run как Learned.", "learned"],
    ["Move run to To Learn.", "to_learn"],
    ["Измени категорию слова run на Learned.", "learned"],
    ["Change the category of run to Learning.", "learning"],
    ["Set run's category to To Learn.", "to_learn"],
  ]) {
    const harness = createHarness(message);
    assert.deepEqual(await harness.handlers.setVocabularyCategory({
      phraseId: "phrase-run",
      category,
    }, harness.scope), {
      ok: true,
      updated: true,
      phraseId: "phrase-run",
      category,
    });
    assert.deepEqual(harness.calls, [{
      method: "getCategoryTarget",
      userId: "user-a",
      phraseId: "phrase-run",
    }, {
      method: "setCategory",
      userId: "user-a",
      input: {
        phraseId: "phrase-run",
        expectedStoredStatus: "learning_now",
        category,
      },
    }]);
  }

  for (const message of [
    "Давай потренируем run в Learning.",
    "run находится в Learning.",
    "Не перемещай run в Learned.",
    "Перемести run в Learned — не делай этого.",
  ]) {
    const harness = createHarness(message);
    assert.deepEqual(await harness.handlers.setVocabularyCategory({
      phraseId: "phrase-run",
      category: "learned",
    }, harness.scope), { ok: false, error: "explicit_user_command_required" });
    assert.deepEqual(harness.calls, []);
  }

  const wrongDestination = createHarness("Перемести run в Learning.");
  assert.deepEqual(await wrongDestination.handlers.setVocabularyCategory({
    phraseId: "phrase-run",
    category: "learned",
  }, wrongDestination.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(wrongDestination.calls, []);

  const wrongEntry = createHarness("Перемести другое в Learning.");
  assert.deepEqual(await wrongEntry.handlers.setVocabularyCategory({
    phraseId: "phrase-run",
    category: "learning",
  }, wrongEntry.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(wrongEntry.calls, [{
    method: "getCategoryTarget",
    userId: "user-a",
    phraseId: "phrase-run",
  }]);
});

test("write handlers allow revocation words when they are the literal phrase", async () => {
  const harness = createHarness("Добавь фразу never mind.");
  assert.equal((await harness.handlers.addVocabularyEntry({
    text: "never mind",
  }, harness.scope)).ok, true);
  assert.equal(harness.calls.at(-1).input.text, "never mind");
});

test("meaning writes are owner-bound and require the saved value to be explicit", async () => {
  const harness = createHarness(
    "Добавь к run значение управлять в контексте run a company.",
  );
  const added = await harness.handlers.addVocabularyMeaning({
    phraseId: "phrase-run",
    translation: "управлять",
    context: "run a company",
  }, harness.scope);
  assert.equal(added.ok, true);
  assert.deepEqual(harness.calls, [{
    method: "getEntry",
    userId: "user-a",
    phraseId: "phrase-run",
  }, {
    method: "addMeaning",
    userId: "user-a",
    input: {
      phraseId: "phrase-run",
      translation: "управлять",
      context: "run a company",
    },
  }]);

  const missingTarget = createHarness("Исправь перевод на руководить.");
  assert.deepEqual(await missingTarget.handlers.updateVocabularyMeaning({
    meaningId: "meaning-owned",
    translation: "руководить",
  }, missingTarget.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(missingTarget.calls, [{
    method: "getEntryForMeaning",
    userId: "user-a",
    meaningId: "meaning-owned",
  }]);

  const missingOldMeaning = createHarness("Исправь у run перевод на руководить.");
  assert.deepEqual(await missingOldMeaning.handlers.updateVocabularyMeaning({
    meaningId: "meaning-owned",
    translation: "руководить",
  }, missingOldMeaning.scope), { ok: false, error: "explicit_values_required" });
  assert.deepEqual(missingOldMeaning.calls, [{
    method: "getEntryForMeaning",
    userId: "user-a",
    meaningId: "meaning-owned",
  }]);

  const invalidMeaning = createHarness(
    "Исправь у run перевод управлять на руководить.",
  );
  assert.deepEqual(await invalidMeaning.handlers.updateVocabularyMeaning({
    meaningId: "meaning-missing",
    translation: "руководить",
  }, invalidMeaning.scope), { ok: false, error: "mutation_conflict" });

  const updated = createHarness("Исправь у run перевод управлять на руководить.");
  assert.equal((await updated.handlers.updateVocabularyMeaning({
    meaningId: "meaning-owned",
    translation: "руководить",
  }, updated.scope)).ok, true);
  assert.deepEqual(updated.calls, [{
    method: "getEntryForMeaning",
    userId: "user-a",
    meaningId: "meaning-owned",
  }, {
    method: "updateMeaning",
    userId: "user-a",
    input: {
      meaningId: "meaning-owned",
      phraseId: "phrase-run",
      expectedTranslation: "управлять",
      expectedContext: "run a company",
      translation: "руководить",
    },
  }]);
});

test("omitted context remains omitted and an explicit empty context is rejected", async () => {
  const add = createHarness("Добавь слово uncanny — странный.");
  assert.equal((await add.handlers.addVocabularyEntry({
    text: "uncanny",
    translation: "странный",
  }, add.scope)).ok, true);
  assert.equal(Object.hasOwn(add.calls.at(-1).input, "context"), false);

  const update = createHarness("Исправь у run перевод управлять на руководить.");
  assert.equal((await update.handlers.updateVocabularyMeaning({
    meaningId: "meaning-owned",
    translation: "руководить",
  }, update.scope)).ok, true);
  assert.equal(Object.hasOwn(update.calls.at(-1).input, "context"), false);

  const empty = createHarness("Добавь к run значение управлять.");
  assert.deepEqual(await empty.handlers.addVocabularyMeaning({
    phraseId: "phrase-run",
    translation: "управлять",
    context: "",
  }, empty.scope), { ok: false, error: "invalid_input" });
  assert.deepEqual(empty.calls, []);
});

test("read tool output is bounded before it is returned to the provider", async () => {
  const harness = createHarness("Покажи последние двадцать слов.");
  const maximumEntry = entry({
    phraseId: "p".repeat(120),
    text: "w".repeat(500),
    meanings: Array.from({ length: 20 }, (_, index) => ({
      id: `${index}-${"m".repeat(140)}`,
      source: "personal",
      translation: "т".repeat(1_000),
      context: "c".repeat(1_000),
    })),
    meaningCount: 20,
  });
  harness.repositoryResults.splice(
    0,
    harness.repositoryResults.length,
    ...Array.from({ length: 10 }, () => maximumEntry),
  );

  const result = await harness.handlers.listVocabulary({ limit: 20 });
  assert.equal(result.ok, true);
  assert.ok(JSON.stringify(result).length <= 7_800);
  assert.ok(result.entries[0].meanings.length <= 6);
  assert.equal(result.entries[0].meaningCount, 20);
  assert.equal(result.entries[0].meaningsTruncated, true);
  assert.equal(result.entries[0].detailsTruncated, true);
  assert.ok([...result.entries[0].text].length <= 240);
  assert.ok([...result.entries[0].meanings[0].translation].length <= 100);
  assert.ok([...result.entries[0].meanings[0].context].length <= 160);
});

test("opening message presents recent vocabulary with translations without a model call", () => {
  assert.equal(typeof toolsModule.buildVocabularyOpeningMessage, "function");
  const message = toolsModule.buildVocabularyOpeningMessage([
    entry(),
    entry({
      phraseId: "phrase-break-even",
      text: "break even",
      meanings: [],
      meaningCount: 0,
    }),
  ]);
  assert.match(message, /Последние 2 добавленных/u);
  assert.match(message, /run — бежать/u);
  assert.match(message, /break even — перевод пока не сохранён/u);
  assert.match(message, /Хочешь потренировать/u);

  assert.match(
    toolsModule.buildVocabularyOpeningMessage([]),
    /В словаре пока нет слов/u,
  );

  const bounded = toolsModule.buildVocabularyOpeningMessage(Array.from(
    { length: 5 },
    (_, index) => entry({
      phraseId: `phrase-${index}`,
      text: `word-${index}-${"w".repeat(300)}`,
      meanings: Array.from({ length: 8 }, (_, meaningIndex) => ({
        id: `meaning-${index}-${meaningIndex}`,
        source: "personal",
        translation: `translation-${meaningIndex}-${"т".repeat(1_000)}`,
        context: "",
      })),
      meaningCount: 8,
    }),
  ));
  assert.ok([...bounded].length <= 4_000);
  assert.match(bounded, /ещё 5/u);
});

test("AI SDK tool set exposes reads and confirmation-gated proposal capabilities", () => {
  const { executor, handlers } = createHarness("Добавь слово serendipity.");
  assert.equal(typeof toolsModule.createAiVocabularyTools, "function");
  const tools = toolsModule.createAiVocabularyTools(handlers, executor);
  assert.deepEqual(Object.keys(tools).sort(), [
    "find_vocabulary",
    "list_vocabulary",
    "propose_vocabulary_entries",
    "propose_vocabulary_meaning",
    "propose_vocabulary_meaning_update",
    "propose_vocabulary_state_change",
  ]);
  assert.deepEqual([...toolsModule.AI_VOCABULARY_TOOL_NAMES].sort(), Object.keys(tools).sort());
  assert.equal(
    tools.find_vocabulary.inputSchema.jsonSchema.properties.query.maxLength,
    48,
  );
});

test("every vocabulary tool is constructed through one traced budget wrapper", async () => {
  const source = await readFile(
    new URL("../lib/ai-chat/tools/vocabulary/registry.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /function defineTracedVocabularyTool/u);
  assert.equal(
    (source.match(/\btool(?:\s*<[\s\S]*?>)?\s*\(\s*\{/gu) || []).length,
    1,
  );
});

test("AI SDK proposal adapters forward provider identity, name, and arguments to the trace executor", async () => {
  const currentMessage = [
    "Добавь слово serendipity — счастливая случайность.",
    "Добавь к run значение управлять.",
    "Исправь у run перевод управлять на руководить.",
  ].join(" ");
  const invocations = [];
  const freshTools = () => {
    const harness = createHarness(currentMessage);
    return toolsModule.createAiVocabularyTools(harness.handlers, {
      async execute(input) {
        invocations.push({
          providerToolCallId: input.providerToolCallId,
          toolName: input.toolName,
          args: input.args,
        });
        return input.run(harness.scope);
      },
    });
  };
  const readTools = freshTools();
  const entryTools = freshTools();
  const meaningTools = freshTools();
  const updateTools = freshTools();
  const options = (toolCallId) => ({
    toolCallId,
    messages: [],
    abortSignal: new AbortController().signal,
  });

  await readTools.list_vocabulary.execute({ limit: 5 }, options("provider-read"));
  await readTools.find_vocabulary.execute({ query: "run", limit: 3 }, options("provider-search"));
  await entryTools.propose_vocabulary_entries.execute({
    entries: [{ text: "serendipity", translation: "счастливая случайность" }],
  }, options("provider-add-entry"));
  await meaningTools.propose_vocabulary_meaning.execute({
    phraseId: "phrase-run",
    translation: "управлять",
  }, options("provider-add-meaning"));
  await updateTools.propose_vocabulary_meaning_update.execute({
    meaningId: "meaning-owned",
    translation: "руководить",
  }, options("provider-update-meaning"));

  assert.deepEqual(invocations, [
    {
      providerToolCallId: "provider-read",
      toolName: "list_vocabulary",
      args: { limit: 5 },
    },
    {
      providerToolCallId: "provider-search",
      toolName: "find_vocabulary",
      args: { query: "run", limit: 3 },
    },
    {
      providerToolCallId: "provider-add-entry",
      toolName: "propose_vocabulary_entries",
      args: { entries: [{ text: "serendipity", translation: "счастливая случайность" }] },
    },
    {
      providerToolCallId: "provider-add-meaning",
      toolName: "propose_vocabulary_meaning",
      args: { phraseId: "phrase-run", translation: "управлять" },
    },
    {
      providerToolCallId: "provider-update-meaning",
      toolName: "propose_vocabulary_meaning_update",
      args: { meaningId: "meaning-owned", translation: "руководить" },
    },
  ]);
});

test("state-change adapter proposes exact current targets, including removal, without writing", async () => {
  const harness = createHarness("Удали run из моего Practice.");
  const invocations = [];
  const tools = toolsModule.createAiVocabularyTools(harness.handlers, {
    async execute(input) {
      invocations.push({
        providerToolCallId: input.providerToolCallId,
        toolName: input.toolName,
        args: input.args,
      });
      return input.run(harness.scope);
    },
  });
  const result = await tools.propose_vocabulary_state_change.execute({
    entries: [{ text: "run" }],
    destination: "removed",
  }, {
    toolCallId: "provider-change-state",
    messages: [],
    abortSignal: new AbortController().signal,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(invocations, [{
    providerToolCallId: "provider-change-state",
    toolName: "propose_vocabulary_state_change",
    args: { entries: [{ text: "run" }], destination: "removed" },
  }]);
  assert.deepEqual(harness.calls, [{
    method: "getStateTargets",
    userId: "user-a",
    texts: ["run"],
  }, {
    method: "changeState",
    userId: "user-a",
    input: {
      destination: "removed",
      entries: [{
        phraseId: "phrase-run",
        text: "run",
        sourceType: "preset",
        expectedStoredStatus: "learning_now",
      }],
    },
  }, {
    method: "propose",
    plan: {
      operation: "vocabulary.change-state/v1",
      targetKey: "entries",
      canonicalArgs: {
        destination: "removed",
        entries: [{
          phraseId: "phrase-run",
          text: "run",
          sourceType: "preset",
          expectedStoredStatus: "learning_now",
        }],
      },
      canonicalResult: {
        ok: true,
        updated: true,
        entries: [{ phraseId: "phrase-run", text: "run", state: "removed" }],
      },
    },
    publicPayload: {
      operation: "change_vocabulary_state",
      items: [{
        id: "phrase-run",
        text: "run",
        fromCategory: "learning",
        toCategory: "removed",
      }],
    },
  }]);
});

test("state-change schema bounds one exact-text batch to ten entries and all destinations", () => {
  const { executor, handlers } = createHarness("change them");
  const tools = toolsModule.createAiVocabularyTools(handlers, executor);
  const schema = tools.propose_vocabulary_state_change.inputSchema.jsonSchema;
  assert.equal(schema.properties.entries.minItems, 1);
  assert.equal(schema.properties.entries.maxItems, 10);
  assert.deepEqual(schema.properties.entries.items.required, ["text"]);
  assert.deepEqual(schema.properties.destination.enum, [
    "to_learn",
    "learning",
    "learned",
    "removed",
  ]);
  assert.deepEqual(schema.required, ["entries", "destination"]);
});

test("state-change resolves the whole batch once and rejects any missing owner-visible phrase", async () => {
  const harness = createHarness("Удали run и missing из Practice.");
  const result = await harness.handlers.proposeVocabularyStateChange({
    entries: [{ text: "run" }, { text: "missing" }],
    destination: "removed",
  }, harness.scope);
  assert.deepEqual(result, { ok: false, error: "mutation_conflict" });
  assert.deepEqual(harness.calls, [{
    method: "getStateTargets",
    userId: "user-a",
    texts: ["run", "missing"],
  }]);
});

test("one model turn has a hard total tool-call budget", async () => {
  assert.equal(toolsModule.AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN, 2);
  const { handlers, calls } = createHarness("Покажи последние слова.");
  for (let index = 0; index < 2; index += 1) {
    assert.equal((await handlers.listVocabulary({ limit: 5 })).ok, true);
  }
  assert.deepEqual(await handlers.listVocabulary({ limit: 5 }), {
    ok: false,
    error: "tool_budget_exceeded",
  });
  assert.equal(calls.length, 2);
});

test("over-budget provider calls are rejected before consuming D1 trace queries", async () => {
  const harness = createHarness("Покажи последние слова.");
  let tracedCalls = 0;
  const tools = toolsModule.createAiVocabularyTools(harness.handlers, {
    async execute(input) {
      tracedCalls += 1;
      return input.run(harness.scope);
    },
  });
  const options = (toolCallId) => ({
    toolCallId,
    messages: [],
    abortSignal: new AbortController().signal,
  });

  for (let index = 0; index < 2; index += 1) {
    assert.equal((await tools.list_vocabulary.execute(
      { limit: 5 },
      options(`within-budget-${index}`),
    )).ok, true);
  }
  assert.deepEqual(await tools.list_vocabulary.execute(
    { limit: 5 },
    options("over-budget"),
  ), { ok: false, error: "tool_budget_exceeded" });
  assert.equal(tracedCalls, 2);
});

test("AI SDK abort signal promptly stops an active traced tool execution", async () => {
  const harness = createHarness("Покажи последние слова.");
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const neverFinishes = new Promise(() => {});
  const tools = toolsModule.createAiVocabularyTools(harness.handlers, {
    async execute() {
      markStarted();
      return neverFinishes;
    },
  });
  const controller = new AbortController();
  const timeout = new DOMException("tool timed out", "TimeoutError");

  const result = tools.list_vocabulary.execute({ limit: 5 }, {
    toolCallId: "provider-timeout",
    messages: [],
    abortSignal: controller.signal,
  });
  await started;
  controller.abort(timeout);

  await assert.rejects(Promise.race([
    result,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("tool execution ignored abort signal")), 25);
    }),
  ]), (error) => error === timeout);
});

test("a pre-aborted tool never reaches the trace executor", async () => {
  const harness = createHarness("Покажи последние слова.");
  let tracedCalls = 0;
  const tools = toolsModule.createAiVocabularyTools(harness.handlers, {
    async execute(input) {
      tracedCalls += 1;
      return input.run(harness.scope);
    },
  });
  const controller = new AbortController();
  const timeout = new DOMException("tool timed out", "TimeoutError");
  controller.abort(timeout);

  const result = tools.list_vocabulary.execute({ limit: 5 }, {
    toolCallId: "provider-pre-aborted",
    messages: [],
    abortSignal: controller.signal,
  });

  await assert.rejects(result, (error) => error === timeout);
  assert.equal(tracedCalls, 0);
});

test("a failed mutation opens a per-turn circuit before another provider tool call", async () => {
  const harness = createHarness("Добавь слово uncanny.");
  let tracedCalls = 0;
  const tools = toolsModule.createAiVocabularyTools(harness.handlers, {
    async execute() {
      tracedCalls += 1;
      return { ok: false, error: "operation_failed" };
    },
  });
  const options = (toolCallId) => ({
    toolCallId,
    messages: [],
    abortSignal: new AbortController().signal,
  });

  assert.deepEqual(await tools.propose_vocabulary_entries.execute(
    { entries: [{ text: "uncanny" }] },
    options("failed-mutation"),
  ), { ok: false, error: "operation_failed" });
  assert.deepEqual(await tools.list_vocabulary.execute(
    { limit: 5 },
    options("blocked-after-failure"),
  ), { ok: false, error: "tool_budget_exceeded" });
  assert.equal(tracedCalls, 1);
});
