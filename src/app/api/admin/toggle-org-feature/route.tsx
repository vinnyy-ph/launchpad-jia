import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  const { orgId, feature, enabled } = await request.json();

  if (!orgId || !feature || typeof enabled !== "boolean") {
    console.error("[toggle-org-feature] Missing required data: orgId, feature, or enabled");
    return NextResponse.json(
      { error: "Missing required data" },
      { status: 400 }
    );
  }

  const validFeatures = ["projectsEnabled", "guestPortalEnabled", "brandedPortalEnabled", "globalHiringEnabled", "linkedCareersEnabled"];
  if (!validFeatures.includes(feature)) {
    return NextResponse.json(
      { error: `Invalid feature. Valid features: ${validFeatures.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const { db } = await connectMongoDB();

    const organization = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgId) });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Update only the specified feature (no nested features object)
    const updateFields: any = {
      [feature]: enabled,
      updatedAt: new Date(),
    };

    // Features are independent - no cascading updates

    await db.collection("organizations").updateOne(
      { _id: new ObjectId(orgId) },
      { $set: updateFields }
    );

    return NextResponse.json({
      message: `Feature '${feature}' ${enabled ? "enabled" : "disabled"} successfully`,
      feature,
      enabled,
    });
  } catch (error) {
    console.error("Error toggling org feature:", error);
    return NextResponse.json(
      { error: "Error toggling organization feature" },
      { status: 500 }
    );
  }
});
