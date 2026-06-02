import webpush from 'web-push';
import { Db, ObjectId } from 'mongodb';
import { getUserPushSubscriptions } from './notificationHelpers';
import { PushNotificationPayload } from './pushTypes';

// Track VAPID configuration status
let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  
  if (process.env.NEXT_PUBLIC_VAPID_CLIENT && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:noreply@hellojia.ai',
      process.env.NEXT_PUBLIC_VAPID_CLIENT,
      process.env.VAPID_PRIVATE_KEY
    );
    vapidConfigured = true;
    console.log('[pushHelpers] VAPID configured successfully');
    return true;
  } else {
    console.error('[pushHelpers] VAPID keys not configured!');
    console.error('[pushHelpers] NEXT_PUBLIC_VAPID_CLIENT exists:', !!process.env.NEXT_PUBLIC_VAPID_CLIENT);
    console.error('[pushHelpers] VAPID_PRIVATE_KEY exists:', !!process.env.VAPID_PRIVATE_KEY);
    return false;
  }
}

/**
 * Send push notification to all subscribed devices for a user
 * @param db MongoDB database instance
 * @param userId User email
 * @param orgID Organization ID
 * @param payload Notification payload
 * @returns Object with success and failed counts
 */
export async function sendPushToUser(
  db: Db,
  userId: string,
  orgID: string,
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  // Ensure VAPID is configured before attempting to send
  if (!ensureVapidConfigured()) {
    console.error('[pushHelpers] sendPushToUser: Cannot send push - VAPID not configured');
    return { success: 0, failed: 0 };
  }

  const subscriptions = await getUserPushSubscriptions(db, userId, orgID);

  if (subscriptions.length === 0) {
    return { success: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          JSON.stringify(payload),
          {
            TTL: 60 * 60 * 24, // 24 hours
          }
        );

        // Update lastUsedAt on successful send
        await db.collection('push-subscriptions').updateOne(
          { _id: new ObjectId(sub._id) },
          { $set: { lastUsedAt: new Date() } }
        );

        return { success: true };
      } catch (error: any) {
        // Remove expired/invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db.collection('push-subscriptions').deleteOne({ _id: new ObjectId(sub._id) });
        }

        // Remove subscriptions with 401 errors (invalid VAPID keys)
        if (error.statusCode === 401) {
          await db.collection('push-subscriptions').deleteOne({ _id: new ObjectId(sub._id) });
        }

        return { success: false, error };
      }
    })
  );

  const success = results.filter(
    (r) => r.status === 'fulfilled' && r.value.success
  ).length;
  const failed = results.length - success;
  return { success, failed };
}
