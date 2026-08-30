"use client";

import { useId, useState } from "react";

export type AiWriteProposalOperation =
  | "add_vocabulary_entries"
  | "add_vocabulary_meaning"
  | "update_vocabulary_meaning"
  | "set_vocabulary_category";

export type AiWriteProposalStatus =
  | "pending"
  | "busy"
  | "confirmed"
  | "cancelled"
  | "failed";

export type AiWriteProposalItem = Readonly<{
  id: string;
  text: string;
  translation?: string;
  context?: string;
  previousTranslation?: string;
  fromCategory?: string;
  toCategory?: string;
}>;

export type AiWriteProposalProps = Readonly<{
  proposalId: string;
  operation: AiWriteProposalOperation;
  items: readonly AiWriteProposalItem[];
  status: AiWriteProposalStatus;
  result?: unknown;
  errorMessage?: string;
  collapsedItemCount?: number;
  onConfirm?: (proposalId: string) => void;
  onCancel?: (proposalId: string) => void;
}>;

const actionStyle = { minHeight: 44 } as const;

function entryCountLabel(count: number) {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}

function proposalTitle(operation: AiWriteProposalOperation) {
  if (operation === "add_vocabulary_meaning") return "Add meaning";
  if (operation === "update_vocabulary_meaning") return "Update meaning";
  if (operation === "set_vocabulary_category") return "Change learning status";
  return "Add to vocabulary";
}

function proposalStatusMessage(
  operation: AiWriteProposalOperation,
  status: AiWriteProposalStatus,
  count: number,
  errorMessage: string | undefined,
  result: unknown,
) {
  const entries = entryCountLabel(count);
  if (status === "busy") return "Applying change…";
  if (status === "confirmed") {
    if (operation !== "add_vocabulary_entries") return "Vocabulary updated.";
    const resultEntries = result && typeof result === "object" && !Array.isArray(result)
      ? (result as { entries?: unknown }).entries
      : null;
    if (Array.isArray(resultEntries)) {
      const added = resultEntries.filter((entry) => (
        entry && typeof entry === "object" && (entry as { state?: unknown }).state === "added"
      )).length;
      const saved = resultEntries.filter((entry) => (
        entry && typeof entry === "object"
        && (entry as { state?: unknown }).state === "already_saved"
      )).length;
      if (added > 0 && saved > 0) {
        return `${entryCountLabel(added)} added · ${saved} already saved.`;
      }
      if (added > 0) return `${entryCountLabel(added)} added to your vocabulary.`;
      if (saved > 0) return `${entryCountLabel(saved)} already saved.`;
    }
    return "Vocabulary update confirmed.";
  }
  if (status === "cancelled") {
    return "Proposal cancelled. No vocabulary changes were made.";
  }
  if (status === "failed") {
    return errorMessage?.trim() || "The proposal could not be completed.";
  }
  if (operation === "add_vocabulary_meaning") {
    return "Review this meaning before adding it.";
  }
  if (operation === "update_vocabulary_meaning") return "Review this meaning change.";
  if (operation === "set_vocabulary_category") {
    return "Review this learning-status change.";
  }
  return `Review ${entries} before adding ${count === 1 ? "it" : "them"}.`;
}

export function AiChatWriteProposal({
  proposalId,
  collapsedItemCount = 3,
  errorMessage,
  items,
  operation,
  onCancel,
  onConfirm,
  result,
  status,
}: AiWriteProposalProps) {
  const titleId = useId();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const count = items.length;
  const previewCount = Math.max(1, Math.floor(collapsedItemCount));
  const expandable = count > previewCount;
  const visibleItems = expandable && !expanded
    ? items.slice(0, previewCount)
    : items;
  const busy = status === "busy";
  const showActions = status === "pending" || busy;
  const statusRole = status === "failed" ? "alert" : "status";

  return (
    <section
      aria-busy={busy}
      aria-labelledby={titleId}
      className="ai-chat-write-proposal"
      data-ai-write-proposal={proposalId}
      data-status={status}
    >
      <header className="ai-chat-write-proposal-heading">
        <div>
          <h3 id={titleId}>{proposalTitle(operation)}</h3>
          <p className="ai-chat-write-proposal-count">{entryCountLabel(count)}</p>
        </div>
      </header>

      <ol className="ai-chat-write-proposal-items" id={listId}>
        {visibleItems.map((item) => (
          <li key={item.id}>
            <strong>{item.text}</strong>
            {item.previousTranslation && item.translation ? (
              <span>{item.previousTranslation} → {item.translation}</span>
            ) : item.translation ? <span>{item.translation}</span> : null}
            {item.fromCategory && item.toCategory && (
              <span>{item.fromCategory} → {item.toCategory}</span>
            )}
          </li>
        ))}
      </ol>

      {expandable && (
        <button
          aria-controls={listId}
          aria-expanded={expanded}
          className="ai-chat-write-proposal-toggle"
          onClick={() => setExpanded((value) => !value)}
          style={actionStyle}
          type="button"
        >{expanded ? "Show fewer" : `Show ${count - previewCount} more`}</button>
      )}

      <p
        aria-live={statusRole === "alert" ? "assertive" : "polite"}
        role={statusRole}
      >
        {proposalStatusMessage(operation, status, count, errorMessage, result)}
      </p>

      {showActions && errorMessage && (
        <p aria-live="assertive" className="ai-chat-write-proposal-error" role="alert">
          {errorMessage}
        </p>
      )}

      {showActions && (
        <div className="ai-chat-write-proposal-actions">
          <button
            disabled={busy}
            onClick={() => onCancel?.(proposalId)}
            style={actionStyle}
            type="button"
          >Cancel</button>
          <button
            disabled={busy}
            onClick={() => onConfirm?.(proposalId)}
            style={actionStyle}
            type="button"
          >{busy ? "Applying…" : "Confirm"}</button>
        </div>
      )}
    </section>
  );
}
