ALTER TABLE ai_chat_assistant_attempts ADD COLUMN terminal_json text CHECK (
  terminal_json IS NULL
  OR (json_valid(terminal_json) AND length(terminal_json) <= 2048)
);
