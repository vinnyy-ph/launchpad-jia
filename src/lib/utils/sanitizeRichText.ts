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

// Plain-text extraction for length/required checks and for feeding stored
// rich-text (Descriptions) to the LLM as clean prose. String-based, no DOM.
export function htmlToPlainText(html: string): string {
  if (!html) return "";

  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
