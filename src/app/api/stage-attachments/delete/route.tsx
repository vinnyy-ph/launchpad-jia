import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getStageAttachmentsR2Client, getR2BucketName } from "@/lib/utils/r2Client";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { interviewId, stageId, substageId, attachmentId, orgID } =
      await request.json();

    if (!interviewId || !stageId || !substageId || !attachmentId || !orgID) {
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

    const buckets = Array.isArray(interview.stageAttachments)
      ? interview.stageAttachments
      : [];
    const bucket = buckets.find(
      (b: any) => b.stageId === stageId && b.substageId === substageId
    );

    if (!bucket || !Array.isArray(bucket.attachments)) {
      return NextResponse.json(
        { error: "Attachment bucket not found" },
        { status: 404 }
      );
    }

    const attachment = bucket.attachments.find((a: any) => a.id === attachmentId);
    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    await db.collection("interviews").updateOne(
      { interviewID: interviewId, orgID },
      {
        $pull: {
          "stageAttachments.$[bucket].attachments": { id: attachmentId },
        } as any,
      },
      {
        arrayFilters: [
          { "bucket.stageId": stageId, "bucket.substageId": substageId },
        ],
      }
    );

    try {
      const s3Client = getStageAttachmentsR2Client();

      const deleteCmd = new DeleteObjectCommand({
        Bucket: getR2BucketName(),
        Key: attachment.key,
      });

      await s3Client.send(deleteCmd);
    } catch (r2Err) {
      console.warn("stage-attachments/delete: failed to delete from R2", r2Err);
    }

    await db.collection("recruiter-history").insertOne({
      interviewUID: interview?._id?.toString(),
      orgID,
      action: "Deleted Attachment",
      recruiterEmail: userEmail,
      createdAt: new Date(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting stage attachment:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
});
