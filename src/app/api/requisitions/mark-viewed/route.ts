import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { validateOrgMembership, createAuthError } from "@/lib/utils/requisitionAuthGuard";

// POST /api/requisitions/mark-viewed - Mark requisition as viewed by current user
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();
    const body = await req.json();

    const { requisitionId, orgID } = body;
    const userEmail = req.user?.email;

    // Validate required fields
    if (!requisitionId || !orgID) {
      console.error("[mark-viewed] Missing required data: requisitionId or orgID");
      return NextResponse.json(
        { success: false, message: "Missing required data" },
        { status: 400 }
      );
    }

    if (!userEmail) {
      return NextResponse.json(
        { success: false, message: "User email not found" },
        { status: 401 }
      );
    }

    // SECURITY: Validate user is a member of the organization
    const authResult = await validateOrgMembership(db, userEmail, orgID);
    if (!authResult.authorized) {
      const error = createAuthError(authResult);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    // Update requisition: add user email to viewedBy array (atomic operation)
    const result = await db.collection("requisitions").updateOne(
      {
        _id: new ObjectId(requisitionId),
        orgID: orgID,
      },
      {
        $addToSet: { viewedBy: userEmail }, // $addToSet prevents duplicates
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Requisition not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Requisition marked as viewed",
    });
  } catch (error: any) {
    console.error("Error marking requisition as viewed:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to mark requisition as viewed" },
      { status: 500 }
    );
  }
});
