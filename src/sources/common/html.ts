/** Strip HTML tags/entities down to plain, FTS-friendly text. */
function decodeEntitiesOnce(s: string): string {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  // Some ATS boards (e.g. Greenhouse's `content` field) return HTML that's itself
  // entity-encoded ("&lt;h2&gt;..."), and some source content is entity-encoded twice
  // over ("&amp;amp;" for a literal "&"). Decode in a couple of bounded passes before
  // stripping tags — otherwise the tag-stripping regex runs first and finds no literal
  // "<" to match.
  let decoded = html;
  for (let i = 0; i < 2; i++) decoded = decodeEntitiesOnce(decoded);
  const text = decoded
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 0 ? text : null;
}
