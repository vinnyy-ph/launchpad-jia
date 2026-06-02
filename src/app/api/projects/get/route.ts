import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { projectId, orgID } = await req.json();

    if (!projectId || !orgID) {
      console.error("[get-project] Missing required data: projectId or orgID");
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
        { error: "Projects feature is not enabled for this organization" },
        { status: 403 }
      );
    }

    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      orgID,
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
});
