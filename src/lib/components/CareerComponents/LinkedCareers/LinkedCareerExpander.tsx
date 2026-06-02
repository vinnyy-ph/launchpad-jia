import styles from "./linked-careers.module.scss";

interface LinkedCareerExpanderProps {
  direction: "left" | "right";
  expanded?: boolean;
  loading?: boolean;
  onClick?: () => void;
  childTitle?: string;
}

export default function LinkedCareerExpander({
  direction,
  expanded = false,
  loading = false,
  onClick,
  childTitle,
}: LinkedCareerExpanderProps) {
  const isLeft = direction === "left";
  const showLabel = isLeft ? "Show Parent" : "Show Child";
  const hideLabel = isLeft ? "Hide Parent" : (childTitle ? `Hide ${childTitle}` : "Hide Child");
  const label = loading ? "Loading..." : (expanded ? hideLabel : showLabel);
  const icon = loading ? "⟳" : (expanded ? "−" : "+");

  return (
    <div
      className={`${styles.expander} ${expanded ? styles.expanderExpanded : (isLeft ? styles.expanderLeft : styles.expanderRight)}`}
      onClick={onClick}
    >
      <span
        className={`${styles.expanderText} ${isLeft ? styles.expanderTextLeft : ""}`}
      >
        <span className={styles.expanderIcon}>{icon}</span> {label}
      </span>
    </div>
  );
}
