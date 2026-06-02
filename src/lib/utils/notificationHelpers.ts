import { Db, Collection } from 'mongodb';
import { NotificationDocument } from './notificationTypes';
import { PushSubscriptionDocument } from './pushTypes';

export const NOTIFICATIONS_COLLECTION = 'notifications';
export const PUSH_SUBSCRIPTIONS_COLLECTION = 'push-subscriptions';
export const TAB_VISITS_COLLECTION = 'tab-visits';
export const SEEN_ITEMS_COLLECTION = 'seen-items';

// Get user's organization ID from members collection
export async function getUserOrgID(db: Db, userEmail: string, targetOrgID?: string): Promise<string | null> {
  const query: any = { email: userEmail };
  
  if (targetOrgID) {
    query.orgID = targetOrgID;
  }
  
  const member = await db.collection('members').findOne(query, { projection: { orgID: 1 } });
  if (!member || !member.orgID) {
    return null;
  }
  return member.orgID;
}

// Create indexes for notifications collection
// Call this during application initialization or migration
export async function createNotificationIndexes(db: Db): Promise<void> {
  const collection: Collection<NotificationDocument> = db.collection(NOTIFICATIONS_COLLECTION);
  
  await collection.createIndex(
    { userId: 1, orgID: 1, createdAt: -1 },
    { name: 'user_org_created_idx' }
  );
  
  // Optimized for unread count queries
  await collection.createIndex(
    { userId: 1, orgID: 1, isRead: 1 },
    { name: 'user_org_read_idx' }
  );
  
  await collection.createIndex(
    { userId: 1, isRead: 1 },
    { name: 'user_read_idx' }
  );
  
  await collection.createIndex(
    { orgID: 1, createdAt: -1 },
    { name: 'org_created_idx' }
  );
  
  await collection.createIndex(
    { entityId: 1, entityType: 1 },
    { name: 'entity_idx' }
  );

  // TTL index - auto-delete notifications older than 90 days
  await collection.createIndex(
    { createdAt: 1 },
    { name: 'created_ttl_idx', expireAfterSeconds: 90 * 24 * 60 * 60 }
  );
}

// Fetch notifications for a user with pagination and optional search
export async function fetchUserNotifications(
  db: Db,
  userEmail: string,
  orgID: string,
  page: number = 1,
  limit: number = 20,
  searchQuery?: string
): Promise<{ notifications: NotificationDocument[]; total: number }> {
  const collection: Collection<NotificationDocument> = db.collection(NOTIFICATIONS_COLLECTION);

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    collection.aggregate<NotificationDocument>([
      // Stage 1: Match notifications for this user
      {
        $match: {
          userId: userEmail,
          orgID: orgID
        }
      },
      // Stage 2: Lookup actor from members collection
      {
        $lookup: {
          from: 'members',
          let: { actorEmail: '$actorId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toLower: '$email' }, { $toLower: '$$actorEmail' }]
                }
              }
            },
            {
              $project: {
                name: 1,
                image: 1,
                email: 1
              }
            }
          ],
          as: 'actorData'
        }
      },
      // Stage 3: Add actor field with fallback
      {
        $addFields: {
          actor: {
            $cond: {
              if: { $gt: [{ $size: '$actorData' }, 0] },
              then: { $arrayElemAt: ['$actorData', 0] },
              else: {
                name: 'Unknown User',
                image: '',
                email: '$actorId'
              }
            }
          }
        }
      },
      // Stage 4: Remove temporary field
      {
        $project: {
          actorData: 0
        }
      },
      // Stage 4.5: Search filter (if search query provided)
      ...(searchQuery ? [{
        $match: {
          $or: [
            { summary: { $regex: searchQuery, $options: 'i' } },
            { 'actor.name': { $regex: searchQuery, $options: 'i' } },
            { entityType: { $regex: searchQuery, $options: 'i' } },
            { 'metadata.candidateName': { $regex: searchQuery, $options: 'i' } },
            { 'metadata.careerTitle': { $regex: searchQuery, $options: 'i' } },
            { 'metadata.projectName': { $regex: searchQuery, $options: 'i' } },
            { 'metadata.entityName': { $regex: searchQuery, $options: 'i' } },
            { 'metadata.interviewer': { $regex: searchQuery, $options: 'i' } },
            { 'metadata.oldStatus': { $regex: searchQuery, $options: 'i' } },
            { 'metadata.newStatus': { $regex: searchQuery, $options: 'i' } },
            { 'metadata.oldStage': { $regex: searchQuery, $options: 'i' } },
            { 'metadata.newStage': { $regex: searchQuery, $options: 'i' } },
            { 'metadata.outcome': { $regex: searchQuery, $options: 'i' } }
          ]
        }
      }] : []),
      // Stage 5: Sort by creation date
      {
        $sort: { createdAt: -1 }
      },
      // Stage 6: Pagination
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]).toArray(),
    // Count total with search filter if provided
    searchQuery
      ? collection.aggregate([
          { $match: { userId: userEmail, orgID } },
          {
            $lookup: {
              from: 'members',
              let: { actorEmail: '$actorId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [{ $toLower: '$email' }, { $toLower: '$$actorEmail' }]
                    }
                  }
                },
                { $project: { name: 1, image: 1, email: 1 } }
              ],
              as: 'actorData'
            }
          },
          {
            $addFields: {
              actor: {
                $cond: {
                  if: { $gt: [{ $size: '$actorData' }, 0] },
                  then: { $arrayElemAt: ['$actorData', 0] },
                  else: { name: 'Unknown User', image: '', email: '$actorId' }
                }
              }
            }
          },
          {
            $match: {
              $or: [
                { summary: { $regex: searchQuery, $options: 'i' } },
                { 'actor.name': { $regex: searchQuery, $options: 'i' } },
                { entityType: { $regex: searchQuery, $options: 'i' } },
                { 'metadata.candidateName': { $regex: searchQuery, $options: 'i' } },
                { 'metadata.careerTitle': { $regex: searchQuery, $options: 'i' } },
                { 'metadata.projectName': { $regex: searchQuery, $options: 'i' } },
                { 'metadata.entityName': { $regex: searchQuery, $options: 'i' } },
                { 'metadata.interviewer': { $regex: searchQuery, $options: 'i' } },
                { 'metadata.oldStatus': { $regex: searchQuery, $options: 'i' } },
                { 'metadata.newStatus': { $regex: searchQuery, $options: 'i' } },
                { 'metadata.oldStage': { $regex: searchQuery, $options: 'i' } },
                { 'metadata.newStage': { $regex: searchQuery, $options: 'i' } },
                { 'metadata.outcome': { $regex: searchQuery, $options: 'i' } }
              ]
            }
          },
          { $count: 'total' }
        ]).toArray().then(result => result[0]?.total ?? 0)
      : collection.countDocuments({ userId: userEmail, orgID })
  ]);

  return { notifications, total };
}

// Count unread notifications for a user
export async function countUnreadNotifications(
  db: Db,
  userEmail: string,
  orgID: string
): Promise<number> {
  const collection: Collection<NotificationDocument> = db.collection(NOTIFICATIONS_COLLECTION);
  
  return await collection.countDocuments({
    userId: userEmail,
    orgID,
    isRead: false
  });
}

// Mark notification as read
export async function markNotificationAsRead(
  db: Db,
  notificationId: string,
  userEmail: string,
  orgID: string
): Promise<boolean> {
  const collection: Collection<NotificationDocument> = db.collection(NOTIFICATIONS_COLLECTION);
  const { ObjectId } = require('mongodb');
  
  const result = await collection.updateOne(
    { _id: new ObjectId(notificationId), userId: userEmail, orgID },
    { $set: { isRead: true } }
  );
  
  return result.modifiedCount > 0;
}

// Mark all notifications as read for a user
export async function markAllNotificationsAsRead(
  db: Db,
  userEmail: string,
  orgID: string
): Promise<number> {
  const collection: Collection<NotificationDocument> = db.collection(NOTIFICATIONS_COLLECTION);
  
  const result = await collection.updateMany(
    { userId: userEmail, orgID, isRead: false },
    { $set: { isRead: true } }
  );
  
  return result.modifiedCount;
}

// Create notifications for multiple recipients
export async function createNotifications(
  db: Db,
  notifications: Omit<NotificationDocument, '_id' | 'createdAt' | 'isRead'>[]
): Promise<string[]> {
  const collection: Collection<NotificationDocument> = db.collection(NOTIFICATIONS_COLLECTION);
  
  const notificationsToInsert = notifications.map(n => ({
    ...n,
    isRead: false,
    createdAt: new Date()
  }));
  
  const result = await collection.insertMany(notificationsToInsert);
  
  return Object.values(result.insertedIds).map(id => id.toString());
}

// Notification preferences structure for org members
export interface NotificationPreferences {
  commentsAndMentions: 'none' | 'mentions' | 'all';
  careerUpdates: boolean;
  projectUpdates: boolean;
  careerPublished: boolean;
  careerOwnershipTransferred: boolean;
  projectOwnershipTransferred: boolean;
  careerTeamMembership: boolean;
  projectTeamMembership: boolean;
  requisitions: 'none' | 'new' | 'all';
}

// Notification preferences structure for guest members
export interface GuestNotificationPreferences {
  requisitionApproved: boolean;
  requisitionHold: boolean;
  careerPublished: boolean;
  careerTeamMembership: boolean;
  commentsAndMentions: 'none' | 'mentions' | 'all';
}

// Get user notification preferences
// Returns user's notification settings from members collection
// Returns appropriate defaults based on user role
export async function getUserNotificationPreferences(
  db: Db,
  userEmail: string,
  orgID: string
): Promise<NotificationPreferences | GuestNotificationPreferences> {
  const member = await db.collection('members').findOne({ email: userEmail, orgID });

  const isGuest = member?.role === 'guest';

  // Default preferences for guest members
  const defaultGuestPreferences: GuestNotificationPreferences = {
    requisitionApproved: true,
    requisitionHold: true,
    careerPublished: true,
    careerTeamMembership: true,
    commentsAndMentions: 'mentions',
  };

  // Default preferences for non-guest members
  const defaultPreferences: NotificationPreferences = {
    commentsAndMentions: 'all',
    careerUpdates: true,
    projectUpdates: true,
    careerPublished: true,
    careerOwnershipTransferred: true,
    projectOwnershipTransferred: true,
    careerTeamMembership: true,
    projectTeamMembership: true,
    requisitions: 'all',
  };

  if (!member || !member.notificationPreferences) {
    return isGuest ? defaultGuestPreferences : defaultPreferences;
  }

  // Merge with appropriate defaults based on role
  if (isGuest) {
    return {
      ...defaultGuestPreferences,
      ...member.notificationPreferences,
    };
  } else {
    return {
      ...defaultPreferences,
      ...member.notificationPreferences,
    };
  }
}

// Update user notification preferences
export async function updateUserNotificationPreferences(
  db: Db,
  userEmail: string,
  orgID: string,
  preferences: Partial<NotificationPreferences> | Partial<GuestNotificationPreferences>
): Promise<boolean> {
  const result = await db.collection('members').updateOne(
    { email: userEmail, orgID },
    { $set: { notificationPreferences: preferences } }
  );

  return result.modifiedCount > 0;
}

// Check if a notification should be created based on user preferences
// Handles both regular user and guest preferences
export function shouldCreateNotification(
  notificationType: string,
  preferences: NotificationPreferences | GuestNotificationPreferences,
  _metadata?: Record<string, any>
): boolean {
  const isGuestPreferences = (prefs: any): prefs is GuestNotificationPreferences => {
    return 'requisitionApproved' in prefs || 'requisitionHold' in prefs;
  };

  const isGuest = isGuestPreferences(preferences);

  // Map notification types to preference checks
  switch (notificationType) {
    case 'comment':
      if (preferences.commentsAndMentions === 'none') {
        return false;
      }
      if (preferences.commentsAndMentions === 'mentions') {
        return false;
      }
      return true;

    case 'tag':
      return preferences.commentsAndMentions !== 'none';

    case 'career_updated':
    case 'career_deleted':
      if (isGuestPreferences(preferences)) return false;
      return preferences.careerUpdates;

    case 'project_updated':
    case 'project_deleted':
      if (isGuestPreferences(preferences)) return false;
      return preferences.projectUpdates;

    case 'career_published':
    case 'career_unpublished':
      return preferences.careerPublished;

    case 'career_ownership_transferred':
      if (isGuestPreferences(preferences)) return false;
      return preferences.careerOwnershipTransferred;

    case 'project_ownership_transferred':
      if (isGuestPreferences(preferences)) return false;
      return preferences.projectOwnershipTransferred;

    case 'career_team_member_added':
    case 'career_team_member_removed':
      return preferences.careerTeamMembership;

    case 'project_team_member_added':
    case 'project_team_member_removed':
      if (isGuestPreferences(preferences)) return false;
      return preferences.projectTeamMembership;

    case 'requisition_created':
      if (!isGuestPreferences(preferences)) {
        if (preferences.requisitions === 'none') {
          return false;
        }
        return true; // 'new' or 'all' allow creation notifications
      }
      return false;

    case 'requisition_approved':
      if (isGuestPreferences(preferences)) return preferences.requisitionApproved;
      return preferences.requisitions === 'all';

    case 'requisition_hold':
      if (isGuestPreferences(preferences)) return preferences.requisitionHold;
      return preferences.requisitions === 'all';

    case 'career_added':
    case 'project_added':
      return true;

    case 'application_status_changed':
    case 'interview_scheduled':
    case 'interview_rescheduled':
    case 'interview_completed':
    case 'new_application':
    case 'application_moved':
      return true;

    // Default: allow
    default:
      return true;
  }
}

// Push Subscription Helper Functions

// Save push subscription to database
// Upserts by endpoint to prevent duplicate subscriptions
export async function savePushSubscription(
  db: Db,
  userId: string,
  orgID: string,
  subscription: PushSubscriptionJSON,
  userAgent?: string
): Promise<string> {
  const collection: Collection<PushSubscriptionDocument> = db.collection(PUSH_SUBSCRIPTIONS_COLLECTION);

  const result = await collection.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      $set: {
        userId,
        orgID,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys?.p256dh ?? '',
          auth: subscription.keys?.auth ?? '',
        },
        userAgent,
        lastUsedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  return result?._id?.toString() || '';
}

// Get all push subscriptions for a user
export async function getUserPushSubscriptions(
  db: Db,
  userId: string,
  orgID: string
): Promise<PushSubscriptionDocument[]> {
  const collection: Collection<PushSubscriptionDocument> = db.collection(PUSH_SUBSCRIPTIONS_COLLECTION);

  return await collection.find({ userId, orgID }).toArray();
}

// Remove push subscription (user logs out or denies permission)
export async function removePushSubscription(
  db: Db,
  endpoint: string
): Promise<boolean> {
  const collection: Collection<PushSubscriptionDocument> = db.collection(PUSH_SUBSCRIPTIONS_COLLECTION);

  const result = await collection.deleteOne({ endpoint });
  return result.deletedCount > 0;
}

// Create indexes for push subscriptions collection
export async function createPushSubscriptionIndexes(db: Db): Promise<void> {
  const collection: Collection<PushSubscriptionDocument> = db.collection(PUSH_SUBSCRIPTIONS_COLLECTION);

  // Index for fast lookups when sending notifications
  await collection.createIndex(
    { userId: 1, orgID: 1 },
    { name: 'user_org_idx' }
  );

  // Unique index to prevent duplicate subscriptions
  await collection.createIndex(
    { endpoint: 1 },
    { name: 'endpoint_idx', unique: true }
  );

  // TTL index - auto-delete unused subscriptions after 90 days
  await collection.createIndex(
    { lastUsedAt: 1 },
    { name: 'last_used_ttl_idx', expireAfterSeconds: 90 * 24 * 60 * 60 }
  );
}

// Create indexes for tab-visits collection
export async function createTabVisitsIndexes(db: Db): Promise<void> {
  const collection = db.collection(TAB_VISITS_COLLECTION);

  await collection.createIndex(
    { userId: 1, tabName: 1, orgID: 1 },
    { name: 'user_tab_org_idx', unique: true }
  );

  await collection.createIndex(
    { orgID: 1, lastVisitedAt: -1 },
    { name: 'org_visited_idx' }
  );
}

// Create indexes for seen-items collection
export async function createSeenItemsIndexes(db: Db): Promise<void> {
  const collection = db.collection(SEEN_ITEMS_COLLECTION);

  await collection.createIndex(
    { userId: 1, itemType: 1, itemId: 1, orgID: 1 },
    { name: 'user_item_org_idx', unique: true }
  );

  await collection.createIndex(
    { orgID: 1, seenAt: -1 },
    { name: 'org_seen_idx' }
  );
}

// Create indexes for comment-views collection
export async function createCommentViewsIndexes(db: Db): Promise<void> {
  const collection = db.collection('comment-views');

  // Compound index for fast applicant comment view lookups
  await collection.createIndex(
    { userId: 1, applicantEmail: 1, orgID: 1 },
    { name: 'user_applicant_org_idx', unique: true }
  );

  // Index for org-scoped queries
  await collection.createIndex(
    { orgID: 1, lastViewedAt: -1 },
    { name: 'org_viewed_idx' }
  );
}

// Check if an item is new for a user (not seen and created after last tab visit)
export async function isItemNew(
  db: Db,
  userId: string,
  orgID: string,
  itemType: 'career' | 'requisition',
  itemId: string,
  itemCreatedAt: Date
): Promise<boolean> {
  // Get last tab visit for the item type
  const tabName = itemType === 'career' ? 'careers' : 'requisitions';
  const tabVisits = db.collection(TAB_VISITS_COLLECTION);
  const visit = await tabVisits.findOne({
    userId,
    orgID,
    tabName
  });

  if (!visit || !visit.lastVisitedAt) {
    return false;
  }

  if (itemCreatedAt <= visit.lastVisitedAt) {
    return false;
  }

  const seenItems = db.collection(SEEN_ITEMS_COLLECTION);
  const seen = await seenItems.findOne({
    userId,
    orgID,
    itemType,
    itemId
  });

  return !seen;
}

// Mark items as seen for a user (bulk operation on tab visit)
export async function markItemsAsSeen(
  db: Db,
  userId: string,
  orgID: string,
  itemType: 'career' | 'requisition',
  itemIds: string[]
): Promise<number> {
  const seenItems = db.collection(SEEN_ITEMS_COLLECTION);
  const now = new Date();

  const operations = itemIds.map(itemId => ({
    updateOne: {
      filter: { userId, orgID, itemType, itemId },
      update: { $set: { seenAt: now } },
      upsert: true
    }
  }));

  if (operations.length === 0) {
    return 0;
  }

  const result = await seenItems.bulkWrite(operations);
  return result.upsertedCount + result.modifiedCount;
}
