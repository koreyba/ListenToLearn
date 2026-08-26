import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { CONNECTED_SPEECH_CARDS } from "../lib/catalog/connected-speech-catalog.ts";

const GENERATED_MARKER = "-- generated connected-speech catalog; edit the TypeScript catalog, not this SQL";
const STATEMENT_BREAK = "\n--> statement-breakpoint\n";

export function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function generateConnectedSpeechCatalogSql(cards) {
  const statements = [];

  cards.forEach((card, catalogIndex) => {
    const searchQuery = card.searchQuery || card.text;
    statements.push(`INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES (${sqlLiteral(card.id)}, ${sqlLiteral(card.text)}, ${sqlLiteral(card.pattern)}, ${sqlLiteral(card.ipa)}, '', '', 'preset', ${catalogIndex + 1}, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;`);

    statements.push(`INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES (${sqlLiteral(card.id)}, ${sqlLiteral(card.kind)}, ${card.rank}, ${sqlLiteral(card.pattern)}, ${sqlLiteral(card.ipa)}, ${sqlLiteral(searchQuery)}, ${sqlLiteral(card.alternateQuery)}, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;`);

    card.mechanisms.forEach((mechanism, displayOrder) => {
      statements.push(`INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES (${sqlLiteral(card.id)}, ${sqlLiteral(mechanism)}, ${displayOrder})
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;`);
    });
  });

  return `${GENERATED_MARKER}\n${statements.join(STATEMENT_BREAK)}\n`;
}

export function replaceGeneratedCatalogSql(current, cards) {
  const generatedMarkerIndex = current.indexOf(GENERATED_MARKER);
  const schemaSection = generatedMarkerIndex === -1
    ? current
    : current.slice(0, generatedMarkerIndex);
  const schemaSql = schemaSection
    .replace(/(?:\s*-->\s*statement-breakpoint\s*)+$/u, "")
    .trimEnd();

  return `${schemaSql}${STATEMENT_BREAK}${generateConnectedSpeechCatalogSql(cards)}`;
}

async function writeGeneratedCatalog(target) {
  const current = await readFile(target, "utf8");
  await writeFile(target, replaceGeneratedCatalogSql(current, CONNECTED_SPEECH_CARDS), "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [flag, target] = process.argv.slice(2);
  if (flag === "--write" && target) {
    await writeGeneratedCatalog(target);
  } else if (flag) {
    throw new Error("Usage: node scripts/generate-connected-speech-migration.mjs [--write <migration.sql>]");
  } else {
    process.stdout.write(generateConnectedSpeechCatalogSql(CONNECTED_SPEECH_CARDS));
  }
}
