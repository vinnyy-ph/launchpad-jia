import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { draftId, attachmentUrl, attachmentKey } = body || {};

    if (!draftId) {
      return NextResponse.json({ error: "Missing draftId" }, { status: 400 });
    }

    if (!attachmentUrl && !attachmentKey) {
      return NextResponse.json(
        { error: "Missing attachmentUrl or attachmentKey" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Find the draft document
    let query: any = { _id: String(draftId) };
    if (ObjectId.isValid(String(draftId)))
      query = { _id: new ObjectId(String(draftId)) };

    const draft = await db.collection("mailgun-messages").findOne(query);
    if (!draft)
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });

    // Ensure this is a draft
    if (!draft.isDraft && !draft.draft && draft.direction !== "draft") {
      return NextResponse.json({ error: "Not a draft" }, { status: 400 });
    }

    // Determine organization id of the draft
    const draftOrgId = draft.organizationId
      ? String(draft.organizationId)
      : draft.orgID || draft.orgId || null;

    // Verify that the requesting user belongs to the same org
    let memberInOrg = null;
    if (draftOrgId) {
      memberInOrg = await db.collection("members").findOne({
        email: userEmail,
        $or: [
          { orgID: draftOrgId },
          { orgID: new ObjectId(draftOrgId) },
          { organizationId: draftOrgId },
          { organizationId: new ObjectId(draftOrgId) },
        ],
      });
    }

    // If we couldn't verify membership by draft org, attempt to infer user's org and compare
    if (!memberInOrg) {
      const maybeMember = await db
        .collection("members")
        .findOne({ email: userEmail });
      if (maybeMember) {
        const userOrg = maybeMember.orgID || maybeMember.organizationId || null;
        if (userOrg && draftOrgId && String(userOrg) === String(draftOrgId)) {
          memberInOrg = maybeMember;
        }
      }
    }

    if (!memberInOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Extract the key from the URL if provided, otherwise use attachmentKey
    let objectKey: string | null = null;
    if (attachmentKey) {
      objectKey = attachmentKey;
    } else if (attachmentUrl) {
      try {
        const parsedUrl = new URL(attachmentUrl);
        // Get the pathname and remove leading slash
        let pathname = parsedUrl.pathname.substring(1);

        // Find the first slash to separate bucket from key
        const firstSlashIndex = pathname.indexOf("/");

        if (firstSlashIndex > 0) {
          // Skip bucket name, get the key
          objectKey = pathname.substring(firstSlashIndex + 1);
        } else {
          // No bucket separator found, treat whole path as key
          objectKey = pathname;
        }

        // Decode the object key (handles URL encoding)
        objectKey = decodeURIComponent(objectKey);
      } catch (e) {
        console.error("Error parsing attachment URL:", e);
        // Fallback: treat the whole thing as the key
        objectKey = decodeURIComponent(attachmentUrl);
      }
    }

    if (!objectKey) {
      return NextResponse.json(
        { error: "Could not determine object key" },
        { status: 400 }
      );
    }

    // Remove attachment from draft's draftAttachments array
    const draftAttachments = Array.isArray(draft.draftAttachments)
      ? draft.draftAttachments
      : [];
    const updatedAttachments = draftAttachments.filter((att: any) => {
      const attKey = att.key || null;
      const attUrl = att.url || null;
      // Remove if it matches by key or url
      return (
        (attKey && attKey !== objectKey) ||
        (attUrl && attUrl !== attachmentUrl) ||
        (!attKey && !attUrl)
      );
    });

    // Update the draft document
    await db.collection("mailgun-messages").updateOne(query, {
      $set: {
        draftAttachments: updatedAttachments,
        updatedAt: new Date(),
      },
    });

    // Delete the file from R2 storage
    try {
      const s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });

      const deleteCmd = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: objectKey,
      });

      await s3Client.send(deleteCmd);
    } catch (r2Err) {
      // Log error but don't fail the request - the attachment is already removed from the draft
      console.warn("mg-delete-attachment: failed to delete from R2", r2Err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("mg-delete-attachment error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
