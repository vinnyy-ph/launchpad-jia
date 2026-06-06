import { sanitizeRichText } from "@/lib/utils/sanitizeRichText";

interface RichTextProps {
  html: string;
  className?: string;
}

// Renders stored rich-text Description HTML, sanitised at the display boundary
// (defends against anything unexpected in the stored string). Plain-text
// descriptions render unchanged. Returns null when empty.
export default function RichText({ html, className }: RichTextProps) {
  const clean = sanitizeRichText(html);
  if (!clean.trim()) return null;

  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
