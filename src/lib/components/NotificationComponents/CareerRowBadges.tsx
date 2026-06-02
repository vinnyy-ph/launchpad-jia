"use client";

import React, { useEffect, useState } from 'react';
import styles from './CareerRowBadges.module.scss';
import NewBadge from './NewBadge';

interface CareerRowBadgesProps {
  careerId: string;
  showComments?: boolean;
  showActions?: boolean;
  precomputedBadges?: {
    newComments: number;
    importantActions: number;
    isNew?: boolean;
  };
}

/**
 * Displays two badge counters for career rows:
 * - Blue "New" badge when career is unviewed by current user
 * - Red count badge showing total of new comments + important actions
 */
export default function CareerRowBadges({
  careerId,
  showComments = true,
  showActions = false,
  precomputedBadges,
}: CareerRowBadgesProps) {
  const [commentsCount, setCommentsCount] = useState<number>(
    precomputedBadges?.newComments || 0
  );
  const [actionsCount, setActionsCount] = useState<number>(
    precomputedBadges?.importantActions || 0
  );
  const [isNew, setIsNew] = useState<boolean>(
    precomputedBadges?.isNew || false
  );
  const [isLoading, setIsLoading] = useState(!precomputedBadges);

  useEffect(() => {
    // Use precomputed badges if provided
    if (precomputedBadges) {
      setCommentsCount(precomputedBadges.newComments);
      setActionsCount(precomputedBadges.importantActions);
      setIsNew(precomputedBadges.isNew || false);
      setIsLoading(false);
    } else {
      // No precomputed badges - this shouldn't happen in production
      console.warn('CareerRowBadges: No precomputed badges provided. Badges will not be displayed.');
      setIsLoading(false);
    }
  }, [precomputedBadges]);

  // Listen for updates
  useEffect(() => {
    const handleUpdate = () => {
      // Refetch counts when comments or actions change
      setIsLoading(true);
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    };

    window.addEventListener('candidate-comments-updated', handleUpdate);

    return () => {
      window.removeEventListener('candidate-comments-updated', handleUpdate);
    };
  }, []);

  const totalCount = commentsCount + actionsCount;

  if (isLoading) {
    return null;
  }

  // Show nothing if no badges to display
  if (!isNew && totalCount === 0) {
    return null;
  }

  return (
    <>
      <NewBadge show={isNew} />
      {totalCount > 0 && (
        <span
          className={styles.badge}
          title={`${commentsCount > 0 ? `${commentsCount} new comments` : ''}${
            commentsCount > 0 && actionsCount > 0 ? ', ' : ''
          }${actionsCount > 0 ? `${actionsCount} important actions` : ''}`}
        >
          {totalCount}
        </span>
      )}
    </>
  );
}