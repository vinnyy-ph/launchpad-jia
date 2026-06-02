import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { sourceCareerId, targetCareerId, orgID } = body;

    // Validate required fields
    if (!sourceCareerId || !targetCareerId || !orgID) {
      return NextResponse.json(
        { success: false, error: "sourceCareerId, targetCareerId, and orgID are required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const automationsCollection = db.collection("automations");

    // 1. Delete any existing automations for the target career
    // This ensures we have a clean slate if replacing an existing pipeline
    await automationsCollection.deleteMany({
      orgID,
      careerId: targetCareerId,
    });

    // 2. Find all automations from the source career
    const sourceAutomations = await automationsCollection
      .find({
        orgID,
        careerId: sourceCareerId,
      })
      .toArray();

    // 3. If there are automations to copy, insert them for the target career
    if (sourceAutomations.length > 0) {
      const newAutomations = sourceAutomations.map((auto) => {
        const { _id, ...rest } = auto;
        return {
          ...rest,
          careerId: targetCareerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      await automationsCollection.insertMany(newAutomations);
    }

    return NextResponse.json({
      success: true,
      message: "Automations copied successfully",
      copiedCount: sourceAutomations.length,
    });
  } catch (error) {
    console.error("Error copying email automations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to copy email automations" },
      { status: 500 }
    );
  }
});
