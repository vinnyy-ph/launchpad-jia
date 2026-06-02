import { CompleteMultipartUploadCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import axios from "axios";
import { CORE_API_URL } from "@/lib/Utils";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const { uploadId, parts, fileName, filetype, uid } = await request.json();
    try {
        const s3Client = new S3Client({
            region: "auto",
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });

        const command = new CompleteMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.map((part: { etag: string; partNumber: number }) => ({
                    ETag: part.etag,
                    PartNumber: part.partNumber,
                })),
            },
        });

        const response = await s3Client.send(command);

        // Update interview with recording details
        const { db } = await connectMongoDB();
        await db.collection("interviews").updateOne(
            {
                _id: new ObjectId(uid),
            },
            {
                $set: {
                    interviewRecording: {
                        filename: fileName,
                        filetype: filetype,
                    },
                    interviewRecordingUpdatedAt: Date.now(),
                    updatedAt: Date.now(),
                },
            }
        );

        // Convert the video to mp4 via JVX service
        if (filetype.includes("video")) {
            await axios.post(`${CORE_API_URL}/format-interview-recording`, {
                interviewId: uid,
            }).catch((err) => {
                console.error("Error converting interview recording to mp4", err);
            });
        }

        return NextResponse.json({
            response,
        });
    } catch (error) {
        console.error("Error", error);
        return NextResponse.json(
            { error: "File upload error" },
            { status: 500 }
        );
    }
});
