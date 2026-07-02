import { ashby } from "./ashby.js";
import type { AtsScraper } from "./base.js";
import { greenhouse } from "./greenhouse.js";
import { lever } from "./lever.js";

export type { AtsScraper } from "./base.js";

export const atsScrapers: AtsScraper[] = [greenhouse, lever, ashby];
