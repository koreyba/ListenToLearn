CREATE TABLE `catalog_phrase_analysis` (
	`phrase_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`rank` integer NOT NULL,
	`pattern` text NOT NULL,
	`ipa` text NOT NULL,
	`search_query` text NOT NULL,
	`alternate_query` text,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`phrase_id`) REFERENCES `phrases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_analysis_active_kind_rank` ON `catalog_phrase_analysis` (`active`,`kind`,`rank`);--> statement-breakpoint
CREATE TABLE `phrase_mechanisms` (
	`phrase_id` text NOT NULL,
	`mechanism` text NOT NULL,
	`display_order` integer NOT NULL,
	PRIMARY KEY(`phrase_id`, `mechanism`),
	FOREIGN KEY (`phrase_id`) REFERENCES `phrases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_phrase_mechanisms_mechanism_phrase` ON `phrase_mechanisms` (`mechanism`,`phrase_id`);
--> statement-breakpoint
-- generated connected-speech catalog; edit the TypeScript catalog, not this SQL
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a01', 'tell him', '[tell him]', 'tɛlɪm', '', '', 'preset', 1, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a01', 'atom', 1, '[tell him]', 'tɛlɪm', 'tell him', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a01', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a02', 'a couple of', '[a couple of]', 'əkʌplə', '', '', 'preset', 2, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a02', 'atom', 2, '[a couple of]', 'əkʌplə', 'a couple of', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a02', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a03', 'probably', 'probably', 'prɑbli', '', '', 'preset', 3, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a03', 'atom', 3, 'probably', 'prɑbli', 'probably', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a03', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a04', 'I can see', '[I can see]', 'aɪkn̩siː', '', '', 'preset', 4, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a04', 'atom', 4, '[I can see]', 'aɪkn̩siː', 'I can see', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a04', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a05', 'it was there', '[it was there]', 'ɪtwəzðɛr', '', '', 'preset', 5, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a05', 'atom', 5, '[it was there]', 'ɪtwəzðɛr', 'it was there', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a05', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a06', 'more than that', '[more than that]', 'mɔːrðənðæt', '', '', 'preset', 6, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a06', 'atom', 6, '[more than that]', 'mɔːrðənðæt', 'more than that', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a06', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a07', 'did you', '[did you]', 'dɪdʒə', '', '', 'preset', 7, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a07', 'atom', 7, '[did you]', 'dɪdʒə', 'did you', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a07', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a08', 'don''t you', '[don''t you]', 'doʊntʃə', '', '', 'preset', 8, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a08', 'atom', 8, '[don''t you]', 'doʊntʃə', 'don''t you', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a08', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a09', 'miss you', '[miss you]', 'mɪʃə', '', '', 'preset', 9, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a09', 'atom', 9, '[miss you]', 'mɪʃə', 'miss you', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a09', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a10', 'get it', '[get it]', 'gɛɾɪt', '', '', 'preset', 10, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a10', 'atom', 10, '[get it]', 'gɛɾɪt', 'get it', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a10', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a11', 'better', 'better', 'bɛɾər', '', '', 'preset', 11, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a11', 'atom', 11, 'better', 'bɛɾər', 'better', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a11', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a12', 'can''t just', '[can''t just]', 'kænʔdʒəs', '', '', 'preset', 12, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a12', 'atom', 12, '[can''t just]', 'kænʔdʒəs', 'can''t just', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a12', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a13', 'an hour', '[an hour]', 'ənaʊr', '', '', 'preset', 13, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a13', 'atom', 13, '[an hour]', 'ənaʊr', 'an hour', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a13', 'linking', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a14', 'made out', '[made out]', 'meɪdaʊt', '', '', 'preset', 14, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a14', 'atom', 14, '[made out]', 'meɪdaʊt', 'made out', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a14', 'linking', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a15', 'an apple', '[an apple]', 'ənæpl̩', '', '', 'preset', 15, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a15', 'atom', 15, '[an apple]', 'ənæpl̩', 'an apple', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a15', 'linking', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a16', 'button', 'button', 'bʌʔn̩', '', '', 'preset', 16, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a16', 'atom', 16, 'button', 'bʌʔn̩', 'button', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a16', 'syllabic_consonant', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a17', 'that''ll', 'that''ll', 'ðæɾl̩', '', '', 'preset', 17, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a17', 'atom', 17, 'that''ll', 'ðæɾl̩', 'that''ll', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a17', 'syllabic_consonant', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('a18', 'didn''t', 'didn''t', 'dɪdn̩', '', '', 'preset', 18, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('a18', 'atom', 18, 'didn''t', 'dɪdn̩', 'didn''t', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('a18', 'syllabic_consonant', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l01', 'gonna', 'gonna', 'gənə', '', '', 'preset', 19, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l01', 'lexicon', 1, 'gonna', 'gənə', 'gonna', 'going to', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l01', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l01', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l02', 'wanna', 'wanna', 'wɑnə', '', '', 'preset', 20, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l02', 'lexicon', 2, 'wanna', 'wɑnə', 'wanna', 'want to', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l02', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l02', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l03', 'gotta', 'gotta', 'gɑɾə', '', '', 'preset', 21, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l03', 'lexicon', 3, 'gotta', 'gɑɾə', 'gotta', 'got to', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l03', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l03', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l04', 'kinda', 'kinda', 'kaɪndə', '', '', 'preset', 22, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l04', 'lexicon', 4, 'kinda', 'kaɪndə', 'kinda', 'kind of', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l04', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l05', 'hafta', 'hafta', 'hæftə', '', '', 'preset', 23, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l05', 'lexicon', 5, 'hafta', 'hæftə', 'hafta', 'have to', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l05', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l05', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l06', 'dunno', 'dunno', 'dəˈnoʊ', '', '', 'preset', 24, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l06', 'lexicon', 6, 'dunno', 'dəˈnoʊ', 'dunno', 'don''t know', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l06', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l07', 'gimme', 'gimme', 'gɪmi', '', '', 'preset', 25, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l07', 'lexicon', 7, 'gimme', 'gɪmi', 'gimme', 'give me', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l07', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l08', 'lemme', 'lemme', 'lɛmi', '', '', 'preset', 26, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l08', 'lexicon', 8, 'lemme', 'lɛmi', 'lemme', 'let me', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l08', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l09', '''em', '''em', 'əm', '', '', 'preset', 27, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l09', 'lexicon', 9, '''em', 'əm', '''em', 'give them', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l09', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l10', 'cuz', 'cuz', 'kəz', '', '', 'preset', 28, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l10', 'lexicon', 10, 'cuz', 'kəz', 'cuz', 'because I', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l10', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l11', 'sorta', 'sorta', 'sɔːrɾə', '', '', 'preset', 29, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l11', 'lexicon', 11, 'sorta', 'sɔːrɾə', 'sorta', 'sort of', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l11', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l11', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l12', 'gotcha', 'gotcha', 'gɑtʃə', '', '', 'preset', 30, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l12', 'lexicon', 12, 'gotcha', 'gɑtʃə', 'gotcha', 'got you', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l12', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l12', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l13', 'shoulda', 'shoulda', 'ʃʊɾə', '', '', 'preset', 31, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l13', 'lexicon', 13, 'shoulda', 'ʃʊɾə', 'shoulda', 'should have', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l13', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l13', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l14', 'woulda', 'woulda', 'wʊɾə', '', '', 'preset', 32, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l14', 'lexicon', 14, 'woulda', 'wʊɾə', 'woulda', 'would have', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l14', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l14', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l15', 'coulda', 'coulda', 'kʊɾə', '', '', 'preset', 33, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l15', 'lexicon', 15, 'coulda', 'kʊɾə', 'coulda', 'could have', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l15', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l15', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l16', 'used to', '[used to]', 'juːstə', '', '', 'preset', 34, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l16', 'lexicon', 16, '[used to]', 'juːstə', 'used to', 'useta', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l16', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l16', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l17', 'supposed to', '[supposed to]', 'spoʊstə', '', '', 'preset', 35, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l17', 'lexicon', 17, '[supposed to]', 'spoʊstə', 'supposed to', 'sposta', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l17', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l17', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l18', 'has to', '[has to]', 'hæstə', '', '', 'preset', 36, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l18', 'lexicon', 18, '[has to]', 'hæstə', 'has to', 'hasta', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l18', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l18', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l19', 'musta', 'musta', 'mʌstə', '', '', 'preset', 37, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l19', 'lexicon', 19, 'musta', 'mʌstə', 'musta', 'must have', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l19', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l19', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l20', 'oughta', 'oughta', 'ɔːɾə', '', '', 'preset', 38, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l20', 'lexicon', 20, 'oughta', 'ɔːɾə', 'oughta', 'ought to', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l20', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l20', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l21', 'whatcha', 'whatcha', 'wʌtʃə', '', '', 'preset', 39, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l21', 'lexicon', 21, 'whatcha', 'wʌtʃə', 'whatcha', 'what are you', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l21', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l21', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('l22', 'innit', 'innit', 'ɪnɪt', '', '', 'preset', 40, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('l22', 'lexicon', 22, 'innit', 'ɪnɪt', 'innit', 'isn''t it', 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l22', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('l22', 'syllabic_consonant', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-0', 'I don''t know if it''s', '[I don''t know] [if it''s]', 'aɪɾəˈnoʊ ɪfɪts', '', '', 'preset', 41, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-0', 'stack', 1, '[I don''t know] [if it''s]', 'aɪɾəˈnoʊ ɪfɪts', 'I don''t know if it''s', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-0', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-0', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-1', 'you know what I mean', '[you know] [what I mean]', 'jənoʊ wʌɾaɪ miːn', '', '', 'preset', 42, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-1', 'stack', 2, '[you know] [what I mean]', 'jənoʊ wʌɾaɪ miːn', 'you know what I mean', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-1', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-1', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s003', 'one of the', '[one of the]', 'wʌnəðə', '', '', 'preset', 43, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s003', 'stack', 3, '[one of the]', 'wʌnəðə', 'one of the', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s003', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s003', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s004', 'a couple of', '[a couple of]', 'əkʌpləv', '', '', 'preset', 44, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s004', 'stack', 4, '[a couple of]', 'əkʌpləv', 'a couple of', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s004', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-4', 'it''s going to be a', '[it''s] [going to be a]', 'ɪts gənə biːə', '', '', 'preset', 45, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-4', 'stack', 5, '[it''s] [going to be a]', 'ɪts gənə biːə', 'it''s going to be a', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-4', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-4', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-2', 'all you have to do is', '[all you] [have to] [do is]', 'ɔːljə hæftə duːɪz', '', '', 'preset', 46, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-2', 'stack', 6, '[all you] [have to] [do is]', 'ɔːljə hæftə duːɪz', 'all you have to do is', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-2', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-2', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-5', 'there''s a lot of it', '[there''s a lot of it]', 'ðərzəlɑɾəvɪt', '', '', 'preset', 47, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-5', 'stack', 7, '[there''s a lot of it]', 'ðərzəlɑɾəvɪt', 'there''s a lot of it', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-5', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-5', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-7', 'at the end of the day', '[at the end of the day]', 'əɾðiɛndəvðədeɪ', '', '', 'preset', 48, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-7', 'stack', 8, '[at the end of the day]', 'əɾðiɛndəvðədeɪ', 'at the end of the day', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-7', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-7', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s009', 'most of the time', '[most of the time]', 'moʊsəvðətaɪm', '', '', 'preset', 49, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s009', 'stack', 9, '[most of the time]', 'moʊsəvðətaɪm', 'most of the time', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s009', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s010', 'some of them', '[some of them]', 'sʌməvəm', '', '', 'preset', 50, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s010', 'stack', 10, '[some of them]', 'sʌməvəm', 'some of them', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s010', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-3', 'I didn''t know that it was', '[I didn''t know] [that it was]', 'aɪ dɪdn̩ noʊ ðəɾɪwəz', '', '', 'preset', 51, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-3', 'stack', 11, '[I didn''t know] [that it was]', 'aɪ dɪdn̩ noʊ ðəɾɪwəz', 'I didn''t know that it was', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-3', 'syllabic_consonant', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-3', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-3', 'reduction', 2)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-9', 'what do you want me to do', '[what do you] [want me to] [do]', 'wʌɾəjə wʌnmɪɾə duː', '', '', 'preset', 52, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-9', 'stack', 12, '[what do you] [want me to] [do]', 'wʌɾəjə wʌnmɪɾə duː', 'what do you want me to do', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-9', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-9', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s013', 'all of a sudden', '[all of a sudden]', 'ɔːləvəsʌdn̩', '', '', 'preset', 53, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s013', 'stack', 13, '[all of a sudden]', 'ɔːləvəsʌdn̩', 'all of a sudden', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s013', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s013', 'syllabic_consonant', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s014', 'or something like that', '[or something] [like that]', 'ərsʌmpm̩ laɪkðæt', '', '', 'preset', 54, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s014', 'stack', 14, '[or something] [like that]', 'ərsʌmpm̩ laɪkðæt', 'or something like that', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s014', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s014', 'coalescence', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s015', 'and stuff like that', '[and stuff] [like that]', 'ənstʌf laɪkðæt', '', '', 'preset', 55, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s015', 'stack', 15, '[and stuff] [like that]', 'ənstʌf laɪkðæt', 'and stuff like that', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s015', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-14', 'did you tell him about it', '[did you] [tell him] [about it]', 'dɪdʒə tɛlɪm əbaʊɾɪt', '', '', 'preset', 56, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-14', 'stack', 16, '[did you] [tell him] [about it]', 'dɪdʒə tɛlɪm əbaʊɾɪt', 'did you tell him about it', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-14', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-14', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-14', 't_variation', 2)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s017', 'I was gonna say', '[I was gonna] [say]', 'aɪwəzgənə seɪ', '', '', 'preset', 57, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s017', 'stack', 17, '[I was gonna] [say]', 'aɪwəzgənə seɪ', 'I was gonna say', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s017', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s017', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s018', 'what''s going on', '[what''s going on]', 'wʌsgoʊɪnɑn', '', '', 'preset', 58, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s018', 'stack', 18, '[what''s going on]', 'wʌsgoʊɪnɑn', 'what''s going on', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s018', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s019', 'how''s it going', '[how''s it going]', 'haʊzɪɾgoʊɪn', '', '', 'preset', 59, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s019', 'stack', 19, '[how''s it going]', 'haʊzɪɾgoʊɪn', 'how''s it going', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s019', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s019', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-10', 'it should have been a', '[it should have been a]', 'ɪtʃʊɾəbɪnə', '', '', 'preset', 60, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-10', 'stack', 20, '[it should have been a]', 'ɪtʃʊɾəbɪnə', 'it should have been a', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-10', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-10', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-8', 'I would have thought that', '[I would have] [thought that]', 'aɪwʊɾə θɔːtðət', '', '', 'preset', 61, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-8', 'stack', 21, '[I would have] [thought that]', 'aɪwʊɾə θɔːtðət', 'I would have thought that', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-8', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-8', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s022', 'what do you think', '[what do you think]', 'wʌɾəjəθɪŋk', '', '', 'preset', 62, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s022', 'stack', 22, '[what do you think]', 'wʌɾəjəθɪŋk', 'what do you think', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s022', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s022', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s023', 'I don''t think so', '[I don''t think so]', 'aɪdoʊnθɪŋksoʊ', '', '', 'preset', 63, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s023', 'stack', 23, '[I don''t think so]', 'aɪdoʊnθɪŋksoʊ', 'I don''t think so', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s023', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s024', 'by the way', '[by the way]', 'baɪðəweɪ', '', '', 'preset', 64, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s024', 'stack', 24, '[by the way]', 'baɪðəweɪ', 'by the way', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s024', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s025', 'at the same time', '[at the same time]', 'əɾðəseɪmtaɪm', '', '', 'preset', 65, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s025', 'stack', 25, '[at the same time]', 'əɾðəseɪmtaɪm', 'at the same time', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s025', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s025', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s026', 'the other day', '[the other day]', 'ðiʌðərdeɪ', '', '', 'preset', 66, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s026', 'stack', 26, '[the other day]', 'ðiʌðərdeɪ', 'the other day', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s026', 'linking', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-12', 'there have been a lot of', '[there have been a] [lot of]', 'ðərəvbɪnə lɑɾəv', '', '', 'preset', 67, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-12', 'stack', 27, '[there have been a] [lot of]', 'ðərəvbɪnə lɑɾəv', 'there have been a lot of', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-12', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-16', 'I''ll let you know if', '[I''ll let you know] [if]', 'aɪl lɛtʃə noʊ ɪf', '', '', 'preset', 68, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-16', 'stack', 28, '[I''ll let you know] [if]', 'aɪl lɛtʃə noʊ ɪf', 'I''ll let you know if', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-16', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s029', 'as far as I know', '[as far as I know]', 'əzfɑrəzaɪnoʊ', '', '', 'preset', 69, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s029', 'stack', 29, '[as far as I know]', 'əzfɑrəzaɪnoʊ', 'as far as I know', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s029', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s029', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s030', 'for the most part', '[for the most part]', 'fərðəmoʊspɑrt', '', '', 'preset', 70, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s030', 'stack', 30, '[for the most part]', 'fərðəmoʊspɑrt', 'for the most part', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s030', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s030', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-17', 'that''s what I''m talking about', '[that''s] [what I''m] [talking about]', 'ðæts wʌɾaɪm tɔːkɪŋəbaʊt', '', '', 'preset', 71, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-17', 'stack', 31, '[that''s] [what I''m] [talking about]', 'ðæts wʌɾaɪm tɔːkɪŋəbaʊt', 'that''s what I''m talking about', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-17', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-17', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s032', 'I actually think that', '[I actually] [think that]', 'aɪækʃli θɪŋkðət', '', '', 'preset', 72, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s032', 'stack', 32, '[I actually] [think that]', 'aɪækʃli θɪŋkðət', 'I actually think that', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s032', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s033', 'I''ll probably just', '[I''ll probably just]', 'aɪlprɑblidʒəs', '', '', 'preset', 73, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s033', 'stack', 33, '[I''ll probably just]', 'aɪlprɑblidʒəs', 'I''ll probably just', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s033', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s034', 'just because I', '[just because I]', 'dʒəskəzaɪ', '', '', 'preset', 74, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s034', 'stack', 34, '[just because I]', 'dʒəskəzaɪ', 'just because I', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s034', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s034', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s035', 'I just wanted to', '[I just] [wanted to]', 'aɪdʒəs wɑnɪɾə', '', '', 'preset', 75, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s035', 'stack', 35, '[I just] [wanted to]', 'aɪdʒəs wɑnɪɾə', 'I just wanted to', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s035', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s035', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-15', 'it used to be a lot', '[it used to be a] [lot]', 'ɪtjuːstəbiːə lɑt', '', '', 'preset', 76, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-15', 'stack', 36, '[it used to be a] [lot]', 'ɪtjuːstəbiːə lɑt', 'it used to be a lot', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-15', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-15', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s037', 'hold on a second', '[hold on a second]', 'hoʊldɑnəsɛkn̩', '', '', 'preset', 77, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s037', 'stack', 37, '[hold on a second]', 'hoʊldɑnəsɛkn̩', 'hold on a second', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s037', 'linking', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s037', 'syllabic_consonant', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s038', 'give me a second', '[give me a second]', 'gɪmiəsɛkn̩', '', '', 'preset', 78, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s038', 'stack', 38, '[give me a second]', 'gɪmiəsɛkn̩', 'give me a second', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s038', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s038', 'syllabic_consonant', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s039', 'how do you know', '[how do you know]', 'haʊdəjənoʊ', '', '', 'preset', 79, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s039', 'stack', 39, '[how do you know]', 'haʊdəjənoʊ', 'how do you know', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s039', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s039', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s040', 'when did you', '[when did you]', 'wɛndɪdʒə', '', '', 'preset', 80, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s040', 'stack', 40, '[when did you]', 'wɛndɪdʒə', 'when did you', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s040', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s041', 'what did I', '[what did I]', 'wʌɾɪɾaɪ', '', '', 'preset', 81, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s041', 'stack', 41, '[what did I]', 'wʌɾɪɾaɪ', 'what did I', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s041', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-19', 'what have you been up to', '[what have you] [been up to]', 'wʌɾəvjə bɪnʌptə', '', '', 'preset', 82, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-19', 'stack', 42, '[what have you] [been up to]', 'wʌɾəvjə bɪnʌptə', 'what have you been up to', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-19', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-19', 'coalescence', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-23', 'why don''t you just ask her', '[why don''t you] [just ask her]', 'waɪdoʊntʃə dʒəstæskər', '', '', 'preset', 83, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-23', 'stack', 43, '[why don''t you] [just ask her]', 'waɪdoʊntʃə dʒəstæskər', 'why don''t you just ask her', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-23', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-23', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-21', 'I couldn''t get a hold of him', '[I couldn''t] [get a hold of him]', 'aɪkʊdn̩ gɛɾəhoʊldəvɪm', '', '', 'preset', 84, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-21', 'stack', 44, '[I couldn''t] [get a hold of him]', 'aɪkʊdn̩ gɛɾəhoʊldəvɪm', 'I couldn''t get a hold of him', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-21', 'syllabic_consonant', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-21', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-21', 'elision', 2)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-25', 'he must have been the one', '[he must have been] [the one]', 'imʌstəbɪn ðəwʌn', '', '', 'preset', 85, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-25', 'stack', 45, '[he must have been] [the one]', 'imʌstəbɪn ðəwʌn', 'he must have been the one', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-25', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-25', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-22', 'there could have been a', '[there could have been a]', 'ðərkʊɾəbɪnə', '', '', 'preset', 86, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-22', 'stack', 46, '[there could have been a]', 'ðərkʊɾəbɪnə', 'there could have been a', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-22', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-22', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s047', 'tell them I''ll', '[tell them I''ll]', 'tɛləmaɪl', '', '', 'preset', 87, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s047', 'stack', 47, '[tell them I''ll]', 'tɛləmaɪl', 'tell them I''ll', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s047', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s048', 'it doesn''t matter', '[it doesn''t matter]', 'ɪtdʌzn̩mæɾər', '', '', 'preset', 88, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s048', 'stack', 48, '[it doesn''t matter]', 'ɪtdʌzn̩mæɾər', 'it doesn''t matter', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s048', 'syllabic_consonant', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s048', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s049', 'nothing to do with', '[nothing to do with]', 'nʌθɪntəduːwɪθ', '', '', 'preset', 89, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s049', 'stack', 49, '[nothing to do with]', 'nʌθɪntəduːwɪθ', 'nothing to do with', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s049', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s050', 'look at it', '[look at it]', 'lʊkəɾɪt', '', '', 'preset', 90, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s050', 'stack', 50, '[look at it]', 'lʊkəɾɪt', 'look at it', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s050', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s050', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s051', 'talk about it', '[talk about it]', 'tɔːkəbaʊɾɪt', '', '', 'preset', 91, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s051', 'stack', 51, '[talk about it]', 'tɔːkəbaʊɾɪt', 'talk about it', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s051', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s051', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s052', 'what about it', '[what about it]', 'wʌɾəbaʊɾɪt', '', '', 'preset', 92, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s052', 'stack', 52, '[what about it]', 'wʌɾəbaʊɾɪt', 'what about it', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s052', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s052', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s053', 'more or less', '[more or less]', 'mɔːrərlɛs', '', '', 'preset', 93, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s053', 'stack', 53, '[more or less]', 'mɔːrərlɛs', 'more or less', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s053', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s053', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s054', 'one or two', '[one or two]', 'wʌnərtuː', '', '', 'preset', 94, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s054', 'stack', 54, '[one or two]', 'wʌnərtuː', 'one or two', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s054', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s054', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s055', 'more than a', '[more than a]', 'mɔːrðənə', '', '', 'preset', 95, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s055', 'stack', 55, '[more than a]', 'mɔːrðənə', 'more than a', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s055', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s056', 'better than that', '[better than that]', 'bɛɾərðənðæt', '', '', 'preset', 96, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s056', 'stack', 56, '[better than that]', 'bɛɾərðənðæt', 'better than that', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s056', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s056', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s057', 'as long as you', '[as long as you]', 'əzlɔŋəzjə', '', '', 'preset', 97, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s057', 'stack', 57, '[as long as you]', 'əzlɔŋəzjə', 'as long as you', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s057', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s057', 'coalescence', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s058', 'as soon as I', '[as soon as I]', 'əzsuːnəzaɪ', '', '', 'preset', 98, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s058', 'stack', 58, '[as soon as I]', 'əzsuːnəzaɪ', 'as soon as I', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s058', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s058', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s059', 'quite a bit', '[quite a bit]', 'kwaɪɾəbɪt', '', '', 'preset', 99, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s059', 'stack', 59, '[quite a bit]', 'kwaɪɾəbɪt', 'quite a bit', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s059', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s060', 'a bit of a', '[a bit of a]', 'əbɪɾəvə', '', '', 'preset', 100, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s060', 'stack', 60, '[a bit of a]', 'əbɪɾəvə', 'a bit of a', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s060', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s060', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s061', 'a whole lot of', '[a whole lot of]', 'əhoʊllɑɾəv', '', '', 'preset', 101, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s061', 'stack', 61, '[a whole lot of]', 'əhoʊllɑɾəv', 'a whole lot of', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s061', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s062', 'that kind of thing', '[that kind of thing]', 'ðætkaɪndəθɪŋ', '', '', 'preset', 102, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s062', 'stack', 62, '[that kind of thing]', 'ðætkaɪndəθɪŋ', 'that kind of thing', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s062', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s063', 'this sort of thing', '[this sort of thing]', 'ðɪssɔːrɾəθɪŋ', '', '', 'preset', 103, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s063', 'stack', 63, '[this sort of thing]', 'ðɪssɔːrɾəθɪŋ', 'this sort of thing', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s063', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s063', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s064', 'the thing is', '[the thing is]', 'ðəθɪŋɪz', '', '', 'preset', 104, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s064', 'stack', 64, '[the thing is]', 'ðəθɪŋɪz', 'the thing is', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s064', 'linking', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s065', 'in the first place', '[in the first place]', 'ɪnðəfərsspleɪs', '', '', 'preset', 105, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s065', 'stack', 65, '[in the first place]', 'ɪnðəfərsspleɪs', 'in the first place', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s065', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s066', 'in a minute', '[in a minute]', 'ɪnəmɪnɪt', '', '', 'preset', 106, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s066', 'stack', 66, '[in a minute]', 'ɪnəmɪnɪt', 'in a minute', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s066', 'linking', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s066', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s067', 'for a minute', '[for a minute]', 'fərəmɪnɪt', '', '', 'preset', 107, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s067', 'stack', 67, '[for a minute]', 'fərəmɪnɪt', 'for a minute', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s067', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s067', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s068', 'thanks for the', '[thanks for the]', 'θæŋksfərðə', '', '', 'preset', 108, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s068', 'stack', 68, '[thanks for the]', 'θæŋksfərðə', 'thanks for the', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s068', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s069', 'put it in the', '[put it in the]', 'pʊɾɪɾɪnðə', '', '', 'preset', 109, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s069', 'stack', 69, '[put it in the]', 'pʊɾɪɾɪnðə', 'put it in the', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s069', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s069', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s070', 'I can see that', '[I can see that]', 'aɪkn̩siːðæt', '', '', 'preset', 110, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s070', 'stack', 70, '[I can see that]', 'aɪkn̩siːðæt', 'I can see that', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s070', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s070', 'syllabic_consonant', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s071', 'you can''t just', '[you can''t just]', 'jəkænʔdʒəs', '', '', 'preset', 111, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s071', 'stack', 71, '[you can''t just]', 'jəkænʔdʒəs', 'you can''t just', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s071', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s072', 'we''re not gonna', '[we''re not gonna]', 'wərnɑɾgənə', '', '', 'preset', 112, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s072', 'stack', 72, '[we''re not gonna]', 'wərnɑɾgənə', 'we''re not gonna', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s072', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s072', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s072', 'elision', 2)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s073', 'there you go', '[there you go]', 'ðɛrjəgoʊ', '', '', 'preset', 113, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s073', 'stack', 73, '[there you go]', 'ðɛrjəgoʊ', 'there you go', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s073', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s074', 'come and get it', '[come and get it]', 'kʌmənɡɛɾɪt', '', '', 'preset', 114, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s074', 'stack', 74, '[come and get it]', 'kʌmənɡɛɾɪt', 'come and get it', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s074', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s074', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s075', 'nice and easy', '[nice and easy]', 'naɪsəniːzi', '', '', 'preset', 115, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s075', 'stack', 75, '[nice and easy]', 'naɪsəniːzi', 'nice and easy', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s075', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s075', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s076', 'more and more', '[more and more]', 'mɔːrənmɔːr', '', '', 'preset', 116, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s076', 'stack', 76, '[more and more]', 'mɔːrənmɔːr', 'more and more', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s076', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s077', 'I said that I', '[I said that I]', 'aɪsɛdðəɾaɪ', '', '', 'preset', 117, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s077', 'stack', 77, '[I said that I]', 'aɪsɛdðəɾaɪ', 'I said that I', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s077', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s077', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s078', 'take a look at this', '[take a look at this]', 'teɪkəlʊkəɾðɪs', '', '', 'preset', 118, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s078', 'stack', 78, '[take a look at this]', 'teɪkəlʊkəɾðɪs', 'take a look at this', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s078', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s078', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s079', 'let me get this straight', '[let me] [get this straight]', 'lɛmiː gɛɾðɪsstreɪt', '', '', 'preset', 119, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s079', 'stack', 79, '[let me] [get this straight]', 'lɛmiː gɛɾðɪsstreɪt', 'let me get this straight', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s079', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s079', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s080', 'most of us', '[most of us]', 'moʊsəvəs', '', '', 'preset', 120, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s080', 'stack', 80, '[most of us]', 'moʊsəvəs', 'most of us', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s080', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s080', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-38', 'I think there''ll be a', '[I think] [there''ll be a]', 'aɪθɪŋk ðɛrl̩biə', '', '', 'preset', 121, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-38', 'stack', 81, '[I think] [there''ll be a]', 'aɪθɪŋk ðɛrl̩biə', 'I think there''ll be a', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-38', 'syllabic_consonant', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-38', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-39', 'if there''d been', '[if there''d been]', 'ɪfðərdbɪn', '', '', 'preset', 122, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-39', 'stack', 82, '[if there''d been]', 'ɪfðərdbɪn', 'if there''d been', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-39', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-43', 'that''s it, isn''t it', '[that''s it] [isn''t it]', 'ðætsɪt ɪnɪt', '', '', 'preset', 123, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-43', 'stack', 83, '[that''s it] [isn''t it]', 'ðætsɪt ɪnɪt', 'that''s it, isn''t it', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-43', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-43', 'syllabic_consonant', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-44', 'get out of it', '[get out of it]', 'gɛɾaʊɾəvɪt', '', '', 'preset', 124, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-44', 'stack', 84, '[get out of it]', 'gɛɾaʊɾəvɪt', 'get out of it', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-44', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-44', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-45', 'an hour and a half', '[an hour and a half]', 'ənaʊrənəhæf', '', '', 'preset', 125, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-45', 'stack', 85, '[an hour and a half]', 'ənaʊrənəhæf', 'an hour and a half', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-45', 'linking', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-45', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-46', 'it''s kind of a', '[it''s kind of a]', 'ɪtskaɪndəvə', '', '', 'preset', 126, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-46', 'stack', 86, '[it''s kind of a]', 'ɪtskaɪndəvə', 'it''s kind of a', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-46', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-47', 'not at all', '[not at all]', 'nɑɾəɾɔːl', '', '', 'preset', 127, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-47', 'stack', 87, '[not at all]', 'nɑɾəɾɔːl', 'not at all', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-47', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-47', 'linking', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-48', 'let me know what you', '[let me know] [what you]', 'lɛmiːnoʊ wʌtʃə', '', '', 'preset', 128, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-48', 'stack', 88, '[let me know] [what you]', 'lɛmiːnoʊ wʌtʃə', 'let me know what you', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-48', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-48', 'coalescence', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-32', 'could you give me a', '[could you] [give me a]', 'kʊdʒə gɪmiə', '', '', 'preset', 129, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-32', 'stack', 89, '[could you] [give me a]', 'kʊdʒə gɪmiə', 'could you give me a', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-32', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-32', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-33', 'what did he say', '[what did he say]', 'wʌɾɪɾiseɪ', '', '', 'preset', 130, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-33', 'stack', 90, '[what did he say]', 'wʌɾɪɾiseɪ', 'what did he say', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-33', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-33', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-34', 'how was he supposed to', '[how was he] [supposed to]', 'haʊwəzi spoʊstə', '', '', 'preset', 131, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-34', 'stack', 91, '[how was he] [supposed to]', 'haʊwəzi spoʊstə', 'how was he supposed to', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-34', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-34', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-35', 'just give ''em a', '[just give ''em a]', 'dʒəsgɪvəmə', '', '', 'preset', 132, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-35', 'stack', 92, '[just give ''em a]', 'dʒəsgɪvəmə', 'just give ''em a', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-35', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-36', 'I did it for her', '[I did it] [for her]', 'aɪdɪɾɪt fərər', '', '', 'preset', 133, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-36', 'stack', 93, '[I did it] [for her]', 'aɪdɪɾɪt fərər', 'I did it for her', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-36', 't_variation', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-36', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-36', 'reduction', 2)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-27', 'that''ll have to do for now', '[that''ll] [have to do] [for now]', 'ðæɾl̩ hæftəduː fərnaʊ', '', '', 'preset', 134, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-27', 'stack', 94, '[that''ll] [have to do] [for now]', 'ðæɾl̩ hæftəduː fərnaʊ', 'that''ll have to do for now', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-27', 'syllabic_consonant', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-27', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-27', 'reduction', 2)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-28', 'it wasn''t supposed to be', '[it wasn''t] [supposed to be]', 'ɪtwʌzn̩ spoʊstəbi', '', '', 'preset', 135, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-28', 'stack', 95, '[it wasn''t] [supposed to be]', 'ɪtwʌzn̩ spoʊstəbi', 'it wasn''t supposed to be', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-28', 'syllabic_consonant', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-28', 'elision', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('preset-30', 'what would you do if', '[what would you] [do if]', 'wʌwʊdʒə duːɪf', '', '', 'preset', 136, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('preset-30', 'stack', 96, '[what would you] [do if]', 'wʌwʊdʒə duːɪf', 'what would you do if', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-30', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('preset-30', 'reduction', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s097', 'in fact', '[in fact]', 'ɪnfækt', '', '', 'preset', 137, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s097', 'stack', 97, '[in fact]', 'ɪnfækt', 'in fact', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s097', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s098', 'up and down', '[up and down]', 'ʌpənˈdaʊn', '', '', 'preset', 138, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s098', 'stack', 98, '[up and down]', 'ʌpənˈdaʊn', 'up and down', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s098', 'elision', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s099', 'sooner or later', '[sooner or later]', 'suːnərərleɪɾər', '', '', 'preset', 139, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s099', 'stack', 99, '[sooner or later]', 'suːnərərleɪɾər', 'sooner or later', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s099', 'reduction', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s099', 't_variation', 1)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
--> statement-breakpoint
INSERT INTO phrases (id, text, pattern, ipa, translation, context, source_type, catalog_order, owner_id, status, created_at, updated_at)
VALUES ('s100', 'I told you so', '[I told you so]', 'aɪtoʊldʒəsoʊ', '', '', 'preset', 140, NULL, 'pick', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  text = excluded.text,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  source_type = excluded.source_type,
  catalog_order = excluded.catalog_order;
--> statement-breakpoint
INSERT INTO catalog_phrase_analysis (phrase_id, kind, rank, pattern, ipa, search_query, alternate_query, active)
VALUES ('s100', 'stack', 100, '[I told you so]', 'aɪtoʊldʒəsoʊ', 'I told you so', NULL, 1)
ON CONFLICT(phrase_id) DO UPDATE SET
  kind = excluded.kind,
  rank = excluded.rank,
  pattern = excluded.pattern,
  ipa = excluded.ipa,
  search_query = excluded.search_query,
  alternate_query = excluded.alternate_query,
  active = 1;
--> statement-breakpoint
INSERT INTO phrase_mechanisms (phrase_id, mechanism, display_order)
VALUES ('s100', 'coalescence', 0)
ON CONFLICT(phrase_id, mechanism) DO UPDATE SET display_order = excluded.display_order;
