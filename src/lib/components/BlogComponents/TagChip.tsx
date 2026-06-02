import type { BlogTag } from "@/lib/blog/client";

const CATEGORY_THEME: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  ai: { bg: "#EFF8FF", border: "#B2DDFF", text: "#175CD3" },
  recruiting: { bg: "#F4F3FF", border: "#D9D6FE", text: "#5925DC" },
  ops: { bg: "#ECFDF3", border: "#ABEFC6", text: "#067647" },
  ethics: { bg: "#F0F9FF", border: "#B9E6FE", text: "#026AA2" },
  product: { bg: "#FDF2FA", border: "#FCCEEE", text: "#C11574" },
};

export default function TagChip({ tag }: { tag: BlogTag }) {
  const category = tag.category ?? "unknown";
  const theme = CATEGORY_THEME[category] ?? CATEGORY_THEME.unknown;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${theme.border}`,
        background: theme.bg,
        color: theme.text,
        fontSize: 14,
        lineHeight: "20px",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {tag.name}
    </span>
  );
}


