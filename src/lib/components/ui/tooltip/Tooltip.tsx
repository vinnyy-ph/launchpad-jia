import styles from "./tooltip.module.scss";

interface TooltipProps {
  message: string;
  position?: "bottom" | "top";
  width: number;
  align?: "center" | "end";
}

export default function ({
  message,
  position = "top",
  width,
  align = "center",
}: TooltipProps) {
  return (
    <div className={`${styles.tooltip} ${styles[position]} ${align === "end" ? styles.end : ""}`}>
      <img alt="" src="/icons/help-circle.svg" />
      <span style={{ width }}>
        {message}
        <div />
      </span>
    </div>
  );
}
