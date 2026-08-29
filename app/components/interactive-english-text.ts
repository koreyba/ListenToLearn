"use client";

import {
  createElement,
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  interactiveEnglishContext,
  readInteractiveSelection,
  segmentInteractiveEnglishText,
} from "../../lib/interactive-english-text.ts";

export type InteractiveEnglishTextProps = {
  text: string;
  maxSelectionCharacters?: number;
  onPhraseSelect?: (phrase: string, context: string) => void;
  onWordActivate?: (word: string, context: string) => void;
};

export function InteractiveEnglishText({
  text,
  maxSelectionCharacters = 500,
  onPhraseSelect,
  onWordActivate,
}: InteractiveEnglishTextProps) {
  function selectedPhrase(container: Node | null) {
    const selection = window.getSelection();
    const phrase = container
      ? readInteractiveSelection(container, selection, maxSelectionCharacters)
      : "";
    if (!container || !selection || !phrase) return null;

    const range = selection.getRangeAt(0);
    const prefix = range.cloneRange();
    prefix.selectNodeContents(container);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length;
    return { phrase, start, end: start + range.toString().length };
  }

  function reportSelection(
    event: ReactKeyboardEvent<HTMLSpanElement> | ReactMouseEvent<HTMLSpanElement>,
  ) {
    const selection = selectedPhrase(event.currentTarget);
    if (selection) {
      onPhraseSelect?.(
        selection.phrase,
        interactiveEnglishContext(text, selection.start, selection.end),
      );
    }
  }

  function reportWord(word: string, start: number, end: number) {
    onWordActivate?.(word, interactiveEnglishContext(text, start, end));
  }

  return createElement(
    "span",
    {
      className: "interactive-english-text",
      onKeyUp: reportSelection,
      onMouseUp: reportSelection,
    },
    segmentInteractiveEnglishText(text).map((segment) => segment.kind === "word"
      ? createElement("span", {
          "aria-label": `Translate word ${segment.text}`,
          "data-interactive-english-word": "",
          key: `${segment.start}:${segment.end}`,
          onClick: (event) => {
            if (!selectedPhrase(event.currentTarget.parentNode)) {
              reportWord(segment.text, segment.start, segment.end);
            }
          },
          onKeyDown: (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            reportWord(segment.text, segment.start, segment.end);
          },
          role: "button",
          tabIndex: 0,
        }, segment.text)
      : createElement(Fragment, { key: `${segment.start}:${segment.end}` }, segment.text)),
  );
}
