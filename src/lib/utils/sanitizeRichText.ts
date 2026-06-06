// Conservative allowlist sanitizer for the rich-text Description fields.
// Keeps only basic formatting tags and strips ALL attributes plus every other
// tag — so no <script>, event handlers, inline styles, or links survive. It is
// string-based (no DOM), so it runs safely on both server and client.

const ALLOWED_TAGS = new Set([
  "p", "br", "div",
  "b", "strong", "i", "em", "u", "s", "strike",
  "ul", "ol", "li",
]);

export function sanitizeRichText(html: string): string {
  if (!html) return "";

  return html
    // Drop HTML comments entirely.
    .replace(/<!--[\s\S]*?-->/g, "")
    // For every tag: keep it only if allow-listed, and always drop its attributes.
    .replace(
      /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g,
      (_match, slash: string, tag: string) =>
        ALLOWED_TAGS.has(tag.toLowerCase()) ? `<${slash}${tag.toLowerCase()}>` : "",
    );
}
