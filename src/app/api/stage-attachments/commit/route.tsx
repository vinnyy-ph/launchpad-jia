import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { isAllowedStageAttachment } from "@/lib/utils/stageAttachmentsFileTypes";
import { logActivity } from "@/lib/utils/activityLogger";

const CDN_BASE_URL = "https://cdn.hellojia.ai";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const {
      interviewId,
      orgID,
      stageId,
      substageId,
      key,
      filename,
      mimeType,
      size,
      uploadedBy,
    } = await request.json();

    if (
      !interviewId ||
      !orgID ||
      !stageId ||
      !substageId ||
      !key ||
      !filename ||
      !mimeType
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const userEmail = request.user?.email;
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

    const attachmentId = crypto.randomUUID();

    const expectedPrefix = `stage-attachments/${orgID}/${interviewId}/${stageId}/${substageId}/`;
    if (!String(key).startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "Invalid attachment key" },
        { status: 400 }
      );
    }

    const validation = isAllowedStageAttachment({ filename, mimeType });
    if (!validation.allowed) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 400 }
      );
    }

    const url = `${CDN_BASE_URL}/${encodeURI(key)}`;

    const attachment = {
      id: attachmentId,
      filename,
      mimeType,
      size: size || 0,
      key,
      url,
      uploadedBy: uploadedBy || {
        name: request.user?.name || "Unknown",
        email: request.user?.email || "",
      },
      uploadedAt: new Date(),
    };

    const updateExisting = await db.collection("interviews").updateOne(
      {
        interviewID: interviewId,
        orgID,
        stageAttachments: {
          $elemMatch: { stageId, substageId },
        },
      },
      {
        $push: {
          "stageAttachments.$[bucket].attachments": attachment,
        } as any,
      },
      {
        arrayFilters: [{ "bucket.stageId": stageId, "bucket.substageId": substageId }],
      }
    );

    if (updateExisting.matchedCount === 0) {
      const newBucket = {
        stageId,
        substageId,
        attachments: [attachment],
      };

      const createBucket = await db.collection("interviews").updateOne(
        {
          interviewID: interviewId,
          orgID,
          stageAttachments: {
            $not: { $elemMatch: { stageId, substageId } },
          },
        },
        {
          $push: {
            stageAttachments: newBucket,
          } as any,
        }
      );

      if (createBucket.matchedCount === 0) {
        const interviewExists = await db.collection("interviews").findOne(
          { interviewID: interviewId, orgID },
          { projection: { _id: 1 } }
        );

        if (!interviewExists) {
          return NextResponse.json(
            { error: "Interview not found" },
            { status: 404 }
          );
        }

        const retryUpdate = await db.collection("interviews").updateOne(
          {
            interviewID: interviewId,
            orgID,
            stageAttachments: {
              $elemMatch: { stageId, substageId },
            },
          },
          {
            $push: {
              "stageAttachments.$[bucket].attachments": attachment,
            } as any,
          },
          {
            arrayFilters: [{ "bucket.stageId": stageId, "bucket.substageId": substageId }],
          }
        );

        if (retryUpdate.modifiedCount === 0) {
          return NextResponse.json(
            { error: "Failed to save attachment after retry" },
            { status: 500 }
          );
        }
      }
    }

    const interviewData = await db.collection("interviews").findOne(
      { interviewID: interviewId, orgID }
    );
    await db.collection("recruiter-history").insertOne({
      interviewUID: interviewData?._id?.toString(),
      orgID,
      action: "Uploaded Attachment",
      recruiterEmail: userEmail,
      createdAt: new Date(),
    });

    // Get stage name for activity log
    let stageName = "a stage";
    if (interviewData?.pipelineStages) {
      const stage = interviewData.pipelineStages.find((s: any) => s.id === stageId);
      if (stage) {
        const substage = stage.substages?.find((sub: any) => sub.id === substageId);
        stageName = substage ? `${stage.name}: ${substage.name}` : stage.name;
      }
    }

    // Log activity
    await logActivity({
      db,
      kind: "recruiter_uploaded_attachment",
      interview: interviewData,
      actor: {
        type: "recruiter",
        email: userEmail,
        name: request.user?.name || userEmail,
        image: request.user?.image,
      },
      extraMetadata: {
        stageName,
        filename,
        mimeType,
        size,
        url,
      },
    });

    return NextResponse.json({
      success: true,
      attachment,
    });
  } catch (error) {
    console.error("Error committing attachment:", error);
    return NextResponse.json(
      { error: "Failed to save attachment metadata" },
      { status: 500 }
    );
  }
});

