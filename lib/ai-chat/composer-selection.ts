export type ComposerSelection = {
  start: number;
  end: number;
  direction: "forward" | "backward" | "none";
};

export function readComposerSelection(input: HTMLTextAreaElement | null): ComposerSelection | null {
  if (!input) return null;
  return {
    start: input.selectionStart,
    end: input.selectionEnd,
    direction: input.selectionDirection,
  };
}

export function restoreComposerSelection(
  input: HTMLTextAreaElement | null,
  selection: ComposerSelection | null,
) {
  if (!input) return;
  const fallback = input.value.length;
  const start = Math.min(selection?.start ?? fallback, fallback);
  const end = Math.min(selection?.end ?? fallback, fallback);
  input.focus();
  input.setSelectionRange(start, end, selection?.direction || "none");
}
