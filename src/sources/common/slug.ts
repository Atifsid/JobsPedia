/** Turn a URL slug into a display name when a platform doesn't expose one ("acme-corp" -> "Acme Corp"). */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
