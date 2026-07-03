# jobspedia

Merges two job-data sources into one local dataset and serves it over a small local
API:

1. **Aggregator boards** (LinkedIn, Indeed, Glassdoor, …) via the `jobspy-js` npm
   package.
2. **ATS-direct** sources (Greenhouse, Lever, Ashby, SmartRecruiters, Workable,
   Recruitee, Comeet, BreezyHR, JobScore, Personio, BambooHR) via thin hand-written
   fetchers that hit each platform's public JSON/XML API.

Both are normalized into one schema, deduplicated, written to a local SQLite file,
and exposed via `POST /jobs/search`. See `CLAUDE.md` for the full architecture,
schema, and conventions this project follows.

## Quick start

```bash
npm install
npm run crawl -- --only ats   # populate data/jobs.db from live ATS boards
npm run serve                 # start the read API on :8080
```

```bash
curl -X POST http://localhost:8080/jobs/search \
  -H 'content-type: application/json' \
  -d '{"title":"engineer","limit":5}'
```

## Commands

```bash
npm run crawl                 # ATS crawl (aggregators are off by default — see Assumptions)
npm run crawl -- --only ats   # same as above, explicit
npm run crawl -- --only aggregators   # jobspy-js crawl (LinkedIn/Indeed/Glassdoor)
npm run serve                 # start the read API on :8080
npm run typecheck             # tsc --noEmit
npm test                      # vitest
```

## Assumptions

Ambiguities encountered while building this from the `CLAUDE.md` spec, and the
choices made:

- **Aggregators default to off, not just under `--only ats`.** The build brief said
  to wire up `jobspy-js` but leave it off in the seed crawl. Concretely: plain
  `npm run crawl` and `npm run crawl -- --only ats` behave identically (ATS only).
  The *only* way to run the aggregator side is `npm run crawl -- --only aggregators`
  — there's currently no flag to run both in one invocation.
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

## Project layout

See `CLAUDE.md` for the full architecture description, database schema, and the
`/jobs/search` request/response contract.
