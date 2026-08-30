export type PracticeSearchablePhrase = {
  text: string;
  translation: string;
  context: string;
  pattern: string;
  ipa: string;
};

export const PRACTICE_VIRTUALIZATION_THRESHOLD = 50;

export function shouldVirtualizePracticeList(itemCount: number): boolean {
  return Number.isFinite(itemCount) && itemCount > PRACTICE_VIRTUALIZATION_THRESHOLD;
}

function positiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function practiceVirtualRowCount(itemCount: number, columns = 2): number {
  const safeCount = Number.isFinite(itemCount) && itemCount > 0 ? Math.floor(itemCount) : 0;
  return Math.ceil(safeCount / positiveInteger(columns, 2));
}

export function practiceVirtualRow<T>(
  items: readonly T[],
  rowIndex: number,
  columns = 2,
): T[] {
  if (!Number.isInteger(rowIndex) || rowIndex < 0) return [];
  const safeColumns = positiveInteger(columns, 2);
  const start = rowIndex * safeColumns;
  if (start >= items.length) return [];
  return items.slice(start, start + safeColumns);
}

export function filterPracticePhrases<T extends PracticeSearchablePhrase>(
  phrases: readonly T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().normalize("NFKC").toLocaleLowerCase("en");
  if (!normalizedQuery) return Array.from(phrases);

  return phrases.filter((phrase) => [
    phrase.text,
    phrase.translation,
    phrase.context,
    phrase.pattern,
    phrase.ipa,
  ].some((value) => value.normalize("NFKC").toLocaleLowerCase("en").includes(normalizedQuery)));
}
