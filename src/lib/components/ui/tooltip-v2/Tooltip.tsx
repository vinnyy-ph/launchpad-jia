import styles from "./tooltip.module.scss";

interface TooltipProps {
  message: string;
  width: number;
}

export default ({ message, width }: TooltipProps) => {
  return (
    <div className={styles.tooltip}>
      <img alt="" src="/icons/help-circle.svg" />
      <span style={{ width }}>{message}</span>
    </div>
  );
};
