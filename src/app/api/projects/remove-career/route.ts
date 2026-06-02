import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  withAuthAndProjectPermission,
  ProjectAuthenticatedRequest,
} from "@/lib/utils/permissions/projectMiddleware";

export const POST = withAuthAndProjectPermission("remove-career")(
  async (req: ProjectAuthenticatedRequest) => {
    try {
      const { careerId } = await req.json();
      const { db, project } = req.projectContext;

      if (!careerId) {
        return NextResponse.json(
          { error: "Career ID is required" },
          { status: 400 }
        );
      }

      const updatedCareers = (project.careers || []).filter(
        (id: string) => id !== careerId
      );

      await db.collection("projects").updateOne(
        { _id: new ObjectId(project._id) },
        { $set: { careers: updatedCareers, updatedAt: new Date() } }
      );

      return NextResponse.json({
        success: true,
        message: "Career removed from project successfully",
        data: {
          projectId: project._id,
          careers: updatedCareers,
        },
      });
    } catch (error) {
      console.error("Failed to remove career from project:", error);
      return NextResponse.json(
        { error: "Failed to remove career from project" },
        { status: 500 }
      );
    }
  }
);
