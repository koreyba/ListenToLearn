import assert from "node:assert/strict";
import test from "node:test";

const toolsModule = await import("../lib/ai-chat/vocabulary-tools.ts").catch(() => ({}));

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
  };
  const scope = {
    async commitMutation(plan) {
      return plan.canonicalResult;
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
    "Save these translations to my vocabulary.",
    "Update the translation to руководить.",
    "Пожалуйста, добавь слово uncanny.",
    "Давай добавим фразу break even.",
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

  assert.deepEqual(await handlers.getRecentVocabulary({ limit: 10 }), {
    ok: true,
    entries: [{
      phraseId: savedEntry.phraseId,
      text: savedEntry.text,
      status: savedEntry.status,
      meanings: savedEntry.meanings,
      meaningCount: 1,
      meaningsTruncated: false,
      detailsTruncated: false,
    }],
  });
  assert.deepEqual(await handlers.findVocabulary({ query: "run", limit: 4 }), {
    ok: true,
    entries: [{
      phraseId: savedEntry.phraseId,
      text: savedEntry.text,
      status: savedEntry.status,
      meanings: savedEntry.meanings,
      meaningCount: 1,
      meaningsTruncated: false,
      detailsTruncated: false,
    }],
  });
  assert.deepEqual(calls, [
    { method: "recent", userId: "user-a", limit: 10 },
    { method: "search", userId: "user-a", query: "run", limit: 4 },
  ]);
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

  const result = await harness.handlers.getRecentVocabulary({ limit: 5 });
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

  const result = await harness.handlers.getRecentVocabulary({ limit: 20 });
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

test("AI SDK tool set exposes read and guarded write capabilities", () => {
  const { executor, handlers } = createHarness("Добавь слово serendipity.");
  assert.equal(typeof toolsModule.createAiVocabularyTools, "function");
  const tools = toolsModule.createAiVocabularyTools(handlers, executor);
  assert.deepEqual(Object.keys(tools).sort(), [
    "add_vocabulary_entry",
    "add_vocabulary_meaning",
    "find_vocabulary",
    "get_recent_vocabulary",
    "update_vocabulary_meaning",
  ]);
  assert.equal(
    tools.find_vocabulary.inputSchema.jsonSchema.properties.query.maxLength,
    48,
  );
});

test("AI SDK tool adapters forward provider call identity, name, and arguments to the trace executor", async () => {
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
  const entryAndMeaningTools = freshTools();
  const updateTools = freshTools();
  const options = (toolCallId) => ({
    toolCallId,
    messages: [],
    abortSignal: new AbortController().signal,
  });

  await readTools.get_recent_vocabulary.execute({ limit: 5 }, options("provider-read"));
  await readTools.find_vocabulary.execute({ query: "run", limit: 3 }, options("provider-search"));
  await entryAndMeaningTools.add_vocabulary_entry.execute({
    text: "serendipity",
    translation: "счастливая случайность",
  }, options("provider-add-entry"));
  await entryAndMeaningTools.add_vocabulary_meaning.execute({
    phraseId: "phrase-run",
    translation: "управлять",
  }, options("provider-add-meaning"));
  await updateTools.update_vocabulary_meaning.execute({
    meaningId: "meaning-owned",
    translation: "руководить",
  }, options("provider-update-meaning"));

  assert.deepEqual(invocations, [
    {
      providerToolCallId: "provider-read",
      toolName: "get_recent_vocabulary",
      args: { limit: 5 },
    },
    {
      providerToolCallId: "provider-search",
      toolName: "find_vocabulary",
      args: { query: "run", limit: 3 },
    },
    {
      providerToolCallId: "provider-add-entry",
      toolName: "add_vocabulary_entry",
      args: { text: "serendipity", translation: "счастливая случайность" },
    },
    {
      providerToolCallId: "provider-add-meaning",
      toolName: "add_vocabulary_meaning",
      args: { phraseId: "phrase-run", translation: "управлять" },
    },
    {
      providerToolCallId: "provider-update-meaning",
      toolName: "update_vocabulary_meaning",
      args: { meaningId: "meaning-owned", translation: "руководить" },
    },
  ]);
});

test("one model turn has a hard total tool-call budget", async () => {
  assert.equal(toolsModule.AI_VOCABULARY_MAX_TOOL_CALLS_PER_TURN, 2);
  const { handlers, calls } = createHarness("Покажи последние слова.");
  for (let index = 0; index < 2; index += 1) {
    assert.equal((await handlers.getRecentVocabulary({ limit: 5 })).ok, true);
  }
  assert.deepEqual(await handlers.getRecentVocabulary({ limit: 5 }), {
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
    assert.equal((await tools.get_recent_vocabulary.execute(
      { limit: 5 },
      options(`within-budget-${index}`),
    )).ok, true);
  }
  assert.deepEqual(await tools.get_recent_vocabulary.execute(
    { limit: 5 },
    options("over-budget"),
  ), { ok: false, error: "tool_budget_exceeded" });
  assert.equal(tracedCalls, 2);
});
