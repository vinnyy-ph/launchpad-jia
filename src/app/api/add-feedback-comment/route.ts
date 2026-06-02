import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";
import { sanitizeString, containsSuspiciousPatterns } from '@/lib/utils/sanitizeInput';
import { NOTIFICATION_TYPES, ENTITY_TYPES } from '@/lib/utils/notificationTypes';
import {
  getUserOrgID,
  createNotifications,
  getUserNotificationPreferences,
  shouldCreateNotification,
} from '@/lib/utils/notificationHelpers';
import { sendPushToUser } from '@/lib/utils/pushHelpers';
import { logActivity } from "@/lib/utils/activityLogger";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const {
    interviewID,
    orgID,
    comment,
    mentions,
    createdBy,
    createdAt,
    parentId,
    replyTo,
    type,
    candidateEmail,
  } = await request.json(); // Added parentId for one layer reply support; now supports type, candidateEmail, mentions, and replyTo
  const { db } = await connectMongoDB();

  // Basic validations
  // Require orgID and comment in all cases
  if (!orgID || !comment) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate type and scope
  const validTypes = ["application", "candidate"] as const;
  const resolvedType = typeof type === 'string' ? type : 'application';
  if (!validTypes.includes(resolvedType as (typeof validTypes)[number])) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  // For application comments, interviewID is required
  if (resolvedType === 'application' && !interviewID) {
    return NextResponse.json({ error: "interviewID is required for application comments" }, { status: 400 });
  }

  // For candidate comments, candidateEmail is required and interviewID should be null/undefined
  if (resolvedType === 'candidate') {
    if (!candidateEmail) {
      return NextResponse.json({ error: "candidateEmail is required for candidate comments" }, { status: 400 });
    }
  }

  // Sanitize comment server-side first. Use 'strict' to remove any HTML;
  // use 'moderate' if you want to allow a small subset.
  const finalComment = sanitizeString(comment, 'strict');

  // If the raw input contains suspicious patterns, prefer to sanitize and continue.
  // However, if sanitization removed everything (empty/too-short), reject to avoid
  // storing content that was only disallowed payloads.
  if (containsSuspiciousPatterns(comment)) {
    if (!finalComment || finalComment.trim().length < 1) {
      return NextResponse.json({ error: "Comment contains disallowed content" }, { status: 400 });
    }
    // Log sanitized-but-suspicious input for monitoring/inspection
    console.warn('[Sanitize] Suspicious content sanitized for interviewID=', interviewID);
  }

  // Optional: enforce length cap
  const MAX_LEN = 5000;
  const safeText = finalComment.length > MAX_LEN ? finalComment.slice(0, MAX_LEN) : finalComment;

  // Create the comment object (for standalone comments collection)
  const commentObj: any = {
    _id: new ObjectId(),
    interviewID: resolvedType === 'application' ? interviewID : null,
    orgID,
    text: safeText, // Use sanitized text
    createdBy: createdBy || null,
    createdAt: createdAt ? new Date(createdAt) : new Date(),
    type: resolvedType,
    candidateEmail: resolvedType === 'candidate' ? candidateEmail : null,
    mentions: mentions,
    viewedBy: [createdBy?.email].filter(Boolean), // Initialize with author's email so they don't see their own comment as unread
  };

  // Handle parentId if provided
  if (parentId) {
    try {
      commentObj.parentId = new ObjectId(parentId);
    } catch {
      return NextResponse.json({ error: "Invalid parentId" }, { status: 400 });
    }
  }

  // Store replyTo context for threaded reply chains
  if (replyTo && replyTo._id) {
    commentObj.replyTo = {
      _id: replyTo._id,
      name: replyTo.name || null,
      email: replyTo.email || null,
    };
  }

  // Insert into separate comments collection
  await db.collection("comments").insertOne(commentObj);

  // Log activity for application comments (including replies)
  if (resolvedType === 'application' && interviewID) {
    try {
      const interview = await db.collection("interviews").findOne({ interviewID });
      if (interview) {
        await logActivity({
          db,
          kind: "recruiter_commented_on_application",
          interview,
          actor: {
            type: "recruiter",
            id: createdBy?.id,
            email: createdBy?.email,
            name: createdBy?.name,
            image: createdBy?.image,
          },
          extraMetadata: {
            comment: safeText,
            isReply: !!parentId,
            replyTo: replyTo?.name || null,
          },
        });
      }
    } catch (error) {
      console.error("Failed to log comment activity:", error);
    }
  }

  // Trigger notifications for application comments
  if (resolvedType === 'application' && interviewID) {
    try {
      const interview = await db.collection("interviews")
        .findOne({ interviewID });

      if (interview?.id) {

        // Get career to find team members
        // Note: careers collection uses 'id' field (string), not '_id'
        const career = await db.collection("careers")
          .findOne({ id: interview.id });

        // Get actor info and entity names (shared by COMMENT and TAG notifications)
        const actorEmail = createdBy?.email || 'unknown';
        const candidateName = interview.name || 'Unknown Candidate';
        const careerName = career?.jobTitle || 'Unknown Role';

        // Get actor's orgID for validation (shared by both notification types)
        const actorOrgID = await getUserOrgID(db, actorEmail, orgID);
        if (!actorOrgID) {
          console.warn('[add-feedback-comment] Actor organization not found, skipping notifications');
          return NextResponse.json({ comment: commentObj });
        }

        // Lookup actor from members collection for summary generation
        const actor = await db.collection('members').findOne({
          email: actorEmail.toLowerCase(),
          orgID: actorOrgID
        });
        const actorName = actor?.name || 'Someone';

        // Extract team member emails
        const recipientEmails = career?.teamMembers?.map((m: any) => m.email).filter(Boolean) || [];

        // Get mentioned user emails for filtering (resolve user IDs to emails)
        const mentionedEmails: string[] = [];
        if (mentions && Array.isArray(mentions)) {
          for (const m of mentions) {
            let email = m.email || m.id;

            // If we got a user ID instead of email, look it up
            if (email && !email.includes('@')) {
              try {
                let user = await db.collection('members').findOne({
                  _id: new ObjectId(email)
                });
                if (!user) {
                  user = await db.collection('members').findOne({
                    id: email
                  });
                }
                if (user?.email) {
                  email = user.email;
                } else {
                  console.warn('[add-feedback-comment] User not found for filtering, ID:', email);
                }
              } catch (err) {
                console.error('[add-feedback-comment] Error looking up user for filtering:', err);
              }
            }

            if (email && email.includes('@')) {
              mentionedEmails.push(email.toLowerCase());
            }
          }
        }

        // Create COMMENT notifications for team members (excluding mentioned users)
        if (recipientEmails.length > 0) {
          // Filter out the comment author and mentioned users
          const filteredRecipients = recipientEmails.filter((email: string) => {
            const emailLower = email.toLowerCase();
            return emailLower !== actorEmail.toLowerCase() && !mentionedEmails.includes(emailLower);
          });

          if (filteredRecipients.length > 0) {
            const commentPreview = safeText.length > 100 ? `${safeText.substring(0, 100)}...` : safeText;
            const summary = `${actorName} commented: ${commentPreview}`;

            const notificationsToCreate = [];

            for (const recipientEmail of filteredRecipients) {
              const recipientOrgID = await getUserOrgID(db, recipientEmail, orgID);

              if (!recipientOrgID) {
                console.warn(`[add-feedback-comment] Recipient ${recipientEmail} not found, skipping`);
                continue;
              }

              if (recipientOrgID !== actorOrgID) {
                console.warn(`[add-feedback-comment] Recipient ${recipientEmail} not in same org, skipping`);
                continue;
              }

              const preferences = await getUserNotificationPreferences(db, recipientEmail, recipientOrgID);

              if (!shouldCreateNotification(NOTIFICATION_TYPES.COMMENT, preferences)) {
                continue;
              }

              notificationsToCreate.push({
                userId: recipientEmail,
                orgID: recipientOrgID,
                type: NOTIFICATION_TYPES.COMMENT,
                actorId: actorEmail,
                summary: summary,
                entityId: interviewID,
                entityType: ENTITY_TYPES.APPLICATION,
                entityLink: `/recruiter-dashboard/careers/manage/${interview.id}/interview-analysis/${interviewID}?tab=Comments`,
                metadata: {
                  commentId: commentObj._id.toString(),
                  careerId: interview.id, // interview.id is the careerID
                  candidateName: candidateName,
                  careerName: careerName,
                },
                createdAt: new Date(),
                isRead: false,
              });
            }

            // Create COMMENT notifications in bulk
            if (notificationsToCreate.length > 0) {
              const notificationIds = await createNotifications(db, notificationsToCreate);

              // Send push notifications (fire-and-forget)
              Promise.allSettled(
                notificationsToCreate.map((notification, index) => {
                  return sendPushToUser(db, notification.userId, notification.orgID, {
                    title: 'New Comment',
                    body: notification.summary,
                    notificationId: notificationIds[index],
                    entityLink: notification.entityLink,
                    type: notification.type,
                  });
                })
              ).catch(err => {
                console.error('[add-feedback-comment] Failed to send COMMENT push notifications:', err);
              });
            }
          }
        }

        // Create TAG notifications for mentioned users
        if (mentions && Array.isArray(mentions) && mentions.length > 0) {
          const tagNotificationsToCreate = [];

          for (const mention of mentions) {
            let mentionedEmail = mention.email || mention.id;

            // If we got a user ID instead of email, resolve it
            if (mentionedEmail && !mentionedEmail.includes('@')) {
              try {
                let mentionedUser = await db.collection('members').findOne({
                  _id: new ObjectId(mentionedEmail)
                });
                if (!mentionedUser) {
                  mentionedUser = await db.collection('members').findOne({
                    id: mentionedEmail
                  });
                }
                if (mentionedUser?.email) {
                  mentionedEmail = mentionedUser.email;
                } else {
                  console.warn('[add-feedback-comment] User not found for ID:', mentionedEmail);
                  continue;
                }
              } catch (err) {
                console.error('[add-feedback-comment] Error looking up user:', err);
                continue;
              }
            }

            if (!mentionedEmail || !mentionedEmail.includes('@')) {
              console.warn('[add-feedback-comment] Skipping mention without valid email:', mention);
              continue;
            }

            // Skip self-mentions
            if (mentionedEmail.toLowerCase() === actorEmail.toLowerCase()) {
              continue;
            }

            const mentionedUserOrgID = await getUserOrgID(db, mentionedEmail, orgID);

            if (!mentionedUserOrgID) {
              console.warn(`[add-feedback-comment] Mentioned user ${mentionedEmail} not found, skipping`);
              continue;
            }

            if (mentionedUserOrgID !== actorOrgID) {
              console.warn(`[add-feedback-comment] Mentioned user ${mentionedEmail} not in same org, skipping`);
              continue;
            }

            const preferences = await getUserNotificationPreferences(db, mentionedEmail, mentionedUserOrgID);

            if (!shouldCreateNotification(NOTIFICATION_TYPES.TAG, preferences)) {
              continue;
            }

            const tagSummary = `${actorName} tagged you in a comment`;

            tagNotificationsToCreate.push({
              userId: mentionedEmail,
              orgID: mentionedUserOrgID,
              type: NOTIFICATION_TYPES.TAG,
              actorId: actorEmail,
              summary: tagSummary,
              entityId: interviewID,
              entityType: ENTITY_TYPES.APPLICATION,
              entityLink: `/recruiter-dashboard/careers/manage/${interview.id}/interview-analysis/${interviewID}?tab=Comments`,
              metadata: {
                commentId: commentObj._id.toString(),
                careerId: interview.id,
                candidateName: candidateName,
                careerName: careerName,
                commentPreview: safeText.length > 100 ? `${safeText.substring(0, 100)}...` : safeText,
              },
              createdAt: new Date(),
              isRead: false,
            });
          }

          // Create TAG notifications in bulk
          if (tagNotificationsToCreate.length > 0) {
            const tagNotificationIds = await createNotifications(db, tagNotificationsToCreate);

            // Send push notifications (fire-and-forget)
            Promise.allSettled(
              tagNotificationsToCreate.map((notification, index) => {
                return sendPushToUser(db, notification.userId, notification.orgID, {
                  title: 'You were mentioned',
                  body: notification.summary,
                  notificationId: tagNotificationIds[index],
                  entityLink: notification.entityLink,
                  type: notification.type,
                });
              })
            ).catch(err => {
              console.error('[add-feedback-comment] Failed to send TAG push notifications:', err);
            });
          }
        }

        await db.collection("recruiter-history").insertOne({
          interviewUID: interview._id.toString(),
          orgID: orgID,
          action: "Added Feedback Comment",
          recruiterEmail: createdBy?.email,
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      // Log error but don't fail the comment creation
      console.error('[add-feedback-comment] Failed to trigger notifications:', err);
    }
  }

  // Return the created comment (keep shape compatible)
  return NextResponse.json({ comment: commentObj });
});
