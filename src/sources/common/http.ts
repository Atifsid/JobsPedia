const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    url: string,
  ) {
    super(`GET ${url} -> HTTP ${status}`);
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) return RETRYABLE_STATUS.has(err.status);
  return true; // network errors (fetch throwing a TypeError, timeouts, etc.)
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS || !isRetryable(err)) throw err;
      const backoff = BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(backoff + Math.random() * BASE_DELAY_MS);
    }
  }
  throw lastErr;
}

export async function fetchJson<T>(url: string): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new HttpError(res.status, url);
    return (await res.json()) as T;
  });
}

export async function fetchText(url: string): Promise<string> {
  return withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new HttpError(res.status, url);
    return await res.text();
  });
}
