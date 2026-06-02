import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  const { orgId, status } = await request.json();

  if (!orgId || !status) {
    console.error("[toggle-org-access] Missing required data: orgId or status");
    return NextResponse.json(
      { error: "Missing required data" },
      { status: 400 }
    );
  }

  if (!["active", "inactive"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'active' or 'inactive'" },
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

    await db.collection("organizations").updateOne(
      { _id: new ObjectId(orgId) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      message: `Organization ${status === "active" ? "activated" : "deactivated"} successfully`,
      status,
    });
  } catch (error) {
    console.error("Error toggling org access:", error);
    return NextResponse.json(
      { error: "Error toggling organization access" },
      { status: 500 }
    );
  }
});
