import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json();
  const { db } = await connectMongoDB();

  const orgID = typeof body?.orgID === "string" ? body.orgID.trim() : "";
  const versionId = typeof body?.versionId === "string" ? body.versionId.trim() : "";

  if (!orgID || !versionId) {
    return NextResponse.json(
      { error: "orgID and versionId are required" },
      { status: 400 }
    );
  }

  const requesterEmail = request.user?.email || "";
  const authResult = await verifyUserIsMember(db, requesterEmail, orgID);
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.reason }, { status: 403 });
  }

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(versionId);
  } catch {
    return NextResponse.json({ error: "Invalid versionId" }, { status: 400 });
  }

  const deleteResult = await db.collection("applicant-cv-version").deleteOne({
    _id: objectId,
    orgID,
  });

  if (deleteResult.deletedCount === 0) {
    return NextResponse.json({ error: "CV version not found" }, { status: 404 });
  }

  return NextResponse.json({
    message: "CV version deleted",
    versionId,
  });
});
