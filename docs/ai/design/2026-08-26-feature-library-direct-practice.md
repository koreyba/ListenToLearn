---
phase: design
title: Library Direct Practice Design
description: Reuse the current Trainer URL contract without mutating phrase state
---

# Library Direct Practice Design

## Flow

```mermaid
flowchart LR
  Card[Library catalog card] -->|Practice| Open[openPhrase]
  Open --> URL[/trainer?phrase=...&phraseId=.../]
  URL --> Trainer[Existing Trainer playback]
  Card -->|Add to Learn| Status[Existing status mutation]
  Tabs[Practice status tabs] --> Form[Add your own]
  Form -->|Submit| ToLearn[Create with to_learn status]
  ToLearn --> Activate[Activate To Learn tab]
```

`PhraseWorkspace.openPhrase` already creates the canonical Trainer URL. Library reuses that function directly, keeping navigation separate from `changeStatus`.

The existing custom-phrase form moves from the Library-only branch to the Practice surface outside tab-specific list rendering. Its existing `to_learn` resolution remains the single destination, and a successful submit selects `To Learn` so the new item is immediately visible.

## Interaction hierarchy

- `Practice` is the primary blue action because it performs the immediate task.
- `Add to Learn` remains available as a quieter non-destructive save action.
- Practice-page progression and destructive `Remove` styles are unchanged.
- `Add your own` is part of Practice rather than Library and stays visible for all three status tabs.

## Constraints

- Phrase text remains sufficient for playback when an anonymous catalog ID is not present in guest storage.
- No client storage, account API, or D1 write occurs before navigation.
