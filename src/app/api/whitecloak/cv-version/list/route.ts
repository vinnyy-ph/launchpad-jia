import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json();
  const { db } = await connectMongoDB();

  const orgID = typeof body?.orgID === "string" ? body.orgID.trim() : "";
  const candidateEmail =
    typeof body?.candidateEmail === "string"
      ? body.candidateEmail.trim().toLowerCase()
      : "";

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

  const versions = await db
    .collection("applicant-cv-version")
    .find(
      { orgID, candidateEmail },
      {
        projection: {
          structuredCV: 0,
          baseStructuredCV: 0,
          digitalCV: 0,
        },
      }
    )
    .sort({ versionNo: -1, updatedAt: -1 })
    .toArray();

  const creatorEmails = Array.from(
    new Set(
      versions
        .map((version: any) =>
          typeof version?.createdBy?.email === "string"
            ? version.createdBy.email.trim().toLowerCase()
            : ""
        )
        .filter(Boolean)
    )
  );

  const members = creatorEmails.length
    ? await db
        .collection("members")
        .find(
          { orgID, email: { $in: creatorEmails } },
          { projection: { email: 1, name: 1, image: 1, photoURL: 1 } }
        )
        .toArray()
    : [];

  const memberByEmail = new Map(
    members.map((member: any) => [
      String(member.email || "").trim().toLowerCase(),
      member,
    ])
  );

  return NextResponse.json({
    items: versions.map((version: any) => ({
      ...version,
      _id: version._id.toString(),
      createdBy: version?.createdBy?.email
        ? {
            ...version.createdBy,
            name:
              version.createdBy?.name ||
              memberByEmail.get(version.createdBy.email.trim().toLowerCase())?.name ||
              null,
            image:
              version.createdBy?.image ||
              memberByEmail.get(version.createdBy.email.trim().toLowerCase())?.image ||
              memberByEmail.get(version.createdBy.email.trim().toLowerCase())?.photoURL ||
              null,
          }
        : version.createdBy,
    })),
  });
});
