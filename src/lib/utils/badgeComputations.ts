import { Db } from 'mongodb';

/**
 * Badge counts for a career
 */
export interface BadgeCounts {
  newComments: number;
  importantActions: number;
}

/**
 * Maps for organizing badge-related data
 */
export interface BadgeDataMaps {
  interviewsByCareer: Map<string, any[]>;
  commentsByInterviewId: Map<string, any[]>;
  requisitionsByCareer: Map<string, number>;
  urgentApplicationsByCareer: Map<string, number>;
}

/**
 * Bulk fetches all badge-related data for multiple careers
 * Executes 4 parallel MongoDB queries
 * @param db - MongoDB database instance
 * @param careerIds - Array of career IDs to fetch badges for
 * @param userId - Current user's Firebase UID (kept for compatibility)
 * @param orgID - Organization ID
 * @param userEmail - Current user's email for view checking
 * @returns Data maps for efficient badge computation
 */
export async function fetchBadgeDataForCareers(
  db: Db,
  careerIds: string[],
  userId: string,
  orgID: string,
  userEmail: string
): Promise<BadgeDataMaps> {
  // Build career ID filters (handle field variations: careerID, careerId, id)
  const careerIdFilter = {
    $or: careerIds.flatMap((id) => [
      { careerID: id },
      { careerId: id },
      { id: id },
    ]),
  };

  // Execute all queries in parallel
  const [
    interviews,
    pendingRequisitions,
    urgentInterviews,
  ] = await Promise.all([
    // 1. Get all interviews for visible careers
    db.collection('interviews').find({
      orgID,
      ...careerIdFilter,
    }).toArray(),

    // 2. Get pending requisitions count per career
    db.collection('requisitions').find({
      orgID,
      ...careerIdFilter,
      status: 'pending',
    }).toArray(),

    // 3. Get urgent applications count per career
    db.collection('interviews').find({
      orgID,
      $and: [
        careerIdFilter,
        {
          $or: [
            { currentStep: { $in: ['Needs Review', 'Pending', 'Awaiting Decision'] } },
            { status: { $in: ['Needs Review', 'Pending', 'Awaiting Decision'] } },
          ],
        },
      ],
    }).toArray(),
  ]);

  // Get interview IDs for comment lookup
  const interviewIDs = interviews.map((i: any) => i.interviewID).filter(Boolean);

  // Fetch comments for all interviews
  const comments = interviewIDs.length > 0
    ? await db.collection('comments').find({
        orgID,
        interviewID: { $in: interviewIDs },
        deleted: { $ne: true },
      }).toArray()
    : [];

  // Build data maps for efficient lookup
  const interviewsByCareer = new Map<string, any[]>();
  const commentsByInterviewId = new Map<string, any[]>();
  const requisitionsByCareer = new Map<string, number>();
  const urgentApplicationsByCareer = new Map<string, number>();

  // Group interviews by career
  interviews.forEach((interview: any) => {
    const careerId = interview.careerID || interview.careerId || interview.id;
    if (!careerId) return;

    if (!interviewsByCareer.has(careerId)) {
      interviewsByCareer.set(careerId, []);
    }
    interviewsByCareer.get(careerId)!.push(interview);
  });

  // Group comments by interview ID
  comments.forEach((comment: any) => {
    const interviewId = comment.interviewID;
    if (!interviewId) return;

    if (!commentsByInterviewId.has(interviewId)) {
      commentsByInterviewId.set(interviewId, []);
    }
    commentsByInterviewId.get(interviewId)!.push(comment);
  });

  // Count pending requisitions per career
  pendingRequisitions.forEach((req: any) => {
    const careerId = req.careerID || req.careerId;
    if (!careerId) return;

    requisitionsByCareer.set(careerId, (requisitionsByCareer.get(careerId) || 0) + 1);
  });

  // Count urgent applications per career
  urgentInterviews.forEach((interview: any) => {
    const careerId = interview.careerID || interview.careerId || interview.id;
    if (!careerId) return;

    urgentApplicationsByCareer.set(careerId, (urgentApplicationsByCareer.get(careerId) || 0) + 1);
  });

  return {
    interviewsByCareer,
    commentsByInterviewId,
    requisitionsByCareer,
    urgentApplicationsByCareer,
  };
}


export function getCareerViewStatusMap(
  careers: any[],
  userEmail: string,
  options?: { onlyRecentCareers?: boolean; daysThreshold?: number }
) {
  const viewStatusMap = new Map<string, boolean>();

  const showOnlyRecent = options?.onlyRecentCareers ?? false;
  const daysThreshold = options?.daysThreshold ?? 30;
  const cutoffDate = showOnlyRecent
    ? new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000)
    : null;

  careers.forEach((career: any) => {
    const careerId = career.id;
    const teamMember = career.teamMembers?.find(
      (m: any) => m.email === userEmail
    );

    let isNew = false;

    if (teamMember) {
      isNew = !teamMember.isViewed;
    } else {
      const viewedBy = career.viewedBy || [];
      isNew = !viewedBy.includes(userEmail);
    }

    if (isNew && cutoffDate && career.createdAt) {
      const careerCreatedAt = new Date(career.createdAt);
      if (careerCreatedAt < cutoffDate) {
        isNew = false;
      }
    }

    viewStatusMap.set(careerId, isNew);
  });

  return viewStatusMap;
}

/**
 * Computes badge counts for a single career using pre-fetched data maps
 * Pure function - testable and side-effect free
 * @param careerId - Career ID to compute badges for
 * @param maps - Pre-fetched data maps from fetchBadgeDataForCareers
 * @param userEmail - Current user's email for view checking
 * @returns Badge counts (newComments and importantActions)
 */
export function computeBadgesForCareer(
  careerId: string,
  maps: BadgeDataMaps,
  userEmail: string
): BadgeCounts {
  let newCommentsCount = 0;
  let importantActionsCount = 0;

  // Count new comments
  const interviews = maps.interviewsByCareer.get(careerId) || [];
  interviews.forEach((interview: any) => {
    const interviewId = interview.interviewID;

    if (!interviewId) return;

    const isDroppedOrCancelled =
      interview.applicationStatus === 'Dropped' ||
      interview.applicationStatus === 'Cancelled';

    if (isDroppedOrCancelled) return;

    const comments = maps.commentsByInterviewId.get(interviewId) || [];

    comments.forEach((comment: any) => {
      // Check if current user has viewed this comment
      if (!comment.viewedBy || !comment.viewedBy.includes(userEmail)) {
        newCommentsCount++;
      }
    });
  });

  // Count important actions
  const pendingReqs = maps.requisitionsByCareer.get(careerId) || 0;
  const urgentApps = maps.urgentApplicationsByCareer.get(careerId) || 0;
  importantActionsCount = pendingReqs + urgentApps;

  return {
    newComments: newCommentsCount,
    importantActions: importantActionsCount,
  };
}

/**
 * Attaches badge counts to an array of career objects (mutates in place)
 * @param careers - Array of career objects
 * @param maps - Pre-fetched data maps from fetchBadgeDataForCareers
 * @param userEmail - Current user's email for comment view checking
 */
export function attachBadgesToCareers(
  careers: any[],
  maps: BadgeDataMaps,
  userEmail: string
): void {
  careers.forEach((career) => {
    const careerId = career.id || career._id?.toString();
    if (!careerId) {
      career.badges = { newComments: 0, importantActions: 0 };
      return;
    }

    career.badges = computeBadgesForCareer(careerId, maps, userEmail);
  });
}

/**
 * Badge counts for a requisition
 */
export interface RequisitionBadgeCounts {
  isNew: boolean;
  isUpdated: boolean;
}

/**
 * Computes badge flags for a single requisition
 * Pure function - testable and side-effect free
 * @param requisition - Requisition object with createdAt/updatedAt/viewedBy
 * @param userEmail - Current user's email
 * @returns Badge flags (isNew, isUpdated)
 */
export function computeBadgesForRequisition(
  requisition: any,
  userEmail: string
): RequisitionBadgeCounts {
  // Check if user has viewed this requisition
  const viewedBy = requisition.viewedBy || [];
  const hasBeenViewed = viewedBy.includes(userEmail);

  // If user has viewed it, no badges
  if (hasBeenViewed) {
    return { isNew: false, isUpdated: false };
  }

  // Handle missing or invalid timestamps
  const createdAt = requisition.createdAt ? new Date(requisition.createdAt) : null;
  const updatedAt = requisition.updatedAt ? new Date(requisition.updatedAt) : null;

  if (!createdAt || isNaN(createdAt.getTime())) {
    return { isNew: false, isUpdated: false };
  }

  // Determine if requisition was modified (updated after creation)
  const wasModified = updatedAt && !isNaN(updatedAt.getTime()) && updatedAt > createdAt;

  // Badge priority: Show "Updated" if modified, otherwise "New"
  if (wasModified) {
    return { isNew: false, isUpdated: true };
  }

  // Not viewed and not modified = New
  return { isNew: true, isUpdated: false };
}

/**
 * Attaches badge counts to an array of requisition objects (mutates in place)
 * @param requisitions - Array of requisition objects
 * @param userEmail - Current user's email for view checking
 */
export function attachBadgesToRequisitions(
  requisitions: any[],
  userEmail: string
): void {
  requisitions.forEach((requisition) => {
    requisition.badges = computeBadgesForRequisition(requisition, userEmail);
  });
}