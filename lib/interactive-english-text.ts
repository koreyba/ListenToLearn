export type InteractiveEnglishSegment = {
  kind: "word" | "text";
  text: string;
  start: number;
  end: number;
};

export function matchesInteractiveSelection<Selection extends { text: string; context: string }>(
  current: Selection | null,
  text: string,
  context: string,
): current is Selection {
  return current?.text === text && current.context === context;
}

const englishWordPattern = /[\p{Script=Latin}\p{M}]+(?:['’\-][\p{Script=Latin}\p{M}]+)*/gu;

export function segmentInteractiveEnglishText(source: string): InteractiveEnglishSegment[] {
  const segments: InteractiveEnglishSegment[] = [];
  let cursor = 0;
  for (const match of source.matchAll(englishWordPattern)) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ kind: "text", text: source.slice(cursor, start), start: cursor, end: start });
    }
    const end = start + match[0].length;
    segments.push({ kind: "word", text: match[0], start, end });
    cursor = end;
  }
  if (cursor < source.length) {
    segments.push({ kind: "text", text: source.slice(cursor), start: cursor, end: source.length });
  }
  return segments;
}

export function readInteractiveSelection(
  container: Node,
  selection: Selection | null,
  maxCharacters: number,
): string {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return "";
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return "";
  const selected = selection.toString().trim().replace(/\s+/gu, " ");
  return selected && [...selected].length <= maxCharacters ? selected : "";
}

export function interactiveEnglishContext(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  maxCharacters = 1_000,
): string {
  const start = Math.max(0, Math.min(selectionStart, source.length));
  const end = Math.max(start, Math.min(selectionEnd, source.length));
  const before = source.slice(0, start);
  const sentenceStart = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
    before.lastIndexOf("\n"),
  ) + 1;
  const after = source.slice(end);
  const nextBoundary = after.search(/[.!?\n]/u);
  const sentenceEnd = nextBoundary < 0 ? source.length : end + nextBoundary + 1;
  const sentence = source.slice(sentenceStart, sentenceEnd).trim();
  if (sentence && [...sentence].length <= maxCharacters) return sentence;

  const selected = [...source.slice(start, end)];
  if (selected.length >= maxCharacters) return selected.slice(0, maxCharacters).join("");
  const available = maxCharacters - selected.length;
  const beforeCharacters = [...source.slice(0, start)];
  const afterCharacters = [...source.slice(end)];
  let beforeCount = Math.min(beforeCharacters.length, Math.floor(available / 2));
  let afterCount = Math.min(afterCharacters.length, available - beforeCount);
  beforeCount = Math.min(beforeCharacters.length, available - afterCount);
  afterCount = Math.min(afterCharacters.length, available - beforeCount);
  return [
    ...beforeCharacters.slice(beforeCharacters.length - beforeCount),
    ...selected,
    ...afterCharacters.slice(0, afterCount),
  ].join("").trim();
}
