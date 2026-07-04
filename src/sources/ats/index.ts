import { ashby } from "./ashby.js";
import { bamboohr } from "./bamboohr.js";
import type { AtsScraper } from "./base.js";
import { breezyhr } from "./breezyhr.js";
import { comeet } from "./comeet.js";
import { eightfold } from "./eightfold.js";
import { greenhouse } from "./greenhouse.js";
import { jobscore } from "./jobscore.js";
import { jobvite } from "./jobvite.js";
import { lever } from "./lever.js";
import { oracleRecruitingCloud } from "./oracle_recruiting_cloud.js";
import { personio } from "./personio.js";
import { pinpoint } from "./pinpoint.js";
import { recruitee } from "./recruitee.js";
import { rippling } from "./rippling.js";
import { sapSuccessfactors } from "./sap_successfactors.js";
import { smartrecruiters } from "./smartrecruiters.js";
import { teamtailor } from "./teamtailor.js";
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
  comeet,
  bamboohr,
  teamtailor,
  pinpoint,
  rippling,
  oracleRecruitingCloud,
  sapSuccessfactors,
  eightfold,
  jobvite,
];
