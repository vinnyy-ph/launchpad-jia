import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { tryGetBearerUser } from "@/lib/utils/authMiddleware";
import { validateShareableAssessmentPasscode } from "@/lib/utils/shareableAssessmentAccess";
import { getStageAttachmentsR2Client, getR2BucketName } from "@/lib/utils/r2Client";

function sanitizeContentDispositionFilename(filename: string): string {
  return String(filename)
    .replace(/[\r\n]/g, " ")
    .replace(/"/g, "'");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      orgID,
      interviewId,
      stageId,
      substageId,
      attachmentId,
      profileId,
      passcode,
      mode,
    } = body ?? {};

    const disposition = mode === "preview" ? "inline" : "attachment";

    if (!stageId || !substageId || !attachmentId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Shareable/passcode mode
    if (profileId && passcode) {
      const validationResult = await validateShareableAssessmentPasscode(
        profileId,
        passcode,
        null,
        db
      );

      if (validationResult.status === 404 || !validationResult.assessment) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      }

      if (!validationResult.valid) {
        return NextResponse.json(
          { error: validationResult.message ?? "Incorrect passcode" },
          { status: 400 }
        );
      }

      const assessment = validationResult.assessment;
      if (!assessment.active) {
        return NextResponse.json(
          { error: "This shareable link is inactive." },
          { status: 403 }
        );
      }

      if (!assessment.viewableStages?.[stageId]?.viewable) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const interview = await db.collection("interviews").findOne({
        interviewID: assessment.interviewId,
        orgID: assessment.orgID,
      });

      if (!interview) {
        return NextResponse.json(
          { error: "Interview not found" },
          { status: 404 }
        );
      }

      const buckets = Array.isArray(interview.stageAttachments)
        ? interview.stageAttachments
        : [];
      const bucket = buckets.find(
        (b: any) => b.stageId === stageId && b.substageId === substageId
      );
      const attachment = bucket?.attachments?.find((a: any) => a.id === attachmentId);

      if (!attachment) {
        return NextResponse.json(
          { error: "Attachment not found" },
          { status: 404 }
        );
      }

      const s3Client = getStageAttachmentsR2Client();

      const safeFilename = sanitizeContentDispositionFilename(attachment.filename);
      const command = new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: attachment.key,
        ResponseContentDisposition: `${disposition}; filename="${safeFilename}"`,
      });

      const downloadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 5 * 60,
      });

      return NextResponse.json({ downloadUrl });
    }

    // Recruiter/authenticated mode
    if (!orgID || !interviewId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const user = await tryGetBearerUser(request);
    const userEmail = user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [{ orgID }, { orgID: ObjectId.createFromHexString(orgID) }],
    });

    if (!memberInOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const interview = await db.collection("interviews").findOne({
      interviewID: interviewId,
      orgID,
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    const buckets = Array.isArray(interview.stageAttachments)
      ? interview.stageAttachments
      : [];
    const bucket = buckets.find(
      (b: any) => b.stageId === stageId && b.substageId === substageId
    );
    const attachment = bucket?.attachments?.find((a: any) => a.id === attachmentId);

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    const s3Client = getStageAttachmentsR2Client();

    const safeFilename = sanitizeContentDispositionFilename(attachment.filename);
    const command = new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: attachment.key,
      ResponseContentDisposition: `${disposition}; filename="${safeFilename}"`,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 5 * 60, // 5 minutes
    });

    return NextResponse.json({ downloadUrl });
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}

