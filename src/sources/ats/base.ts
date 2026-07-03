import type { NewJob, Platform } from "../../schema.js";

export interface AtsScraper {
  platform: Platform;
  /** Fetch all open jobs for one company's board, identified by its ATS slug. */
  fetch(slug: string): Promise<NewJob[]>;
}
