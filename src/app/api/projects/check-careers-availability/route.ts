import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { careerIds, orgID } = await req.json();

    if (!Array.isArray(careerIds) || !orgID) {
      console.error("[check-careers-availability] Missing required data: careerIds or orgID");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Find all projects that have any of these careers
    const projectsWithCareers = await db.collection("projects")
      .find({
        orgID,
        careers: { $in: careerIds }
      })
      .project({ _id: 1, name: 1, careers: 1 })
      .toArray();

    // Build status map for each career
    const careerStatuses = careerIds.map(careerId => {
      const linkedProject = projectsWithCareers.find(p =>
        p.careers?.includes(careerId)
      );

      return {
        careerId,
        isAvailable: !linkedProject,
        linkedProject: linkedProject ? {
          _id: linkedProject._id.toString(),
          name: linkedProject.name
        } : null
      };
    });

    return NextResponse.json({ careerStatuses });
  } catch (error) {
    console.error("Failed to check career availability:", error);
    return NextResponse.json(
      { error: "Failed to check career availability" },
      { status: 500 }
    );
  }
});
