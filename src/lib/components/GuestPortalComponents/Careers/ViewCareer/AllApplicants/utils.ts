export function parseStageLabel(stageLabel?: string): { groupTitle: string; columnTitle: string } {
  if (!stageLabel) return { groupTitle: "", columnTitle: "" };
  const [groupTitle, ...rest] = stageLabel.split(" - ");
  return { groupTitle: (groupTitle || "").trim(), columnTitle: rest.join(" - ").trim() };
}

export function formatTimeAgo(timestamp?: string | number | Date) {
  if (!timestamp) return "";
  const createdAt = new Date(timestamp);
  if (Number.isNaN(createdAt.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return "Just now";
}
