import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { Project } from "@/lib/types/projects";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { orgID, userEmail, search } = await req.json();

    if (!orgID) {
      return NextResponse.json(
        { error: "Organization ID is required" },
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

    // Get all projects for the organization
    let projects = await db
      .collection("projects")
      .find({ 
        orgID,
        ...(search?.trim() ? {
          name: { $regex: search, $options: "i" },
        } : {})
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Filter projects for hiring managers and guests
    if (userEmail) {
      const member = await db
        .collection("members")
        .findOne({ email: userEmail, orgID });

      if (member?.role === "hiring_manager" || member?.role === "guest") {
        // Get the career _id values that match the user's career id values
        let userCareerIds: string[] = [];
        if (member?.careers?.length > 0) {
          const userCareers = await db
            .collection("careers")
            .find({
              id: { $in: member.careers },
              orgID,
            })
            .project({ _id: 1 })
            .toArray();

          userCareerIds = userCareers.map((c) => c._id.toString());
        }

        // Filter projects to only include those where the user is a member or the owner of the project
        projects = projects.filter((project) => {
          const p = project as unknown as Project;
          const isMember = p.members?.some((m: any) => m.email === userEmail);
          const isOwner = p.owner?.email === userEmail;
          return isMember || isOwner;
        });

        projects = projects.map((project) => {
          const p = project as Project & { _id: ObjectId }; // keep _id as ObjectId
          const filteredCareers = (p.careers || []).filter((careerId: string) =>
            userCareerIds.includes(careerId)
          );
          return {
            ...p,
            careers: filteredCareers,
          };
        });
      }
    }

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
});
