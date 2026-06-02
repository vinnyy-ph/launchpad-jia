import { NOTIFICATION_TYPES, ENTITY_TYPES, NotificationType, EntityType } from './notificationTypes';
import { createNotifications, getUserNotificationPreferences, shouldCreateNotification } from '@/lib/utils/notificationHelpers';
import { sendPushToUser } from '@/lib/utils/pushHelpers';

// Create notification by calling the database helper directly
export async function createNotification(
  db: any,
  params: {
    type: string;
    orgID: string;
    actorId: string;
    recipientIds: string[];
    entityId: string;
    entityType: string;
    entityLink: string;
    summary?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const { type, orgID, actorId, recipientIds, entityId, entityType, entityLink, summary, metadata } = params;
  
  // Build notification objects for each recipient
  const notificationsToCreate = await Promise.all(
    recipientIds.map(async (recipientEmail) => {
      const member = await db.collection('members').findOne({
        email: recipientEmail,
        orgID: orgID
      });

      if (!member) {
        console.warn(`[notificationTriggers] Member not found: ${recipientEmail} in org ${orgID}`);
        return null;
      }

      // Check user preferences
      const preferences = await getUserNotificationPreferences(db, recipientEmail, orgID);

      const shouldCreate = shouldCreateNotification(type, preferences, metadata);
      if (!shouldCreate) return null;

      const isGuest = member.role === 'guest';

      let recipientEntityLink = entityLink;

      // If the recipient is a guest, generate the appropriate entity link
      if (isGuest) {
        // Requisition notifications
        if (entityLink.includes('/requisitions')) {
          recipientEntityLink = `/guest-portal/requisitions?orgId=${orgID}`;
        }
        // Career notifications
        else if (entityLink.includes('/careers/')) {
          recipientEntityLink = `/guest-portal/careers/${entityId}?orgId=${orgID}`;
        }
        // Application/candidate notifications - redirect to career
        else if (entityLink.includes('/candidates/') || entityLink.includes('/application/')) {
          recipientEntityLink = `/guest-portal/careers/${entityId}?orgId=${orgID}`;
        }
        // Project notifications - redirect to requisitions (guests don't have projects)
        else if (entityLink.includes('/projects/')) {
          recipientEntityLink = `/guest-portal/requisitions?orgId=${orgID}`;
        }
        // Default fallback for any other recruiter dashboard links
        else if (entityLink.includes('/recruiter-dashboard/')) {
          recipientEntityLink = `/guest-portal/requisitions?orgId=${orgID}`;
        }
      }

      const notificationSummary = summary || `New ${type.replace(/_/g, ' ').toLowerCase()} notification`;

      return {
        type: type as NotificationType,
        userId: recipientEmail,
        orgID,
        actorId,
        entityId,
        entityType: entityType as EntityType,
        entityLink: recipientEntityLink,
        summary: notificationSummary,
        metadata: metadata || {},
      };
    })
  );

  // Filter out null values (recipients without orgID)
  const validNotifications = notificationsToCreate.filter((n): n is NonNullable<typeof n> => n !== null);

  if (validNotifications.length === 0) {
    console.warn('[notificationTriggers] No valid notifications to create');
    return;
  }

  const notificationIds = await createNotifications(db, validNotifications);

  // Send push notifications asynchronously
  Promise.allSettled(
    validNotifications.map((notification, index) => {
      return sendPushToUser(db, notification.userId, notification.orgID, {
        title: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        body: notification.summary,
        notificationId: notificationIds[index],
        entityLink: notification.entityLink,
        type: notification.type,
      });
    })
  ).catch(err => {
    console.error('[notificationTriggers] Failed to send push notifications:', err);
  });
}

// Trigger notification for new comment on application
export async function triggerCommentNotification(
  db: any,
  params: {
    commentId: string;
    interviewID: string;
    careerId: string;
    commentText: string;
    actorId: string;
    recipientIds: string[];
    candidateName?: string;
    orgID: string;
  }
): Promise<void> {
  const { commentId, interviewID, careerId, actorId, recipientIds, candidateName, orgID } = params;

  // Don't notify the comment author
  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.COMMENT,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: interviewID,
    entityType: ENTITY_TYPES.APPLICATION,
    entityLink: `/recruiter-dashboard/candidates/application/${interviewID}?orgID=${orgID}`,
    metadata: {
      commentId,
      careerId,
      candidateName,
    },
  });
}

// Trigger notification for user tag in comment
export async function triggerTagNotification(
  db: any,
  params: {
    commentId: string;
    entityId: string;
    entityType: string;
    entityLink: string;
    commentText: string;
    actorId: string;
    taggedUserIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { commentId, entityId, entityType, entityLink, actorId, taggedUserIds, orgID } = params;

  if (taggedUserIds.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.TAG,
    orgID,
    actorId,
    recipientIds: taggedUserIds,
    entityId,
    entityType,
    entityLink: `${entityLink}${entityLink.includes('?') ? '&' : '?'}orgID=${orgID}`,
    metadata: {
      commentId,
    },
  });
}

// Trigger notification for user added to career
export async function triggerCareerAccessNotification(
  db: any,
  params: {
    careerId: string;
    careerTitle: string;
    actorId: string;
    newUserIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { careerId, careerTitle, actorId, newUserIds, orgID } = params;

  // Filter out the actor from new users
  const filteredRecipients = newUserIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.CAREER_ADDED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: careerId,
    entityType: ENTITY_TYPES.CAREER,
    entityLink: `/recruiter-dashboard/careers/manage/${careerId}?orgID=${orgID}`,
    metadata: {
      careerTitle,
    },
  });
}

// Trigger notification for user added to project
export async function triggerProjectAccessNotification(
  db: any,
  params: {
    projectId: string;
    projectName: string;
    actorId: string;
    newUserIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { projectId, projectName, actorId, newUserIds, orgID } = params;

  // Filter out the actor from new users
  const filteredRecipients = newUserIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.PROJECT_ADDED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: projectId,
    entityType: ENTITY_TYPES.PROJECT,
    entityLink: `/recruiter-dashboard/projects/${projectId}?orgID=${orgID}`,
    metadata: {
      projectName,
    },
  });
}

// Trigger notification for career published/unpublished
export async function triggerCareerStatusNotification(
  db: any,
  params: {
    careerId: string;
    careerTitle: string;
    isPublished: boolean;
    actorId: string;
    recipientIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { careerId, careerTitle, isPublished, actorId, recipientIds, orgID } = params;

  // Don't notify the actor
  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: isPublished ? NOTIFICATION_TYPES.CAREER_PUBLISHED : NOTIFICATION_TYPES.CAREER_UNPUBLISHED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: careerId,
    entityType: ENTITY_TYPES.CAREER,
    entityLink: `/recruiter-dashboard/careers/manage/${careerId}?orgID=${orgID}`,
    metadata: {
      careerTitle,
      isPublished,
    },
  });
}

// Trigger notification for requisition events
export async function triggerRequisitionNotification(
  db: any,
  params: {
    requisitionId: string;
    type: 'created' | 'approved' | 'hold';
    actorId: string;
    recipientIds: string[]; // Admins or specific users
    orgID: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const { requisitionId, type, actorId, recipientIds, orgID, metadata } = params;

  if (recipientIds.length === 0) {
    return;
  }

  const notificationTypeMap = {
    created: NOTIFICATION_TYPES.REQUISITION_CREATED,
    approved: NOTIFICATION_TYPES.REQUISITION_APPROVED,
    hold: NOTIFICATION_TYPES.REQUISITION_HOLD,
  };

  // Get actor details for summary
  const actor = await db.collection('members').findOne({ email: actorId, orgID });
  const actorName = actor?.name || 'Admin';

  // Build summary based on type
  const positionName = metadata?.positionName || 'a position';
  const summaryMap = {
    created: `New requisition created for "${positionName}"`,
    approved: `${actorName} approved your requisition for "${positionName}"`,
    hold: `${actorName} put your requisition for "${positionName}" on hold`,
  };

  await createNotification(db, {
    type: notificationTypeMap[type],
    orgID,
    actorId,
    recipientIds,
    entityId: requisitionId,
    entityType: ENTITY_TYPES.REQUISITION,
    entityLink: `/recruiter-dashboard/requisitions/employer?orgID=${orgID}`,
    summary: summaryMap[type],
    metadata: metadata || {},
  });
}

// Trigger notification for career update
export async function triggerCareerUpdateNotification(
  db: any,
  params: {
    careerId: string;
    careerTitle: string;
    actorId: string;
    recipientIds: string[];
    orgID: string;
    changes?: string[];
  }
): Promise<void> {
  const { careerId, careerTitle, actorId, recipientIds, orgID, changes } = params;

  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.CAREER_UPDATED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: careerId,
    entityType: ENTITY_TYPES.CAREER,
    entityLink: `/recruiter-dashboard/careers/manage/${careerId}?orgID=${orgID}`,
    metadata: {
      careerTitle,
      changes,
    },
  });
}

// Trigger notification for career deletion
export async function triggerCareerDeleteNotification(
  db: any,
  params: {
    careerId: string;
    careerTitle: string;
    actorId: string;
    recipientIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { careerId, careerTitle, actorId, recipientIds, orgID } = params;

  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.CAREER_DELETED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: careerId,
    entityType: ENTITY_TYPES.CAREER,
    entityLink: `/recruiter-dashboard/careers?orgID=${orgID}`,
    metadata: {
      careerTitle,
    },
  });
}

// Trigger notification for project update
export async function triggerProjectUpdateNotification(
  db: any,
  params: {
    projectId: string;
    projectName: string;
    actorId: string;
    recipientIds: string[];
    orgID: string;
    changes?: string[];
  }
): Promise<void> {
  const { projectId, projectName, actorId, recipientIds, orgID, changes } = params;

  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.PROJECT_UPDATED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: projectId,
    entityType: ENTITY_TYPES.PROJECT,
    entityLink: `/recruiter-dashboard/projects/manage/${projectId}?orgID=${orgID}`,
    metadata: {
      projectName,
      changes,
    },
  });
}

// Trigger notification for project deletion
export async function triggerProjectDeleteNotification(
  db: any,
  params: {
    projectId: string;
    projectName: string;
    actorId: string;
    recipientIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { projectId, projectName, actorId, recipientIds, orgID } = params;

  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.PROJECT_DELETED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: projectId,
    entityType: ENTITY_TYPES.PROJECT,
    entityLink: `/recruiter-dashboard/projects?orgID=${orgID}`,
    metadata: {
      projectName,
    },
  });
}

// Trigger notification for career ownership transfer
export async function triggerCareerOwnershipNotification(
  db: any,
  params: {
    careerId: string;
    careerTitle: string;
    actorId: string;
    newOwnerId: string;
    orgID: string;
    previousOwnerId?: string;
  }
): Promise<void> {
  const { careerId, careerTitle, actorId, newOwnerId, orgID, previousOwnerId } = params;

  const recipientIds = [];

  // Only notify new owner if they didn't initiate the transfer
  if (newOwnerId !== actorId) {
    recipientIds.push(newOwnerId);
  }

  // Only notify previous owner if they didn't initiate the transfer
  if (previousOwnerId && previousOwnerId !== actorId) {
    recipientIds.push(previousOwnerId);
  }

  // Early return if no recipients
  if (recipientIds.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.CAREER_OWNERSHIP_TRANSFERRED,
    orgID,
    actorId,
    recipientIds,
    entityId: careerId,
    entityType: ENTITY_TYPES.CAREER,
    entityLink: `/recruiter-dashboard/careers/manage/${careerId}?orgID=${orgID}`,
    metadata: {
      careerTitle,
      newOwnerId,
      previousOwnerId,
    },
  });
}

// Trigger notification for project ownership transfer
export async function triggerProjectOwnershipNotification(
  db: any,
  params: {
    projectId: string;
    projectName: string;
    actorId: string;
    newOwnerId: string;
    orgID: string;
    previousOwnerId?: string;
  }
): Promise<void> {
  const { projectId, projectName, actorId, newOwnerId, orgID, previousOwnerId } = params;

  const recipientIds = [];

  // Only notify new owner if they didn't initiate the transfer
  if (newOwnerId !== actorId) {
    recipientIds.push(newOwnerId);
  }

  // Only notify previous owner if they didn't initiate the transfer
  if (previousOwnerId && previousOwnerId !== actorId) {
    recipientIds.push(previousOwnerId);
  }

  // Early return if no recipients
  if (recipientIds.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.PROJECT_OWNERSHIP_TRANSFERRED,
    orgID,
    actorId,
    recipientIds,
    entityId: projectId,
    entityType: ENTITY_TYPES.PROJECT,
    entityLink: `/recruiter-dashboard/projects/manage/${projectId}?orgID=${orgID}`,
    metadata: {
      projectName,
      newOwnerId,
      previousOwnerId,
    },
  });
}

// Trigger notification for team membership changes
export async function triggerTeamMembershipNotification(
  db: any,
  params: {
    entityId: string;
    entityType: 'career' | 'project';
    entityName: string;
    action: 'added' | 'removed';
    actorId: string;
    affectedUserIds: string[];
    orgID: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const { entityId, entityType, entityName, action, actorId, affectedUserIds, orgID, metadata: additionalMetadata } = params;

  // Filter out the actor from affected users
  const filteredRecipients = affectedUserIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  const notificationType = entityType === 'career'
    ? (action === 'added' ? NOTIFICATION_TYPES.CAREER_TEAM_MEMBER_ADDED : NOTIFICATION_TYPES.CAREER_TEAM_MEMBER_REMOVED)
    : (action === 'added' ? NOTIFICATION_TYPES.PROJECT_TEAM_MEMBER_ADDED : NOTIFICATION_TYPES.PROJECT_TEAM_MEMBER_REMOVED);

  const entityTypeConstant = entityType === 'career' ? ENTITY_TYPES.CAREER : ENTITY_TYPES.PROJECT;
  const entityLink = entityType === 'career'
    ? `/recruiter-dashboard/careers/manage/${entityId}?orgID=${orgID}`
    : `/recruiter-dashboard/projects/manage/${entityId}?orgID=${orgID}`;

  await createNotification(db, {
    type: notificationType,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId,
    entityType: entityTypeConstant,
    entityLink,
    metadata: {
      entityName,
      action,
      ...additionalMetadata,
    },
  });
}

// Trigger notification for application status change
export async function triggerApplicationStatusNotification(
  db: any,
  params: {
    interviewID: string;
    careerId: string;
    candidateName: string;
    oldStatus: string;
    newStatus: string;
    actorId: string;
    recipientIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { interviewID, careerId, candidateName, oldStatus, newStatus, actorId, recipientIds, orgID } = params;

  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.APPLICATION_STATUS_CHANGED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: interviewID,
    entityType: ENTITY_TYPES.APPLICATION,
    entityLink: `/recruiter-dashboard/candidates/application/${interviewID}?orgID=${orgID}`,
    metadata: {
      careerId,
      candidateName,
      oldStatus,
      newStatus,
    },
  });
}

// Trigger notification for interview scheduled
export async function triggerInterviewScheduledNotification(
  db: any,
  params: {
    interviewID: string;
    careerId: string;
    candidateName: string;
    date: string;
    time: string;
    interviewer: string;
    actorId: string;
    recipientIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { interviewID, careerId, candidateName, date, time, interviewer, actorId, recipientIds, orgID } = params;

  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.INTERVIEW_SCHEDULED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: interviewID,
    entityType: ENTITY_TYPES.APPLICATION,
    entityLink: `/recruiter-dashboard/candidates/application/${interviewID}?orgID=${orgID}`,
    metadata: {
      careerId,
      candidateName,
      date,
      time,
      interviewer,
    },
  });
}

// Trigger notification for interview rescheduled
export async function triggerInterviewRescheduledNotification(
  db: any,
  params: {
    interviewID: string;
    careerId: string;
    candidateName: string;
    oldDate: string;
    oldTime: string;
    newDate: string;
    newTime: string;
    actorId: string;
    recipientIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { interviewID, careerId, candidateName, oldDate, oldTime, newDate, newTime, actorId, recipientIds, orgID } = params;

  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.INTERVIEW_RESCHEDULED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: interviewID,
    entityType: ENTITY_TYPES.APPLICATION,
    entityLink: `/recruiter-dashboard/candidates/application/${interviewID}?orgID=${orgID}`,
    metadata: {
      careerId,
      candidateName,
      oldDate,
      oldTime,
      newDate,
      newTime,
    },
  });
}

// Trigger notification for interview completed
export async function triggerInterviewCompletedNotification(
  db: any,
  params: {
    interviewID: string;
    careerId: string;
    candidateName: string;
    outcome?: string;
    actorId: string;
    recipientIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { interviewID, careerId, candidateName, outcome, actorId, recipientIds, orgID } = params;

  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.INTERVIEW_COMPLETED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: interviewID,
    entityType: ENTITY_TYPES.APPLICATION,
    entityLink: `/recruiter-dashboard/candidates/application/${interviewID}?orgID=${orgID}`,
    metadata: {
      careerId,
      candidateName,
      outcome,
    },
  });
}

// Trigger notification for new application received
export async function triggerNewApplicationNotification(
  db: any,
  params: {
    interviewID: string;
    careerId: string;
    careerTitle: string;
    candidateName: string;
    recipientIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { interviewID, careerId, careerTitle, candidateName, recipientIds, orgID } = params;

  if (recipientIds.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.NEW_APPLICATION,
    orgID,
    actorId: 'system',
    recipientIds,
    entityId: interviewID,
    entityType: ENTITY_TYPES.APPLICATION,
    entityLink: `/recruiter-dashboard/candidates/application/${interviewID}?orgID=${orgID}`,
    metadata: {
      careerId,
      careerTitle,
      candidateName,
    },
  });
}

// Trigger notification for application moved in pipeline
export async function triggerApplicationMovedNotification(
  db: any,
  params: {
    interviewID: string;
    careerId: string;
    candidateName: string;
    oldStage: string;
    newStage: string;
    actorId: string;
    recipientIds: string[];
    orgID: string;
  }
): Promise<void> {
  const { interviewID, careerId, candidateName, oldStage, newStage, actorId, recipientIds, orgID } = params;

  const filteredRecipients = recipientIds.filter((id) => id !== actorId);

  if (filteredRecipients.length === 0) {
    return;
  }

  await createNotification(db, {
    type: NOTIFICATION_TYPES.APPLICATION_MOVED,
    orgID,
    actorId,
    recipientIds: filteredRecipients,
    entityId: interviewID,
    entityType: ENTITY_TYPES.APPLICATION,
    entityLink: `/recruiter-dashboard/candidates/application/${interviewID}?orgID=${orgID}`,
    metadata: {
      careerId,
      candidateName,
      oldStage,
      newStage,
    },
  });
}

