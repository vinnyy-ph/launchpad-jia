import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";

export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const attachmentId = url.searchParams.get("id");
    const filenameParam = url.searchParams.get("filename"); // Optional filename parameter

    if (!attachmentId) {
      console.error("mg-download-attachment: missing attachment id");
      return NextResponse.json(
        { message: "Missing attachment id" },
        { status: 400 }
      );
    }

    // Parse attachment URL to extract bucket and key
    // URL format: https://{ACCOUNT_ID}.r2.cloudflarestorage.com/{BUCKET_NAME}/{KEY}
    let bucketName = process.env.R2_BUCKET_NAME || "jia-app";
    let objectKey: string | null = null;

    try {
      const parsedUrl = new URL(attachmentId);
      // Get the pathname and remove leading slash
      let pathname = parsedUrl.pathname.substring(1);

      // Find the first slash to separate bucket from key
      const firstSlashIndex = pathname.indexOf("/");

      if (firstSlashIndex > 0) {
        bucketName = pathname.substring(0, firstSlashIndex);
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
      objectKey = decodeURIComponent(attachmentId);
    }

    if (!objectKey) {
      return NextResponse.json(
        { message: "Invalid attachment id format" },
        { status: 400 }
      );
    }

    // Import R2 client
    const { S3Client, GetObjectCommand, HeadObjectCommand } = await import(
      "@aws-sdk/client-s3"
    );
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    // Initialize R2 client
    const accountId = process.env.R2_ACCOUNT_ID || "";
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    const s3Client = new S3Client({
      region: "auto",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
      endpoint,
    });

    // Try to get original filename from R2 metadata first
    let originalFilename: string | null = filenameParam || null;

    if (!originalFilename) {
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        });
        const headResponse = await s3Client.send(headCommand);
        originalFilename = headResponse.Metadata?.["original-filename"] || null;
      } catch (e) {
        console.warn("mg-download-attachment: could not fetch R2 metadata", e);
      }
    }

    // If still no filename, try to look up in mailgun-attachments collection
    if (!originalFilename) {
      try {
        const { db } = await connectMongoDB();
        const attachmentDoc = await db
          .collection("mailgun-attachments")
          .findOne({ key: objectKey });
        if (attachmentDoc && attachmentDoc.filename) {
          originalFilename = attachmentDoc.filename;
        }
      } catch (e) {
        console.warn(
          "mg-download-attachment: could not fetch from database",
          e
        );
      }
    }

    // Fallback: extract from key (will be UUID filename, but better than nothing)
    if (!originalFilename) {
      originalFilename = objectKey.split("/").pop() || "attachment";
    }

    // Generate presigned URL valid for 1 hour
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    // Fetch the file from the presigned URL
    const fileResponse = await fetch(presignedUrl);

    if (!fileResponse.ok) {
      console.error("mg-download-attachment: failed to fetch file", {
        status: fileResponse.status,
        statusText: fileResponse.statusText,
      });
      return NextResponse.json(
        { error: "Failed to fetch attachment" },
        { status: 500 }
      );
    }

    // Get the file content as a buffer
    const fileBuffer = await fileResponse.arrayBuffer();

    // Sanitize filename for Content-Disposition header (prevent injection)
    const safeFilename = originalFilename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "") // Remove leading dots
      .slice(0, 255); // Limit length

    // Return the file with download headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(
          originalFilename
        )}`,
        "Content-Type":
          fileResponse.headers.get("content-type") ||
          "application/octet-stream",
        "Content-Length": fileBuffer.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error("mg-download-attachment error", err);
    return NextResponse.json(
      { message: "Failed to download attachment" },
      { status: 500 }
    );
  }
};
