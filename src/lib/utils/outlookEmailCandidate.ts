import { ObjectId } from "mongodb";

export interface OutlookMessage {
  id: string;
  internetMessageId?: string;
  conversationId: string;
  subject: string;
  from?: {
    emailAddress?: {
      address: string;
      name: string;
    };
  };
  toRecipients?: Array<{
    emailAddress?: {
      address: string;
      name: string;
    };
  }>;
  inReplyTo?: string;
  references?: string;
  receivedDateTime: string;
}

export interface ThreadMetadata {
  _id: ObjectId;
  appThreadId: string;
  mode: "mailgun" | "gmail" | "outlook";
  outlookConversationId?: string;
}

/**
 * Determines if an Outlook message is relevant to the app.
 * A message is relevant if ANY of these conditions are true:
 * 1. conversationId matches an existing thread
 * 2. inReplyTo matches a message sent by app
 * 3. references matches a message sent by app
 * 4. from is app-connected Outlook account (sent message)
 * 5. to contains app-connected Outlook account (received message to tracked account)
 */
export function isRelevantEmailCandidate(
  message: OutlookMessage,
  knownThreads: Map<string, ThreadMetadata>,
  knownMessageIds: Set<string>,
  appSentFromAddresses: Set<string>,
): boolean {
  // Rule 1: Check if conversationId matches an existing thread
  if (message.conversationId && knownThreads.has(message.conversationId)) {
    return true;
  }

  // Rule 2: Check if inReplyTo matches a message sent by app
  const inReplyToId = message.inReplyTo;
  if (inReplyToId && knownMessageIds.has(inReplyToId)) {
    return true;
  }

  // Rule 3: Check references field (contains message IDs this replies to)
  if (message.references) {
    const referencedIds = message.references.split(" ");
    for (const refId of referencedIds) {
      if (knownMessageIds.has(refId)) {
        return true;
      }
    }
  }

  // Rule 4: Check if message is FROM an app-connected Outlook account
  // (indicates it's a sent message we need to track)
  const fromAddress = message.from?.emailAddress?.address;
  if (fromAddress && appSentFromAddresses.has(fromAddress)) {
    return true;
  }

  // Rule 5: Check if message is TO an app-connected Outlook account
  // (indicates it's an inbound message to a tracked account)
  if (message.toRecipients && message.toRecipients.length > 0) {
    for (const recipient of message.toRecipients) {
      const toAddress = recipient?.emailAddress?.address;
      if (toAddress && appSentFromAddresses.has(toAddress)) {
        return true;
      }
    }
  }

  return false;
}
