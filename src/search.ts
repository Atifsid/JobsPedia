import type Database from "better-sqlite3";
import { z } from "zod";
import { rowToJob, type JobRow } from "./db.js";
import { sourceEnum, type Job } from "./schema.js";

export const searchRequestSchema = z.object({
  title: z.string().trim().min(1).optional(),
  keywords: z.array(z.string().trim().min(1)).optional(),
  remote: z.boolean().optional(),
  city: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  // No dedicated DB column exists for this — matched against the job title as a
  // best-effort heuristic. See README "Assumptions".
  experience: z.string().trim().min(1).optional(),
  source: sourceEnum.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;

export interface SearchResponse {
  jobs: Job[];
  page: number;
  count: number;
}

function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function ftsToken(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

function buildMatchQuery(title: string | undefined, keywords: string[] | undefined): string | null {
  const terms: string[] = [];
  for (const source of [title, ...(keywords ?? [])]) {
    if (!source) continue;
    for (const word of source.split(/\s+/).filter(Boolean)) terms.push(ftsToken(word));
  }
  return terms.length > 0 ? terms.join(" AND ") : null;
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
  if (params.experience) {
    conditions.push("jobs.title LIKE ? ESCAPE '\\'");
    conditionBinds.push(`%${escapeLike(params.experience)}%`);
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
      SELECT jobs.* FROM jobs_fts
      JOIN jobs ON jobs.rowid = jobs_fts.rowid
      WHERE jobs_fts MATCH ? AND ${whereClause}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `;
    binds = [matchQuery, ...conditionBinds, limit, offset];
  } else {
    sql = `
      SELECT jobs.* FROM jobs
      WHERE ${whereClause}
      ORDER BY jobs.date_posted DESC
      LIMIT ? OFFSET ?
    `;
    binds = [...conditionBinds, limit, offset];
  }

  const rows = db.prepare(sql).all(...binds) as JobRow[];
  return { jobs: rows.map(rowToJob), page, count: rows.length };
}
