import type { ApiProvider } from "./base.js";
import { remoteok } from "./remoteok.js";
import { remotive } from "./remotive.js";

export type { ApiProvider } from "./base.js";

export const apiProviders: ApiProvider[] = [remoteok, remotive];
