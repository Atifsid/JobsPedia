import { ashby } from "./ashby.js";
import type { AtsScraper } from "./base.js";
import { breezyhr } from "./breezyhr.js";
import { greenhouse } from "./greenhouse.js";
import { jobscore } from "./jobscore.js";
import { lever } from "./lever.js";
import { personio } from "./personio.js";
import { recruitee } from "./recruitee.js";
import { smartrecruiters } from "./smartrecruiters.js";
import { workable } from "./workable.js";

export type { AtsScraper } from "./base.js";

export const atsScrapers: AtsScraper[] = [
  greenhouse,
  lever,
  ashby,
  workable,
  breezyhr,
  jobscore,
  personio,
  recruitee,
  smartrecruiters,
];
