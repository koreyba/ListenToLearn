export function observeCanonicalMessages<T>(observed: T, next: T, busy: boolean) {
  const changed = !Object.is(observed, next);
  return {
    observed: next,
    apply: changed && !busy,
  };
}
