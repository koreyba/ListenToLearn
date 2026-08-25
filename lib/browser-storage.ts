export type BrowserStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function readMigratedStorage(
  storage: BrowserStorage,
  currentKey: string,
  legacyKeys: readonly string[],
) {
  const currentValue = storage.getItem(currentKey);
  if (currentValue !== null) return currentValue;

  for (const legacyKey of legacyKeys) {
    const legacyValue = storage.getItem(legacyKey);
    if (legacyValue === null) continue;
    storage.setItem(currentKey, legacyValue);
    return legacyValue;
  }

  return null;
}

export function writeMigratedStorage(
  storage: BrowserStorage,
  currentKey: string,
  legacyKeys: readonly string[],
  value: string,
) {
  storage.setItem(currentKey, value);
  for (const legacyKey of legacyKeys) storage.setItem(legacyKey, value);
}

export function removeMigratedStorage(
  storage: BrowserStorage,
  currentKey: string,
  legacyKeys: readonly string[],
) {
  storage.removeItem(currentKey);
  for (const legacyKey of legacyKeys) storage.removeItem(legacyKey);
}
