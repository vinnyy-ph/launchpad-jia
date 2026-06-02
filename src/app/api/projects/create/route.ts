import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { sanitizeString } from "@/lib/utils/sanitizeInput";
import { triggerTeamMembershipNotification } from "@/lib/utils/notificationTriggers";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { orgID, name, owner, members } = await req.json();

    if (!orgID) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    if (!owner) {
      return NextResponse.json(
        { error: "Project owner is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(members)) {
      return NextResponse.json(
        { error: "Members must be an array" },
        { status: 400 }
      );
    }

    if (members.length === 0) {
      return NextResponse.json(
        { error: "Project must have at least one member" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Check if organization has projects enabled
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

    // Check if the user creating the project is a guest
    const creatorMember = await db.collection("members").findOne({
      email: req.user.email,
      orgID,
    });

    if (creatorMember?.role === "guest") {
      return NextResponse.json(
        { error: "Guest users cannot create projects" },
        { status: 403 }
      );
    }

    // Validate that the project owner is not a guest
    const ownerMember = await db.collection("members").findOne({
      email: owner.email,
      orgID,
    });

    if (ownerMember?.role === "guest") {
      return NextResponse.json(
        { error: "Guest users cannot be project owners" },
        { status: 400 }
      );
    }

    const sanitizedName =  name
      ? sanitizeString(name, "strict")
      : name;

    const createdBy = {
      _id: req.user.uid,
      email: req.user.email,
      name: req.user.name,
      image: req.user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${req.user.name}`
    };

    const result = await db.collection("projects").insertOne({
      orgID,
      name: sanitizedName,
      owner,
      members,
      careers: [],
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const projectID = result.insertedId.toString();

    // Trigger notifications for team members (after successful project creation)
    try {
      const actorEmail = req.user?.email;

      // Notify all members (except the creator) that they were added to the project
      if (members && members.length > 0) {
        for (const member of members) {
          if (member.email && member.email !== actorEmail) {
            await triggerTeamMembershipNotification(db, {
              entityId: projectID,
              entityType: 'project',
              entityName: sanitizedName,
              action: 'added',
              actorId: actorEmail,
              affectedUserIds: [member.email],
              orgID,
            });
          }
        }
      }
    } catch (notificationError) {
      // Log but don't fail the project creation
      console.error('[create-project] Failed to trigger team member notifications:', notificationError);
    }

    return NextResponse.json({ 
      success: true,
      message: "Project created successfully",
      projectID,
    });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
});
