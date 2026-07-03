/** Map each record, dropping (and logging) any that fail instead of aborting the whole batch. */
export function mapSkipInvalid<T, J>(raw: T[], mapper: (item: T) => J, label: string): J[] {
  const out: J[] = [];
  for (const item of raw) {
    try {
      out.push(mapper(item));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${label}] skipped malformed record: ${msg}`);
    }
  }
  return out;
}
