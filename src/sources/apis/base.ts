import type { NewJob, Platform } from "../../schema.js";

export interface ApiProvider {
  platform: Platform;
  /** Fetch every available job from this API. No per-company scoping — these APIs span many companies in one call. */
  fetch(): Promise<NewJob[]>;
}
