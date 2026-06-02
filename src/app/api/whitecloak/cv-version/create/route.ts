import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";
import {
  buildDigitalCVFromStructuredCV,
  buildStructuredCVFromDigitalCV,
  STRUCTURED_CV_SCHEMA_VERSION,
  normalizeStructuredCVInput,
} from "@/lib/utils/structuredCV";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json();
  const { db } = await connectMongoDB();

  const orgID = typeof body?.orgID === "string" ? body.orgID.trim() : "";
  const candidateEmail =
    typeof body?.candidateEmail === "string"
      ? body.candidateEmail.trim().toLowerCase()
      : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";

  if (!orgID || !candidateEmail) {
    return NextResponse.json(
      { error: "orgID and candidateEmail are required" },
      { status: 400 }
    );
  }

  const requesterEmail = request.user?.email || "";
  const authResult = await verifyUserIsMember(db, requesterEmail, orgID);
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.reason }, { status: 403 });
  }

  const masterCV = await db.collection("applicant-cv").findOne({
    email: candidateEmail,
  });

  if (!masterCV) {
    return NextResponse.json(
      { error: "Candidate CV not found in applicant-cv" },
      { status: 404 }
    );
  }

  const rawStructuredCV = masterCV?.structuredCV
    ? normalizeStructuredCVInput(masterCV.structuredCV)
    : buildStructuredCVFromDigitalCV(Array.isArray(masterCV?.digitalCV) ? masterCV.digitalCV : []);

  const orgSkillsDocs = await db.collection("org-candidate-skills").find({ candidateEmail, orgID }).toArray();
  const orgSkillNames: string[] = orgSkillsDocs.map((doc: any) => doc.skillName).filter(Boolean);

  const structuredCV = {
    ...rawStructuredCV,
    skills: orgSkillNames.length > 0 ? orgSkillNames : rawStructuredCV.skills ?? [],
  };

  const latestVersion = await db.collection("applicant-cv-version").findOne(
    { orgID, candidateEmail },
    {
      sort: {
        versionNo: -1,
      },
      projection: {
        versionNo: 1,
      },
    }
  );

  const versionNo =
    typeof latestVersion?.versionNo === "number" ? latestVersion.versionNo + 1 : 1;
  const now = Date.now();

  const doc = {
    orgID,
    candidateEmail,
    versionNo,
    label: label || `Org Edit v${versionNo}`,
    status: "draft",
    structuredCVSchemaVersion: STRUCTURED_CV_SCHEMA_VERSION,
    structuredCV,
    digitalCV: buildDigitalCVFromStructuredCV(rawStructuredCV),
    baseStructuredCV: structuredCV,
    isEdited: false,
    editedSections: [],
    sourceApplicantCvUpdatedAt:
      typeof masterCV?.updatedAt === "number" ? masterCV.updatedAt : null,
    sourceApplicantCvId: masterCV?._id?.toString?.() || null,
    createdBy: {
      uid: request.user?.uid ?? null,
      email: request.user?.email ?? null,
      name: request.user?.name ?? request.user?.email ?? null,
      image: request.user?.image ?? request.user?.photoURL ?? request.user?.photo_url ?? null,
    },
    updatedBy: {
      uid: request.user?.uid ?? null,
      email: request.user?.email ?? null,
      name: request.user?.name ?? request.user?.email ?? null,
      image: request.user?.image ?? request.user?.photoURL ?? request.user?.photo_url ?? null,
    },
    createdAt: now,
    updatedAt: now,
  };

  const insertResult = await db.collection("applicant-cv-version").insertOne(doc);

  return NextResponse.json({
    message: "Candidate CV version created",
    version: {
      id: insertResult.insertedId.toString(),
      orgID,
      candidateEmail,
      versionNo,
      label: doc.label,
      status: doc.status,
      isEdited: doc.isEdited,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
  });
});
