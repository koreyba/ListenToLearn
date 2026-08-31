"use client";

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  readComposerSelection,
  restoreComposerSelection,
  type ComposerSelection,
} from "@/lib/ai-chat/composer-selection";

type AiChatComposerProps = {
  cancelling: boolean;
  chatId: string;
  draft: string;
  generationConfigured: boolean;
  onDraftChange: (value: string) => void;
  onExpand: () => void;
  onRetryRecoverable: () => void;
  onSend: () => void | Promise<void>;
  onStop: () => void;
  showRecoverableOutbound: boolean;
  showRetryFailure: boolean;
  turnBusy: boolean;
  turnControlError: string;
  turnRecoveryNotice: string;
};

export function AiChatComposer({
  cancelling,
  chatId,
  draft,
  generationConfigured,
  onDraftChange,
  onExpand,
  onRetryRecoverable,
  onSend,
  onStop,
  showRecoverableOutbound,
  showRetryFailure,
  turnBusy,
  turnControlError,
  turnRecoveryNotice,
}: AiChatComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const compactComposer = useRef<HTMLTextAreaElement | null>(null);
  const expandedComposer = useRef<HTMLTextAreaElement | null>(null);
  const composerSelection = useRef<ComposerSelection | null>(null);
  const composerHasExpanded = useRef(false);
  const composerDialog = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const input = compactComposer.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.max(48, Math.min(input.scrollHeight, 112))}px`;
  }, [draft]);

  useEffect(() => {
    if (!expanded) {
      if (!composerHasExpanded.current) return;
      const frame = window.requestAnimationFrame(() => {
        restoreComposerSelection(compactComposer.current, composerSelection.current);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    composerHasExpanded.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      restoreComposerSelection(expandedComposer.current, composerSelection.current);
    });

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        composerSelection.current = readComposerSelection(expandedComposer.current);
        setExpanded(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = composerDialog.current;
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSend();
  }

  function submitExpanded(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || turnBusy || !generationConfigured) return;
    composerSelection.current = readComposerSelection(expandedComposer.current);
    setExpanded(false);
    void onSend();
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter"
      || event.shiftKey
      || event.nativeEvent.isComposing
      || window.matchMedia("(pointer: coarse)").matches
    ) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function handleExpandedComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter"
      || (!event.metaKey && !event.ctrlKey)
      || event.nativeEvent.isComposing
    ) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <>
      <div className="ai-chat-composer-region">
        {!generationConfigured && (
          <p className="ai-chat-inline-error" role="status">AI generation is not configured on the server.</p>
        )}
        {showRetryFailure && (
          <p className="ai-chat-inline-error" role="alert">The response failed. Retry it below.</p>
        )}
        {turnControlError && <p className="ai-chat-inline-error" role="alert">{turnControlError}</p>}
        {turnRecoveryNotice && <p className="ai-chat-inline-notice" role="status">{turnRecoveryNotice}</p>}
        {showRecoverableOutbound && (
          <div className="ai-chat-outbound-recovery" role="alert">
            <span>Your previous message is available to retry safely. Your current draft is unchanged.</span>
            <button
              disabled={turnBusy || !generationConfigured}
              onClick={onRetryRecoverable}
              type="button"
            >Retry message</button>
          </div>
        )}
        <form className="ai-chat-composer" onSubmit={submit}>
          <label className="ai-chat-visually-hidden" htmlFor={`ai-chat-message-${chatId}`}>
            Your practice request
          </label>
          <div className={`ai-chat-composer-field ${draft ? "has-draft" : ""}`}>
            <textarea
              disabled={!generationConfigured}
              id={`ai-chat-message-${chatId}`}
              maxLength={4_000}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Message Unmumble…"
              ref={compactComposer}
              rows={1}
              value={draft}
            />
            {draft && (
              <button
                aria-expanded={expanded}
                aria-haspopup="dialog"
                aria-label="Expand composer"
                className="ai-chat-composer-expand"
                onClick={() => {
                  composerSelection.current = readComposerSelection(compactComposer.current);
                  onExpand();
                  setExpanded(true);
                }}
                type="button"
              >
                <span aria-hidden="true">⤢</span>
              </button>
            )}
          </div>
          {turnBusy ? (
            <button
              aria-busy={cancelling}
              aria-label={cancelling ? "Stopping response" : "Stop response"}
              className="ai-chat-stop"
              disabled={cancelling}
              onClick={onStop}
              type="button"
            >
              <span aria-hidden="true">{cancelling ? "…" : "■"}</span>
            </button>
          ) : (
            <button
              aria-label="Send message"
              className="ai-chat-send"
              disabled={!draft.trim() || !generationConfigured}
              type="submit"
            >
              <span aria-hidden="true">↑</span>
            </button>
          )}
        </form>
        <p className="ai-chat-composer-hint">Enter to send · Shift+Enter for a new line</p>
      </div>

      {expanded && (
        <div
          aria-labelledby={`ai-chat-composer-dialog-title-${chatId}`}
          aria-modal="true"
          className="ai-chat-composer-dialog"
          ref={composerDialog}
          role="dialog"
        >
          <header>
            <div>
              <span>AI vocabulary practice</span>
              <h2 id={`ai-chat-composer-dialog-title-${chatId}`}>Compose message</h2>
            </div>
            <button
              aria-label="Close expanded composer"
              onClick={() => {
                composerSelection.current = readComposerSelection(expandedComposer.current);
                setExpanded(false);
              }}
              type="button"
            >×</button>
          </header>
          <form className="ai-chat-composer-dialog-editor" onSubmit={submitExpanded}>
            <label className="ai-chat-visually-hidden" htmlFor={`ai-chat-expanded-message-${chatId}`}>
              Expanded practice request
            </label>
            <textarea
              id={`ai-chat-expanded-message-${chatId}`}
              maxLength={4_000}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={handleExpandedComposerKeyDown}
              placeholder="Ask for an example, change the context, or write a longer answer…"
              ref={expandedComposer}
              value={draft}
            />
            <footer>
              <span>{draft.length.toLocaleString()} / 4,000</span>
              <span>⌘/Ctrl+Enter to send</span>
              <button disabled={!draft.trim() || turnBusy || !generationConfigured} type="submit">
                Send message
                <span aria-hidden="true">↑</span>
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
