import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import {
  canTransferOwnership,
  canManageProjectMembers,
  canRenameProject,
} from "@/lib/utils/permissions/projectAccess";
import { Project } from "@/lib/types/projects";
import {
  triggerProjectUpdateNotification,
  triggerProjectOwnershipNotification,
  triggerTeamMembershipNotification,
} from "@/lib/utils/notificationTriggers";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { projectId, members, owner, name, orgID } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

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

    const project = (await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      orgID,
    })) as unknown as Project;

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const userMember = await db.collection("members").findOne({
      email: req.user.email,
      orgID,
    });

    if (members !== undefined && !Array.isArray(members)) {
      return NextResponse.json(
        { error: "Members must be an array" },
        { status: 400 }
      );
    }

    if (
      members !== undefined &&
      Array.isArray(members) &&
      members.length === 0
    ) {
      return NextResponse.json(
        { error: "Project must have at least one member" },
        { status: 400 }
      );
    }

    if (name !== undefined && typeof name === "string" && !name.trim()) {
      return NextResponse.json(
        { error: "Project name cannot be empty" },
        { status: 400 }
      );
    }

    if (owner !== undefined && owner.email !== project.owner.email) {
      // Check if new owner is a guest
      const newOwnerMember = await db.collection("members").findOne({
        email: owner.email,
        orgID,
      });

      if (newOwnerMember?.role === "guest") {
        return NextResponse.json(
          { error: "Cannot transfer ownership to a guest user" },
          { status: 400 }
        );
      }

      if (
        !(await canTransferOwnership(
          req.user.email,
          project,
          orgID,
          db,
          userMember
        ))
      ) {
        return NextResponse.json(
          {
            error:
              "You do not have permission to transfer ownership of this project",
          },
          { status: 403 }
        );
      }
    }

    if (members !== undefined) {
      if (
        !(await canManageProjectMembers(
          req.user.email,
          project,
          orgID,
          db,
          userMember
        ))
      ) {
        return NextResponse.json(
          { error: "You do not have permission to manage project members" },
          { status: 403 }
        );
      }
    }

    if (name !== undefined && name.trim() !== project.name) {
      if (
        !(await canRenameProject(
          req.user.email,
          project,
          orgID,
          db,
          userMember
        ))
      ) {
        return NextResponse.json(
          { error: "You do not have permission to rename this project" },
          { status: 403 }
        );
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (members !== undefined) {
      updateData.members = members;
    }

    if (owner !== undefined) {
      // When transferring ownership, add the previous owner as a member if not already
      if (owner.email !== project.owner.email) {
        const currentMembers =
          (members !== undefined ? members : project.members) || [];
        const previousOwnerIsMember = currentMembers.some(
          (m: any) => m.email === project.owner.email
        );

        if (!previousOwnerIsMember) {
          updateData.members = [
            ...currentMembers,
            {
              name: project.owner.name,
              email: project.owner.email,
              image: project.owner.image,
              role: "Member",
            },
          ];
        }
      }

      updateData.owner = owner;
    }

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    await db
      .collection("projects")
      .updateOne({ _id: new ObjectId(project._id) }, { $set: updateData });

    // Trigger notifications for project changes
    const actorEmail = req.user?.email;

    try {
      const isOwnershipTransfer = owner !== undefined && owner.email !== project.owner.email;
      const isSelfOwnership = isOwnershipTransfer && owner.email === actorEmail;

      // 1. Check for ownership transfer (skip if transferring to self)
      if (isOwnershipTransfer && !isSelfOwnership) {
        // Get final members list for notifying other team members
        const finalMembers = (updateData.members as any[]) || project.members || [];
        const allTeamEmails = [
          ...finalMembers.map((m: any) => m.email),
          project.owner.email,
        ].filter(Boolean);

        // Notify new owner and previous owner
        await triggerProjectOwnershipNotification(db, {
          projectId: project._id.toString(),
          projectName: name?.trim() || project.name,
          newOwnerId: owner.email,
          previousOwnerId: project.owner.email,
          actorId: actorEmail,
          orgID,
        });

        // Notify other team members about the ownership change
        const otherMembers = allTeamEmails.filter(
          (email) => email !== owner.email && email !== project.owner.email && email !== actorEmail
        );

        if (otherMembers.length > 0) {
          await triggerProjectUpdateNotification(db, {
            projectId: project._id.toString(),
            projectName: name?.trim() || project.name,
            actorId: actorEmail,
            recipientIds: otherMembers,
            orgID,
            changes: ['ownership'],
          });
        }
      }

      // 2. Check for member changes (skip if ownership transfer is happening)
      if (updateData.members !== undefined && !isOwnershipTransfer) {
        const oldMemberEmails = new Set(project.members?.map((m: any) => m.email) || []);

        // Use the actual members that were saved to the database
        const finalMembers = updateData.members as any[];
        const newMemberEmails = new Set(finalMembers?.map((m: any) => m.email) || []);

        // Find added members
        const addedMembers = finalMembers?.filter(
          (m: any) => m.email && !oldMemberEmails.has(m.email)
        ) || [];

        // Find removed members
        const removedMembers = project.members?.filter(
          (m: any) => m.email && !newMemberEmails.has(m.email)
        ) || [];

        // Trigger notifications for added members
        if (addedMembers.length > 0) {
          const addedMemberNames = addedMembers.map((m: any) => m.name).filter(Boolean);

          for (const member of addedMembers) {
            // Skip notification if the added member is the actor
            if (member.email !== actorEmail) {
              await triggerTeamMembershipNotification(db, {
                entityId: project._id.toString(),
                entityType: 'project',
                entityName: name?.trim() || project.name,
                action: 'added',
                actorId: actorEmail,
                affectedUserIds: [member.email],
                orgID,
              });
            }
          }

          // Notify existing members about new additions
          const existingMembers = Array.from(oldMemberEmails).filter(
            (email) => email !== actorEmail
          );

          if (existingMembers.length > 0) {
            await triggerProjectUpdateNotification(db, {
              projectId: project._id.toString(),
              projectName: name?.trim() || project.name,
              actorId: actorEmail,
              recipientIds: existingMembers,
              orgID,
              changes: ['members_added'],
            });
          }
        }

        // Trigger notifications for removed members
        if (removedMembers.length > 0) {
          const removedMemberNames = removedMembers.map((m: any) => m.name).filter(Boolean);

          await triggerTeamMembershipNotification(db, {
            entityId: project._id.toString(),
            entityType: 'project',
            entityName: name?.trim() || project.name,
            action: 'removed',
            actorId: actorEmail,
            affectedUserIds: removedMembers.map((m: any) => m.email),
            orgID,
          });

          // Notify remaining members about removals
          const remainingMembers = Array.from(newMemberEmails).filter(
            (email) => email !== actorEmail
          );

          if (remainingMembers.length > 0) {
            await triggerProjectUpdateNotification(db, {
              projectId: project._id.toString(),
              projectName: name?.trim() || project.name,
              actorId: actorEmail,
              recipientIds: remainingMembers,
              orgID,
              changes: ['members_removed'],
            });
          }
        }
      }

      // 3. Check for general project updates (name changes, non-ownership, non-member changes)
      if (name !== undefined && name.trim() !== project.name) {
        const currentMembers = (members !== undefined ? members : project.members) || [];
        const allMemberIds = [
          ...currentMembers.map((m: any) => m.email),
          owner?.email || project.owner.email,
        ].filter(Boolean);

        await triggerProjectUpdateNotification(db, {
          projectId: project._id.toString(),
          projectName: name.trim(),
          actorId: actorEmail,
          recipientIds: allMemberIds,
          orgID,
          changes: ['name'],
        });
      }
    } catch (notificationError) {
      // Log but don't fail the project update
      console.error('[update-project] Failed to trigger notifications:', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: "Project updated successfully",
      data: {
        projectId: project._id,
        ...updateData,
      },
    });
  } catch (error) {
    console.error("Failed to update project members:", error);
    return NextResponse.json(
      { error: "Failed to update project members" },
      { status: 500 }
    );
  }
});
