import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  validateOrgMembership,
  guardCreateRequisition,
  createAuthError,
  sanitizeCreateRequisitionPayload,
} from "@/lib/utils/requisitionAuthGuard";
import { triggerRequisitionNotification } from '@/lib/utils/notificationTriggers';
import { attachBadgesToRequisitions } from '@/lib/utils/badgeComputations';

// Helper function to format relative time from a date
function formatRelativeDate(date: Date | string | undefined): string {
  if (!date) return "Unknown";
  
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Unknown";
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  
  // Format as date for older entries
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// GET /api/requisitions - List all requisitions
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();
    const { searchParams } = new URL(req.url);
    
    // Get query parameters
    const orgID = searchParams.get("orgID") || req.user?.orgID;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;
    const filterByUser = searchParams.get("filterByUser") === "true"; // For guest portal
    const includeBadges = searchParams.get("includeBadges") === "true"; // For badge computation

    if (!orgID) {
      return NextResponse.json(
        { success: false, message: "Organization ID is required" },
        { status: 400 }
      );
    }

    // SECURITY: Validate user is a member of the requested organization
    const authResult = await validateOrgMembership(db, req.user?.email, orgID);
    if (!authResult.authorized) {
      const error = createAuthError(authResult);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    
    const member = authResult.member;
    const userEmail = req.user?.email;
    
    console.log("[GET /api/requisitions] userEmail:", userEmail, "orgID:", orgID, "filterByUser:", filterByUser);

    // Build query - always filter by orgID
    const query: any = { orgID };
    
    // If filterByUser is true (guest portal), only show user's own requisitions
    if (filterByUser && userEmail) {
      query["submittedBy.email"] = userEmail;
    }
    
    if (status) {
      query.status = status;
    }

    console.log("[GET /api/requisitions] Query:", JSON.stringify(query));

    // Fetch requisitions with pagination
    const requisitions = await db
      .collection("requisitions")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    console.log("[GET /api/requisitions] Found:", requisitions.length, "requisitions");

    // Compute badges if requested
    if (includeBadges && requisitions.length > 0 && req.user?.email) {
      attachBadgesToRequisitions(requisitions, req.user.email);
    }

    // Get total count for pagination
    const total = await db.collection("requisitions").countDocuments(query);

    return NextResponse.json({
      success: true,
      requisitions: requisitions.map((req) => ({
        id: req._id.toString(),
        positionName: req.positionName,
        referenceNo: req.referenceNo,
        dateSubmitted: formatRelativeDate(req.createdAt),
        status: req.status,
        approvalCareerId: (req as any).approvalCareerId,
        submittedBy: req.submittedBy,
        formData: req.formData,
        moreInfoReason: req.moreInfoReason,
        moreInfoBy: req.moreInfoBy,
        moreInfoByEmail: (req as any).moreInfoByEmail,
        moreInfoByAvatar: (req as any).moreInfoByAvatar,
        cancelReason: req.cancelReason,
        previousStatus: (req as any).previousStatus,
        cancelRequestPreviousStatus: (req as any).cancelRequestPreviousStatus,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        viewedBy: req.viewedBy,
        badges: req.badges,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching requisitions:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch requisitions" },
      { status: 500 }
    );
  }
});

// POST /api/requisitions - Create new requisition
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();
    const body = await req.json();
    
    // SECURITY: Sanitize and validate input payload (prevents NoSQL injection & extra fields)
    const sanitizationResult = sanitizeCreateRequisitionPayload(body);
    if (!sanitizationResult.valid) {
      return NextResponse.json(
        { success: false, message: sanitizationResult.error },
        { status: 400 }
      );
    }

    const { formData, orgID, submittedBy } = sanitizationResult.sanitized;

    // SECURITY: Validate user is a member of the target organization
    const authResult = await guardCreateRequisition(db, req.user, orgID);
    if (!authResult.authorized) {
      const error = createAuthError(authResult);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    // SECURITY: Ensure submittedBy email matches authenticated user (prevent impersonation)
    if (submittedBy.email !== req.user.email) {
      return NextResponse.json(
        { success: false, message: "Cannot create requisition on behalf of another user" },
        { status: 403 }
      );
    }

    // Generate reference number
    const timestamp = Date.now().toString().slice(-6);
    const referenceNo = `REQ${timestamp}`;

    const now = new Date();
    // Store actual timestamp - frontend will format as relative time
    const dateSubmitted = now.toISOString();

    // Create requisition document
    const requisitionDoc = {
      positionName: formData.positionName,
      referenceNo,
      dateSubmitted,
      status: "In Review",
      orgID,
      submittedBy: {
        memberID: submittedBy.memberID || req.user?.id,
        name: submittedBy.name,
        email: submittedBy.email,
        avatar: submittedBy.avatar || "",
      },
      formData,
      createdAt: now,
      updatedAt: now,
    };

    // Insert into database
    const result = await db.collection("requisitions").insertOne(requisitionDoc);

    // Trigger notification for admins
    try {
      const admins = await db.collection('members').find({
        orgID: orgID,
        role: 'admin'
      }).toArray();

      const adminEmails = admins.map((admin: any) => admin.email).filter(Boolean);

      // Filter out the actor from recipients
      const filteredRecipients = adminEmails.filter((email: string) => email !== req.user.email);

      if (filteredRecipients.length > 0) {

        await triggerRequisitionNotification(db, {
          requisitionId: result.insertedId.toString(),
          type: 'created',
          actorId: req.user.email,
          recipientIds: filteredRecipients,
          orgID: orgID,
          metadata: {
            positionName: formData.positionName,
            referenceNo: referenceNo,
          },
        });
      }
    } catch (notificationError) {
      console.error('Failed to trigger requisition creation notification:', notificationError);
      // Don't fail the request if notification fails
    }

    // Return created requisition
    const createdRequisition = {
      id: result.insertedId.toString(),
      ...requisitionDoc,
    };

    return NextResponse.json(
      {
        success: true,
        requisition: createdRequisition,
        message: "Requisition created successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating requisition:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create requisition" },
      { status: 500 }
    );
  }
});
