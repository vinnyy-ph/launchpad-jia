export const NOTIFICATION_TYPES = {
  COMMENT: 'comment',
  TAG: 'tag',
  CAREER_ADDED: 'career_added',
  PROJECT_ADDED: 'project_added',
  CAREER_PUBLISHED: 'career_published',
  CAREER_UNPUBLISHED: 'career_unpublished',
  CAREER_UPDATED: 'career_updated',
  CAREER_DELETED: 'career_deleted',
  PROJECT_UPDATED: 'project_updated',
  PROJECT_DELETED: 'project_deleted',
  CAREER_OWNERSHIP_TRANSFERRED: 'career_ownership_transferred',
  PROJECT_OWNERSHIP_TRANSFERRED: 'project_ownership_transferred',
  CAREER_TEAM_MEMBER_ADDED: 'career_team_member_added',
  CAREER_TEAM_MEMBER_REMOVED: 'career_team_member_removed',
  PROJECT_TEAM_MEMBER_ADDED: 'project_team_member_added',
  PROJECT_TEAM_MEMBER_REMOVED: 'project_team_member_removed',
  REQUISITION_CREATED: 'requisition_created',
  REQUISITION_APPROVED: 'requisition_approved',
  REQUISITION_HOLD: 'requisition_hold',
  APPLICATION_STATUS_CHANGED: 'application_status_changed',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  INTERVIEW_RESCHEDULED: 'interview_rescheduled',
  INTERVIEW_COMPLETED: 'interview_completed',
  NEW_APPLICATION: 'new_application',
  APPLICATION_MOVED: 'application_moved',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export const ENTITY_TYPES = {
  CAREER: 'career',
  APPLICATION: 'application',
  PROJECT: 'project',
  REQUISITION: 'requisition',
  COMMENT: 'comment',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];

// Notification document structure for MongoDB
export interface NotificationDocument {
  _id?: string;
  userId: string;
  orgID: string;
  type: NotificationType;
  actorId: string;
  actor?: {
    name: string;
    image: string;
    email: string;
  };
  summary: string;
  entityId: string;
  entityType: EntityType;
  entityLink: string;
  isRead: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}

// Request body for creating notifications
export interface CreateNotificationRequest {
  type: NotificationType;
  actorId: string;
  recipientIds: string[];
  entityId: string;
  entityType: EntityType;
  entityLink: string;
  summary?: string;
  metadata?: Record<string, any>;
}

// Response from notification fetch API
export interface NotificationResponse {
  notifications: NotificationDocument[];
  total: number;
  hasMore: boolean;
  page: number;
  limit: number;
}

// Helper function to generate summary based on notification type
export function generateNotificationSummary(
  type: NotificationType,
  actorName: string,
  entityType: EntityType,
): string {
  switch (type) {
    case NOTIFICATION_TYPES.COMMENT:
      return `${actorName} commented on ${entityType}`;
    case NOTIFICATION_TYPES.TAG:
      return `${actorName} tagged you in a comment`;
    case NOTIFICATION_TYPES.CAREER_ADDED:
      return `${actorName} added you to a career`;
    case NOTIFICATION_TYPES.PROJECT_ADDED:
      return `${actorName} added you to a project`;
    case NOTIFICATION_TYPES.CAREER_PUBLISHED:
      return `${actorName} published a career`;
    case NOTIFICATION_TYPES.CAREER_UNPUBLISHED:
      return `${actorName} unpublished a career`;
    case NOTIFICATION_TYPES.CAREER_UPDATED:
      return `${actorName} updated a career`;
    case NOTIFICATION_TYPES.CAREER_DELETED:
      return `${actorName} deleted a career`;
    case NOTIFICATION_TYPES.PROJECT_UPDATED:
      return `${actorName} updated a project`;
    case NOTIFICATION_TYPES.PROJECT_DELETED:
      return `${actorName} deleted a project`;
    case NOTIFICATION_TYPES.CAREER_OWNERSHIP_TRANSFERRED:
      return `${actorName} transferred career ownership`;
    case NOTIFICATION_TYPES.PROJECT_OWNERSHIP_TRANSFERRED:
      return `${actorName} transferred project ownership`;
    case NOTIFICATION_TYPES.CAREER_TEAM_MEMBER_ADDED:
      return `${actorName} added you to a career team`;
    case NOTIFICATION_TYPES.CAREER_TEAM_MEMBER_REMOVED:
      return `${actorName} removed you from a career team`;
    case NOTIFICATION_TYPES.PROJECT_TEAM_MEMBER_ADDED:
      return `${actorName} added you to a project team`;
    case NOTIFICATION_TYPES.PROJECT_TEAM_MEMBER_REMOVED:
      return `${actorName} removed you from a project team`;
    case NOTIFICATION_TYPES.REQUISITION_CREATED:
      return `${actorName} created a new requisition`;
    case NOTIFICATION_TYPES.REQUISITION_APPROVED:
      return `${actorName} approved a requisition`;
    case NOTIFICATION_TYPES.REQUISITION_HOLD:
      return `${actorName} put a requisition on hold`;
    case NOTIFICATION_TYPES.APPLICATION_STATUS_CHANGED:
      return `${actorName} changed an application status`;
    case NOTIFICATION_TYPES.INTERVIEW_SCHEDULED:
      return `${actorName} scheduled an interview`;
    case NOTIFICATION_TYPES.INTERVIEW_RESCHEDULED:
      return `${actorName} rescheduled an interview`;
    case NOTIFICATION_TYPES.INTERVIEW_COMPLETED:
      return `${actorName} completed an interview`;
    case NOTIFICATION_TYPES.NEW_APPLICATION:
      return `New application received`;
    case NOTIFICATION_TYPES.APPLICATION_MOVED:
      return `${actorName} moved an application in the pipeline`;
    default:
      return `${actorName} performed an action`;
  }
}

