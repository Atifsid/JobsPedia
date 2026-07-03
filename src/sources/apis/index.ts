import type { ApiProvider } from "./base.js";
import { remoteok } from "./remoteok.js";

export type { ApiProvider } from "./base.js";

export const apiProviders: ApiProvider[] = [remoteok];
