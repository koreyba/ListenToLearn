"use client";

import {
  createElement,
  Fragment,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  interactiveEnglishContext,
  readInteractiveSelection,
  segmentInteractiveEnglishText,
} from "../../lib/interactive-english-text.ts";

export type InteractiveEnglishTextProps = {
  text: string;
  markdown?: boolean;
  maxSelectionCharacters?: number;
  onPhraseSelect?: (
    phrase: string,
    context: string,
    details: InteractiveTextSelectionDetails,
  ) => void;
  onWordActivate?: (
    word: string,
    context: string,
    details: InteractiveTextSelectionDetails,
  ) => void;
};

export type InteractiveTextSelectionAnchor = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type InteractiveTextSelectionDetails = {
  start: number;
  end: number;
  anchor: InteractiveTextSelectionAnchor;
};

const LONG_PRESS_MILLISECONDS = 450;
const SYNTHETIC_CLICK_SUPPRESSION_MILLISECONDS = 1_000;

type MarkdownAstNode = {
  type: string;
  value?: string;
  children?: MarkdownAstNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string | number>;
  };
};

type InteractiveMarkdownState = { text: string };

function annotateInteractiveMarkdown(state: InteractiveMarkdownState) {
  return (tree: MarkdownAstNode) => {
    state.text = "";
    function visit(node: MarkdownAstNode) {
      if (node.type === "html") return;
      if (node.type === "text") {
        const value = node.value || "";
        const start = state.text.length;
        state.text += value;
        node.type = "interactiveText";
        delete node.value;
        node.children = [{ type: "text", value }];
        node.data = {
          hName: "span",
          hProperties: { "data-interactive-markdown-start": start },
        };
        return;
      }
      if (node.type === "inlineCode" || node.type === "code") {
        const value = node.value || "";
        const start = state.text.length;
        state.text += value;
        node.data = {
          ...node.data,
          hProperties: {
            ...node.data?.hProperties,
            "data-interactive-markdown-start": start,
          },
        };
        return;
      }
      if (node.type === "break") {
        state.text += "\n";
        return;
      }
      for (const child of node.children || []) visit(child);
    }
    visit(tree);
  };
}

export function InteractiveEnglishText({
  text,
  markdown = false,
  maxSelectionCharacters = 500,
  onPhraseSelect,
  onWordActivate,
}: InteractiveEnglishTextProps) {
  const markdownState: InteractiveMarkdownState = { text: "" };
  const contentText = () => markdown ? markdownState.text : text;

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
    const rect = typeof range.getBoundingClientRect === "function"
      ? range.getBoundingClientRect()
      : (container as Element).getBoundingClientRect?.();
    return {
      phrase,
      start,
      end: start + range.toString().length,
      anchor: {
        left: rect?.left || 0,
        top: rect?.top || 0,
        right: rect?.right || 0,
        bottom: rect?.bottom || 0,
      },
    };
  }

  function reportSelection(container: HTMLElement) {
    const selection = selectedPhrase(container);
    if (!selection) return false;
    onPhraseSelect?.(
      selection.phrase,
      interactiveEnglishContext(contentText(), selection.start, selection.end),
      { start: selection.start, end: selection.end, anchor: selection.anchor },
    );
    return true;
  }

  function selectionFingerprint(container: HTMLElement) {
    const selection = selectedPhrase(container);
    return selection ? `${selection.start}:${selection.end}:${selection.phrase}` : "";
  }

  function reportChangedSelection(container: HTMLElement, previousFingerprint: string) {
    const currentFingerprint = selectionFingerprint(container);
    return currentFingerprint !== previousFingerprint && reportSelection(container);
  }

  function reportWord(word: string, start: number, end: number, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    onWordActivate?.(
      word,
      interactiveEnglishContext(contentText(), start, end),
      {
        start,
        end,
        anchor: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      },
    );
  }

  function moveWordFocus(event: ReactKeyboardEvent<HTMLSpanElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return false;
    const words = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
      "[data-interactive-english-word]",
    ) || [])];
    const currentIndex = words.indexOf(event.currentTarget);
    if (currentIndex < 0 || words.length === 0) return false;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? words.length - 1
        : Math.max(0, Math.min(
            words.length - 1,
            currentIndex + (event.key === "ArrowRight" ? 1 : -1),
          ));
    event.preventDefault();
    event.currentTarget.tabIndex = -1;
    words[nextIndex].tabIndex = 0;
    words[nextIndex].focus();
    return true;
  }

  function suppressWordClick(container: HTMLElement, eventTime: number) {
    container.dataset.interactiveSuppressClickUntil = String(
      eventTime + SYNTHETIC_CLICK_SUPPRESSION_MILLISECONDS,
    );
  }

  function finishTouch(container: HTMLElement, eventTime: number) {
    const startedAtValue = container.dataset.interactiveTouchStartedAt;
    const startedAt = Number(startedAtValue || 0);
    const previousFingerprint = container.dataset.interactiveTouchSelection || "";
    const held = startedAtValue !== undefined
      && eventTime - startedAt >= LONG_PRESS_MILLISECONDS;
    delete container.dataset.interactiveTouchStartedAt;
    delete container.dataset.interactiveTouchSelection;
    if (held) suppressWordClick(container, eventTime);
    if (reportChangedSelection(container, previousFingerprint)) {
      suppressWordClick(container, eventTime);
      return;
    }
    window.requestAnimationFrame(() => {
      if (reportChangedSelection(container, previousFingerprint)) {
        suppressWordClick(container, eventTime);
      }
    });
  }

  function finishMouse(container: HTMLElement, eventTime: number) {
    const previousFingerprint = container.dataset.interactiveMouseSelection || "";
    delete container.dataset.interactiveMouseSelection;
    if (reportChangedSelection(container, previousFingerprint)) {
      suppressWordClick(container, eventTime);
    }
  }

  let wordIndex = 0;

  function interactiveText(value: string, baseOffset = 0): ReactNode {
    if (!onWordActivate) return value;
    return segmentInteractiveEnglishText(value).map((segment) => {
      if (segment.kind !== "word") {
        return createElement(Fragment, { key: `${baseOffset + segment.start}:${baseOffset + segment.end}` }, segment.text);
      }
      const currentWordIndex = wordIndex;
      wordIndex += 1;
      const start = baseOffset + segment.start;
      const end = baseOffset + segment.end;
      return createElement("span", {
        "aria-label": `Actions for word ${segment.text}`,
        "data-interactive-english-word": "",
        key: `${start}:${end}`,
        onClick: (event: ReactMouseEvent<HTMLSpanElement>) => {
          const container = event.currentTarget.closest<HTMLElement>(".interactive-english-text");
          const suppressUntil = Number(container?.dataset.interactiveSuppressClickUntil || 0);
          if (event.timeStamp < suppressUntil) return;
          window.getSelection()?.removeAllRanges();
          reportWord(segment.text, start, end, event.currentTarget);
        },
        onKeyDown: (event: ReactKeyboardEvent<HTMLSpanElement>) => {
          if (moveWordFocus(event)) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          window.getSelection()?.removeAllRanges();
          reportWord(segment.text, start, end, event.currentTarget);
        },
        role: "button",
        tabIndex: currentWordIndex === 0 ? 0 : -1,
      }, segment.text);
    });
  }

  function markdownLeaf(
    tag: "span" | "code",
    props: Record<string, unknown>,
    children: ReactNode,
  ) {
    const rawStart = props["data-interactive-markdown-start"];
    const start = typeof rawStart === "number" ? rawStart : Number(rawStart);
    const safeProps = { ...props };
    delete safeProps["data-interactive-markdown-start"];
    const value = typeof children === "string" ? children : null;
    return createElement(
      tag,
      safeProps,
      value !== null && Number.isSafeInteger(start)
        ? interactiveText(value, start)
        : children,
    );
  }

  const markdownComponents: Components = {
    span: ({ node, children, ...props }) => {
      void node;
      return markdownLeaf("span", props, children);
    },
    code: ({ node, children, ...props }) => {
      void node;
      return markdownLeaf("code", props, children);
    },
  };

  const surfaceChildren = markdown
    ? createElement(Markdown, {
        components: markdownComponents,
        remarkPlugins: [remarkGfm, [annotateInteractiveMarkdown, markdownState]],
        skipHtml: true,
      }, text)
    : interactiveText(text);

  return createElement(
    markdown ? "div" : "span",
    {
      className: "interactive-english-text",
      onKeyUp: (event: ReactKeyboardEvent<HTMLElement>) => reportSelection(event.currentTarget),
      onMouseDown: (event: ReactMouseEvent<HTMLElement>) => {
        event.currentTarget.dataset.interactiveMouseSelection = selectionFingerprint(event.currentTarget);
        event.currentTarget.dataset.interactiveSuppressClickUntil = String(event.timeStamp);
      },
      onMouseUp: (event: ReactMouseEvent<HTMLElement>) => {
        finishMouse(event.currentTarget, event.timeStamp);
      },
      onTouchCancel: (event: { currentTarget: HTMLElement }) => {
        delete event.currentTarget.dataset.interactiveTouchStartedAt;
        delete event.currentTarget.dataset.interactiveTouchSelection;
      },
      onTouchEnd: (event: { currentTarget: HTMLElement; timeStamp: number }) => {
        finishTouch(event.currentTarget, event.timeStamp);
      },
      onTouchStart: (event: { currentTarget: HTMLElement; timeStamp: number }) => {
        event.currentTarget.dataset.interactiveTouchStartedAt = String(event.timeStamp);
        event.currentTarget.dataset.interactiveTouchSelection = selectionFingerprint(event.currentTarget);
        event.currentTarget.dataset.interactiveSuppressClickUntil = String(event.timeStamp);
      },
    },
    surfaceChildren,
  );
}
