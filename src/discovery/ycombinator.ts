import { fetchJson, fetchText } from "../sources/common/http.js";

export interface YcCompany {
  name: string;
  website: string;
  industries: string[];
  tags: string[];
  batch: string;
}

interface AlgoliaCreds {
  appId: string;
  apiKey: string;
}

interface AlgoliaHit {
  name: string;
  website?: string | null;
  industries?: string[] | null;
  tags?: string[] | null;
  batch?: string | null;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
  page: number;
  nbPages: number;
}

const ALGOLIA_OPTS_RE = /window\.AlgoliaOpts\s*=\s*(\{[^;]+\})\s*;/;
const YC_COMPANIES_URL = "https://www.ycombinator.com/companies";
const INDEX = "YCCompany_production";
const HITS_PER_PAGE = 1000;

/** YC embeds a public, search-only Algolia key directly in the companies page HTML. */
async function fetchAlgoliaCreds(): Promise<AlgoliaCreds> {
  const html = await fetchText(YC_COMPANIES_URL);
  const match = html.match(ALGOLIA_OPTS_RE);
  if (!match) {
    throw new Error("could not find window.AlgoliaOpts on the YC companies page — page structure may have changed");
  }
  const opts = JSON.parse(match[1]) as { app: string; key: string };
  return { appId: opts.app, apiKey: opts.key };
}

async function queryPage(creds: AlgoliaCreds, page: number): Promise<AlgoliaResponse> {
  return fetchJson<AlgoliaResponse>(`https://${creds.appId}-dsn.algolia.net/1/indexes/${INDEX}/query`, {
    method: "POST",
    headers: {
      "X-Algolia-Application-Id": creds.appId,
      "X-Algolia-API-Key": creds.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "", filters: "isHiring:true", hitsPerPage: HITS_PER_PAGE, page }),
  });
}

function toCompany(hit: AlgoliaHit): YcCompany {
  return {
    name: hit.name,
    website: hit.website ?? "",
    industries: hit.industries ?? [],
    tags: hit.tags ?? [],
    batch: hit.batch ?? "",
  };
}

/** Every YC company currently marked `isHiring: true`, paginated to completion. */
export async function fetchYcCompanies(): Promise<YcCompany[]> {
  const creds = await fetchAlgoliaCreds();
  const companies: YcCompany[] = [];
  let page = 0;
  let nbPages = 1;
  do {
    const data = await queryPage(creds, page);
    nbPages = data.nbPages;
    for (const hit of data.hits) {
      const company = toCompany(hit);
      if (company.website) companies.push(company);
    }
    page++;
  } while (page < nbPages);
  return companies;
}
