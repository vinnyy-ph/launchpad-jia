'use client';

import Link from 'next/link';
import { markNotificationAsRead } from '@/lib/hooks/useNotificationData';
import { NotificationDocument, NOTIFICATION_TYPES } from '@/lib/utils/notificationTypes';
import styles from './NotificationItem.module.scss';
import AvatarImage from '../AvatarImage/AvatarImage';

interface NotificationItemProps {
  notification: NotificationDocument;
  onClose: () => void;
}

export default function NotificationItem({ notification, onClose }: NotificationItemProps) {
  // Extract actor data from populated field
  const actorName = notification.actor?.name || 'Unknown User';
  const actorImage = notification.actor?.image;

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - notifDate.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) {
      const mins = Math.floor(diffInSeconds / 60);
      return mins === 1 ? '1 min ago' : `${mins} mins ago`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return days === 1 ? '1 day ago' : `${days} days ago`;
    }

    return notifDate.toLocaleDateString();
  };

  const handleClick = async () => {
    // Mark as read with optimistic update
    if (!notification.isRead) {
      await markNotificationAsRead(notification._id!, notification.orgID);
    }

    onClose();
  };

  // Format notification title based on type
  const getFormattedNotification = () => {
    const metadata = notification.metadata || {};
    const entityName = metadata.entityName || metadata.roleName || metadata.requisitionTitle || metadata.positionName;

    switch (notification.type) {
      case NOTIFICATION_TYPES.REQUISITION_HOLD:
        return {
          title: 'Requisition Put on Hold',
          description: (
            <>
              Requisition for the role "<span className={styles.link}>{entityName}</span>" has been put on hold by <strong>{actorName}</strong>.
            </>
          )
        };
      case NOTIFICATION_TYPES.REQUISITION_APPROVED:
        return {
          title: 'Requisition Approved',
          description: (
            <>
              Requisition for the role "<span className={styles.link}>{entityName}</span>" has been approved by <strong>{actorName}</strong>.
            </>
          )
        };
      case NOTIFICATION_TYPES.REQUISITION_CREATED:
        return {
          title: 'New Requisition',
          description: (
            <>
              A requisition for the role "<span className={styles.link}>{entityName}</span>" has been created by guest <strong>{actorName}</strong>.
            </>
          )
        };
      case NOTIFICATION_TYPES.PROJECT_ADDED:
        return {
          title: `${actorName} invited you`,
          description: (
            <>
              Invited you to the project <span className={styles.link}>{entityName}</span>
            </>
          )
        };
      case NOTIFICATION_TYPES.TAG:
        const mentionedCandidateName = metadata.candidateName;
        const mentionedCareerName = metadata.careerName;

        return {
          title: actorName,
          description: (
            <>
              Tagged you in a comment on <span className={styles.link}>{mentionedCandidateName}</span> <span className={styles.muted}>[{mentionedCareerName}]</span>
            </>
          )
        };
      case NOTIFICATION_TYPES.COMMENT:
        const candidateName = metadata.candidateName;
        const careerName = metadata.careerName;

        return {
          title: actorName,
          description: (
            <>
              Commented on <span className={styles.link}>{candidateName}</span> <span className={styles.muted}>[{careerName}]</span>
            </>
          ),
          preview: notification.summary?.replace(`${actorName} commented: `, '')
        };
      case NOTIFICATION_TYPES.CAREER_UPDATED:
        const careerTitle = metadata.careerTitle || metadata.entityName || 'a career';
        const careerChanges = metadata.changes || [];

        let careerUpdateDescription: React.ReactNode;

        // Check if this is a team member change notification
        if (careerChanges.length > 0 && careerChanges[0].includes(' added')) {
          const roleAdded = careerChanges[0].replace(' added', '');
          careerUpdateDescription = (
            <>
              Added a new <strong>{roleAdded}</strong> to <span className={styles.link}>{careerTitle}</span>
            </>
          );
        } else if (careerChanges.length > 0 && careerChanges[0].includes(' removed')) {
          const roleRemoved = careerChanges[0].replace(' removed', '');
          careerUpdateDescription = (
            <>
              Removed a <strong>{roleRemoved}</strong> from <span className={styles.link}>{careerTitle}</span>
            </>
          );
        } else {
          careerUpdateDescription = (
            <>
              Updated <span className={styles.link}>{careerTitle}</span>
            </>
          );
        }

        return {
          title: actorName,
          description: careerUpdateDescription
        };
      case NOTIFICATION_TYPES.CAREER_DELETED:
        const deletedCareerTitle = metadata.careerTitle || metadata.entityName || 'a career';

        return {
          title: actorName,
          description: (
            <>
              Deleted the career <span className={styles.link}>{deletedCareerTitle}</span>
            </>
          )
        };
      case NOTIFICATION_TYPES.CAREER_PUBLISHED:
        const publishedCareerTitle = metadata.careerTitle || metadata.entityName || 'a career';

        return {
          title: actorName,
          description: (
            <>
              Published the career <span className={styles.link}>{publishedCareerTitle}</span>
            </>
          )
        };
      case NOTIFICATION_TYPES.CAREER_UNPUBLISHED:
        const unpublishedCareerTitle = metadata.careerTitle || metadata.entityName || 'a career';

        return {
          title: actorName,
          description: (
            <>
              Unpublished the career <span className={styles.link}>{unpublishedCareerTitle}</span>
            </>
          )
        };
      case NOTIFICATION_TYPES.CAREER_OWNERSHIP_TRANSFERRED:
        const ownershipCareerTitle = metadata.careerTitle || metadata.entityName || 'a career';
        const newOwnerId = metadata.newOwnerId;

        // Check if the current user is receiving or losing ownership
        const isReceivingOwnership = notification.userId === newOwnerId;

        if (isReceivingOwnership) {
          return {
            title: actorName,
            description: (
              <>
                Transferred career ownership of <span className={styles.link}>{ownershipCareerTitle}</span> to you
              </>
            )
          };
        } else {
          // Previous owner losing ownership
          return {
            title: actorName,
            description: (
              <>
                Transferred your career ownership of <span className={styles.link}>{ownershipCareerTitle}</span> to another team member
              </>
            )
          };
        }
      case NOTIFICATION_TYPES.CAREER_TEAM_MEMBER_ADDED:
        const addedCareerTitle = metadata.entityName || metadata.careerTitle || 'a career';
        const addedMemberRole = metadata.role;

        return {
          title: actorName,
          description: (
            <>
              Assigned you as <strong>{addedMemberRole}</strong> for the career <span className={styles.link}>{addedCareerTitle}</span>
            </>
          )
        };
      case NOTIFICATION_TYPES.CAREER_TEAM_MEMBER_REMOVED:
        const removedCareerTitle = metadata.entityName || metadata.careerTitle || 'a career';
        const removedMemberRole = metadata.role;

        return {
          title: actorName,
          description: (
            <>
              Removed you as <strong>{removedMemberRole}</strong> from the career <span className={styles.link}>{removedCareerTitle}</span>
            </>
          )
        };
      case NOTIFICATION_TYPES.PROJECT_UPDATED:
        const projectTitle = metadata.projectName || metadata.entityName || 'a project';
        const changes = metadata.changes || [];

        let updateDescription: React.ReactNode;

        if (changes.includes('ownership')) {
          updateDescription = (
            <>
              Changed ownership of the project <span className={styles.link}>{projectTitle}</span>
            </>
          );
        } else if (changes.includes('members_added')) {
          updateDescription = (
            <>
              Added new members to the project <span className={styles.link}>{projectTitle}</span>
            </>
          );
        } else if (changes.includes('members_removed')) {
          updateDescription = (
            <>
              Removed members from the project <span className={styles.link}>{projectTitle}</span>
            </>
          );
        } else if (changes.includes('name')) {
          updateDescription = (
            <>
              Renamed the project to <span className={styles.link}>{projectTitle}</span>
            </>
          );
        } else {
          updateDescription = (
            <>
              Updated the project <span className={styles.link}>{projectTitle}</span>
            </>
          );
        }

        return {
          title: actorName,
          description: updateDescription
        };
      case NOTIFICATION_TYPES.PROJECT_DELETED:
        const deletedProjectTitle = metadata.projectName || metadata.entityName || 'a project';

        return {
          title: actorName,
          description: (
            <>
              Deleted the project <span className={styles.link}>{deletedProjectTitle}</span>
            </>
          )
        };
      case NOTIFICATION_TYPES.PROJECT_OWNERSHIP_TRANSFERRED:
        const ownershipProjectTitle = metadata.projectName || metadata.entityName || 'a project';
        const newProjectOwnerId = metadata.newOwnerId;

        // Check if the current user is receiving or losing ownership
        const isReceivingProjectOwnership = notification.userId === newProjectOwnerId;

        if (isReceivingProjectOwnership) {
          return {
            title: actorName,
            description: (
              <>
                Transferred project ownership of <span className={styles.link}>{ownershipProjectTitle}</span> to you
              </>
            )
          };
        } else {
          // Previous owner losing ownership
          return {
            title: actorName,
            description: (
              <>
                Transferred your project ownership of <span className={styles.link}>{ownershipProjectTitle}</span> to another team member
              </>
            )
          };
        }
      case NOTIFICATION_TYPES.PROJECT_TEAM_MEMBER_ADDED:
        const addedProjectTitle = metadata.entityName || metadata.projectName || 'a project';

        return {
          title: actorName,
          description: (
            <>
              Invited you to the project <span className={styles.link}>{addedProjectTitle}</span>
            </>
          )
        };
      case NOTIFICATION_TYPES.PROJECT_TEAM_MEMBER_REMOVED:
        const removedProjectTitle = metadata.entityName || metadata.projectName || 'a project';

        return {
          title: actorName,
          description: (
            <>
              Removed you from the project <span className={styles.link}>{removedProjectTitle}</span>
            </>
          )
        };
      default:
        return {
          title: actorName,
          description: notification.summary
        };
    }
  };

  function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((word: string) => word[0].toUpperCase())
    .join('');
}

  const formattedNotif = getFormattedNotification();

  return (
    <Link
      href={notification.entityLink}
      className={`${styles.notificationItem} ${!notification.isRead ? styles.unread : styles.read}`}
      onClick={handleClick}
    >
      {/* Avatar/Icon */}
      <div className={styles.avatarWrapper}>
        {actorImage ? (
          <AvatarImage src={actorImage} alt={actorName} className={styles.avatar} />
        ) : (
          <div className={styles.avatar}>
            {getInitials(actorName)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleWrapper}>
            <span className={styles.actorName}>{actorName}</span>
            <span className={styles.timestamp}>{getRelativeTime(notification.createdAt)}</span>
          </div>
          {!notification.isRead && <div className={styles.unreadDot} />}
        </div>
        <div className={styles.description}>
          {formattedNotif.description}
        </div>
        {formattedNotif.preview && (
          <div className={styles.preview}>
            {formattedNotif.preview}
          </div>
        )}
      </div>
    </Link>
  );
}

