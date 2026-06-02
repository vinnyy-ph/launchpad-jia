import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  withAuthAndProjectPermission,
  ProjectAuthenticatedRequest,
} from "@/lib/utils/permissions/projectMiddleware";
import { triggerProjectDeleteNotification } from "@/lib/utils/notificationTriggers";

export const POST = withAuthAndProjectPermission("delete")(
  async (req: ProjectAuthenticatedRequest) => {
    try {
      const { db, project, orgID } = req.projectContext;

      // Store project info before deletion for notification
      const projectName = project.name;
      const projectId = project._id.toString();
      const memberIds = project.members?.map((m: any) => m.email).filter(Boolean) || [];
      const ownerEmail = project.owner?.email;

      // Combine owner and members for notifications (owner should also be notified if different)
      const allRecipients = [...new Set([...memberIds, ownerEmail].filter(Boolean))];

      // Delete the project
      await db.collection("projects").deleteOne({
        _id: new ObjectId(project._id),
      });

      // Trigger deletion notification for project members (after successful deletion)
      if (allRecipients.length > 0) {
        try {
          const actorEmail = req.user?.email;

          await triggerProjectDeleteNotification(db, {
            projectId,
            projectName,
            actorId: actorEmail,
            recipientIds: allRecipients,
            orgID,
          });
        } catch (notificationError) {
          console.error('[delete-project] Failed to trigger deletion notifications:', notificationError);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Project deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete project:", error);
      return NextResponse.json(
        { error: "Failed to delete project" },
        { status: 500 }
      );
    }
  }
);
