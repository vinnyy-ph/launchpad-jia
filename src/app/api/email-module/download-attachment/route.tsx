import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

// Function to refresh access token
async function refreshAccessToken(refreshToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Google OAuth credentials not configured");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to refresh access token: ${response.status}`);
    }

    const data = await response.json();
    if (!data.access_token) {
        throw new Error("No access token received from refresh");
    }

    return data.access_token;
}

// Function to get valid access token
async function getValidAccessToken(email: string) {
    const { db } = await connectToDatabase();

    const tokenDoc = await db
        .collection("gmail-refresh-tokens")
        .findOne({ email: email.toLowerCase() });

    if (!tokenDoc) {
        throw new Error("No Gmail token found for user");
    }

    const now = new Date();
    const tokenExpiry = new Date(tokenDoc.tokenExpiry);

    if (now >= tokenExpiry) {
        const newAccessToken = await refreshAccessToken(tokenDoc.refreshToken);
        await db.collection("gmail-refresh-tokens").updateOne(
            { email: email.toLowerCase() },
            {
                $set: {
                    accessToken: newAccessToken,
                    tokenExpiry: new Date(Date.now() + 3600 * 1000),
                    updatedAt: new Date(),
                },
            }
        );
        return newAccessToken;
    }

    return tokenDoc.accessToken;
}

/**
 * POST /api/email-module/download-attachment
 * 
 * Downloads an attachment directly from Gmail API
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const { messageId, attachmentId, filename, mimeType, recruiterEmail } = await request.json();

        console.log("Downloading attachment:", { messageId, attachmentId, filename });

        if (!messageId || !attachmentId || !filename || !recruiterEmail) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        // Get valid access token for the recruiter who received the email
        const accessToken = await getValidAccessToken(recruiterEmail);

        // Fetch attachment from Gmail API
        const gmailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (!gmailResponse.ok) {
            const errorText = await gmailResponse.text();
            console.error("Gmail API Error:", errorText);
            throw new Error(`Gmail API Error: ${gmailResponse.status}`);
        }

        const attachmentData = await gmailResponse.json();

        // Decode base64url data to binary
        const base64Data = attachmentData.data.replace(/-/g, "+").replace(/_/g, "/");
        const fileBuffer = Buffer.from(base64Data, "base64");

        // Return file directly to browser for download
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': mimeType || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': fileBuffer.length.toString(),
            },
        });

    } catch (error) {
        console.error("Error downloading attachment:", error);
        return NextResponse.json(
            {
                error: "Failed to download attachment",
                details: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
            },
            { status: 500 }
        );
    }
});

