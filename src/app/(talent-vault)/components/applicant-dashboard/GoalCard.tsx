import styles from "@/app/(talent-vault)/styles/modules/goal-card.module.scss";

type GoalCardProps = {
  title: string;
  description: string;
  imgSrc: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};
export function GoalCard({ title, description, imgSrc, selected = false, disabled = false, onClick }: GoalCardProps) {
  const className = [
    styles.goalCard,
    selected ? styles.selected : "",
    disabled ? styles.disabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={className} onClick={onClick} aria-pressed={selected} disabled={disabled}>
      <img className={styles.illustration} src={imgSrc} alt="" />
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <div className={styles.description}>{description}</div>
      </div>
    </button>
  )
}
