import type { AtsSeed } from "./config.js";

export function parseScope(argv: string[]): string | undefined {
  const idx = argv.indexOf("--scope");
  return idx !== -1 ? argv[idx + 1] : undefined;
}

export function matchesScope(seed: Pick<AtsSeed, "industries" | "tags">, scope: string): boolean {
  const needle = scope.toLowerCase();
  return seed.industries.some((i) => i.toLowerCase() === needle) || seed.tags.some((t) => t.toLowerCase() === needle);
}

/** Filters `seeds` to those matching `scope` (against YC's own industries/tags). Undefined scope is a no-op. */
export function filterByScope(seeds: AtsSeed[], scope: string | undefined): AtsSeed[] {
  if (!scope) return seeds;
  return seeds.filter((seed) => matchesScope(seed, scope));
}
