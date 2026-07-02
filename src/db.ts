import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Job, NewJob, Source } from "./schema.js";

export const DEFAULT_DB_PATH = fileURLToPath(
  new URL("../data/jobs.db", import.meta.url),
);

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  company      TEXT NOT NULL,
  location     TEXT,
  city         TEXT,
  region       TEXT,
  country      TEXT,
  is_remote    INTEGER DEFAULT 0,
  salary_min   INTEGER,
  salary_max   INTEGER,
  currency     TEXT,
  apply_url    TEXT NOT NULL,
  description  TEXT,
  date_posted  TEXT,
  platform     TEXT,
  source       TEXT,
  first_seen   TEXT,
  last_seen    TEXT,
  is_active    INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_is_remote ON jobs(is_remote);
CREATE INDEX IF NOT EXISTS idx_jobs_city ON jobs(city);
CREATE INDEX IF NOT EXISTS idx_jobs_region ON jobs(region);
CREATE INDEX IF NOT EXISTS idx_jobs_country ON jobs(country);

CREATE VIRTUAL TABLE IF NOT EXISTS jobs_fts USING fts5(
  title, company, description,
  content='jobs', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS jobs_ai AFTER INSERT ON jobs BEGIN
  INSERT INTO jobs_fts(rowid, title, company, description)
  VALUES (new.rowid, new.title, new.company, new.description);
END;

CREATE TRIGGER IF NOT EXISTS jobs_ad AFTER DELETE ON jobs BEGIN
  INSERT INTO jobs_fts(jobs_fts, rowid, title, company, description)
  VALUES ('delete', old.rowid, old.title, old.company, old.description);
END;

CREATE TRIGGER IF NOT EXISTS jobs_au AFTER UPDATE ON jobs BEGIN
  INSERT INTO jobs_fts(jobs_fts, rowid, title, company, description)
  VALUES ('delete', old.rowid, old.title, old.company, old.description);
  INSERT INTO jobs_fts(rowid, title, company, description)
  VALUES (new.rowid, new.title, new.company, new.description);
END;
`;

export function openDb(path: string = DEFAULT_DB_PATH): Database.Database {
  if (path !== ":memory:") {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(MIGRATIONS);
  return db;
}

export interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  is_remote: number;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  apply_url: string;
  description: string | null;
  date_posted: string | null;
  platform: string;
  source: string;
  first_seen: string;
  last_seen: string;
  is_active: number;
}

export function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    city: row.city,
    region: row.region,
    country: row.country,
    isRemote: row.is_remote === 1,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    currency: row.currency,
    applyUrl: row.apply_url,
    description: row.description,
    datePosted: row.date_posted,
    platform: row.platform as Job["platform"],
    source: row.source as Source,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    isActive: row.is_active === 1,
  };
}

const upsertSql = `
INSERT INTO jobs (
  id, title, company, location, city, region, country, is_remote,
  salary_min, salary_max, currency, apply_url, description, date_posted,
  platform, source, first_seen, last_seen, is_active
) VALUES (
  @id, @title, @company, @location, @city, @region, @country, @isRemote,
  @salaryMin, @salaryMax, @currency, @applyUrl, @description, @datePosted,
  @platform, @source, @now, @now, 1
)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  company = excluded.company,
  location = excluded.location,
  city = excluded.city,
  region = excluded.region,
  country = excluded.country,
  is_remote = excluded.is_remote,
  salary_min = excluded.salary_min,
  salary_max = excluded.salary_max,
  currency = excluded.currency,
  apply_url = excluded.apply_url,
  description = excluded.description,
  date_posted = excluded.date_posted,
  platform = excluded.platform,
  source = excluded.source,
  last_seen = excluded.last_seen,
  is_active = 1
`;

/** Upsert a batch of deduped jobs. Bumps last_seen; preserves first_seen on existing rows. */
export function upsertJobs(db: Database.Database, jobs: NewJob[]): void {
  const stmt = db.prepare(upsertSql);
  const now = new Date().toISOString();
  const run = db.transaction((rows: NewJob[]) => {
    for (const job of rows) {
      stmt.run({
        ...job,
        isRemote: job.isRemote ? 1 : 0,
        now,
      });
    }
  });
  run(jobs);
}

/** Mark jobs of a given source inactive if they weren't seen in the current crawl run. */
export function markStale(
  db: Database.Database,
  seenIds: Iterable<string>,
  source: Source,
): void {
  const ids = Array.from(seenIds);
  const sql =
    ids.length > 0
      ? `UPDATE jobs SET is_active = 0 WHERE source = ? AND is_active = 1 AND id NOT IN (${ids.map(() => "?").join(",")})`
      : `UPDATE jobs SET is_active = 0 WHERE source = ? AND is_active = 1`;
  db.prepare(sql).run(source, ...ids);
}
