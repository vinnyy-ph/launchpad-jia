import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { careerId, orgID } = await req.json();

    if (!careerId || !orgID) {
      console.error("[get-project-by-career] Missing required data: careerId or orgID");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const organization = await db.collection("organizations").findOne({
      _id: new ObjectId(orgID),
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (!organization.projectsEnabled) {
      return NextResponse.json(
        { success: true, project: null },
        { status: 200 }
      );
    }

    const project = await db.collection("projects").findOne({
      careers: careerId,
      orgID,
    });

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("Failed to fetch project by career:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
});
