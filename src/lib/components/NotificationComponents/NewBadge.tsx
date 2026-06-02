'use client';

import styles from './NewBadge.module.scss';

interface NewBadgeProps {
  show?: boolean;
}

export default function NewBadge({ show = true }: NewBadgeProps) {
  if (!show) {
    return null;
  }

  return (
    <span className={styles.newBadge}>
      New
    </span>
  );
}