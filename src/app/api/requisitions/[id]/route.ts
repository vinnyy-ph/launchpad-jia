import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  validateRequisitionAccess,
  createAuthError,
  sanitizeUpdateRequisitionPayload,
  isValidObjectId,
} from "@/lib/utils/requisitionAuthGuard";

async function ensureRequisitionsEnabledForOrg(db: any, orgId: string) {
  if (!orgId || !isValidObjectId(orgId)) {
    return {
      ok: false as const,
      status: 400,
      message: "Invalid organization ID on requisition",
    };
  }

  const org = await db.collection("organizations").findOne({ _id: new ObjectId(orgId) });
  if (!org) {
    return { ok: false as const, status: 404, message: "Organization not found" };
  }

  const guestPortalEnabledEffective =
    typeof (org as any)?.guestPortalEnabled === "boolean"
      ? Boolean((org as any).guestPortalEnabled)
      : Boolean((org as any)?.projectsEnabled);

  if (!guestPortalEnabledEffective) {
    return {
      ok: false as const,
      status: 403,
      message: "Requisitions are disabled for this organization",
    };
  }

  return { ok: true as const };
}

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
  
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// GET /api/requisitions/[id] - Get single requisition
export const GET = withAuth(async (
  req: AuthenticatedRequest,
  context: any
) => {
  try {
    const { db } = await connectMongoDB();
    const params = await context.params;
    const { id } = params;

    // SECURITY: Validate ObjectId format (prevents injection via ID)
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid requisition ID format" },
        { status: 400 }
      );
    }

    // Fetch requisition
    const requisition = await db
      .collection("requisitions")
      .findOne({ _id: new ObjectId(id) });

    if (!requisition) {
      return NextResponse.json(
        { success: false, message: "Requisition not found" },
        { status: 404 }
      );
    }

    // SECURITY: Validate org membership and requisition access
    const authResult = await validateRequisitionAccess(db, req.user, requisition, "read");
    if (!authResult.authorized) {
      const error = createAuthError(authResult);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      requisition: {
        id: requisition._id.toString(),
        positionName: requisition.positionName,
        referenceNo: requisition.referenceNo,
        dateSubmitted: formatRelativeDate(requisition.createdAt),
        status: requisition.status,
        submittedBy: requisition.submittedBy,
        formData: requisition.formData,
        moreInfoReason: requisition.moreInfoReason,
        moreInfoBy: requisition.moreInfoBy,
        moreInfoByEmail: (requisition as any).moreInfoByEmail,
        moreInfoByAvatar: (requisition as any).moreInfoByAvatar,
        cancelReason: requisition.cancelReason,
        createdAt: requisition.createdAt,
        updatedAt: requisition.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error fetching requisition:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch requisition" },
      { status: 500 }
    );
  }
});

// PUT /api/requisitions/[id] - Update requisition
export const PUT = withAuth(async (
  req: AuthenticatedRequest,
  context: any
) => {
  try {
    const { db } = await connectMongoDB();
    const params = await context.params;
    const { id } = params;
    const body = await req.json();

    // SECURITY: Validate ObjectId format (prevents injection via ID)
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid requisition ID format" },
        { status: 400 }
      );
    }

    // SECURITY: Sanitize and validate input payload
    const sanitizationResult = sanitizeUpdateRequisitionPayload(body);
    if (!sanitizationResult.valid) {
      console.error("[Update Requisition] Validation failed:", sanitizationResult.error);
      console.error("[Update Requisition] Received payload:", JSON.stringify(body, null, 2));
      return NextResponse.json(
        { success: false, message: sanitizationResult.error },
        { status: 400 }
      );
    }

    const { formData } = sanitizationResult.sanitized;

    // Fetch existing requisition
    const existingRequisition = await db
      .collection("requisitions")
      .findOne({ _id: new ObjectId(id) });

    if (!existingRequisition) {
      return NextResponse.json(
        { success: false, message: "Requisition not found" },
        { status: 404 }
      );
    }

    // FEATURE GATE: Block edits when Guest Portal/Requisitions are disabled for the org
    const orgGate = await ensureRequisitionsEnabledForOrg(db, (existingRequisition as any)?.orgID);
    if (!orgGate.ok) {
      return NextResponse.json(
        { success: false, message: orgGate.message },
        { status: orgGate.status }
      );
    }

    // SECURITY: Validate org membership and write access
    const authResult = await validateRequisitionAccess(
      db,
      req.user,
      existingRequisition,
      "write"
    );
    if (!authResult.authorized) {
      const error = createAuthError(authResult);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    // ENFORCE MUTABILITY RULES: Only allow editing form data when status is In Review or Requires More Info
    const currentStatus = existingRequisition.status as
      | "In Review"
      | "Requires More Info"
      | "Active"
      | "On Hold"
      | "Cancelled"
      | "Completed"
      | string;

    const editableStatuses = ["In Review", "Requires More Info"];

    if (!editableStatuses.includes(currentStatus)) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Cannot edit requisition with status '${currentStatus}'. Only requisitions with status 'In Review' or 'Requires More Info' can be edited.`,
        },
        { status: 400 }
      );
    }

    // Update requisition with sanitized data
    const now = new Date();
    const updateDoc: any = {
      $set: {
        positionName: formData.positionName,
        formData,
        // Do not modify createdAt; treat edits as updates, not new submissions
        updatedAt: now,
      },
    };

    // When a guest resubmits after "Requires More Info", move it back to "In Review"
    // and clear more-info metadata.
    if (currentStatus === "Requires More Info") {
      updateDoc.$set.status = "In Review";
      updateDoc.$unset = {
        moreInfoReason: "",
        moreInfoBy: "",
        moreInfoByEmail: "",
        moreInfoByAvatar: "",
      };
    }

    const result = await db
      .collection("requisitions")
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        updateDoc,
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json(
        { success: false, message: "Failed to update requisition" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requisition: {
        id: result._id.toString(),
        positionName: result.positionName,
        referenceNo: result.referenceNo,
        dateSubmitted: formatRelativeDate(result.createdAt),
        status: result.status,
        submittedBy: result.submittedBy,
        formData: result.formData,
        moreInfoReason: result.moreInfoReason,
        moreInfoBy: result.moreInfoBy,
        moreInfoByEmail: (result as any).moreInfoByEmail,
        moreInfoByAvatar: (result as any).moreInfoByAvatar,
        cancelReason: result.cancelReason,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
      message: "Requisition updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating requisition:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update requisition" },
      { status: 500 }
    );
  }
});

// DELETE /api/requisitions/[id] - Delete requisition
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  context: any
) => {
  try {
    const { db } = await connectMongoDB();
    const params = await context.params;
    const { id } = params;

    // SECURITY: Validate ObjectId format (prevents injection via ID)
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid requisition ID format" },
        { status: 400 }
      );
    }

    // Fetch existing requisition to check authorization
    const existingRequisition = await db
      .collection("requisitions")
      .findOne({ _id: new ObjectId(id) });

    if (!existingRequisition) {
      return NextResponse.json(
        { success: false, message: "Requisition not found" },
        { status: 404 }
      );
    }

    // FEATURE GATE: Block deletes when Guest Portal/Requisitions are disabled for the org
    const orgGate = await ensureRequisitionsEnabledForOrg(db, (existingRequisition as any)?.orgID);
    if (!orgGate.ok) {
      return NextResponse.json(
        { success: false, message: orgGate.message },
        { status: orgGate.status }
      );
    }

    // SECURITY: Validate org membership and delete access
    const authResult = await validateRequisitionAccess(db, req.user, existingRequisition, "delete");
    if (!authResult.authorized) {
      const error = createAuthError(authResult);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    // Delete requisition
    const result = await db
      .collection("requisitions")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Failed to delete requisition" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Requisition deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting requisition:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete requisition" },
      { status: 500 }
    );
  }
});
