import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";

// ============================================================================
// Type Definitions
// ============================================================================

interface EmailHeader {
    name: string;
    value: string;
}

interface MessagePart {
    partId?: string;
    mimeType?: string;
    filename?: string;
    headers?: EmailHeader[];
    body?: {
        data?: string;
        size?: number;
        attachmentId?: string;
    };
    parts?: MessagePart[];
}

interface InlineImageInfo {
    attachmentId: string;
    mimeType: string;
}

interface Attachment {
    filename: string;
    mimeType?: string;
    size: number;
    attachmentId: string;
    messageId: string;
}

// ============================================================================
// Token Management Functions
// ============================================================================

/**
 * Refreshes an expired Google OAuth access token using a refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
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
    return data.access_token;
}

/**
 * Gets a valid access token for the user, refreshing if necessary
 */
async function getValidAccessToken(email: string): Promise<string> {
    const { db } = await connectToDatabase();

    const tokenDoc = await db
        .collection("gmail-refresh-tokens")
        .findOne({ email: email.toLowerCase() });

    if (!tokenDoc) {
        throw new Error("No Gmail token found for user");
    }

    // Check if token is expired (tokens last 1 hour)
    const now = new Date();
    const tokenExpiry = new Date(tokenDoc.tokenExpiry);

    if (now >= tokenExpiry) {
        const newAccessToken = await refreshAccessToken(tokenDoc.refreshToken);

        // Update token in database
        await db.collection("gmail-refresh-tokens").updateOne(
            { email: email.toLowerCase() },
            {
                $set: {
                    accessToken: newAccessToken,
                    tokenExpiry: new Date(Date.now() + 3600 * 1000), // 1 hour from now
                    updatedAt: new Date(),
                },
            }
        );

        return newAccessToken;
    }

    return tokenDoc.accessToken;
}

// ============================================================================
// Email Parsing Helper Functions
// ============================================================================

/**
 * Extracts a header value by name from an array of headers
 */
function getHeaderValue(headers: EmailHeader[] | undefined, headerName: string): string {
    if (!headers) return "";
    const header = headers.find((h) => h.name === headerName);
    return header?.value || "";
}

/**
 * Extracts the Content-ID from headers (used for inline images)
 */
function extractContentId(headers: EmailHeader[] | undefined): string | null {
    if (!headers) return null;
    
    const contentIdHeader = headers.find((h) => h.name === "Content-ID");
    if (!contentIdHeader) return null;

    // Remove angle brackets if present (e.g., "<ii_123>" -> "ii_123")
    return contentIdHeader.value.replace(/[<>]/g, "");
}

/**
 * Checks if a message part is marked as inline (for embedded images)
 */
function isInlineAttachment(headers: EmailHeader[] | undefined): boolean {
    const disposition = getHeaderValue(headers, "Content-Disposition");
    return disposition.includes("inline");
}

/**
 * Fetches an inline image from Gmail API and converts it to a data URL
 */
async function fetchInlineImageAsDataUrl(
    messageId: string,
    attachmentId: string,
    mimeType: string,
    accessToken: string
): Promise<string | null> {
    try {
        const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            console.error(`Failed to fetch inline image ${attachmentId}:`, response.status);
            return null;
        }

        const attachmentData = await response.json();
        
        // Gmail API returns base64url-encoded data, convert to standard base64
        const base64Data = attachmentData.data.replace(/-/g, "+").replace(/_/g, "/");
        
        // Create data URL for embedding in HTML
        return `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
        console.error(`Error fetching inline image ${attachmentId}:`, error);
        return null;
    }
}

/**
 * Replaces all cid: references in HTML with their corresponding data URLs
 */
function replaceCidReferences(
    htmlBody: string,
    contentIdToDataUrl: Map<string, string>
): string {
    let processedHtml = htmlBody;

    contentIdToDataUrl.forEach((dataUrl, contentId) => {
        // Escape special regex characters in contentId
        const escapedContentId = contentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        
        // Replace both formats: "cid:contentId" and "cid:<contentId>"
        const patterns = [
            new RegExp(`cid:${escapedContentId}`, "gi"),
            new RegExp(`cid:<${escapedContentId}>`, "gi"),
        ];

        patterns.forEach((pattern) => {
            processedHtml = processedHtml.replace(pattern, dataUrl);
        });
    });

    return processedHtml;
}

// ============================================================================
// Main Email Extraction Logic
// ============================================================================

/**
 * Recursively extracts email body content, attachments, and inline images from message parts
 */
function extractEmailContent(
    parts: MessagePart[],
    messageId: string
): {
    body: string;
    attachments: Attachment[];
    inlineImages: Map<string, InlineImageInfo>;
} {
    let htmlBody = "";
    let plainBody = "";
    const attachments: Attachment[] = [];
    const inlineImages = new Map<string, InlineImageInfo>();

    for (const part of parts) {
        // Handle nested parts (multipart messages)
        if (part.parts) {
            const nestedContent = extractEmailContent(part.parts, messageId);
            if (nestedContent.body && !htmlBody && !plainBody) {
                htmlBody = nestedContent.body;
            }
            attachments.push(...nestedContent.attachments);
            nestedContent.inlineImages.forEach((info, contentId) => {
                inlineImages.set(contentId, info);
            });
        }

        // Extract HTML body content
        if (part.mimeType === "text/html" && part.body?.data) {
            htmlBody = Buffer.from(part.body.data, "base64").toString();
        }

        // Extract plain text body content
        if (part.mimeType === "text/plain" && part.body?.data) {
            plainBody = Buffer.from(part.body.data, "base64").toString();
        }

        // Identify and store inline images (for later cid: replacement)
        if (part.body?.attachmentId && part.headers) {
            const contentId = extractContentId(part.headers);
            const isInline = isInlineAttachment(part.headers);
            const isImage = part.mimeType?.startsWith("image/");

            if (contentId && isInline && isImage) {
                inlineImages.set(contentId, {
                    attachmentId: part.body.attachmentId,
                    mimeType: part.mimeType,
                });
            }
        }

        // Extract regular file attachments (non-inline)
        if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
            const isInline = isInlineAttachment(part.headers);

            // Only add as attachment if it's not an inline image
            if (!isInline) {
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType,
                    size: part.body?.size || 0,
                    attachmentId: part.body.attachmentId,
                    messageId: messageId,
                });
            }
        }
    }

    return {
        body: htmlBody || plainBody,
        attachments,
        inlineImages,
    };
}

/**
 * Processes inline images by fetching them and replacing cid: references with data URLs
 */
async function processInlineImages(
    htmlBody: string,
    inlineImages: Map<string, InlineImageInfo>,
    messageId: string,
    accessToken: string
): Promise<string> {
    if (inlineImages.size === 0 || !htmlBody) {
        return htmlBody;
    }

    // Fetch all inline images in parallel
    const imageFetchPromises = Array.from(inlineImages.entries()).map(
        async ([contentId, imageInfo]) => {
            const dataUrl = await fetchInlineImageAsDataUrl(
                messageId,
                imageInfo.attachmentId,
                imageInfo.mimeType,
                accessToken
            );

            return dataUrl ? { contentId, dataUrl } : null;
        }
    );

    const imageDataUrls = await Promise.all(imageFetchPromises);

    // Build map of contentId -> dataUrl
    const contentIdToDataUrl = new Map<string, string>();
    imageDataUrls.forEach((imageData) => {
        if (imageData) {
            contentIdToDataUrl.set(imageData.contentId, imageData.dataUrl);
        }
    });

    // Replace all cid: references in HTML with data URLs
    return replaceCidReferences(htmlBody, contentIdToDataUrl);
}

// ============================================================================
// Main API Route Handler
// ============================================================================

/**
 * POST /api/email-module/gm-fetch-draft
 * 
 * Fetches a draft email from Gmail or email-noreply collection and processes it for display in the composer.
 * Handles inline images by converting them to data URLs for proper display.
 * 
 * Supports both:
 * - Gmail drafts (requires email and messageId)
 * - Noreply drafts from no-reply@hirejia.ai (requires _id and orgID)
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
    try {
        // Validate request
        const { email, messageId, orgID } = await request.json();

        if (!email || !messageId) {
            console.error("[gm-fetch-draft] Missing required data: email or messageId");
            return NextResponse.json(
                { error: "Missing required data" },
                { status: 400 }
            );
        }

        // Get valid access token
        const accessToken = await getValidAccessToken(email);


        const { db } = await connectToDatabase();
        let noreplyDraft = null;
        if (orgID) {
            try {
                if (ObjectId.isValid(messageId)) {
                    const objectId = new ObjectId(messageId);
                    noreplyDraft = await db.collection("email-noreply").findOne({
                        _id: objectId,
                        orgID: orgID,
                        "metadata.createdby": email.toLowerCase(),
                    });
                }
            } catch (error) {

            }
        }

        if (noreplyDraft) {
            return NextResponse.json({
                success: true,
                data: {
                    subject: noreplyDraft.subject || "No Subject",
                    to: noreplyDraft.to || "",
                    from: noreplyDraft.from || "",
                    message: noreplyDraft.html || noreplyDraft.message || "",
                    threadId: noreplyDraft.metadata?.threadId || null,
                    attachments: noreplyDraft.attachments || [],
                },
            });
        }

        // Fetch full message details from Gmail API
        const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch message: ${response.status}`);
        }

        const message = await response.json();
        // console.log("Google API Draft Response:", JSON.stringify(message, null, 2));

        // Extract email headers
        const headers = message.payload?.headers || [];
        const subject = getHeaderValue(headers, "Subject");
        const to = getHeaderValue(headers, "To");
        const from = getHeaderValue(headers, "From");

        // Extract email body, attachments, and inline images
        let body = "";
        let attachments: Attachment[] = [];
        let inlineImages = new Map<string, InlineImageInfo>();

        if (message.payload?.body?.data) {
            // Simple message with body directly in payload
            body = Buffer.from(message.payload.body.data, "base64").toString();
        } else if (message.payload?.parts) {
            // Multipart message - extract from parts
            const extracted = extractEmailContent(message.payload.parts, messageId);
            body = extracted.body;
            attachments = extracted.attachments;
            inlineImages = extracted.inlineImages;
        }

        // Process inline images: fetch them and replace cid: references with data URLs
        body = await processInlineImages(body, inlineImages, messageId, accessToken);

        // Return formatted response
        return NextResponse.json({
            success: true,
            data: {
                subject,
                to,
                from,
                message: body,
                threadId: message.threadId,
                attachments,
            },
        });
    } catch (error: any) {
        console.error("Error fetching draft:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch draft details",
                details: process.env.NODE_ENV === "development" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
});
