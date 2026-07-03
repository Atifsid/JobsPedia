// Below this, a numeric timestamp is treated as unix seconds; at or above it, milliseconds.
// 1e12 ms is the year 2001 — no job-posting timestamp predates that, so the threshold
// never misclassifies real data while still separating 10-digit seconds from 13-digit ms.
const MS_THRESHOLD = 1e12;

/** Normalize a unix-seconds/ms timestamp or a date string into an ISO 8601 string. */
export function toIsoDate(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") {
    const ms = input < MS_THRESHOLD ? input * 1000 : input;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
