import type Database from "better-sqlite3";
import { z } from "zod";
import { rowToJob, type JobRow } from "./db.js";
import { sourceEnum, type Job } from "./schema.js";
import { SENIORITY_LEVELS } from "./seniority.js";

export const searchRequestSchema = z.object({
  title: z.string().trim().min(1).optional(),
  keywords: z.array(z.string().trim().min(1)).optional(),
  company: z.string().trim().min(1).optional(),
  remote: z.boolean().optional(),
  city: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  seniority: z.array(z.enum(SENIORITY_LEVELS)).optional(),
  minSalary: z.number().int().positive().optional(),
  maxSalary: z.number().int().positive().optional(),
  daysAgo: z.number().int().positive().optional(),
  source: sourceEnum.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;

export interface SearchResponse {
  jobs: Job[];
  page: number;
  count: number;
  total: number;
}

function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function ftsToken(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

/** Column-scoped: matches only the jobs.title column, not company/description. */
function buildTitleClause(title: string | undefined): string | null {
  if (!title) return null;
  const terms = title.split(/\s+/).filter(Boolean).map(ftsToken);
  return terms.length > 0 ? `title:(${terms.join(" AND ")})` : null;
}

/** Unscoped: matches title+company+description together, for broad keyword search. */
function buildKeywordsClause(keywords: string[] | undefined): string | null {
  if (!keywords || keywords.length === 0) return null;
  const terms: string[] = [];
  for (const kw of keywords) {
    for (const word of kw.split(/\s+/).filter(Boolean)) terms.push(ftsToken(word));
  }
  return terms.length > 0 ? `(${terms.join(" AND ")})` : null;
}

function buildMatchQuery(title: string | undefined, keywords: string[] | undefined): string | null {
  const clauses = [buildTitleClause(title), buildKeywordsClause(keywords)].filter(
    (c): c is string => c !== null,
  );
  return clauses.length > 0 ? clauses.join(" AND ") : null;
}

export function searchJobs(db: Database.Database, params: SearchRequest): SearchResponse {
  const page = params.page;
  const limit = params.limit;
  const offset = (page - 1) * limit;

  const conditions: string[] = ["jobs.is_active = 1"];
  const conditionBinds: unknown[] = [];

  if (params.remote !== undefined) {
    conditions.push("jobs.is_remote = ?");
    conditionBinds.push(params.remote ? 1 : 0);
  }
  if (params.city) {
    conditions.push("LOWER(jobs.city) = LOWER(?)");
    conditionBinds.push(params.city);
  }
  if (params.region) {
    conditions.push("LOWER(jobs.region) = LOWER(?)");
    conditionBinds.push(params.region);
  }
  if (params.country) {
    conditions.push("LOWER(jobs.country) = LOWER(?)");
    conditionBinds.push(params.country);
  }
  if (params.company) {
    conditions.push("jobs.company LIKE ? ESCAPE '\\'");
    conditionBinds.push(`%${escapeLike(params.company)}%`);
  }
  if (params.seniority && params.seniority.length > 0) {
    conditions.push(`jobs.seniority IN (${params.seniority.map(() => "?").join(",")})`);
    conditionBinds.push(...params.seniority);
  }
  if (params.minSalary !== undefined) {
    conditions.push("(jobs.salary_max IS NULL OR jobs.salary_max >= ?)");
    conditionBinds.push(params.minSalary);
  }
  if (params.maxSalary !== undefined) {
    conditions.push("(jobs.salary_min IS NULL OR jobs.salary_min <= ?)");
    conditionBinds.push(params.maxSalary);
  }
  if (params.daysAgo !== undefined) {
    // Unlike minSalary/maxSalary (which never exclude on missing data), this filter
    // excludes jobs with a NULL date_posted: freshness can't be confirmed for an
    // undated posting, so it's treated as not matching rather than always-included.
    // Compare by calendar day only (date(), not datetime()) — date_posted values are
    // stored as ISO 8601 with a "T" separator ("2026-06-25T00:00:00Z"), while
    // datetime('now', ...) returns a space-separated string ("2026-06-23 10:15:00").
    // Comparing those two formats directly is lexicographically inconsistent right at
    // day boundaries (' ' < 'T' in ASCII); normalizing both sides with date() avoids it,
    // and "posted within N days" only needs day granularity anyway.
    conditions.push("date(jobs.date_posted) >= date('now', ?)");
    conditionBinds.push(`-${params.daysAgo} days`);
  }
  if (params.source) {
    conditions.push("jobs.source = ?");
    conditionBinds.push(params.source);
  }

  const matchQuery = buildMatchQuery(params.title, params.keywords);
  const whereClause = conditions.join(" AND ");

  let sql: string;
  let binds: unknown[];
  if (matchQuery) {
    sql = `
      SELECT jobs.*, COUNT(*) OVER() AS total_count FROM jobs_fts
      JOIN jobs ON jobs.rowid = jobs_fts.rowid
      WHERE jobs_fts MATCH ? AND ${whereClause}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `;
    binds = [matchQuery, ...conditionBinds, limit, offset];
  } else {
    sql = `
      SELECT jobs.*, COUNT(*) OVER() AS total_count FROM jobs
      WHERE ${whereClause}
      ORDER BY jobs.date_posted DESC
      LIMIT ? OFFSET ?
    `;
    binds = [...conditionBinds, limit, offset];
  }

  const rows = db.prepare(sql).all(...binds) as (JobRow & { total_count: number })[];
  // total_count comes from COUNT(*) OVER() on the returned page, so it's only known
  // when at least one row comes back. Requesting a page past the last page of
  // results yields zero rows and thus `total: 0` here, not the true total.
  const total = rows[0]?.total_count ?? 0;
  return { jobs: rows.map(rowToJob), page, count: rows.length, total };
}
