import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

/**
 * POST /api/email-module/gm-fetch-org-emails
 * 
 * Fetches emails from ALL recruiters in an organization who have Gmail integration.
 * Groups conversations by conversationId (not threadId) to support cross-account threading.
 * 
 * @param orgID - Organization ID (required)
 * @param maxResults - Maximum emails to fetch per recruiter (default: 50)
 * @param label - Optional Gmail label filter (e.g., "INBOX", "SENT")
 */

// Constants
const TOKEN_EXPIRY_HOURS = 1;
const REQUEST_TIMEOUT_MS = 15000;
const EMAIL_DETAIL_TIMEOUT_MS = 10000;
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Types
interface EmailAttachment {
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
}

interface TokenRefreshResponse {
    access_token: string;
    expires_in: number;
}

/**
 * Refreshes an expired Gmail OAuth2 access token
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Google OAuth credentials not configured");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data: TokenRefreshResponse = await response.json();

    if (!data.access_token) {
        throw new Error("No access token in refresh response");
    }

    return data.access_token;
}

/**
 * Gets a valid access token for a user, refreshing if necessary
 */
async function getValidAccessToken(email: string, db: any): Promise<string | null> {
    const tokenDoc = await db
        .collection("gmail-refresh-tokens")
        .findOne({ email: email.toLowerCase() });

    if (!tokenDoc) return null;

    const now = new Date();
    const tokenExpiry = new Date(tokenDoc.tokenExpiry);

    if (now >= tokenExpiry) {
        const newAccessToken = await refreshAccessToken(tokenDoc.refreshToken);

        await db.collection("gmail-refresh-tokens").updateOne(
            { email: email.toLowerCase() },
            {
                $set: {
                    accessToken: newAccessToken,
                    tokenExpiry: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 3600 * 1000),
                    updatedAt: new Date(),
                },
            }
        );

        return newAccessToken;
    }

    return tokenDoc.accessToken;
}
/**
 * Batch fetches user data from database for multiple emails (optimized)
 */
async function batchUserData(
    emails: string[],
    db: any
): Promise<Map<string, { name: string; email: string; image: string | null }>> {

    const lowerEmails = emails.map(e => e.toLowerCase());
    const emailMap = new Map<string, { name: string; email: string; image: string | null }>();


    const [admins, members] = await Promise.all([
        db.collection("admins").find({ email: { $in: lowerEmails } }).toArray(),
        db.collection("members").find({ email: { $in: lowerEmails } }).toArray(),
    ]);

    admins.forEach((a: any) => {
        emailMap.set(a.email.toLowerCase(), {
            name: a.name,
            email: a.email,
            image: a.image || null
        });
    });

    members.forEach((m: any) => {
        emailMap.set(m.email.toLowerCase(), {
            name: m.name || m.email,
            email: m.email,
            image: m.image || null
        });
    });

    const foundEmails = new Set([...emailMap.keys()]);
    const missingEmails = lowerEmails.filter(e => !foundEmails.has(e));
    if (missingEmails.length > 0) {
        const affiliations = await db.collection("affiliations").find({ "applicantInfo.email": { $in: missingEmails } }).toArray();
        affiliations.forEach((aff: any) => {
            const email = aff.applicantInfo?.email?.toLowerCase();
            if (!email) return;
            emailMap.set(email, {
                name: aff.applicantInfo.name,
                email: aff.applicantInfo.email,
                image: aff.applicantInfo.image || null
            });
        });
    }

    lowerEmails.forEach(email => {
        if (!emailMap.has(email)) {
            emailMap.set(email, {
                name: email,
                email: email,
                image: null
            });
        }
    });

    return emailMap;
}


/**
 * Formats a date as a relative time string (e.g., "2 hours ago")
 */
function formatTimeAgo(date: Date): string {
    const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return date.toLocaleDateString();
}

/**
 * Formats a date as a readable string
 */
function formatDate(date: Date): string {
    return date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
    });
}

/**
 * Generates an avatar URL based on a name or email
 */
function generateAvatarUrl(name: string, email: string, backgroundColor: string): string {
    const seed = name || email;
    return seed
        ? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${backgroundColor}`
        : `https://api.dicebear.com/9.x/initials/svg?seed=${Date.now()}`;
}

/**
 * Strips HTML tags from text to create a plain text snippet
 */
function stripHtmlTags(html: string): string {
    if (!html) return "";
    // Remove HTML tags and decode common entities
    return html
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ") // Collapse whitespace
        .trim();
}

/**
 * Normalizes subject by removing "Re:", "Fwd:", etc.
 */
function normalizeSubject(subject: string): string {
    if (!subject) return "";
    return subject
        .replace(/^(Re:|RE:|Fwd:|FWD:|Fw:|FW:)\s*/i, "")
        .trim();
}

/**
 * Removes quoted content from email body (like "On [date] <email> wrote:")
 */
function removeQuotedContent(body: string): string {
    if (!body) return "";
    let cleaned = body;
    cleaned = cleaned.replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, "");
    cleaned = cleaned.replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
    const quotedPatterns = [
        /On\s+[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[AP]M\s+<[^>]+>\s+wrote:[\s\S]*$/i,
        /On\s+[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+<[^>]+>\s+wrote:[\s\S]*$/i,
        /On\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[AP]M\s+<[^>]+>\s+wrote:[\s\S]*$/i,
        /On\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+<[^>]+>\s+wrote:[\s\S]*$/i,
        /On\s+[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[AP]M\s+[^<]+<[^>]+>\s+wrote:[\s\S]*$/i,
        /<div[^>]*>[\s\S]*?On\s+[A-Za-z]{3}[^<]*<[^>]+>\s+wrote:[\s\S]*$/i,
    ];
    quotedPatterns.forEach((pattern) => {
        cleaned = cleaned.replace(pattern, "");
    });
    cleaned = cleaned.replace(/---\s*Original\s+Message\s*---[\s\S]*$/i, "");
    cleaned = cleaned.replace(/---\s*Forwarded\s+Message\s*---[\s\S]*$/i, "");
    cleaned = cleaned.replace(/From:\s*[^\n<]+[\s\S]*$/i, "");
    cleaned = cleaned.replace(/Sent:\s*[^\n<]+[\s\S]*$/i, "");
    cleaned = cleaned.replace(/To:\s*[^\n<]+[\s\S]*$/i, "");
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/<div[^>]*>\s*<\/div>[\s\S]*$/gi, "");
    return cleaned;
}

/**
 * Extracts email body from Gmail message payload parts
 */
function extractEmailBody(payload: any): string {
    let body = "";

    const extractFromParts = (parts: any[]): string => {
        let htmlBody = "";
        let plainBody = "";

        for (const part of parts) {
            if (part.parts) {
                const nestedBody = extractFromParts(part.parts);
                if (nestedBody) return nestedBody;
            }

            if (part.mimeType === "text/html" && part.body?.data) {
                htmlBody = Buffer.from(part.body.data, "base64").toString();
            } else if (part.mimeType === "text/plain" && part.body?.data) {
                plainBody = Buffer.from(part.body.data, "base64").toString();
            }
        }

        return htmlBody || plainBody;
    };

    if (payload?.body?.data) {
        body = Buffer.from(payload.body.data, "base64").toString();
    } else if (payload?.parts) {
        body = extractFromParts(payload.parts);
    }
    body = removeQuotedContent(body);

    return body;
}

/**
 * Extracts attachment metadata from Gmail message payload
 */
function extractAttachments(parts: any[]): EmailAttachment[] {
    const attachments: EmailAttachment[] = [];

    const traverseParts = (partsList: any[]) => {
        for (const part of partsList) {
            if (part.parts) {
                traverseParts(part.parts);
            }

            if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType || "application/octet-stream",
                    size: part.body.size || 0,
                    attachmentId: part.body.attachmentId,
                });
            }
        }
    };

    if (parts) {
        traverseParts(parts);
    }

    return attachments;
}

/**
 * Parses email address from a header string
 * Handles formats like "Name <email@example.com>" or "email@example.com"
 */
function parseEmailAddress(headerValue: string): { name: string; email: string } {
    const match = headerValue.match(/([^<]+)<([^>]+)>/) || [null, headerValue, headerValue];
    return {
        name: match[1]?.trim() || headerValue,
        email: match[2]?.trim() || headerValue,
    };
}

/**
 * Determines if an email is automated based on subject and sender
 */
function isAutomatedEmail(subject: string, from: string): boolean {
    const lowerSubject = subject.toLowerCase();
    const lowerFrom = from.toLowerCase();

    return (
        lowerSubject.includes("automated") ||
        lowerSubject.includes("notification") ||
        lowerFrom.includes("noreply") ||
        lowerFrom.includes("no-reply")
    );
}

/**
 * Fetches Gmail emails for recruiter and members of the organization
 */
async function fetchRecruiterEmails(
    recruiterEmail: string,
    accessToken: string,
    maxResults: number,
    label?: string
): Promise<any[]> {
    try {
        const params = new URLSearchParams({ maxResults: maxResults.toString() });
        if (label) params.append("labelIds", label);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const listRes = await fetch(
            `${GMAIL_API_BASE}/messages?${params}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: controller.signal
            }
        ).finally(() => clearTimeout(timeoutId));

        if (!listRes.ok) return [];

        const { messages = [] } = await listRes.json();

        // FETCH DETAILS
        const results = await Promise.all(
            messages.map(async (msg: any) => {
                try {
                    const controller2 = new AbortController();
                    const timeout2 = setTimeout(
                        () => controller2.abort(),
                        EMAIL_DETAIL_TIMEOUT_MS
                    );

                    const detailRes = await fetch(
                        `${GMAIL_API_BASE}/messages/${msg.id}`,
                        {
                            headers: { Authorization: `Bearer ${accessToken}` },
                            signal: controller2.signal
                        }
                    ).finally(() => clearTimeout(timeout2));

                    if (!detailRes.ok) return null;

                    const detail = await detailRes.json();

                    // Headers
                    const headers = detail.payload?.headers || [];
                    const subject = headers.find((h: any) => h.name === "Subject")?.value || "No Subject";
                    const from = headers.find((h: any) => h.name === "From")?.value || "";
                    const to = headers.find((h: any) => h.name === "To")?.value || "";
                    const date = headers.find((h: any) => h.name === "Date")?.value;

                    const sender = parseEmailAddress(from);
                    const recipient = parseEmailAddress(to);

                    const emailDate = new Date(date);
                    const body = extractEmailBody(detail.payload);
                    const cleanSnippet = stripHtmlTags(body);
                    const snippet = cleanSnippet.slice(0, 100) + (cleanSnippet.length > 100 ? "..." : "");

                    const attachments = extractAttachments(detail.payload?.parts || []);

                    const isAutomated = isAutomatedEmail(subject, from);

                    return {
                        id: msg.id,
                        messageId: msg.id, // Use messageId for ordering
                        threadId: detail.threadId,
                        labelIds: detail.labelIds || [],
                        name: sender.name,
                        avatar: null,
                        role: "User Role",
                        subject,
                        snippet,
                        timeAgo: formatTimeAgo(emailDate),
                        isNew: !detail.labelIds?.includes("READ"),
                        unreadCount: detail.labelIds?.includes("UNREAD") ? 1 : 0,
                        messageCount: 1,
                        hasAttachment: attachments.length > 0,
                        attachments,
                        stage: isAutomated ? "Automated" : "Direct",
                        recruiterEmail,
                        emailTimestamp: emailDate.getTime(),
                        emailDate: emailDate.toISOString(),

                        // TEMP for enrichment
                        tempSenderEmail: sender.email,
                        tempRecipientEmail: recipient.email,

                        emailContent: {
                            subject,
                            messages: [
                                {
                                    id: msg.id,
                                    sender: {
                                        name: sender.name,
                                        email: sender.email,
                                        avatar: generateAvatarUrl(sender.name, sender.email, "4F46E5"),
                                    },
                                    recipient: {
                                        name: recipient.name,
                                        email: recipient.email,
                                        avatar: generateAvatarUrl(recipient.name, recipient.email, "10B981"),
                                    },
                                    timestamp: formatDate(emailDate),
                                    type: isAutomated ? "automated" : "direct",
                                    content: body,
                                    signature: {
                                        name: sender.name,
                                        title: "",
                                        contact: sender.email,
                                    },
                                },
                            ],
                        },
                    };
                } catch {
                    return null;
                }
            })
        );

        return results.filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * Formats email-noreply as a message item
 */
function formatNoreplyEmail(doc: any, userDataMap: Map<string, any>) {
    const emailDate = doc.createdAt || doc.updatedAt || new Date();
    const ts = new Date(emailDate).getTime();

    const body = doc.html || doc.message || "";
    const snippet = stripHtmlTags(body).slice(0, 100) + (body.length > 100 ? "..." : "");

    const fromEmail = doc.from || "";
    const toEmail = Array.isArray(doc.to) ? doc.to[0] : doc.to || "";

    const sender = userDataMap.get(fromEmail.toLowerCase()) || {
        name: fromEmail, email: fromEmail, image: null
    };
    const recipient = userDataMap.get(toEmail.toLowerCase()) || {
        name: toEmail, email: toEmail, image: null
    };

    return {
        id: doc.mailgunId || doc._id.toString(),
        messageId: doc.mailgunId || doc._id.toString(), // Use messageId for ordering
        threadId: null,
        labelIds: ["SENT"],
        isSent: true,

        name: recipient.name || sender.name,
        avatar: recipient.image || sender.image,
        role: "User Role",

        subject: doc.subject || "No Subject",
        snippet,
        timeAgo: formatTimeAgo(new Date(emailDate)),
        isNew: false,
        unreadCount: 0,
        messageCount: 1,

        hasAttachment: false,
        attachments: [],

        stage: "Direct",
        recruiterEmail: doc.sentByGmail || doc.createdby || doc.sentBy || sender.email,

        emailTimestamp: ts,
        emailDate: new Date(emailDate).toISOString(),
        CareerId: doc.CareerId || null,

        emailContent: {
            subject: doc.subject || "No Subject",
            messages: [
                {
                    id: doc.mailgunId || doc._id.toString(),
                    sender: {
                        name: sender.name,
                        email: sender.email,
                        avatar: sender.image || generateAvatarUrl(sender.name, sender.email, "4F46E5")
                    },
                    recipient: {
                        name: recipient.name,
                        email: recipient.email,
                        avatar: recipient.image || generateAvatarUrl(recipient.name, recipient.email, "10B981")
                    },
                    timestamp: formatDate(new Date(emailDate)),
                    type: doc.type === "automated" ? "automated" : "direct",
                    content: body,
                    signature: {
                        name: sender.name,
                        title: "",
                        contact: sender.email,
                    }
                }
            ]
        },

        isNoreply: true
    };
}

/**
 * Gets or generates conversationId for a message
 */
async function getConversationId(
    threadId: string | null,
    normalizedSubject: string,
    candidateEmail: string,
    orgID: string,
    db: any
): Promise<string> {
    if (threadId) {
        const threadQuery: any = { threadId };
        if (orgID) {
            threadQuery.$or = [
                { orgID },
                { orgID: { $exists: false } }
            ];
        }
        const threadDoc = await db.collection("email-threads").findOne(threadQuery);
        if (threadDoc?.conversationId) {
            return threadDoc.conversationId;
        }
    }
    const subjectQuery: any = {
        normalizedSubject,
        toEmail: candidateEmail.toLowerCase()
    };
    if (orgID) {
        subjectQuery.$or = [
            { orgID },
            { orgID: { $exists: false } }
        ];
    }
    const existingThread = await db.collection("email-threads").findOne(subjectQuery);
    if (existingThread?.conversationId) {
        return existingThread.conversationId;
    }
    return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Expands all messages from related threadIds in the same conversation
 */
async function expandConversationMessages(
    emails: any[],
    orgID: string,
    db: any
): Promise<any[]> {
    const expandedEmails: any[] = [...emails];
    const processedThreadIds = new Set<string>();

    for (const email of emails) {
        if (!email.threadId || processedThreadIds.has(email.threadId)) continue;
        processedThreadIds.add(email.threadId);

        // Find conversationId for this thread
        const threadQuery: any = { threadId: email.threadId };
        if (orgID) {
            threadQuery.$or = [
                { orgID },
                { orgID: { $exists: false } }
            ];
        }
        const threadDoc = await db.collection("email-threads").findOne(threadQuery);

        if (!threadDoc?.conversationId) continue;

        // Find all other threadIds in the same conversation
        const relatedQuery: any = {
            conversationId: threadDoc.conversationId,
            threadId: { $ne: email.threadId }
        };
        if (orgID) {
            relatedQuery.$or = [
                { orgID },
                { orgID: { $exists: false } }
            ];
        }
        const relatedThreadDocs = await db.collection("email-threads")
            .find(relatedQuery)
            .toArray();

        // Fetch all messages from related threads
        for (const related of relatedThreadDocs) {
            if (processedThreadIds.has(related.threadId)) continue;
            processedThreadIds.add(related.threadId);

            const token = await getValidAccessToken(related.fromEmail, db);
            if (!token) continue;

            try {
                const gRes = await fetch(
                    `${GMAIL_API_BASE}/threads/${related.threadId}?format=full`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (!gRes.ok) continue;

                const gThread = await gRes.json();
                const messages = gThread.messages || [];

                for (const m of messages) {
                    // Skip duplicates
                    if (expandedEmails.find(em => em.id === m.id)) continue;

                    const headers = m.payload.headers || [];
                    const subject = headers.find((h: any) => h.name === "Subject")?.value || "No Subject";
                    const from = headers.find((h: any) => h.name === "From")?.value || "";
                    const to = headers.find((h: any) => h.name === "To")?.value || "";
                    const date = headers.find((h: any) => h.name === "Date")?.value;

                    const sender = parseEmailAddress(from);
                    const recipient = parseEmailAddress(to);

                    const emailDate = new Date(date);
                    const body = extractEmailBody(m.payload);
                    const attachments = extractAttachments(m.payload.parts || []);

                    expandedEmails.push({
                        id: m.id,
                        messageId: m.id,
                        threadId: related.threadId,
                        labelIds: m.labelIds || [],
                        name: sender.name,
                        avatar: null,
                        role: "User Role",
                        subject,
                        snippet: stripHtmlTags(body).slice(0, 100),
                        timeAgo: formatTimeAgo(emailDate),
                        isNew: !m.labelIds?.includes("READ"),
                        unreadCount: m.labelIds?.includes("UNREAD") ? 1 : 0,
                        messageCount: 1,
                        hasAttachment: attachments.length > 0,
                        attachments,
                        stage: "Direct",
                        recruiterEmail: related.fromEmail,
                        emailTimestamp: emailDate.getTime(),
                        emailDate: emailDate.toISOString(),
                        CareerId: related.CareerId || threadDoc?.CareerId || null,

                        emailContent: {
                            subject,
                            messages: [
                                {
                                    id: m.id,
                                    sender: {
                                        name: sender.name,
                                        email: sender.email,
                                        avatar: generateAvatarUrl(sender.name, sender.email, "4F46E5"),
                                    },
                                    recipient: {
                                        name: recipient.name,
                                        email: recipient.email,
                                        avatar: generateAvatarUrl(recipient.name, recipient.email, "10B981"),
                                    },
                                    timestamp: formatDate(emailDate),
                                    type: "direct",
                                    content: body,
                                    signature: {
                                        name: sender.name,
                                        title: "",
                                        contact: sender.email,
                                    },
                                },
                            ],
                        },

                        tempSenderEmail: sender.email,
                        tempRecipientEmail: recipient.email,
                    });
                }
            } catch (err) {
                console.error(`Error expanding thread ${related.threadId}:`, err);
            }
        }
    }

    return expandedEmails;
}

/*  ============================================================
    ! FINAL API: /gm-fetch-org-emails
    ! Fetches Gmail emails for recruiter and members of the organization
    ! STEP 1: GET ALL MEMBERS
    ! STEP 2: FETCH ALL GMAIL EMAILS
    ! STEP 3: EXPAND CONVERSATION MESSAGES
    ! STEP 4: ATTACH CareerId TO EMAILS FROM email-threads
    ! STEP 5: ENRICH WITH USER DATA
    ! STEP 6: FETCH NOREPLY EMAILS
    ! STEP 7: GROUP BY CONVERSATION ID
    ! STEP 8: BUILD FINAL THREADS
    ! STEP 9: SORT BY NEWEST MESSAGE TIMESTAMP DESCENDING
    ! STEP 10: RETURN FINAL THREADS
   ============================================================ */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
    try {
        const { orgID, maxResults = 20, label, candidateEmail, careerId } = await req.json();
        const { db } = await connectToDatabase();

        console.log("careerId", careerId);
        if (!orgID) {
            return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
        }

        //!  STEP 1: GET ALL MEMBERS
        const members = await db.collection("members").find({ orgID }).toArray();

        //!  STEP 2: FETCH ALL GMAIL EMAILS
        const gmailEmails: any[] = [];

        for (const m of members) {
            const token = await getValidAccessToken(m.email, db);
            if (!token) continue;

            const mails = await fetchRecruiterEmails(m.email, token, maxResults, label);
            gmailEmails.push(...mails);
        }

        /* Deduplicate by message id */
        const mapById = new Map();
        gmailEmails.forEach(e => mapById.set(e.id, e));
        const dedupedEmails = Array.from(mapById.values());

        //!  STEP 3: EXPAND CONVERSATION MESSAGES
        let expandedEmails = await expandConversationMessages(dedupedEmails, orgID, db);

        //!  STEP 4: ATTACH CareerId TO EMAILS FROM email-threads
        for (const email of expandedEmails) {
            if (email.CareerId) continue; // Already has CareerId

            if (email.threadId) {
                const threadQuery: any = { threadId: email.threadId };
                if (orgID) {
                    threadQuery.$or = [
                        { orgID },
                        { orgID: { $exists: false } }
                    ];
                }
                const threadDoc = await db.collection("email-threads").findOne(threadQuery);
                if (threadDoc?.CareerId) {
                    email.CareerId = threadDoc.CareerId;
                }
            }
        }

        //!  STEP 5: ENRICH WITH USER DATA
        const allEmailsToLookup = new Set<string>();
        expandedEmails.forEach(e => {
            if (e.tempSenderEmail) allEmailsToLookup.add(e.tempSenderEmail);
            if (e.tempRecipientEmail) allEmailsToLookup.add(e.tempRecipientEmail);
            if (e.recruiterEmail) allEmailsToLookup.add(e.recruiterEmail);
        });

        const userDataMap = await batchUserData(Array.from(allEmailsToLookup), db);

        expandedEmails.forEach(e => {
            const isDraft = Array.isArray(e.labelIds) && e.labelIds.includes("DRAFT");

            const s = userDataMap.get(e.tempSenderEmail?.toLowerCase() || "");
            const r = userDataMap.get(e.tempRecipientEmail?.toLowerCase() || "");

            if (!isDraft) {
                if (s) {
                    e.emailContent.messages[0].sender.name = s.name;
                    e.emailContent.messages[0].sender.email = s.email;
                    e.emailContent.messages[0].sender.avatar = s.image;
                }

                if (r) {
                    e.emailContent.messages[0].recipient.name = r.name;
                    e.emailContent.messages[0].recipient.email = r.email;
                    e.emailContent.messages[0].recipient.avatar = r.image;
                }
            }

            // For display in email list:
            // - For DRAFTS: use recruiterEmail to get the actual sender from database
            // - For SENT emails: show recipient name (who the email was sent to - the candidate)
            // - For INBOX emails: show sender name (who sent it to us)
            if (isDraft) {
                const draftFrom = e.recruiterEmail || "";
                if (draftFrom) {
                    const draftUser = userDataMap.get(draftFrom.toLowerCase());

                    if (draftUser) {
                        e.name = draftUser.name;
                        e.avatar = draftUser.image || generateAvatarUrl(draftUser.name, draftUser.email, "4F46E5");
                    } else {
                        const parsed = parseEmailAddress(draftFrom);
                        e.name = parsed.name || parsed.email || draftFrom;
                        e.avatar = generateAvatarUrl(parsed.name || parsed.email, parsed.email || draftFrom, "4F46E5");
                    }
                }
            }


            else {
                const isSent = (e.labelIds || []).includes("SENT") || e.isSent === true;
                if (isSent && r) {
                    e.name = r.name;
                    e.avatar = r.image;
                } else if (s) {
                    e.name = s.name;
                    e.avatar = s.image;
                }
            }
            delete e.tempSenderEmail;
            delete e.tempRecipientEmail;
        });

        //!  STEP 6: FETCH NOREPLY EMAILS
        const noreplyDocs = await db.collection("email-noreply")
            .find({ orgID })
            .sort({ createdAt: -1 })
            .toArray();

        let noreplyEmails = noreplyDocs.map(doc =>
            formatNoreplyEmail(doc, userDataMap)
        );

        //! Step 6.5: CANDIDATE FILTERING (drafts must NOT be filtered)
        //! CANDIDATE FILTERING (drafts must NOT be filtered)
        //! OPTIONAL FILTER: candidateEmail + CareerId (CareerId is an ID)
        //? Testing only
        // const candidateEmailLower = "johnandreidev404@gmail.com";
        // const activeJobRoleFilter = "69145d7b006bc3d45ff3b430";
        

        const activeJobRoleFilter = careerId;
        const candidateEmailLower = candidateEmail ? candidateEmail.toLowerCase() : "";

        if (candidateEmailLower || activeJobRoleFilter && false) {

            const passesFilters = (email: any) => {
                const msg = email.emailContent?.messages?.[0];
                if (!msg) return false;

                const sender = msg.sender?.email?.toLowerCase();
                const recipient = msg.recipient?.email?.toLowerCase();

                const emailJobRole = email.CareerId || null;

                // Candidate filter (optional)
                const candidateMatch = candidateEmailLower
                    ? sender === candidateEmailLower || recipient === candidateEmailLower
                    : true;

                // Job role filter
                const jobRoleMatch = activeJobRoleFilter
                    ? emailJobRole === activeJobRoleFilter
                    : true;

                return candidateMatch && jobRoleMatch;
            };

            // FILTER ONLY INBOX EMAILS
            expandedEmails = expandedEmails.filter(passesFilters);
            noreplyEmails = noreplyEmails.filter(passesFilters);

        }

        // const noreplyEmails = noreplyDocs.map(doc => formatNoreplyEmail(doc, userDataMap));

        //!  STEP 7: GROUP BY CONVERSATION ID
        const conversationMap = new Map<string, any[]>(); // conversationId -> array of messages

        for (const email of expandedEmails) {
            const recipientEmail = email.emailContent?.messages?.[0]?.recipient?.email?.toLowerCase() || "";
            const emailSubject = email.subject || "";
            const normalizedSubj = normalizeSubject(emailSubject);

            // Get or generate conversationId
            const conversationId = await getConversationId(
                email.threadId,
                normalizedSubj,
                recipientEmail,
                orgID,
                db
            );

            if (!conversationMap.has(conversationId)) {
                conversationMap.set(conversationId, []);
            }
            conversationMap.get(conversationId)!.push(email);
        }

        // Process noreply emails
        for (const noreply of noreplyEmails) {
            const toEmail = (Array.isArray(noreply.emailContent?.messages?.[0]?.recipient?.email)
                ? noreply.emailContent.messages[0].recipient.email[0]
                : noreply.emailContent?.messages?.[0]?.recipient?.email || "").toLowerCase();
            const normalizedSubj = normalizeSubject(noreply.subject || "");

            if (!normalizedSubj || !toEmail) continue;

            // Get or generate conversationId
            const conversationId = await getConversationId(
                null,
                normalizedSubj,
                toEmail,
                orgID,
                db
            );

            if (!conversationMap.has(conversationId)) {
                conversationMap.set(conversationId, []);
            }
            conversationMap.get(conversationId)!.push(noreply);
        }

        //!  STEP 8: BUILD FINAL THREADS
        const finalThreads: any[] = [];

        for (const [conversationId, messages] of conversationMap) {
            // Separate drafts from non-drafts
            const draftMessages = messages.filter((m: any) =>
                Array.isArray(m.labelIds) && m.labelIds.includes("DRAFT")
            );
            const nonDraftMessages = messages.filter((m: any) =>
                !Array.isArray(m.labelIds) || !m.labelIds.includes("DRAFT")
            );

            // Handle drafts separately - each draft is its own thread
            draftMessages.forEach((draft: any) => {
                draft.isDraft = true;
                draft.conversationId = conversationId;
                finalThreads.push(draft);
            });

            // Handle non-draft messages (grouped by conversation)
            if (nonDraftMessages.length === 0) continue;

            const allMessagesIncludingNoReply = nonDraftMessages;

            const latest = allMessagesIncludingNoReply.reduce((a, b) =>
                (b.emailTimestamp || 0) > (a.emailTimestamp || 0) ? b : a
            );

            //! MERGE ALL labelIds from ALL messages in the conversation
            // This ensures SENT, INBOX, DRAFT, and all other Gmail labels are preserved
            // If ANY message has SENT → thread appears in Sent filter
            // If ANY message has INBOX → thread appears in Inbox filter
            // If ANY message has DRAFT → thread appears in Draft filter
            const mergedLabels = new Set<string>();
            nonDraftMessages
                .filter(msg => !msg.isNoreply)     // prevent no-reply from infecting Gmail labels
                .forEach((msg: any) => {
                    const msgLabels = msg.labelIds || [];
                    msgLabels.forEach((label: string) => {
                        if (label) { // Include all labels
                            mergedLabels.add(label);
                        }
                    });
                });

            // Set merged labelIds on the final thread
            // This ensures the thread appears in both Inbox, Sent, and Draft filters if applicable
            // Preserves all original Gmail labels exactly as Gmail returns them
            latest.labelIds = Array.from(mergedLabels);

            // Get CareerId from any message in the conversation
            const CareerId = nonDraftMessages.find((m: any) => m.CareerId)?.CareerId || null;
            if (CareerId) {
                latest.CareerId = CareerId;
            }

            // latest decides sorting ONLY, firstHumanMessage decides: name, avatar, subject
            const firstHumanMessage = nonDraftMessages.find(
                m => !m.isNoreply && !m.labelIds?.includes("AUTOMATED")
            );

            if (firstHumanMessage) {
                latest.name = firstHumanMessage.name;
                latest.avatar = firstHumanMessage.avatar;
                latest.subject = firstHumanMessage.subject;
            }

            // If latest is noreply and doesn't have threadId, get it from any Gmail message
            if (!latest.threadId) {
                const gmailMessage = nonDraftMessages.find(m => m.threadId && !m.isNoreply);
                if (gmailMessage) {
                    latest.threadId = gmailMessage.threadId;
                }
            }

            latest.messageCount = allMessagesIncludingNoReply.length;

            // Add conversationId to the thread item
            latest.conversationId = conversationId;

            finalThreads.push(latest);
        }

        //! STEP 9: SORT BY NEWEST MESSAGE TIMESTAMP DESCENDING
        finalThreads.sort((a, b) => (b.emailTimestamp || 0) - (a.emailTimestamp || 0));

        // Log drafts only
        // const labelToLog = "DRAFT";
        // const draftsOnly = finalThreads.filter((thread: any) =>
        //     thread.isDraft || (Array.isArray(thread.labelIds) && thread.labelIds.includes(labelToLog))
        // );
        // console.log(`=== ${labelToLog} ONLY ===`);
        // console.log(`Total ${labelToLog}:`, draftsOnly.length);
        // draftsOnly.forEach((draft: any, index: number) => {
        //     console.log(`${labelToLog} ${index + 1}:`, {
        //         id: draft.id,
        //         name: draft.name,
        //         subject: draft.subject,
        //         senderEmail: draft.emailContent?.messages?.[0]?.sender?.email,
        //         senderName: draft.emailContent?.messages?.[0]?.sender?.name,
        //         recruiterEmail: draft.recruiterEmail,
        //         labelIds: draft.labelIds,
        //         isDraft: draft.isDraft,
        //     });
        // });
        // console.log("==================\n");

        // console.log(
        //     "=== FINAL THREADS (FIRST 5) ===\n",
        //     JSON.stringify(finalThreads.slice(0, 1), null, 2)
        // );
        

        // finalThreads.forEach((t, i) => {
        //     console.log(`THREAD ${i + 1}`, {
        //         name: t.name,
        //     });
        // });


        // console.log("=== NOREPLY EMAILS (FINAL LOG BEFORE RESPONSE) ===");
        // noreplyEmails.forEach((n, i) => {
        //     console.log(`NOREPLY #${i + 1}:`, {
        //         id: n.id,
        //         subject: n.subject,
        //         from: n.emailContent?.messages?.[0]?.sender?.email,
        //         to: n.emailContent?.messages?.[0]?.recipient?.email,
        //         CareerId: n.CareerId,
        //         timestamp: n.emailTimestamp,
        //         labelIds: n.labelIds,
        //         snippet: n.snippet
        //     });
        // });
        // console.log("=== END NOREPLY LOG ===\n");

        return NextResponse.json({
            success: true,
            total: finalThreads.length,
            threads: finalThreads
        });

    } catch (err: any) {
        console.error("Error:", err);
        return NextResponse.json(
            { error: "Internal Server Error", details: err.message },
            { status: 500 }
        );
    }
});
