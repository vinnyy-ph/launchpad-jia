export interface PushSubscriptionDocument {
  _id?: string;
  userId: string;
  orgID: string;
  endpoint: string;        // Push service endpoint
  keys: {
    p256dh: string;        // Encryption key
    auth: string;          // Authentication secret
  };
  userAgent?: string;      // Browser/device info for debugging
  createdAt: Date;
  lastUsedAt: Date;        // Track last successful push
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  notificationId: string;
  entityLink: string;
  type: string;
}
