# jobspedia

Merges three job-data sources into one local dataset and serves it over a small local
API:

1. **ATS-direct** sources (Greenhouse, Lever, Ashby, SmartRecruiters, Workable,
   Recruitee, Comeet, BreezyHR, JobScore, Personio, BambooHR) via thin hand-written
   fetchers that hit each platform's public JSON/XML API.
2. **API providers** (RemoteOK, Remotive, The Muse, RemoteJobs.org, Himalayas, Adzuna)
   that return their entire board in one call.
3. **Aggregator boards** (LinkedIn, Indeed, Glassdoor, …) via the `jobspy-js` npm
   package.

Both are normalized into one schema, deduplicated, written to a local SQLite file,
and exposed via `POST /jobs/search`. See `CLAUDE.md` for the full architecture,
schema, and conventions this project follows.

## Quick start

```bash
npm install
npm run crawl -- --only ats   # populate data/jobs.db from live ATS + API sources
npm run serve                 # start the read API on :8080
```

```bash
curl -X POST http://localhost:8080/jobs/search \
  -H 'content-type: application/json' \
  -d '{"title":"engineer","limit":5}'
```

## Commands

```bash
npm run crawl                 # ATS + API crawl (same as --only ats; aggregators off by default)
npm run crawl -- --only ats   # same as bare npm run crawl — ATS + API providers
npm run crawl -- --only apis  # API-only crawl (all 6 API providers)
npm run crawl -- --only aggregators   # jobspy-js crawl (LinkedIn/Indeed/Glassdoor)
npm run crawl -- --scope <name>       # filter ATS seeds by YC industry/tag before crawling
npm run discover-seeds                # grow src/seeds/*.json from YC's company directory
npm run discover-seeds -- --limit 50  # cap how many YC companies get probed this run
npm run serve                 # start the read API on :8080
npm run typecheck             # tsc --noEmit
npm test                      # vitest
```

## Assumptions

Ambiguities encountered while building this from the `CLAUDE.md` spec, and the
choices made:

- **Default crawl includes ATS + APIs (all 6 providers), but aggregators stay off.**
  Plain `npm run crawl` and `npm run crawl -- --only ats` behave identically — both run ATS
  and API providers together. Aggregators (LinkedIn/Indeed/Glassdoor) remain opt-in only via
  `npm run crawl -- --only aggregators`.
- **`seniority` is a structured column, but still title-derived under the hood.**
  The old `experience` filter was a substring match against the job `title` with no
  backing column. It's been replaced by `seniority: string[]` — an exact-match filter
  against a real `jobs.seniority` column (`internship`/`entry`/`mid`/`senior`/`lead`/
  `staff`/`principal`). The column itself is still populated by a keyword-rule
  classifier (`deriveSeniority()` in `src/seniority.ts`) run against the title at
  crawl time, not sourced from structured ATS/aggregator data — so it's queryable and
  exact-match at request time, but the underlying classification is still a heuristic
  and can misclassify an unusual title.
- **Company name for Lever and Ashby.** Neither platform's public JSON includes a
  company display name in the posting payload, and the `AtsScraper.fetch(slug)`
  signature (as specified) takes only the slug — no side-channel for a display name.
  Both scrapers fall back to humanizing the slug (`"gohighlevel"` → `"Gohighlevel"`).
  Greenhouse does include `company_name` and uses that directly.
- **Salary extraction is best-effort and asymmetric across platforms.** Greenhouse's
  public API doesn't expose structured salary in any consistent field, so Greenhouse
  jobs get `salaryMin`/`salaryMax: null` (the figure is often present only inside the
  free-text description, which isn't parsed). Lever's `salaryRange` and Ashby's
  `compensation.summaryComponents` (fetched with `includeCompensation=true`) are used
  when present.
- **Location parsing (`city`/`region`/`country`) is a regex heuristic, not a
  geocoder.** ATS boards return a single free-text location string in wildly
  different shapes ("City, ST", "City, Country", "Remote", multi-office lists like
  "US-Atlanta; US-Chicago; US-Remote"). `parseLocation()` in `src/sources/ats/base.ts`
  handles the common comma-separated cases and flags `isRemote` from a `\bremote\b`
  match; anything unusual (e.g. semicolon-delimited multi-office postings) is kept
  verbatim in `location` with `city`/`region`/`country` left `null` rather than
  guessed wrong.
- **Dedup fuzzy-match only fires across sources, never within one.** `CLAUDE.md`
  frames the fuzzy fallback (company + title + city) as a way to bridge an ATS-direct
  posting and its aggregator repost. A large company can legitimately have several
  distinct, separately-req'd open roles with an identical title/company/city (e.g.
  multiple "Software Engineer" reqs across different teams) — those are not
  duplicates. `dedupeAndMerge` only merges a fuzzy-matched group when it contains
  more than one distinct `source` value; same-source records with matching fuzzy
  keys are left as separate rows.
- **Canonical URL hashing keeps non-tracking query params.** The dedup key is
  `sha1(canonicalize(applyUrl))`. Some ATS embeds encode the job's identity in the
  query string itself (e.g. Stripe's Greenhouse links are
  `stripe.com/jobs/search?gh_jid=1234`, not a unique path) — stripping the query
  string wholesale collapsed every job at a company into one id. `canonicalizeUrl()`
  only strips a small known-tracking-parameter blocklist (`utm_*`, `lever-source`,
  etc.) and keeps everything else, including host case and trailing slashes
  normalized.
- **Greenhouse's `content` field is HTML that's itself HTML-entity-encoded**, and
  inconsistently so — some jobs' descriptions have a literal ampersand encoded once
  (`&amp;`), others twice (`&amp;amp;`), depending on how the original rich text was
  authored. `stripHtml()` decodes entities in two bounded passes before stripping
  tags, which handles both depths without a full HTML parser dependency.
- **`is_active = 1` is an implicit default filter on `/jobs/search`.** The contract
  doesn't say so explicitly, but per the DB lifecycle rules (vanished jobs are marked
  inactive, never deleted), search always excludes inactive rows — there's no request
  field to opt into seeing stale listings.
- **ATS seeds are discovered from YC's directory, not the full company universe.** `npm run
  discover-seeds` only probes YC's `isHiring: true` companies (Y Combinator's own directory,
  not a general company database) via their public Algolia search index. Growing coverage
  beyond YC-backed companies is a future extension of the same pipeline
  (`src/discovery/pipeline.ts`), not part of this phase.
- **`detectAts`'s ATS domain patterns are hand-maintained, and only 3 are live-verified.**
  Greenhouse/Lever/Ashby were confirmed against real YC companies during R&D; the other
  platforms follow each ATS's own known public-board URL convention but haven't all been
  spot-checked against a live company yet. `comeet` is excluded from auto-discovery entirely —
  its `fetch()` needs a per-company token embedded in the careers page's JS state, not a slug
  regex can't derive from the URL alone.
- **`--scope` skips the ATS staleness check.** `markStale()` (`src/db.ts`) accepts an optional
  `platforms` filter, but that's coarser than what `--scope` needs: scope filters at
  industry/tag granularity down to individual seed slugs (see `src/scope.ts`'s `matchesScope`),
  while `markStale`'s filter only narrows by platform. E.g. scope `"fintech"` might select the
  `stripe` seed but not `airbnb`, even though both are on `greenhouse` — passing scoped
  platforms to `markStale` would still incorrectly deactivate `airbnb`'s live jobs. A scoped
  `npm run crawl -- --scope <name>` run therefore never marks any ATS job inactive, even if it
  vanished from a company that was actually crawled this run — full, unscoped runs remain the
  source of truth for ATS staleness.
- **Tier 2 API providers scope their fetches per search term/category, not the full board.**
  The Muse (~400K total jobs) and Himalayas (~100K) are far larger than RemoteOK/Remotive
  (a few thousand each) — pulling their entire board unfiltered every crawl isn't practical.
  Each of the 4 newer API providers (`src/sources/apis/{themuse,remotejobsorg,himalayas,adzuna}.ts`)
  loops its own curated keyword/category list in `config.ts`, bounded per source to whatever
  that source's real published constraint is (Adzuna: a hard 250-calls/day quota, so the
  term x country list is kept small; the 3 keyless sources: no published call-count limit found,
  so pagination is bounded instead for local data volume/relevance, not API politeness).

## Seeded ATS slugs

All verified live while building this project (each returns a non-empty job list at
the time of writing — see `src/config.ts`):

| Platform        | Slugs |
|-----------------|-------|
| Greenhouse      | `stripe`, `airbnb`, `figma`, `cloudflare` |
| Lever           | `gohighlevel`, `q-ctrl`, `achievers` |
| Ashby           | `ramp`, `linear`, `notion` |
| SmartRecruiters | `visa` |
| Workable        | `jobrack` |
| Recruitee       | `jobs` |
| BreezyHR        | `new-incentives` |
| JobScore        | `jobscore` |
| Personio        | `personio` |
| Comeet          | `61.003:16358C6EF2C61631639B558C0429` |
| BambooHR        | `soundstripe` |

## API providers

Unlike ATS platforms (which you seed per company), API providers return their entire
board in one call — no per-company configuration. Six providers are currently included:

| Platform      | Coverage |
|---------------|----------|
| RemoteOK      | Remote-first job board (~20k listings) |
| Remotive      | Remote software jobs globally |
| The Muse      | General job board, scoped to a few tech categories (`museConfig` in `src/config.ts`) |
| RemoteJobs.org | Remote-only job board, scoped to programming roles |
| Himalayas     | Remote-only job board, scoped to a curated list of tech search terms (`himalayasConfig`) |
| Adzuna        | General job board across the US and UK, scoped to a curated tech search-term list (`adzunaConfig`) — **requires a free API key** |

All six run as part of the default `npm run crawl` (no `--only` flag needed).

### Setup: Adzuna's free API key

Adzuna is the only source that needs credentials. Register a free key at
[developer.adzuna.com](https://developer.adzuna.com) (email signup, no cost), then set two
environment variables before running the crawl (see `.env.example`):

```bash
export ADZUNA_APP_ID=your-app-id
export ADZUNA_APP_KEY=your-app-key
npm run crawl
```

If these aren't set, `npm run crawl` still works — Adzuna is skipped with a logged warning,
same as any other source that fails, and every other provider (ATS, RemoteOK, Remotive, The
Muse, RemoteJobs.org, Himalayas) still runs normally.

## Remote/visa sponsorship filtering

All jobs include a `visaSponsorship` field (ternary: `true`/`false`/`null`) indicating
confirmed H-1B sponsorship status (cross-referenced against the USCIS H-1B Employer Data
Hub at crawl time). The `/jobs/search` API accepts `visaSponsorship: true` or `false` to
filter by sponsorship status; omit the field for no filter. When set to a specific value,
unknown (null) rows are excluded — use this to find only confirmed sponsors or
non-sponsors.

## Project layout

See `CLAUDE.md` for the full architecture description, database schema, and the
`/jobs/search` request/response contract.
