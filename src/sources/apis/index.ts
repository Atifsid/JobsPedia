import type { ApiProvider } from "./base.js";
import { adzuna } from "./adzuna.js";
import { himalayas } from "./himalayas.js";
import { remoteok } from "./remoteok.js";
import { remotejobsorg } from "./remotejobsorg.js";
import { remotive } from "./remotive.js";
import { themuse } from "./themuse.js";

export type { ApiProvider } from "./base.js";

export const apiProviders: ApiProvider[] = [
  remoteok,
  remotive,
  themuse,
  remotejobsorg,
  himalayas,
  adzuna,
];
