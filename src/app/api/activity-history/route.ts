import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";
import {
  fetchActivityHistory,
  buildActivityHistoryQuery,
  recordActivityHistory,
  ActivityHistoryEvent,
} from "@/lib/utils/activityHistoryHelpers";
import { getUserOrgID } from "@/lib/utils/notificationHelpers";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (Number.isNaN(page) || Number.isNaN(limit) || page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    let orgID =
      searchParams.get("orgID") ||
      searchParams.get("orgId") ||
      searchParams.get("organizationId");

    if (!orgID) {
      orgID = await getUserOrgID(db, user.email);
    } else {
      const membership = await verifyUserIsMember(db, user.email, orgID);
      if (!membership.authorized) {
        return NextResponse.json({ error: membership.reason }, { status: 403 });
      }
    }

    if (!orgID) {
      return NextResponse.json(
        { error: "User organization not found" },
        { status: 404 }
      );
    }

    const careerId = searchParams.get("careerId") || searchParams.get("careerID") || undefined;
    const candidateId =
      searchParams.get("candidateId") || searchParams.get("candidateID") || undefined;
    const candidateEmail =
      searchParams.get("candidateEmail") ||
      searchParams.get("email") ||
      undefined;

    // Validate filter combination early
    buildActivityHistoryQuery({ orgID, careerId, candidateId, candidateEmail });

    const { items, total } = await fetchActivityHistory(db, {
      orgID,
      careerId,
      candidateId,
      candidateEmail,
      page,
      limit,
    });

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
      filters: {
        orgID,
        careerId: careerId || null,
        candidateId: candidateId || null,
        candidateEmail: candidateEmail || null,
      },
    });
  } catch (error: any) {
    console.error("Error fetching activity history:", error);

    if (String(error?.message || "").includes("Organization ID is required")) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch activity history" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const { db } = await connectMongoDB();

    const body = await request.json();
    const {
      orgID,
      careerId,
      candidateId,
      interviewUID,
      action,
      source,
      actor,
      metadata,
      occurredAt,
    } = body;

    // Verify user is member of the organization
    let resolvedOrgID = orgID;
    if (!resolvedOrgID) {
      resolvedOrgID = await getUserOrgID(db, user.email);
    } else {
      const membership = await verifyUserIsMember(db, user.email, resolvedOrgID);
      if (!membership.authorized) {
        return NextResponse.json({ error: membership.reason }, { status: 403 });
      }
    }

    if (!resolvedOrgID) {
      return NextResponse.json(
        { error: "User organization not found" },
        { status: 404 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // Build the activity event
    const event: ActivityHistoryEvent = {
      orgID: resolvedOrgID,
      careerId: careerId || undefined,
      candidateId: candidateId || undefined,
      interviewUID: interviewUID || undefined,
      action,
      source: source || undefined,
      actor: actor || { type: "recruiter", email: user.email, name: user.name || "User" },
      metadata: metadata || {},
      occurredAt: occurredAt || new Date(),
    };

    const result = await recordActivityHistory(db, event);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to record activity" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        id: result.id,
        message: "Activity recorded successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error recording activity history:", error);
    return NextResponse.json(
      { error: "Failed to record activity history" },
      { status: 500 }
    );
  }
});
