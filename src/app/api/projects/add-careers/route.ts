import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  withAuthAndProjectPermission,
  ProjectAuthenticatedRequest,
} from "@/lib/utils/permissions/projectMiddleware";

export const POST = withAuthAndProjectPermission("link-career")(
  async (req: ProjectAuthenticatedRequest) => {
    try {
      const { careerIds } = await req.json();
      const { db, project, orgID } = req.projectContext;

      if (!Array.isArray(careerIds)) {
        return NextResponse.json(
          { error: "Career IDs must be an array" },
          { status: 400 }
        );
      }

      // Check if careerIds array is empty or contains empty values
      if (careerIds.length === 0) {
        return NextResponse.json(
          { error: "Career IDs array cannot be empty" },
          { status: 400 }
        );
      }

      if (careerIds.some((id) => !id || id.trim() === "")) {
        return NextResponse.json(
          { error: "Career IDs cannot contain empty values" },
          { status: 400 }
        );
      }

      // Remove careers from all other projects in this organization
      await db.collection("projects").updateMany(
        {
          orgID,
          _id: { $ne: new ObjectId(project._id) },
          careers: { $in: careerIds },
        },
        {
          $pull: { careers: { $in: careerIds } } as any,
          $set: { updatedAt: new Date() },
        }
      );

      // Add careers to the current project
      const existingCareers = project.careers || [];
      const allCareerIds = [...new Set([...existingCareers, ...careerIds])];

      await db.collection("projects").updateOne(
        { _id: new ObjectId(project._id) },
        { $set: { careers: allCareerIds, updatedAt: new Date() } }
      );

      return NextResponse.json({
        success: true,
        message: "Careers added to project successfully",
        data: {
          projectId: project._id,
          careers: allCareerIds,
        },
      });
    } catch (error) {
      console.error("Failed to add careers to project:", error);
      return NextResponse.json(
        { error: "Failed to add careers to project" },
        { status: 500 }
      );
    }
  }
);
