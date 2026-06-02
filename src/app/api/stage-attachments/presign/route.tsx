import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { getStageAttachmentsR2Client, getR2BucketName } from "@/lib/utils/r2Client";
import { isAllowedStageAttachment } from "@/lib/utils/stageAttachmentsFileTypes";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { interviewId, stageId, substageId, filename, mimeType, orgID } =
      await request.json();

    if (!interviewId || !stageId || !substageId || !filename || !mimeType || !orgID) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const userEmail = request.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectMongoDB();

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

    // Validate file type against allowlist
    const validation = isAllowedStageAttachment({ filename, mimeType });
    if (!validation.allowed) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 400 }
      );
    }

    // Sanitize filename: remove special chars, keep extension
    const sanitizedFilename = filename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .substring(0, 100);

    // Generate unique key
    const timestamp = Date.now();
    const key = `stage-attachments/${orgID}/${interviewId}/${stageId}/${substageId}/${timestamp}-${sanitizedFilename}`;

    const s3Client = getStageAttachmentsR2Client();

    const command = new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      ContentType: mimeType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 60, // 1 hour
    });

    return NextResponse.json({
      key,
      presignedUrl,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
});

