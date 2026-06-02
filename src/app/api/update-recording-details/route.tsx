import { NextResponse } from "next/server";
import connectMongoDB from "../../../lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const { uid, partNumber, etag, uploadId, filename, filetype } = await request.json();
    try {
        const { db } = await connectMongoDB();
        const interviewObjectId = new ObjectId(uid);
        const now = Date.now();
        await db.collection("interviews").updateOne(
            {
                _id: interviewObjectId,
            },
            {
                $addToSet: {
                    interviewParts: {
                        partNumber: partNumber,
                        etag: etag,
                    }
                },
                $set: {
                    interviewUpload: {
                        uploadId: uploadId,
                        key: filename,
                        filetype: filetype,
                    }
                }
            }
        );

        // Mark immutable AI interview attempt once recording upload starts.
        await db.collection("interviews").updateOne(
            {
                _id: interviewObjectId,
                aiInterviewEverAttempted: { $ne: true },
            },
            {
                $set: {
                    aiInterviewEverAttempted: true,
                    aiInterviewEverAttemptedAt: now,
                },
            }
        );

        return NextResponse.json({
            message: "Interview part uploaded successfully",
        });
    } catch (error) {
        console.error("Error", error);
        return NextResponse.json(
            { error: "File upload error" },
            { status: 500 }
        );
    }
});
