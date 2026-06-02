import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import sanitizeHtml from "sanitize-html";

// Avoid attempting to create the same index on every request.
let _mailgunIndexEnsured = false;
let _rateLimitIndexEnsured = false;

// Rate limiting helper functions
interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number;
}

async function checkRateLimit(
  db: any,
  type: string,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitCheck> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    const count = await db.collection("mailgun-rate-limits").countDocuments({
      type,
      key,
      timestamp: { $gte: windowStart },
    });

    if (count >= limit) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${count}/${limit} in ${windowMs / 1000}s`,
        current: count,
        limit,
      };
    }

    return { allowed: true, current: count, limit };
  } catch (e) {
    console.error("checkRateLimit error", e);
    return { allowed: true }; // Fail open on errors
  }
}

async function recordRateLimit(
  db: any,
  type: string,
  key: string,
  metadata?: any
): Promise<void> {
  try {
    await db.collection("mailgun-rate-limits").insertOne({
      type,
      key,
      timestamp: new Date(),
      ...metadata,
    });
  } catch (e) {
    console.error("recordRateLimit error", e);
  }
}

async function checkSizeLimits(
  db: any,
  senderEmail: string,
  attachmentSize: number
): Promise<RateLimitCheck> {
  try {
    const now = new Date();

    // Check: More than 3 messages with attachments in 10 minutes
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const recentAttachments = await db
      .collection("mailgun-rate-limits")
      .countDocuments({
        type: "attachment",
        key: senderEmail,
        timestamp: { $gte: tenMinutesAgo },
      });

    if (recentAttachments >= 3) {
      return {
        allowed: false,
        reason: "Too many attachments: 3+ in 10 minutes",
        current: recentAttachments,
        limit: 3,
      };
    }

    // Check: Total attachments from sender > 50 MB/day
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dailySizeResult = await db
      .collection("mailgun-rate-limits")
      .aggregate([
        {
          $match: {
            type: "attachment",
            key: senderEmail,
            timestamp: { $gte: oneDayAgo },
          },
        },
        { $group: { _id: null, totalSize: { $sum: "$size" } } },
      ])
      .toArray();

    const dailySize = dailySizeResult[0]?.totalSize || 0;
    const maxDailySize = 50 * 1024 * 1024; // 50 MB

    if (dailySize + attachmentSize > maxDailySize) {
      return {
        allowed: false,
        reason: `Daily size limit exceeded: ${Math.round(
          (dailySize + attachmentSize) / 1024 / 1024
        )}MB / 50MB`,
        current: dailySize + attachmentSize,
        limit: maxDailySize,
      };
    }

    return { allowed: true };
  } catch (e) {
    console.error("checkSizeLimits error", e);
    return { allowed: true }; // Fail open on errors
  }
}

function normalizeSubject(s: string) {
  if (!s) return "";
  return s.replace(/^([\s]*(?:re|fw|fwd)[\s]*[:\-\s]*)+/i, "").trim();
}

// Sanitize HTML content to prevent XSS attacks
function sanitizeHtmlContent(html: string): string {
  if (!html) return "";
  const safeRedirect = (url: string): string => {
    try {
      const u = String(url || "").trim();
      // Block javascript:, data:, and other unsafe schemes
      if (/^(javascript:)/i.test(u)) return "";
      if (/^(data:)/i.test(u)) return "";
      // Allow only http, https, mailto, tel
      if (!/^(https?:|mailto:|tel:)/i.test(u)) return "";
      // Optional: route external links through a redirect endpoint for monitoring
      if (/^https?:/i.test(u)) {
        const encoded = encodeURIComponent(u);
        return `/api/link-redirect?url=${encoded}`;
      }
      return u;
    } catch {
      return "";
    }
  };

  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "div",
      "span",
      "br",
      "hr",
      "pre",
      "code",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["class", "id", "style"],
    },
    // Strict scheme rules: block javascript: and data: entirely
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {},
    // Remove script execution vectors
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    transformTags: {
      a: (tagName: string, attribs: any) => {
        const href = attribs.href || "";
        const safeHref = safeRedirect(href);
        const out: any = { ...attribs };
        out.href = safeHref;
        const relSet = new Set(
          String(out.rel || "")
            .split(/\s+/)
            .filter(Boolean)
        );
        relSet.add("nofollow");
        relSet.add("noreferrer");
        relSet.add("noopener");
        out.rel = Array.from(relSet).join(" ");
        return { tagName, attribs: out };
      },
      img: (tagName: string, attribs: any) => {
        const src = attribs.src || "";
        let outSrc = String(src).trim();
        if (/^(javascript:)/i.test(outSrc)) outSrc = "";
        if (/^(data:)/i.test(outSrc)) outSrc = "";
        if (outSrc && !/^https?:/i.test(outSrc)) outSrc = "";
        const out: any = { ...attribs, src: outSrc };
        return { tagName, attribs: out };
      },
    },
  });
}

// Sanitize plain text to prevent injection
function sanitizePlainText(text: string): string {
  if (!text) return "";
  // Remove script tags and any HTML entirely
  let cleaned = sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  });
  // Strip unicode control characters used for obfuscation
  try {
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F\u0080-\u009F]/g, "");
  } catch {}
  // Normalize whitespace
  cleaned = cleaned.replace(/[\t\r]+/g, " ").replace(/[\n]+/g, "\n");
  return cleaned;
}

// File type validation using magic bytes
interface FileValidationResult {
  isValid: boolean;
  detectedType: string | null;
  reason?: string;
}

function validateFileType(
  buffer: Buffer,
  mimeType: string
): FileValidationResult {
  // Check magic bytes (file signatures)
  const magicBytes = buffer.slice(0, 12);

  // Allowed file types with their magic bytes signatures
  const allowedTypes: Record<
    string,
    { signatures: number[][]; extensions: string[] }
  > = {
    "application/pdf": {
      signatures: [[0x25, 0x50, 0x44, 0x46]], // %PDF
      extensions: ["pdf"],
    },
    "application/msword": {
      signatures: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // DOC
      extensions: ["doc"],
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      signatures: [[0x50, 0x4b, 0x03, 0x04]], // DOCX (ZIP-based)
      extensions: ["docx"],
    },
    "text/plain": {
      signatures: [], // Text files don't have consistent magic bytes
      extensions: ["txt"],
    },
    "image/png": {
      signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]], // PNG
      extensions: ["png"],
    },
    "image/jpeg": {
      signatures: [[0xff, 0xd8, 0xff]], // JPEG
      extensions: ["jpg", "jpeg"],
    },
    "message/rfc822": {
      signatures: [], // EML files
      extensions: ["eml"],
    },
  };

  // Dangerous file signatures to explicitly reject
  const dangerousSignatures = [
    [0x4d, 0x5a], // EXE, DLL
    [0x7f, 0x45, 0x4c, 0x46], // ELF (Linux executables)
    [0x23, 0x21], // Script files (#!)
    [0xca, 0xfe, 0xba, 0xbe], // Java class files
    [0xfe, 0xed, 0xfa], // Mach-O (macOS executables)
  ];

  // Check for dangerous file types first
  for (const dangerous of dangerousSignatures) {
    if (
      magicBytes
        .slice(0, dangerous.length)
        .every((byte, i) => byte === dangerous[i])
    ) {
      return {
        isValid: false,
        detectedType: "executable",
        reason: "Executable files are not allowed",
      };
    }
  }

  // Check for HTML content (dangerous in attachments)
  const htmlSignatures = [
    Buffer.from("<!DOCTYPE", "utf-8"),
    Buffer.from("<html", "utf-8"),
    Buffer.from("<HTML", "utf-8"),
    Buffer.from("<?xml", "utf-8"),
  ];

  for (const htmlSig of htmlSignatures) {
    if (buffer.slice(0, htmlSig.length).equals(htmlSig)) {
      return {
        isValid: false,
        detectedType: "html",
        reason: "HTML files are not allowed as attachments",
      };
    }
  }

  // Normalize MIME type for comparison
  const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();

  // Special handling for text/plain - allow if no dangerous content
  if (normalizedMime === "text/plain" || normalizedMime === "message/rfc822") {
    return { isValid: true, detectedType: normalizedMime };
  }

  // Check if MIME type is in allowed list
  const allowedType = allowedTypes[normalizedMime];
  if (!allowedType) {
    return {
      isValid: false,
      detectedType: null,
      reason: `File type ${normalizedMime} is not allowed`,
    };
  }

  // If type has signatures, validate them
  if (allowedType.signatures.length > 0) {
    let signatureMatch = false;
    for (const signature of allowedType.signatures) {
      if (
        magicBytes
          .slice(0, signature.length)
          .every((byte, i) => byte === signature[i])
      ) {
        signatureMatch = true;
        break;
      }
    }

    if (!signatureMatch) {
      return {
        isValid: false,
        detectedType: normalizedMime,
        reason: `File signature does not match MIME type ${normalizedMime}`,
      };
    }
  }

  return { isValid: true, detectedType: normalizedMime };
}

async function uploadToR2(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<{ key: string; originalFilename: string }> {
  const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });

  // Generate UUID for filename to prevent injection attacks
  const uuid = crypto.randomUUID();
  const extension = originalFilename.split(".").pop()?.toLowerCase() || "bin";
  const safeFilename = `${uuid}.${extension}`;
  const key = `mailgun-inbound/${safeFilename}`;

  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType || "application/octet-stream",
    // Store original filename as metadata
    Metadata: {
      "original-filename": originalFilename,
    },
  });

  await s3Client.send(cmd);

  // Return key instead of public URL - presigned URLs will be generated on-demand
  return { key, originalFilename };
}

async function generatePresignedUrl(key: string): Promise<string> {
  const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  // Generate presigned URL valid for 1 hour
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
}

export const POST = async (req: Request) => {
  try {
    const ct = req.headers.get("content-type") || "";
    console.log("mg-receive-email: incoming request", {
      contentType: ct,
      method: (req as any).method || "POST",
      host: req.headers.get("host"),
      ua: req.headers.get("user-agent")?.slice(0, 120),
    });

    // Support both JSON (mailgun's event webhook) and form-data (incoming mail)
    let payload: any = {};
    let form: any = null;
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else {
      // try formData
      try {
        form = await (req as any).formData();
        // Read entries once and reuse (FormData.entries() is an iterator)
        const formEntries = Array.from((form as any).entries()) as Array<
          [string, any]
        >;
        // Create a map for convenient lookups (formMap.get(key))
        (form as any)._entries = formEntries; // attach for later use
        (form as any)._map = new Map(formEntries as [string, any][]);
        // convert string entries into payload where possible
        for (const [k, v] of formEntries) {
          // keep files as File objects
          if (typeof v === "string") payload[k] = v;
        }
      } catch (e) {
        // ignore
      }
    }

    // Extract signature fields (mailgun sends timestamp, token, signature)
    let timestamp: string | undefined;
    let token: string | undefined;
    let signature: string | undefined;
    if (payload?.signature) {
      timestamp = payload.signature.timestamp;
      token = payload.signature.token;
      signature = payload.signature.signature;
    } else if (payload?.timestamp && payload?.token && payload?.signature) {
      timestamp = payload.timestamp;
      token = payload.token;
      signature = payload.signature;
    } else if (form) {
      const formMap = (form as any)?._map as Map<string, any> | undefined;
      timestamp = formMap?.get("timestamp") as string | undefined;
      token = formMap?.get("token") as string | undefined;
      signature = formMap?.get("signature") as string | undefined;
    }

    // log parsed signature fields (if present)
    console.log("mg-receive-email: parsed-signature-fields", {
      timestamp: timestamp || null,
      token: token || null,
      signature: signature ? "(present)" : null,
    });

    // If received a Mailgun even webhook, skip processing unless the payload contains actual message content
    if (ct.includes("application/json")) {
      const event =
        payload?.event || (Array.isArray(payload) && payload[0]?.event) || null;
      const hasMessageContent = !!(
        payload?.["body-plain"] ||
        payload?.["body-html"] ||
        payload?.html ||
        payload?.text ||
        payload?.["message-headers"] ||
        payload?.recipient ||
        payload?.from ||
        payload?.sender
      );

      // log event and header shapes for debugging
      console.log("mg-receive-email: json webhook event", {
        event,
        hasMessageContent,
        headersShape: !!payload?.["message-headers"],
        recipient: payload?.recipient || payload?.to || null,
      });

      // Skip common Mailgun event notifications when they lack message content
      const skipEvents = new Set([
        "accepted",
        "delivered",
        "opened",
        "clicked",
        "failed",
        "stored",
        "unsubscribed",
      ]);
      if (event && skipEvents.has(String(event)) && !hasMessageContent) {
        console.log(
          "mg-receive-email: skipping Mailgun event webhook (known event)",
          {
            event,
          }
        );
        return NextResponse.json({ ok: true, skippedEvent: event });
      }
    }

    // Parse common fields
    const formMap = (form as any)?._map as Map<string, any> | undefined;
    const from =
      payload.from ||
      payload.sender ||
      (formMap && (formMap.get("sender") || formMap.get("from"))) ||
      null;
    const to =
      payload.to ||
      payload.recipient ||
      (formMap && (formMap.get("recipient") || formMap.get("to"))) ||
      null;
    const subject =
      payload.subject || (formMap && formMap.get("subject")) || "";

    // Restrict receiving emails to noreply@hellojia.ai and return SMTP 550 error for bounce
    if (to && typeof to === "string" && to.trim().toLowerCase() === "noreply@hellojia.ai") {
      console.log("mg-receive-email: rejected email to noreply@hellojia.ai (SMTP 550)");
      return new Response("550 5.1.1 Recipient address does not exist: noreply@hellojia.ai", {
        status: 550,
        statusText: "Recipient address does not exist"
      });
    }

    // inquiry@hellojia.ai: accept webhook (200) but do not save to database
    const toEmailNormalized =
      to && typeof to === "string"
        ? (to.match(/<([^>]+)>/) || to.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/))?.[1]?.toLowerCase().trim() ?? to.trim().toLowerCase()
        : "";
    if (toEmailNormalized === "inquiry@hellojia.ai") {
      console.log("mg-receive-email: accepted for inquiry@hellojia.ai (not saved to DB)");
      return NextResponse.json({ ok: true, received: true, savedToDb: false });
    }

    // Extract body content
    const rawBodyPlain =
      payload["body-plain"] ||
      payload.text ||
      (formMap && formMap.get("body-plain")) ||
      payload.content ||
      "";
    const rawBodyHtml =
      payload["body-html"] ||
      payload.html ||
      (formMap && formMap.get("body-html")) ||
      "";

    // Sanitize email content before processing
    const bodyPlain = sanitizePlainText(rawBodyPlain);
    const bodyHtml = sanitizeHtmlContent(rawBodyHtml);

    const { db } = await connectMongoDB();

    // Extract sender email for validation and rate limiting
    let senderEmail: string | null = null;
    if (from) {
      // Extract email address from "Name <email@domain.com>" format
      const emailMatch =
        String(from).match(/<([^>]+)>/) ||
        String(from).match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      senderEmail = emailMatch
        ? emailMatch[1].toLowerCase().trim()
        : String(from).toLowerCase().trim();
    }

    // Extract IP address from request headers for rate limiting
    let clientIp: string | null = null;
    try {
      // Try common IP headers in order of priority
      clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("x-real-ip") ||
        req.headers.get("cf-connecting-ip") || // Cloudflare
        null;

      // Fallback: parse from Received header
      if (!clientIp) {
        const receivedHeader = formMap?.get("Received") || payload.Received;
        if (receivedHeader) {
          const ipMatch = String(receivedHeader).match(
            /\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/
          );
          if (ipMatch) {
            clientIp = ipMatch[1];
          }
        }
      }
    } catch (e) {
      console.warn("mg-receive-email: error extracting IP", e);
    }

    console.log("mg-receive-email: extracted metadata for rate limiting", {
      senderEmail,
      clientIp,
    });

    // Ensure rate-limit collection has TTL indexes
    if (!_rateLimitIndexEnsured) {
      try {
        await db.collection("mailgun-rate-limits").createIndex(
          { timestamp: 1 },
          { expireAfterSeconds: 86400 } // Auto-expire after 24 hours
        );
        await db
          .collection("mailgun-rate-limits")
          .createIndex({ type: 1, key: 1, timestamp: 1 });
        console.log(
          "mg-receive-email: rate-limit indexes created successfully"
        );
      } catch (e) {
        console.warn("mg-receive-email: rate-limit createIndex warning", e);
      } finally {
        _rateLimitIndexEnsured = true;
      }
    }

    // Check rate limits: per-sender
    if (senderEmail) {
      // 1. Check 5 emails per 5 minutes
      const check5min = await checkRateLimit(
        db,
        "sender",
        senderEmail,
        5,
        5 * 60 * 1000
      );
      if (!check5min.allowed) {
        console.log("mg-receive-email: rate limit exceeded (sender 5min)", {
          senderEmail,
          reason: check5min.reason,
        });
        return NextResponse.json({
          ok: true,
          rejected: true,
          reason: check5min.reason,
        });
      }

      // 2. Check 10 emails per hour
      const check1hour = await checkRateLimit(
        db,
        "sender",
        senderEmail,
        10,
        60 * 60 * 1000
      );
      if (!check1hour.allowed) {
        console.log("mg-receive-email: rate limit exceeded (sender 1hour)", {
          senderEmail,
          reason: check1hour.reason,
        });
        return NextResponse.json({
          ok: true,
          rejected: true,
          reason: check1hour.reason,
        });
      }

      // 3. Check 30 emails per day
      const check1day = await checkRateLimit(
        db,
        "sender",
        senderEmail,
        30,
        24 * 60 * 60 * 1000
      );
      if (!check1day.allowed) {
        console.log("mg-receive-email: rate limit exceeded (sender 1day)", {
          senderEmail,
          reason: check1day.reason,
        });
        return NextResponse.json({
          ok: true,
          rejected: true,
          reason: check1day.reason,
        });
      }
    }

    // Check rate limits: per-IP
    if (clientIp) {
      const checkIp = await checkRateLimit(
        db,
        "ip",
        clientIp,
        20,
        60 * 60 * 1000
      );
      if (!checkIp.allowed) {
        console.log("mg-receive-email: rate limit exceeded (IP)", {
          clientIp,
          reason: checkIp.reason,
        });
        return NextResponse.json({
          ok: true,
          rejected: true,
          reason: checkIp.reason,
        });
      }
    }

    // determine message-id and in-reply-to from headers if present
    let messageId: string | null = null;
    let inReplyTo: string | null = null;
    let referencesRawHeader: string | null = null;
    let referencesArrayRaw: string[] | null = null;
    let referencesArrayCanonical: string[] | null = null;
    try {
      const headersRaw =
        payload["message-headers"] ||
        (formMap && formMap.get("message-headers"));
      if (headersRaw) {
        const headers =
          typeof headersRaw === "string"
            ? JSON.parse(String(headersRaw))
            : headersRaw;
        // headers may be array of [name, value] pairs
        if (Array.isArray(headers)) {
          for (const h of headers) {
            const name = (h[0] || "").toLowerCase();
            const val = h[1] || h[2] || "";
            if (
              !messageId &&
              (name === "message-id" || name === "message_id")
            ) {
              messageId = String(val);
            }
            if (!inReplyTo && name === "in-reply-to") {
              inReplyTo = String(val);
            }
            if (!referencesRawHeader && name === "references") {
              referencesRawHeader = String(val);
            }
          }
        }
      }
    } catch (e) {
      // ignore header parsing errors
    }

    // canonicalize message-id to avoid '<id>' vs 'id' mismatches
    const messageIdCanonical = messageId
      ? String(messageId).replace(/[<>]/g, "").trim().toLowerCase()
      : null;
    // keep the raw message-id (preserve case and angle brackets) for exact reply headers
    const messageIdRaw = messageId ? String(messageId).trim() : null;
    // Parse References header into raw array and canonicalized array
    if (referencesRawHeader) {
      // split by whitespace (References are space-separated list of msg-ids)
      const parts = String(referencesRawHeader)
        .replace(/,/g, " ")
        .split(/\s+/)
        .map((p) => p.trim())
        .filter(Boolean);
      referencesArrayRaw = parts.map((p) => p);
      referencesArrayCanonical = parts.map((p) =>
        String(p).replace(/[<>]/g, "").trim().toLowerCase()
      );
    }

    console.log("mg-receive-email: parsed-message-ids", {
      raw: messageId || null,
      canonical: messageIdCanonical,
      inReplyTo: inReplyTo || null,
    });

    // Ensure a unique partial index on mailgunMessageId to prevent duplicates.
    if (!_mailgunIndexEnsured) {
      try {
        await db.collection("mailgun-messages").createIndex(
          { mailgunMessageId: 1 },
          {
            unique: true,
            partialFilterExpression: { mailgunMessageId: { $type: "string" } },
          }
        );
        console.log("mg-receive-email: ensured mailgunMessageId index");
      } catch (e: any) {
        // If index build fails (e.g. due to duplicate existing keys), log once
        // and avoid retrying on every webhook.
        console.warn("mg-receive-email: createIndex warning", e);
      } finally {
        _mailgunIndexEnsured = true;
      }
    }
    // Duplicate detection: if canonical messageId exists, skip if already stored
    if (messageIdCanonical) {
      const existing = await db
        .collection("mailgun-messages")
        .findOne({ mailgunMessageId: messageIdCanonical });
      if (existing) {
        console.log(
          "mg-receive-email: duplicate message detected (canonical)",
          {
            mailgunMessageId: messageIdCanonical,
            existingId: existing._id,
          }
        );
        return NextResponse.json({ ok: true, duplicate: true });
      }
    }

    // Find org/mailgun account matching recipient (to)
    let mgAccount: any = null;
    if (to) {
      try {
        mgAccount = await db
          .collection("mailgun-accounts")
          .findOne({ email: String(to) });
      } catch (e) {
        // ignore
      }
    }

    // fallback: try by domain
    if (!mgAccount && to && typeof to === "string") {
      const domain = String(to).split("@").pop();
      if (domain) {
        mgAccount = await db
          .collection("mailgun-accounts")
          .findOne({ domain: { $regex: domain, $options: "i" } });
      }
    }

    // If still no account, detect dynamic fallback addresses: hr-<orgSlug>@domain or no-reply-<orgSlug>@domain
    if (!mgAccount && to && typeof to === "string") {
      try {
        const [local, domainPart] = String(to).split("@");
        if (
          local &&
          (local.startsWith("hr-") || local.startsWith("no-reply-"))
        ) {
          const slug = local.replace(/^hr-|^no-reply-/i, "").trim();
          // try to find organization by slug, name or _id
          let org: any = null;
          if (ObjectId.isValid(slug)) {
            org = await db
              .collection("organizations")
              .findOne({ _id: new ObjectId(slug) });
          }
          if (!org) {
            org = await db.collection("organizations").findOne({ slug: slug });
          }
          if (!org) {
            org = await db
              .collection("organizations")
              .findOne({ name: { $regex: `^${slug}$`, $options: "i" } });
          }

          if (org) {
            mgAccount = {
              email: to,
              organizationId: org._id,
              domain: domainPart || null,
            } as any;
          }
        }
      } catch (e) {
        // ignore fallback detection errors
      }
    }

    // Determine organizationId for thread/message
    const orgObjectId =
      mgAccount && mgAccount.organizationId
        ? new ObjectId(String(mgAccount.organizationId))
        : null;

    // Handle attachments: formData may expose File objects named 'attachment'
    const attachmentsMeta: Array<any> = [];
    if (form) {
      // Log form keys for debugging
      try {
        const keys = Array.from(form.keys());
        console.log("mg-receive-email: form keys:", keys.slice(0, 200));
      } catch (e) {
        // ignore
      }

      // collect files named 'attachment'
      const files: Array<{ key: string; file: any }> = [];
      for (const [k, v] of form.entries()) {
        const hasArrayBuffer =
          v && typeof (v as any).arrayBuffer === "function";
        const hasStream = v && typeof (v as any).stream === "function";
        const looksLikeFile =
          hasArrayBuffer ||
          hasStream ||
          (v && typeof (v as any).name === "string");

        const keyLower = String(k || "").toLowerCase();
        if (
          looksLikeFile &&
          (keyLower === "attachment" ||
            keyLower.startsWith("attachment") ||
            keyLower.includes("attachment"))
        ) {
          files.push({ key: k, file: v });
        }
      }

      console.log(
        "mg-receive-email: detected file parts",
        files.map((f) => ({ key: f.key, name: f.file?.name || null }))
      );

      for (const entry of files) {
        const f = entry.file;
        const filename = (f && (f as any).name) || `attachment-${Date.now()}`;
        try {
          let buffer: Buffer | null = null;

          if (f && typeof (f as any).arrayBuffer === "function") {
            const arr = await (f as any).arrayBuffer();
            buffer = Buffer.from(arr);
          } else if (f && typeof (f as any).stream === "function") {
            // Read node/web stream into buffer
            const stream = (f as any).stream();
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            buffer = Buffer.concat(chunks);
          } else if (f && (f as any).buffer) {
            // some polyfills expose .buffer
            const raw = (f as any).buffer;
            buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          } else if (f && (f as any)._readableState) {
            // fallback for Readable streams
            const chunks: Buffer[] = [];
            for await (const chunk of f) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            buffer = Buffer.concat(chunks);
          }

          if (!buffer) {
            console.warn(
              "mg-receive-email: unable to read attachment into buffer",
              filename,
              { key: entry.key }
            );
            attachmentsMeta.push({
              filename,
              mimeType: null,
              size: 0,
              url: null,
              skipped: true,
            });
            continue;
          }

          const mimeType = (f && (f as any).type) || "application/octet-stream";

          // Check attachment size limits BEFORE processing
          // 1. Individual attachment max 20MB
          const maxIndividualSize = 20 * 1024 * 1024; // 20 MB
          if (buffer.length > maxIndividualSize) {
            console.warn(
              "mg-receive-email: rejecting attachment exceeding 20MB limit",
              filename,
              { size: buffer.length }
            );
            attachmentsMeta.push({
              filename,
              mimeType,
              size: buffer.length,
              key: null,
              skipped: true,
              skipReason: "File too large (max 20MB)",
            });
            continue;
          }

          // 2. Check sender's attachment rate limits (if sender email is known)
          if (senderEmail) {
            const sizeLimitCheck = await checkSizeLimits(
              db,
              senderEmail,
              buffer.length
            );
            if (!sizeLimitCheck.allowed) {
              console.log(
                "mg-receive-email: attachment size limit exceeded for sender",
                {
                  senderEmail,
                  filename,
                  reason: sizeLimitCheck.reason,
                }
              );
              // Reject the entire email if size limits exceeded
              return NextResponse.json({
                ok: true,
                rejected: true,
                reason: sizeLimitCheck.reason,
              });
            }
          }

          // Validate file type using magic bytes
          const validation = validateFileType(buffer, mimeType);
          if (!validation.isValid) {
            console.warn(
              "mg-receive-email: rejecting invalid file type",
              filename,
              validation.reason
            );
            attachmentsMeta.push({
              filename,
              mimeType,
              size: buffer.length,
              key: null,
              skipped: true,
              skipReason: validation.reason,
            });
            continue;
          }

          const { key, originalFilename } = await uploadToR2(
            buffer,
            filename,
            mimeType
          );
          const attDoc = {
            filename: originalFilename,
            key,
            mimeType,
            size: buffer.length,
            uploadedAt: new Date(),
          };
          const r = await db
            .collection("mailgun-attachments")
            .insertOne(attDoc);
          attachmentsMeta.push({ ...attDoc, _id: r.insertedId });
        } catch (e) {
          console.error("mg-receive-email: attachment error", filename, e);
        }
      }

      // Attempt to fetch the raw message (EML) from Mailgun storage and save to R2
      if (attachmentsMeta.length === 0) {
        try {
          const formMapLocal = (form as any)?._map as
            | Map<string, any>
            | undefined;
          const messageUrl =
            payload["message-url"] ||
            (formMapLocal && formMapLocal.get("message-url")) ||
            (payload.storage &&
              Array.isArray(payload.storage.url) &&
              payload.storage.url[0]) ||
            null;

          if (messageUrl) {
            const mgKey = process.env.MAILGUN_API_KEY || "";
            if (!mgKey) {
              console.warn(
                "mg-receive-email: message-url present but MAILGUN_API_KEY not set; cannot fetch stored message",
                { messageUrl }
              );
            } else {
              console.log(
                "mg-receive-email: fetching stored message from Mailgun storage",
                { messageUrl }
              );
              const auth = Buffer.from(`api:${mgKey}`).toString("base64");
              const res = await fetch(String(messageUrl), {
                method: "GET",
                headers: {
                  Authorization: `Basic ${auth}`,
                  Accept: "message/rfc822, application/octet-stream, */*",
                },
              });
              if (res.ok) {
                const arr = await res.arrayBuffer();
                const buf = Buffer.from(arr);
                const filename = `message-${Date.now()}.eml`;
                const { key, originalFilename } = await uploadToR2(
                  buf,
                  filename,
                  "message/rfc822"
                );
                const attDoc = {
                  filename: originalFilename,
                  key,
                  mimeType: "message/rfc822",
                  size: buf.length,
                  uploadedAt: new Date(),
                };
                const r = await db
                  .collection("mailgun-attachments")
                  .insertOne(attDoc);
                attachmentsMeta.push({ ...attDoc, _id: r.insertedId });
                console.log("mg-receive-email: saved stored message to R2", {
                  key,
                });
              } else {
                console.warn(
                  "mg-receive-email: failed to fetch stored message",
                  { messageUrl, status: res.status }
                );
              }
            }
          }
        } catch (e) {
          console.warn("mg-receive-email: error fetching stored message", e);
        }
      }
    }

    // If we have attachments and a messageId, try to merge attachments into an
    // existing message that may have been created earlier without attachments.
    if (attachmentsMeta.length > 0) {
      try {
        if (messageIdCanonical) {
          const existingById = await db
            .collection("mailgun-messages")
            .findOne({ mailgunMessageId: messageIdCanonical });
          if (existingById) {
            const existingAttachments = Array.isArray(existingById.attachments)
              ? existingById.attachments
              : [];
            if (existingAttachments.length === 0) {
              await db.collection("mailgun-messages").updateOne(
                { _id: existingById._id },
                {
                  $set: {
                    attachments: attachmentsMeta,
                    updatedAt: new Date(),
                    // if body was empty previously, update content
                    html: existingById.html || bodyHtml || null,
                    text: existingById.text || bodyPlain || null,
                  },
                }
              );
              console.log(
                "mg-receive-email: merged attachments into existing message",
                {
                  messageId,
                  existingId: existingById._id,
                }
              );
              return NextResponse.json({ ok: true, merged: true });
            }
            // if attachments already present, treat as duplicate
            return NextResponse.json({ ok: true, duplicate: true });
          }
        }

        // No messageId or no exact match: try to find a recent message without
        // a mailgunMessageId that matches from/to/subject and merge attachments.
        const normSubject = normalizeSubject(subject || "");
        const tenMinutesAgo = new Date(Date.now() - 1000 * 60 * 10);
        const candidate = await db.collection("mailgun-messages").findOne({
          $and: [
            {
              $or: [
                { mailgunMessageId: null },
                { mailgunMessageId: "" },
                { mailgunMessageId: { $exists: false } },
              ],
            },
            { from: from || null },
            { to: to || null },
            { normalizedSubject: normSubject },
            { createdAt: { $gte: tenMinutesAgo } },
          ],
        });
        if (candidate) {
          const updateFields: any = {
            attachments: attachmentsMeta,
            updatedAt: new Date(),
          };
          if (messageIdCanonical)
            updateFields.mailgunMessageId = messageIdCanonical;
          if (bodyHtml) updateFields.html = candidate.html || bodyHtml;
          if (bodyPlain) updateFields.text = candidate.text || bodyPlain;
          await db
            .collection("mailgun-messages")
            .updateOne({ _id: candidate._id }, { $set: updateFields });
          console.log(
            "mg-receive-email: merged attachments into recent candidate message",
            {
              candidateId: candidate._id,
            }
          );
          return NextResponse.json({ ok: true, merged: true });
        }
      } catch (e) {
        console.warn("mg-receive-email: error trying to merge attachments", e);
      }
    }

    // Find thread: prefer matching by inReplyTo -> find message, else by normalized subject
    let thread: any = null;
    if (inReplyTo) {
      // try to find message with matching mailgunMessageId (strip <> from in-reply-to)
      const ref = String(inReplyTo).replace(/[<>]/g, "").trim();

      // Look up by mailgunMessageId (case-insensitive partial match)
      let refMsg = await db
        .collection("mailgun-messages")
        .findOne({ mailgunMessageId: { $regex: ref, $options: "i" } });

      // Fallback: sometimes message-id may have been stored under other fields
      if (!refMsg) {
        // try exact match
        refMsg = await db
          .collection("mailgun-messages")
          .findOne({ mailgunMessageId: ref });
      }

      // If referencing message is found, resolve its threadId to an ObjectId if needed
      if (refMsg) {
        const tid = refMsg.threadId;
        try {
          if (typeof tid === "string" && ObjectId.isValid(tid)) {
            thread = await db
              .collection("mailgun-threads")
              .findOne({ _id: new ObjectId(tid) });
          } else {
            // assume stored as ObjectId already
            thread = await db
              .collection("mailgun-threads")
              .findOne({ _id: tid });
          }
        } catch (e) {
          console.warn(
            "mg-receive-email: failed to resolve threadId from refMsg",
            e
          );
        }
      }
    }

    if (!thread) {
      const norm = normalizeSubject(subject || "");
      const query: any = { normalizedSubject: norm };
      if (orgObjectId) query.organizationId = orgObjectId;
      thread = await db.collection("mailgun-threads").findOne(query);
    }

    if (!thread) {
      const threadIdStr = new ObjectId().toHexString();
      const insertThread: any = {
        applicantId: null,
        organizationId: orgObjectId,
        subject: subject || "",
        normalizedSubject: normalizeSubject(subject || ""),
        threadId: threadIdStr,
        careerId: null,
        lastUpdated: new Date(),
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const tRes = await db
        .collection("mailgun-threads")
        .insertOne(insertThread);
      thread = await db
        .collection("mailgun-threads")
        .findOne({ _id: tRes.insertedId });
    }

    // Check rate limits: per-thread (3 emails per 10 minutes per job application)
    if (thread && thread._id) {
      const threadIdForRateLimit = thread._id.toString();
      const checkThread = await checkRateLimit(
        db,
        "thread",
        threadIdForRateLimit,
        3,
        10 * 60 * 1000
      );
      if (!checkThread.allowed) {
        console.log("mg-receive-email: rate limit exceeded (thread)", {
          threadId: threadIdForRateLimit,
          reason: checkThread.reason,
        });
        return NextResponse.json({
          ok: true,
          rejected: true,
          reason: checkThread.reason,
        });
      }
    }

    // Persist mailgun message record
    const messageDoc: any = {
      threadId: thread._id,
      from: from || null,
      to: to || null,
      cc: payload.cc || null,
      bcc: payload.bcc || null,
      html: bodyHtml || null,
      text: bodyPlain || null,
      attachments: attachmentsMeta,
      direction: "inbound",
      mailgunMessageId: messageIdCanonical || null,
      mailgunMessageIdRaw: messageIdRaw || null,
      mailgunReferencesRaw: referencesArrayRaw || null,
      mailgunReferences: referencesArrayCanonical || null,
      organizationId: orgObjectId,
      createdAt: new Date(),
      receivedAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // If we have a canonical message-id, perform an atomic upsert to avoid races
      if (messageIdCanonical) {
        const filter = { mailgunMessageId: messageIdCanonical } as any;
        // Avoid putting the same field under both $setOnInsert and $set
        // because MongoDB will error with ConflictingUpdateOperators.
        const setOnInsert = { ...messageDoc } as any;
        // remove fields that we explicitly $set on every upsert
        delete setOnInsert.updatedAt;
        delete setOnInsert.receivedAt;
        const update = {
          $setOnInsert: setOnInsert,
          $set: { updatedAt: new Date(), receivedAt: new Date() },
        } as any;
        const res = await db
          .collection("mailgun-messages")
          .findOneAndUpdate(filter, update, {
            upsert: true,
            returnDocument: "after",
          } as any);

        // res.lastErrorObject may indicate whether it was upserted
        const wasUpserted = !!(
          (res as any).lastErrorObject && (res as any).lastErrorObject.upserted
        );
        if (wasUpserted) {
          console.log("mg-receive-email: upserted message", {
            mailgunMessageId: messageIdCanonical,
            id: (res as any).lastErrorObject.upserted,
          });
          try {
            // Merge message's References into thread document for consistent threading
            const msgRefsRaw = messageDoc.mailgunReferencesRaw || [];
            const msgIdRaw = messageDoc.mailgunMessageIdRaw || null;
            const toAdd = (
              Array.isArray(msgRefsRaw) ? msgRefsRaw.slice() : []
            ).concat(msgIdRaw ? [msgIdRaw] : []);
            if (thread && toAdd.length > 0) {
              const t = await db
                .collection("mailgun-threads")
                .findOne({ _id: thread._id });
              const existingRaw: string[] = Array.isArray(
                t?.mailgunReferencesRaw
              )
                ? t.mailgunReferencesRaw
                : [];
              const seen = new Set(existingRaw);
              const merged: string[] = existingRaw.slice();
              for (const r of toAdd) {
                const rr = String(r).trim();
                if (!seen.has(rr)) {
                  merged.push(rr);
                  seen.add(rr);
                }
              }
              // cap chain length to last 50
              const capped = merged.length > 50 ? merged.slice(-50) : merged;
              const canonical = capped.map((v) =>
                String(v).replace(/[<>]/g, "").trim().toLowerCase()
              );
              await db.collection("mailgun-threads").updateOne(
                { _id: thread._id },
                {
                  $set: {
                    mailgunReferencesRaw: capped,
                    mailgunReferences: canonical,
                    lastUpdated: new Date(),
                    updatedAt: new Date(),
                  },
                }
              );
            }
          } catch (e) {
            console.warn(
              "mg-receive-email: failed to merge references into thread",
              e
            );
          }

          // Record rate limit events for successful message processing (upsert)
          try {
            const recordPromises: Promise<void>[] = [];

            // Record sender rate limit
            if (senderEmail) {
              recordPromises.push(recordRateLimit(db, "sender", senderEmail));
            }

            // Record IP rate limit
            if (clientIp) {
              recordPromises.push(recordRateLimit(db, "ip", clientIp));
            }

            // Record thread rate limit
            if (thread && thread._id) {
              const threadIdForRateLimit = thread._id.toString();
              recordPromises.push(
                recordRateLimit(db, "thread", threadIdForRateLimit)
              );
            }

            // Record attachment rate limit if attachments were uploaded
            if (
              senderEmail &&
              attachmentsMeta.length > 0 &&
              attachmentsMeta.some((a) => !a.skipped)
            ) {
              const totalSize = attachmentsMeta
                .filter((a) => !a.skipped)
                .reduce((sum, a) => sum + (a.size || 0), 0);
              recordPromises.push(
                recordRateLimit(db, "attachment", senderEmail, {
                  size: totalSize,
                })
              );
            }

            await Promise.all(recordPromises);
            console.log("mg-receive-email: recorded rate limit events", {
              sender: senderEmail,
              ip: clientIp,
              thread: thread?._id?.toString(),
              attachmentCount: attachmentsMeta.filter((a) => !a.skipped).length,
            });
          } catch (e) {
            console.warn("mg-receive-email: error recording rate limits", e);
            // Non-fatal, continue
          }

          return NextResponse.json({ ok: true });
        }

        // If not upserted, treat as duplicate
        console.log("mg-receive-email: message already existed (upsert)", {
          mailgunMessageId: messageIdCanonical,
        });
        return NextResponse.json({ ok: true, duplicate: true });
      }

      // Fallback: no canonical message-id, fall back to insert (best-effort)
      const insertRes = await db
        .collection("mailgun-messages")
        .insertOne(messageDoc);
      try {
        // Merge references into thread doc after inserting
        const msgRefsRaw = messageDoc.mailgunReferencesRaw || [];
        const msgIdRaw = messageDoc.mailgunMessageIdRaw || null;
        const toAdd = (
          Array.isArray(msgRefsRaw) ? msgRefsRaw.slice() : []
        ).concat(msgIdRaw ? [msgIdRaw] : []);
        if (thread && toAdd.length > 0) {
          const t = await db
            .collection("mailgun-threads")
            .findOne({ _id: thread._id });
          const existingRaw: string[] = Array.isArray(t?.mailgunReferencesRaw)
            ? t.mailgunReferencesRaw
            : [];
          const seen = new Set(existingRaw);
          const merged: string[] = existingRaw.slice();
          for (const r of toAdd) {
            const rr = String(r).trim();
            if (!seen.has(rr)) {
              merged.push(rr);
              seen.add(rr);
            }
          }
          const capped = merged.length > 50 ? merged.slice(-50) : merged;
          const canonical = capped.map((v) =>
            String(v).replace(/[<>]/g, "").trim().toLowerCase()
          );
          await db.collection("mailgun-threads").updateOne(
            { _id: thread._id },
            {
              $set: {
                mailgunReferencesRaw: capped,
                mailgunReferences: canonical,
                lastUpdated: new Date(),
                updatedAt: new Date(),
              },
            }
          );
        }
      } catch (e) {
        console.warn(
          "mg-receive-email: failed to merge references into thread after insert",
          e
        );
      }
      console.log("mg-receive-email: inserted message (no-id)", {
        insertedId: insertRes.insertedId,
      });

      // Record rate limit events for successful message processing
      try {
        const recordPromises: Promise<void>[] = [];

        // Record sender rate limit
        if (senderEmail) {
          recordPromises.push(recordRateLimit(db, "sender", senderEmail));
        }

        // Record IP rate limit
        if (clientIp) {
          recordPromises.push(recordRateLimit(db, "ip", clientIp));
        }

        // Record thread rate limit
        if (thread && thread._id) {
          const threadIdForRateLimit = thread._id.toString();
          recordPromises.push(
            recordRateLimit(db, "thread", threadIdForRateLimit)
          );
        }

        // Record attachment rate limit if attachments were uploaded
        if (
          senderEmail &&
          attachmentsMeta.length > 0 &&
          attachmentsMeta.some((a) => !a.skipped)
        ) {
          const totalSize = attachmentsMeta
            .filter((a) => !a.skipped)
            .reduce((sum, a) => sum + (a.size || 0), 0);
          recordPromises.push(
            recordRateLimit(db, "attachment", senderEmail, { size: totalSize })
          );
        }

        await Promise.all(recordPromises);
        console.log("mg-receive-email: recorded rate limit events", {
          sender: senderEmail,
          ip: clientIp,
          thread: thread?._id?.toString(),
          attachmentCount: attachmentsMeta.filter((a) => !a.skipped).length,
        });
      } catch (e) {
        console.warn("mg-receive-email: error recording rate limits", e);
        // Non-fatal, continue
      }

      return NextResponse.json({ ok: true });
    } catch (e: any) {
      // Handle duplicate key (race) gracefully
      const code = e && (e.code || e.errno || (e.result && e.result.code));
      if (code === 11000 || code === 11001) {
        console.log(
          "mg-receive-email: duplicate detected during insert (duplicate key)",
          {
            mailgunMessageId: messageIdCanonical,
          }
        );
        return NextResponse.json({ ok: true, duplicate: true });
      }
      console.error("mg-receive-email: insert error", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("mg-receive-email error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
