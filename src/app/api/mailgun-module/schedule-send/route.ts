import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

/**
 * Saves an email to the schedule-email collection for later sending.
 * The cron job (send-scheduled-emails) picks up documents where
 * status === "active" and sendDate <= now and sends them.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const {
      to,
      cc,
      bcc,
      subject,
      body: emailBody,
      sender,
      sendDate: sendDateRaw,
      orgID,
      careerId,
      threadId,
      accountId,
      userId,
    } = body || {};

    // Helper: extract tokens from content
    const extractTokens = (content?: string): string[] => {
      if (!content) return [];
      const tokens: string[] = [];

      // Extract from [[Token Name]] format
      const plainTokenRegex = /\[\[([^\]]+)\]\]/g;
      let match;
      while ((match = plainTokenRegex.exec(content)) !== null) {
        if (!tokens.includes(match[1])) {
          tokens.push(match[1]);
        }
      }

      // Extract from HTML span format: <span ... data-token="...">...</span>
      const htmlTokenRegex =
        /<span[^>]*data-token="(?:\[\[)?([^\]"]+)(?:\]\])?"[^>]*>([^<]*)<\/span>/g;
      while ((match = htmlTokenRegex.exec(content)) !== null) {
        const tokenName = match[1];
        if (!tokens.includes(tokenName)) {
          tokens.push(tokenName);
        }
      }

      return tokens;
    };

    // Helper: replace tokens in content
    const replaceTokens = (
      content: string,
      tokenValues: Record<string, string>,
    ): string => {
      if (!content) return content;
      let result = content;

      // Helper to normalize token names by stripping category prefix
      const normalizeTokenName = (tokenName: string): string => {
        const prefixMatch = tokenName.match(/^[A-Za-z]+-(.+)$/);
        if (prefixMatch) {
          return prefixMatch[1];
        }
        return tokenName;
      };

      // FIRST: Replace HTML span token format
      result = result.replace(
        /<span[^>]*data-token="(?:\[\[)?([^\]"]+)(?:\]\])?"[^>]*>([^<]*)<\/span>/g,
        (match, tokenName, displayText) => {
          const cleanTokenName = tokenName.replace(/[\[\]]/g, "");
          const normalizedName = normalizeTokenName(cleanTokenName);
          return tokenValues[normalizedName] ?? displayText;
        },
      );

      // SECOND: Replace [[Token Name]] plain text format
      for (const [tokenName, tokenValue] of Object.entries(tokenValues)) {
        const regex = new RegExp(
          `\\[\\[${tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\]`,
          "g",
        );
        result = result.replace(regex, tokenValue);
      }

      return result;
    };

    // Helper to decode HTML entities for plain text
    const decodeHtmlEntities = (text: string): string => {
      if (!text) return text;
      return text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'");
    };

    if (
      !to ||
      !subject ||
      emailBody === undefined ||
      !sender ||
      !sendDateRaw ||
      !orgID
    ) {
      console.error("[schedule-send] Missing required data: to, subject, emailBody, sender, sendDateRaw, or orgID");
      return NextResponse.json(
        {
          error: "Missing required data",
        },
        { status: 400 },
      );
    }

    const sendDate = new Date(sendDateRaw);
    if (Number.isNaN(sendDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid sendDate; use ISO 8601 string" },
        { status: 400 },
      );
    }

    const now = new Date();
    if (sendDate.getTime() < now.getTime()) {
      return NextResponse.json(
        { error: "sendDate must be in the future" },
        { status: 400 },
      );
    }

    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Helper: extract plain email addresses from display strings or arrays
    const extractEmails = (input?: any): string[] => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input
          .map((e) => {
            if (typeof e === "string") {
              const match = e.match(/<(.+?)>/);
              return match ? match[1].trim() : e.trim();
            }
            return "";
          })
          .filter(Boolean);
      }
      if (typeof input === "string") {
        return input
          .split(",")
          .map((e) => {
            const match = e.match(/<(.+?)>/);
            return match ? match[1].trim() : e.trim();
          })
          .filter(Boolean);
      }
      return [];
    };

    const { db } = await connectMongoDB();
    const scheduleEmailCollection = db.collection("schedule-email");

    // Extract email addresses from to, cc, bcc fields
    const toList = extractEmails(to);
    const ccList = extractEmails(cc);
    const bccList = extractEmails(bcc);

    if (toList.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient is required" },
        { status: 400 },
      );
    }

    // Extract and resolve tokens
    // First decode HTML entities, then trim
    let processedSubject = decodeHtmlEntities(String(subject)).trim();
    let processedBody = String(emailBody);

    const tokensInSubject = extractTokens(processedSubject);
    const tokensInBody = extractTokens(processedBody);
    const allTokens = Array.from(
      new Set([...tokensInSubject, ...tokensInBody]),
    );

    if (allTokens.length > 0) {
      try {
        console.log("[schedule-send] Tokens found in email:", allTokens);

        // Extract first email from toList for token resolution
        const applicantEmail = toList[0] || null;
        const orgIdForTokens = String(orgID);

        // Call resolve-email-tokens API
        const tokenResponse = await fetch(
          `${
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
          }/api/mailgun-module/resolve-email-tokens`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              careerId: careerId || null,
              orgId: orgIdForTokens,
              applicantEmail: applicantEmail,
              threadId: threadId || null,
              tokensUsed: allTokens,
            }),
          },
        );

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.success && tokenData.tokens) {
            // Replace tokens in subject and body
            processedSubject = replaceTokens(
              processedSubject,
              tokenData.tokens,
            );
            // Decode HTML entities in subject since it should be plain text
            processedSubject = decodeHtmlEntities(processedSubject);
            // Trim again after token replacement and decoding
            processedSubject = processedSubject.trim();

            processedBody = replaceTokens(processedBody, tokenData.tokens);

            console.log("[schedule-send] Tokens replaced successfully");
          }
        }
      } catch (tokenError) {
        console.error("[schedule-send] Error resolving tokens:", tokenError);
        // Continue with non-resolved tokens instead of failing
      }
    }

    const doc = {
      to: toList,
      cc: ccList.length > 0 ? ccList : null,
      bcc: bccList.length > 0 ? bccList : null,
      subject: processedSubject,
      body: processedBody,
      sender: String(sender).trim(),
      sendDate,
      orgID: String(orgID),
      status: "active",
      mode: "mailgun",
      careerId: careerId ? String(careerId) : null,
      threadId: threadId ? String(threadId) : null,
      accountId: accountId ? String(accountId) : null,
      userId: userId
        ? ObjectId.isValid(userId)
          ? new ObjectId(userId)
          : userId
        : null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await scheduleEmailCollection.insertOne(doc);

    return NextResponse.json({
      success: true,
      data: {
        _id: result.insertedId.toString(),
        sendDate: sendDate.toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("schedule-send error", error);
    return NextResponse.json(
      {
        error: "Failed to schedule email",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
