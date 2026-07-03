import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { platformEnum, type Platform } from "../schema.js";

export const atsSeedEntrySchema = z.object({
  slug: z.string().min(1),
  industries: z.array(z.string()),
  tags: z.array(z.string()),
  source: z.enum(["yc-discovery", "manual"]),
  discoveredAt: z.string().datetime({ offset: true }).or(z.string().date()),
});
export type AtsSeedEntry = z.infer<typeof atsSeedEntrySchema>;

export interface AtsSeed extends AtsSeedEntry {
  platform: Platform;
}

/** `src/seeds/` — the directory this file lives in, where each `<platform>.json` is committed. */
const DEFAULT_SEEDS_DIR = fileURLToPath(new URL("./", import.meta.url));

function seedFilePath(platform: string, dir: string): string {
  return `${dir}/${platform}.json`;
}

/** Every ATS platform with a seed file on disk in `dir` (default: `src/seeds/`). */
export function listSeedPlatforms(dir: string = DEFAULT_SEEDS_DIR): Platform[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => platformEnum.parse(f.replace(/\.json$/, "")));
}

export function readSeedFile(platform: Platform, dir: string = DEFAULT_SEEDS_DIR): AtsSeedEntry[] {
  const raw: unknown = JSON.parse(readFileSync(seedFilePath(platform, dir), "utf-8"));
  return z.array(atsSeedEntrySchema).parse(raw);
}

/** Writes entries sorted by slug — keeps git diffs stable as new entries are appended. */
export function writeSeedFile(platform: Platform, entries: AtsSeedEntry[], dir: string = DEFAULT_SEEDS_DIR): void {
  const sorted = [...entries].sort((a, b) => a.slug.localeCompare(b.slug));
  writeFileSync(seedFilePath(platform, dir), `${JSON.stringify(sorted, null, 2)}\n`, "utf-8");
}

/** Every seed entry across every platform file in `dir`, flattened with `platform` attached. */
export function loadAllSeeds(dir: string = DEFAULT_SEEDS_DIR): AtsSeed[] {
  const seeds: AtsSeed[] = [];
  for (const platform of listSeedPlatforms(dir)) {
    for (const entry of readSeedFile(platform, dir)) {
      seeds.push({ platform, ...entry });
    }
  }
  return seeds;
}
