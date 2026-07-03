import type { NewJob, Platform } from "../../schema.js";

export interface AtsScraper {
  platform: Platform;
  /** Fetch all open jobs for one company's board, identified by its ATS slug. */
  fetch(slug: string): Promise<NewJob[]>;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
