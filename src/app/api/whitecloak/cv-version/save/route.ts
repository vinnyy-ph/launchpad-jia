import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";
import {
  buildDigitalCVFromStructuredCV,
  detectEditedSections,
  normalizeStructuredCVInput,
} from "@/lib/utils/structuredCV";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json();
  const { db } = await connectMongoDB();

  const orgID = typeof body?.orgID === "string" ? body.orgID.trim() : "";
  const versionId = typeof body?.versionId === "string" ? body.versionId.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";

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

  const existingVersion = await db.collection("applicant-cv-version").findOne({
    _id: objectId,
    orgID,
  });

  if (!existingVersion) {
    return NextResponse.json({ error: "CV version not found" }, { status: 404 });
  }

  const nextStructuredCV = normalizeStructuredCVInput(body?.structuredCV);
  const editedSections = detectEditedSections(
    existingVersion?.baseStructuredCV ?? existingVersion?.structuredCV,
    nextStructuredCV
  );
  const isEdited = editedSections.length > 0;
  const now = Date.now();

  const updatePayload: Record<string, unknown> = {
    structuredCV: nextStructuredCV,
    digitalCV: buildDigitalCVFromStructuredCV(nextStructuredCV),
    isEdited,
    editedSections,
    updatedBy: {
      uid: request.user?.uid ?? null,
      email: request.user?.email ?? null,
    },
    updatedAt: now,
  };

  if (label) updatePayload.label = label;
  if (status) updatePayload.status = status;

  await db.collection("applicant-cv-version").updateOne(
    { _id: objectId, orgID },
    { $set: updatePayload }
  );

  return NextResponse.json({
    message: "CV version saved",
    version: {
      id: versionId,
      orgID,
      candidateEmail: existingVersion.candidateEmail,
      versionNo: existingVersion.versionNo,
      isEdited,
      editedSections,
      status: updatePayload.status ?? existingVersion.status,
      label: updatePayload.label ?? existingVersion.label,
      updatedAt: now,
    },
  });
});
