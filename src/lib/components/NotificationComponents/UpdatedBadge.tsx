'use client';

import styles from './UpdatedBadge.module.scss';

interface UpdatedBadgeProps {
  show?: boolean;
}

export default function UpdatedBadge({ show = true }: UpdatedBadgeProps) {
  if (!show) {
    return null;
  }

  return (
    <span className={styles.updatedBadge}>
      Updated
    </span>
  );
}
