import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

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

async function getValidAccessToken(email: string): Promise<string> {
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
                    tokenExpiry: new Date(Date.now() + 3600 * 1000), // 1 hour from now
                    updatedAt: new Date(),
                },
            }
        );

        return newAccessToken;
    }

    return tokenDoc.accessToken;
}

function base64UrlToBase64(s: string) {
    return s?.replace(/-/g, "+").replace(/_/g, "/") || s;
}

// Strip quoted reply content like:
// "On Sat, Nov 29, 2025 at 1:36 PM <mr.randomdude404@gmail.com> wrote:"
// and common Gmail quote blocks, so the UI only shows the latest message text.
function stripQuotedReply(html: string): string {
    if (!html) return html;

    let cleaned = html;
    cleaned = cleaned.replace(
        /<blockquote[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*?<\/blockquote>/gi,
        ""
    );
    cleaned = cleaned.replace(
        /<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
        ""
    );

    const marker = cleaned.match(/On[\s\S]*?wrote:/i);
    if (marker && typeof marker.index === "number") {
        cleaned = cleaned.slice(0, marker.index);
    }

    return cleaned;
}

// ! getUserData: get user data from db
async function getUserData(email: string, db: any) {
    if (!email) return { name: email, email, image: null };
    const lower = email.toLowerCase();

    const admin = await db.collection("admins").findOne({ email: lower });
    if (admin) return admin;

    const aff = await db
        .collection("affiliations")
        .findOne({ "applicantInfo.email": lower });
    if (aff) return aff.applicantInfo;

    return { name: lower, email: lower, image: null };
}

function generateAvatarUrl(name: string, email: string, bg = "4F46E5") {
    const seed = encodeURIComponent(name || email || Date.now());
    return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=${bg}`;
}

//! processInlineImages: process inline images
async function processInlineImages(body: string, parts: any[], messageId: string, token: string) {
    let found: any[] = [];

    function walk(arr: any[]) {
        for (const p of arr) {
            if (p.parts) walk(p.parts);

            const aId = p?.body?.attachmentId;
            const mime = p?.mimeType;
            if (!aId || !mime?.startsWith("image/")) continue;

            const cd = p.headers?.find((h: any) => h.name.toLowerCase() === "content-disposition");
            if (!cd?.value?.toLowerCase().includes("inline")) continue;

            const cid = p.headers?.find((h: any) => h.name.toLowerCase() === "content-id")?.value?.replace(/[<>]/g, "");
            if (cid) found.push({ cid, attachmentId: aId, mimeType: mime });
        }
    }

    walk(parts);
    if (!found.length) return body;

    const fetched = await Promise.all(
        found.map(async (i) => {
            try {
                const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${i.attachmentId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!r.ok) return null;
                const j = await r.json();
                const b64 = base64UrlToBase64(j.data || "");
                return { cid: i.cid, url: `data:${i.mimeType};base64,${b64}` };
            } catch (err) {
                return null;
            }
        })
    );

    for (const f of fetched) {
        if (!f) continue;
        body = body.replace(new RegExp(`cid:${f.cid}`, "gi"), f.url);
    }

    return body;
}

//! extractAttachments: extract attachments
async function extractAttachments(parts: any[], messageId: string, token: string) {
    let attachments: any[] = [];
    const seen = new Set();

    async function walk(arr: any[]) {
        for (const p of arr) {
            if (p.parts) await walk(p.parts);

            const aId = p?.body?.attachmentId;
            if (!aId || seen.has(aId)) continue;
            seen.add(aId);

            const cd = p.headers?.find((h: any) => h.name.toLowerCase() === "content-disposition");
            if (cd?.value?.toLowerCase().includes("inline")) continue;

            try {
                const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${aId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const meta = {
                    filename: p.filename || "attachment",
                    mimeType: p.mimeType || "application/octet-stream",
                    size: p.body?.size || 0,
                    attachmentId: aId,
                };

                if (!r.ok) {
                    attachments.push({ ...meta, dataUrl: null });
                    continue;
                }

                const j = await r.json();
                const b64 = base64UrlToBase64(j.data || "");
                attachments.push({
                    ...meta,
                    dataUrl: `data:${meta.mimeType};base64,${b64}`,
                });
            } catch (err) {
                attachments.push({
                    filename: p.filename || "attachment",
                    mimeType: p.mimeType || "application/octet-stream",
                    size: p.body?.size || 0,
                    attachmentId: aId,
                    dataUrl: null,
                });
            }
        }
    }

    await walk(parts);
    return attachments;
}

//! Normalize subject by removing Re:, Fwd:, etc.
function normalizeSubject(subject: string): string {
    if (!subject) return "";
    return subject.replace(/^(Re:|RE:|Fwd:|FWD:|Fw:|FW:)\s*/i, "").trim();
}

//! fetch sent emails (email-noreply) by conversationId
async function fetchSentEmailsMessages(conversationId: string, db: any, orgID?: string) {
    if (!conversationId) return [];

    // Get all threads in this conversation to get subject and recipient
    const conversationThreads = await db.collection("email-threads")
        .find({ conversationId })
        .toArray();

    if (conversationThreads.length === 0) return [];

    // Get normalizedSubject and recipient from first thread (they should all have same values)
    const firstThread = conversationThreads[0];
    const normalizedSubj = firstThread?.normalizedSubject || normalizeSubject(firstThread?.subject || "");
    const toEmailLower = (firstThread?.toEmail || "").toLowerCase();

    if (!normalizedSubj || !toEmailLower) return [];

    // Escape special regex characters
    const escapedSubj = normalizedSubj.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedEmail = toEmailLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Build query to find noreply messages matching this conversation
    // Match by normalized subject + recipient (same way as gm-fetch-org-emails groups them)
    // Subject can have Re:/Fwd: prefix or not
    const q: any = {
        status: "sent",
        subject: { $regex: new RegExp(`^(${escapedSubj}|Re: ${escapedSubj}|Fwd: ${escapedSubj})`, "i") },
        to: { $regex: new RegExp(escapedEmail, "i") }
    };

    // Add orgID filter if provided
    if (orgID) {
        q.orgID = orgID;
    }

    const docs = await db.collection("email-noreply").find(q).toArray();

    return docs.map((e) => ({
        id: e.mailgunId || `sent-${e._id}`,
        isSentEmail: true,
        internalDate: String(new Date(e.createdAt).getTime()),
        payload: {
            headers: [
                { name: "Subject", value: e.subject },
                { name: "From", value: e.from },
                { name: "To", value: Array.isArray(e.to) ? e.to[0] : e.to },
                { name: "Date", value: new Date(e.createdAt).toUTCString() },
            ],
            body: { data: Buffer.from(e.html || e.message || e.text || "").toString("base64") },
        },
        sentEmailData: e,
    }));
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const { threadId } = await request.json();
        if (!threadId)
            return NextResponse.json({ error: "threadId required" }, { status: 400 });

        const { db } = await connectToDatabase();

        const messageTokenMap = new Map<string, string>();
        let allMessages: any[] = [];

        const threadDoc = await db.collection("email-threads").findOne({ threadId });
        if (threadDoc?.conversationId) {
            const relatedThreads = await db
                .collection("email-threads")
                .find({ conversationId: threadDoc.conversationId })
                .toArray();

            for (const rt of relatedThreads) {
                if (!rt.threadId || !rt.fromEmail) continue;

                try {
                    const token = await getValidAccessToken(rt.fromEmail);

                    const res = await fetch(
                        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${rt.threadId}?format=full`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );

                    if (!res.ok) continue;

                    const t = await res.json();

                    (t.messages || []).forEach((m: any) =>
                        messageTokenMap.set(m.id, token)
                    );

                    allMessages.push(...(t.messages || []));
                } catch (err) {
                    console.error(
                        `Error fetching rt.threadId ${rt.threadId}:`,
                        err
                    );
                    continue;
                }
            }
        }

        else {
            const thread = await db.collection("email-threads").findOne({ threadId });

            allMessages.push(...(thread?.messages || []));
        }

        const finalOrgID = threadDoc?.orgID;
        const conversationId = threadDoc?.conversationId;
        if (conversationId) {
            const sentEmails = await fetchSentEmailsMessages(conversationId, db, finalOrgID);
            allMessages.push(...sentEmails);
        }

        const unified = new Map();
        for (const m of allMessages) {
            if (!unified.has(m.id)) unified.set(m.id, m);
        }

        const sorted = [...unified.values()].sort((a, b) => {
            const ai = Number(
                a.internalDate ||
                a.payload?.internalDate ||
                new Date(a.internalDate || 0).getTime()
            );
            const bi = Number(
                b.internalDate ||
                b.payload?.internalDate ||
                new Date(b.internalDate || 0).getTime()
            );
            return ai - bi;
        });

        const processed: any[] = [];
        for (const message of sorted) {
            if (message.labelIds?.includes("DRAFT")) continue;

            // CASE: INTERNAL SENT EMAIL (email-noreply)
            if (message.isSentEmail) {
                const e = message.sentEmailData;
                const sender = await getUserData(e.from, db);
                const rec = await getUserData(
                    Array.isArray(e.to) ? e.to[0] : e.to,
                    db
                );

                const rawContent =
                    e.html || e.message || e.text || "";

                processed.push({
                    id: message.id,
                    type: e.type,
                    timestamp: new Date(e.createdAt).toISOString(),
                    sender: {
                        name: sender.name,
                        email: sender.email,
                        avatar:
                            sender.image ||
                            generateAvatarUrl(sender.name, sender.email),
                    },
                    recipient: {
                        name: rec.name,
                        email: rec.email,
                        avatar:
                            rec.image ||
                            generateAvatarUrl(rec.name, rec.email, "10B981"),
                    },
                    content: stripQuotedReply(rawContent),
                    attachments: [],
                });

                continue;
            }

            // CASE: GMAIL MESSAGE
            const tok = messageTokenMap.get(message.id);
            const headers = message.payload?.headers || [];

            const from = headers.find((h) => h.name === "From")?.value || "";
            const to = headers.find((h) => h.name === "To")?.value || "";
            const date =
                headers.find((h) => h.name === "Date")?.value ||
                new Date().toISOString();

            const senderEmail =
                (from.match(/<([^>]+)>/) || [null, from])[1] || from;
            const recEmail =
                (to.match(/<([^>]+)>/) || [null, to])[1] || to;

            const sender = await getUserData(senderEmail, db);
            const rec = await getUserData(recEmail, db);

            // BODY
            let body = "";
            if (message.payload?.body?.data)
                body = Buffer.from(message.payload.body.data, "base64").toString();
            else if (message.payload?.parts)
                body = await (async function find(parts) {
                    for (const p of parts) {
                        if (p.mimeType === "text/html" && p.body?.data)
                            return Buffer.from(p.body.data, "base64").toString();
                        if (p.parts) {
                            const x = await find(p.parts);
                            if (x) return x;
                        }
                    }
                    return "";
                })(message.payload.parts);

            // Remove quoted reply text so UI only shows the main/latest content
            body = stripQuotedReply(body);

            if (body && message.payload?.parts && tok)
                body = await processInlineImages(
                    body,
                    message.payload.parts,
                    message.id,
                    tok
                );

            const attachments =
                message.payload?.parts && tok
                    ? await extractAttachments(
                        message.payload.parts,
                        message.id,
                        tok
                    )
                    : [];

            processed.push({
                id: message.id,
                type: "direct",
                timestamp: new Date(date).toISOString(),
                sender: {
                    name: sender.name,
                    email: sender.email,
                    avatar:
                        sender.image ||
                        generateAvatarUrl(sender.name, sender.email),
                },
                recipient: {
                    name: rec.name,
                    email: rec.email,
                    avatar:
                        rec.image ||
                        generateAvatarUrl(rec.name, rec.email, "10B981"),
                },
                content: body,
                attachments,
            });
        }

        console.log("processed", processed);
        return NextResponse.json({
            success: true,
            data: {
                threadId,
                conversationId: threadDoc?.conversationId || null,
                subject:
                    threadDoc?.subject ||
                    sorted[0]?.payload?.headers?.find(
                        (h: any) => h.name === "Subject"
                    )?.value ||
                    "No Subject",
                messages: processed,
            },
        });
    } catch (err) {
        console.error("FETCH THREAD ERROR:", err);
        return NextResponse.json(
            { error: "Failed to fetch thread", details: String(err) },
            { status: 500 }
        );
    }
});
