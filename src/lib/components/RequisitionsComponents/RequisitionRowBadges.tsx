"use client";

import React from 'react';
import NewBadge from '@/lib/components/NotificationComponents/NewBadge';
import UpdatedBadge from '@/lib/components/NotificationComponents/UpdatedBadge';

interface RequisitionRowBadgesProps {
  badges?: {
    isNew: boolean;
    isUpdated: boolean;
  };
}

/**
 * Displays badge indicators for requisition rows:
 * - Blue "New" badge for requisitions created since last visit
 * - Orange "Updated" badge for requisitions with status changes since last visit
 */
export default function RequisitionRowBadges({ badges }: RequisitionRowBadgesProps) {
  // Show nothing if no badge data or all badges are false
  if (!badges || (!badges.isNew && !badges.isUpdated)) {
    return null;
  }

  return (
    <>
      <NewBadge show={badges.isNew} />
      <UpdatedBadge show={badges.isUpdated} />
    </>
  );
}
