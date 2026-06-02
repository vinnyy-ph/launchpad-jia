import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import Mailgun from "mailgun.js";
import formData from "form-data";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { decrypt } from "@/lib/utils/cryptography";
import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import axios from "axios";
import { logActivity } from "@/lib/utils/activityLogger";
import { recordActivityHistory } from "@/lib/utils/activityHistoryHelpers";

function normalizeSubject(s: string) {
  if (!s) return "";
  return s.replace(/^([\s]*(?:re|fw|fwd)[\s]*[:\-\s]*)+/i, "").trim();
}

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    let {
      fromMailgunId,
      to,
      careerId,
      subject,
      html,
      text,
      attachments,
      inReplyTo,
      inReplyToRaw,
      draftId,
      rawDomain,
      userId,
      templateId,
    } = body || {};

    if (!fromMailgunId || !to || !subject || (!html && !text)) {
      console.error("[mg-send-email] Missing required fields: fromMailgunId, to, subject, or html or text");
      return NextResponse.json(
        {
          error: "Missing required fields"
        },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();

    // If templateId is provided, handle template-based sending with schedule support
    if (templateId) {
      try {
        const emailTemplateModel = db.collection("email-templates");
        const emailTemplate = await emailTemplateModel.findOne({
          _id: new ObjectId(templateId),
        });

        if (!emailTemplate) {
          return NextResponse.json(
            { error: "Email template not found" },
            { status: 404 },
          );
        }

        // Extract recipient email from 'to' field
        const extractFirstEmail = (
          toField: string | string[],
        ): string | null => {
          if (!toField) return null;
          const toStr = Array.isArray(toField) ? toField[0] : toField;
          const emailMatch = String(toStr).match(
            /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
          );
          return emailMatch ? emailMatch[0] : null;
        };

        const recipientEmail = extractFirstEmail(to);
        if (!recipientEmail) {
          return NextResponse.json(
            { error: "No valid recipient email found" },
            { status: 400 },
          );
        }

        // Get orgID from request or infer from user
        let orgIdStr: string | null = body.orgId || body.orgID || null;
        if (!orgIdStr) {
          const userEmail = req.user?.email;
          if (userEmail) {
            const member = await db
              .collection("members")
              .findOne({ email: userEmail });
            if (member) {
              const inferredOrgId = member.orgID || member.organizationId;
              if (inferredOrgId) {
                orgIdStr = String(inferredOrgId);
              }
            }
          }
        }

        if (orgIdStr) {
          // Extract tokens and replace them
          const allDataTokens = new Set<string>();
          [emailTemplate.subject, emailTemplate.message].forEach((text) => {
            if (!text) return;
            const regex = /data-token="([^"]+)"/g;
            let match;
            while ((match = regex.exec(text))) {
              allDataTokens.add(match[1]);
            }
          });

          // Fetch data for token replacement
          let interviews: any = null;
          let organizations: any = null;
          let careers: any = null;

          const dataTokenArray = Array.from(allDataTokens);
          for (const token of dataTokenArray) {
            if (token.includes("Careers") && !careers && careerId) {
              careers = await db.collection("careers").findOne({
                id: String(careerId),
              });
            }

            if (token.includes("Candidate") && !interviews) {
              // Try to find interview by email
              interviews = await db
                .collection("interviews")
                .findOne({ email: recipientEmail });
            }

            if (token.includes("Organization") && !organizations) {
              organizations = await db
                .collection("organizations")
                .findOne({ _id: new ObjectId(orgIdStr) });
            }
          }

          // Token replacement functions
          const getTokenMapper = (
            interviews: any,
            organizations: any,
            careers: any,
          ): Record<string, string | undefined> => {
            return {
              "Job Title": careers?.jobTitle,
              "Job Description": careers?.description,
              "Organization Name": organizations?.name,
              "Organization Description": organizations?.description,
              "Organization Location":
                `${organizations?.city || ""}, ${organizations?.province || ""}, ${organizations?.country || ""}`.replace(
                  /^,\s*|,\s*$/g,
                  "",
                ),
              "Candidate First Name": interviews?.name?.split(" ")[0],
              "Candidate Last Name": interviews?.name?.split(" ")[1],
              "Candidate Full Name": interviews?.name,
              "Candidate Email Address": interviews?.email || recipientEmail,
            };
          };

          const replaceToken = (
            html: string,
            interviews: any,
            organizations: any,
            careers: any,
          ): string => {
            if (!html) return "";
            const tokenMapper = getTokenMapper(
              interviews,
              organizations,
              careers,
            );
            return html.replace(
              /<span([^>]*data-token="([^"]+)"[^>]*)>(.*?)<\/span>/g,
              (match, attributes, tokenKey, originalText) => {
                const tokenValue = tokenKey.includes("-")
                  ? tokenKey.split("-").slice(1).join("-")
                  : tokenKey;
                const replacement = tokenMapper[tokenValue] || originalText;
                return `<span${attributes}>${replacement}</span>`;
              },
            );
          };

          const htmlToPlainText = (html: string): string => {
            if (!html) return "";
            let text = html
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
            text = text.replace(/<[^>]*>/g, "");
            text = text.replace(/\s+/g, " ").trim();
            return text;
          };

          const calculateSendDate = (
            delay: string | number,
            unit: string,
            preferredTime?: string,
          ): Date => {
            const delayValue =
              typeof delay === "string" ? parseInt(delay, 10) : delay;
            const now = new Date();
            const sendDate = new Date(now);
            const unitLower = unit.toLowerCase();

            if (unitLower === "days" || unitLower === "day") {
              sendDate.setDate(sendDate.getDate() + delayValue);
            } else if (unitLower === "hours" || unitLower === "hour") {
              sendDate.setHours(sendDate.getHours() + delayValue);
            } else if (unitLower === "minutes" || unitLower === "minute") {
              sendDate.setMinutes(sendDate.getMinutes() + delayValue);
            } else {
              sendDate.setDate(sendDate.getDate() + delayValue);
            }

            if (preferredTime) {
              const timeMatch = preferredTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
              if (timeMatch) {
                let preferredHours = parseInt(timeMatch[1], 10);
                const preferredMinutes = parseInt(timeMatch[2], 10);
                const ampm = timeMatch[3]?.toUpperCase();

                if (ampm === "PM" && preferredHours !== 12) {
                  preferredHours += 12;
                } else if (ampm === "AM" && preferredHours === 12) {
                  preferredHours = 0;
                }

                if (unitLower === "days" || unitLower === "day") {
                  sendDate.setHours(preferredHours, preferredMinutes, 0, 0);
                } else {
                  const preferredTimeDate = new Date(sendDate);
                  preferredTimeDate.setHours(
                    preferredHours,
                    preferredMinutes,
                    0,
                    0,
                  );
                  if (preferredTimeDate < sendDate) {
                    preferredTimeDate.setDate(preferredTimeDate.getDate() + 1);
                  }
                  sendDate.setTime(preferredTimeDate.getTime());
                }
              }
            }

            return sendDate;
          };

          // Replace tokens in template
          const processedSubject = htmlToPlainText(
            replaceToken(
              emailTemplate.subject,
              interviews,
              organizations,
              careers,
            ),
          );
          const processedHtml = replaceToken(
            emailTemplate.message,
            interviews,
            organizations,
            careers,
          );

          // Determine sender account and mode
          const getSenderAccountAndMode = async (
            db: any,
            automation: any,
            org_id: string,
            career_id: string,
            selectedAccountId?: string | null,
          ): Promise<{
            sender: string;
            mode: "mailgun" | "gmail" | "outlook";
            accountId?: string;
            userId?: string;
          }> => {
            const sender = automation?.automation?.sender || "System";

            if (selectedAccountId) {
              if (selectedAccountId.startsWith("fallback:")) {
                const email =
                  selectedAccountId.split(":")[1] || "noreply@hellojia.ai";
                return {
                  sender: email,
                  mode: "mailgun",
                  accountId: selectedAccountId,
                };
              }

              if (selectedAccountId.startsWith("outlook:")) {
                return {
                  sender: "Outlook User", // Placeholder, validated at send time
                  mode: "outlook",
                  accountId: selectedAccountId,
                };
              }

              if (ObjectId.isValid(selectedAccountId)) {
                const mailgunAccount = await db
                  .collection("mailgun-accounts")
                  .findOne({
                    _id: new ObjectId(selectedAccountId),
                    $or: [
                      { organizationId: new ObjectId(org_id) },
                      { organizationId: org_id },
                    ],
                  });

                if (mailgunAccount) {
                  return {
                    sender: mailgunAccount.email,
                    mode: "mailgun",
                    accountId: selectedAccountId,
                    userId: mailgunAccount.userId
                      ? String(mailgunAccount.userId)
                      : undefined,
                  };
                }

                const emailSettings = await db
                  .collection("email-settings")
                  .findOne({
                    _id: new ObjectId(selectedAccountId),
                    $or: [{ orgID: org_id }, { orgID: new ObjectId(org_id) }],
                  });

                if (
                  emailSettings &&
                  emailSettings.userID &&
                  emailSettings.tokens
                ) {
                  const member = await db.collection("members").findOne({
                    _id: new ObjectId(emailSettings.userID),
                  });

                  if (member && member.email) {
                    return {
                      sender: member.email,
                      mode: "gmail",
                      accountId: selectedAccountId,
                      userId: String(emailSettings.userID),
                    };
                  }
                }
              }
            }

            return { sender: "noreply@hellojia.ai", mode: "mailgun" };
          };

          const mockAutomation = {
            automation: {
              sender: "User",
            },
          };

          const senderInfo = await getSenderAccountAndMode(
            db,
            mockAutomation,
            orgIdStr,
            careerId || "",
            fromMailgunId,
          );
          const { sender, mode, accountId, userId: senderUserId } = senderInfo;

          // Check if schedule sending is enabled
          const isScheduled =
            emailTemplate.enable_schedule_send === "true" ||
            emailTemplate.enable_schedule_send === true;
          const hasPreferredTime =
            emailTemplate.enable_preferred_time === "true" ||
            emailTemplate.enable_preferred_time === true;
          const preferredTime = hasPreferredTime
            ? emailTemplate.preferred_time
            : undefined;

          if (
            isScheduled &&
            emailTemplate.schedule_delay &&
            emailTemplate.schedule_delay_unit
          ) {
            // Calculate send date based on delay + preferred time
            const sendDate = calculateSendDate(
              emailTemplate.schedule_delay,
              emailTemplate.schedule_delay_unit,
              preferredTime,
            );

            // Save to schedule-email collection
            const scheduleEmailData = {
              body: processedHtml,
              subject: processedSubject,
              to: recipientEmail,
              sender: sender,
              mode: mode,
              status: "active",
              sendDate: sendDate,
              accountId: accountId || null,
              userId: senderUserId || null,
              scheduleDelay: emailTemplate.schedule_delay,
              scheduleDelayUnit: emailTemplate.schedule_delay_unit,
              enablePreferredTime: hasPreferredTime,
              preferredTime: emailTemplate.preferred_time || null,
              orgID: orgIdStr,
              careerId: careerId || null,
              interviewId: interviews?._id?.toString() || null,
              templateId: emailTemplate._id?.toString() || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            await db.collection("schedule-email").insertOne(scheduleEmailData);

            return NextResponse.json({
              success: true,
              scheduled: true,
              sendDate: sendDate.toISOString(),
              message: "Email scheduled successfully",
            });
          } else if (hasPreferredTime && preferredTime) {
            // Preferred time only (no schedule delay)
            const sendDate = calculateSendDate(0, "days", preferredTime);

            const scheduleEmailData = {
              body: processedHtml,
              subject: processedSubject,
              to: recipientEmail,
              sender: sender,
              mode: mode,
              status: "active",
              sendDate: sendDate,
              accountId: accountId || null,
              userId: senderUserId || null,
              scheduleDelay: null,
              scheduleDelayUnit: null,
              enablePreferredTime: true,
              preferredTime: preferredTime,
              orgID: orgIdStr,
              careerId: careerId || null,
              interviewId: interviews?._id?.toString() || null,
              templateId: emailTemplate._id?.toString() || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            await db.collection("schedule-email").insertOne(scheduleEmailData);

            return NextResponse.json({
              success: true,
              scheduled: true,
              sendDate: sendDate.toISOString(),
              message: "Email scheduled for preferred time",
            });
          }

          // If not scheduled, continue with normal sending flow using template content
          // Override subject and html/text with processed template content
          subject = processedSubject;
          html = processedHtml;
          text = null; // Use HTML from template
        } else {
          return NextResponse.json(
            { error: "Organization ID is required for template-based sending" },
            { status: 400 },
          );
        }
      } catch (templateError: any) {
        console.error("Error processing template:", templateError);
        return NextResponse.json(
          {
            error: "Failed to process email template",
            details: templateError?.message || "Template processing error",
          },
          { status: 500 },
        );
      }
    }

    // Validate required fields (after template processing which may set subject/html)
    if (!fromMailgunId || !to || !subject || (!html && !text)) {
      console.error("[mg-send-email] Missing required fields: fromMailgunId, to, subject, or html or text");
      return NextResponse.json(
        {
          error: "Missing required fields",
        },
        { status: 400 },
      );
    }

    // Extract tokens from subject and body, fetch values, and replace them
    const extractTokens = (content: string): string[] => {
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
      // Handles both: data-token="Token Name" and data-token="[[Token Name]]"
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

    const replaceTokens = (
      content: string,
      tokenValues: Record<string, string>,
    ): string => {
      if (!content) return content;
      let result = content;

      // Helper to normalize token names by stripping category prefix
      // E.g., "Careers-Job Title" -> "Job Title", "Organization-Name" -> "Name"
      const normalizeTokenName = (tokenName: string): string => {
        const prefixMatch = tokenName.match(/^[A-Za-z]+-(.+)$/);
        if (prefixMatch) {
          return prefixMatch[1];
        }
        return tokenName;
      };

      // FIRST: Replace HTML span token format
      // Match: <span ... data-token="Token Name">display text</span>
      // Or: <span ... data-token="[[Token Name]]">display text</span>
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

    // Helper to decode HTML entities for plain text (like subject lines)
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

    // Extract all tokens from subject and body
    const tokensInSubject = extractTokens(subject);
    const tokensInHtml = html ? extractTokens(html) : [];
    const tokensInText = text ? extractTokens(text) : [];
    const allTokens = Array.from(
      new Set([...tokensInSubject, ...tokensInHtml, ...tokensInText]),
    );

    // Always decode HTML entities from subject and trim (important for editor-generated &nbsp;)
    let processedSubject = decodeHtmlEntities(subject).trim();
    let processedHtml = html;
    let processedText = text;

    // Determine applicantEmail from 'to' field
    const extractFirstEmail = (
      toField: string | string[],
    ): string | null => {
      if (!toField) return null;
      const toStr = Array.isArray(toField) ? toField[0] : toField;
      const emailMatch = String(toStr).match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      );
      return emailMatch ? emailMatch[0] : null;
    };

    const applicantEmail = extractFirstEmail(to);

    if (allTokens.length > 0) {
      try {
        console.log("[mg-send-email] Tokens found in email:", allTokens);
        console.log("[mg-send-email] Subject before replacement:", subject);
        console.log(
          "[mg-send-email] HTML before replacement:",
          html?.substring(0, 200),
        );
        const orgIdForTokens = body.orgId || null;

        console.log("[mg-send-email] Calling resolve-email-tokens with:", {
          careerId: careerId || null,
          orgId: orgIdForTokens,
          applicantEmail: applicantEmail,
          tokensUsed: allTokens,
        });

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
              threadId: body.threadId || null,
              tokensUsed: allTokens,
            }),
          },
        );

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.success && tokenData.tokens) {
            console.log(
              "[mg-send-email] Token values fetched:",
              tokenData.tokens,
            );

            // Replace tokens in subject (use already-decoded subject)
            processedSubject = replaceTokens(
              processedSubject,
              tokenData.tokens,
            );
            // Decode again in case tokens introduced HTML entities, then trim
            processedSubject = decodeHtmlEntities(processedSubject).trim();

            if (html) processedHtml = replaceTokens(html, tokenData.tokens);
            if (text) processedText = replaceTokens(text, tokenData.tokens);

            console.log("[mg-send-email] Tokens replaced successfully");
            console.log(
              "[mg-send-email] Subject after replacement:",
              processedSubject,
            );
            console.log(
              "[mg-send-email] HTML after replacement:",
              processedHtml?.substring(0, 200),
            );

            // Validate: ensure every extracted token has a resolved non-empty value
            const normalizeForCheck = (name: string): string => {
              if (!name) return name;
              const cleaned = String(name).replace(/^[\[]\[|\]\]$/g, "");
              const m = cleaned.match(/^[A-Za-z]+-(.+)$/);
              return m ? m[1] : cleaned;
            };

            const missingByMap = allTokens
              .map((t) => normalizeForCheck(t))
              .filter((t) => {
                const val = tokenData.tokens[t];
                return val === undefined || String(val).trim() === "";
              });

            if (missingByMap.length > 0) {
              const hasJobToken = missingByMap.some(
                (t) =>
                  t.toLowerCase().includes("job") ||
                  t.toLowerCase().includes("career"),
              );
              const hasOrgToken = missingByMap.some(
                (t) =>
                  t.toLowerCase().includes("organization") ||
                  t.toLowerCase().includes("employer"),
              );
              const hasCandidateToken = missingByMap.some((t) =>
                t.toLowerCase().includes("candidate"),
              );

              const missingData: string[] = [];
              const missingReasons: { [key: string]: string } = {};
              
              if (hasJobToken) {
                missingData.push("Job/Career information");
                missingReasons.Job = careerId ? "Career not found with ID: " + careerId : "No careerId provided";
              }
              if (hasOrgToken) {
                missingData.push("Organization information");
                missingReasons.Organization = body.orgId ? "Organization not found with ID: " + body.orgId : "No orgId provided";
              }
              if (hasCandidateToken) {
                missingData.push("Candidate information");
                missingReasons.Candidate = applicantEmail ? "Applicant not found with email: " + applicantEmail : "No applicant email provided";
              }

              console.error("[mg-send-email] Missing tokens detail:", {
                missingTokens: missingByMap,
                tokenValues: tokenData.tokens,
                providedCareerId: careerId,
                providedOrgId: body.orgId,
                providedApplicantEmail: applicantEmail,
              });

              return NextResponse.json(
                {
                  error:
                    "Cannot send email: Some template tokens could not be replaced with actual data",
                  missingTokens: Array.from(new Set(missingByMap)),
                  missingData:
                    missingData.length > 0
                      ? missingData
                      : ["Required data not found"],
                  missingReasons: missingReasons,
                  details:
                    "Please ensure the following exist: " + 
                    (hasJobToken ? "career with ID '" + careerId + "'" : "") +
                    (hasJobToken && hasOrgToken ? ", " : "") +
                    (hasOrgToken ? "organization with ID '" + body.orgId + "'" : "") +
                    (hasOrgToken && hasCandidateToken ? ", " : "") +
                    (hasCandidateToken ? "applicant with email '" + applicantEmail + "'" : ""),
                },
                { status: 400 },
              );
            }
          } else {
            console.warn(
              "[mg-send-email] Token fetch succeeded but no tokens returned:",
              tokenData,
            );
          }
        } else {
          const errorData = await tokenResponse.json();
          console.error("[mg-send-email] Failed to resolve tokens:", errorData);

          // Return error if token resolution failed
          return NextResponse.json(
            {
              error: "Failed to resolve email tokens",
              details: errorData.error || "Token resolution service error",
            },
            { status: 400 },
          );
        }
      } catch (tokenError) {
        console.error(
          "[mg-send-email] Error during token replacement:",
          tokenError,
        );
        return NextResponse.json(
          {
            error: "Error during token replacement",
            details:
              tokenError instanceof Error
                ? tokenError.message
                : String(tokenError),
          },
          { status: 500 },
        );
      }

      // After token replacement, validate that all tokens were successfully replaced
      const unreplacedTokens = new Set<string>();

      // Check for unreplaced tokens in all content
      const checkForUnreplacedTokens = (content: string): string[] => {
        if (!content) return [];
        const found: string[] = [];

        // Check for [[Token Name]] format
        const plainTokenRegex = /\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = plainTokenRegex.exec(content)) !== null) {
          found.push(match[1]);
        }

        // Check for <span data-token="Token Name">...</span> format
        const htmlTokenRegex =
          /<span[^>]*data-token="(?:\[\[)?([^\]"]+)(?:\]\])?"[^>]*>([^<]*)<\/span>/g;
        while ((match = htmlTokenRegex.exec(content)) !== null) {
          found.push(match[1]);
        }

        return found;
      };

      // Collect all unreplaced tokens
      checkForUnreplacedTokens(processedSubject).forEach((token) =>
        unreplacedTokens.add(token),
      );
      if (processedHtml) {
        checkForUnreplacedTokens(processedHtml).forEach((token) =>
          unreplacedTokens.add(token),
        );
      }
      if (processedText) {
        checkForUnreplacedTokens(processedText).forEach((token) =>
          unreplacedTokens.add(token),
        );
      }

      // If there are unreplaced tokens, return an error
      if (unreplacedTokens.size > 0) {
        const unreplacedList = Array.from(unreplacedTokens);
        console.error(
          "[mg-send-email] Unreplaced tokens found:",
          unreplacedList,
        );

        // Determine what data is missing based on token categories
        const missingData: string[] = [];
        const missingReasons: { [key: string]: string } = {};
        
        const hasJobToken = unreplacedList.some(
          (t) =>
            t.toLowerCase().includes("job") ||
            t.toLowerCase().includes("career"),
        );
        const hasOrgToken = unreplacedList.some(
          (t) =>
            t.toLowerCase().includes("organization") ||
            t.toLowerCase().includes("employer"),
        );
        const hasCandidateToken = unreplacedList.some((t) =>
          t.toLowerCase().includes("candidate"),
        );

        if (hasJobToken) {
          missingData.push("Job/Career information");
          missingReasons.Job = careerId ? "Career not found with ID: " + careerId : "No careerId provided";
        }
        if (hasOrgToken) {
          missingData.push("Organization information");
          const orgIdStr = body.orgId || "unknown";
          missingReasons.Organization = "Organization not found with ID: " + orgIdStr;
        }
        if (hasCandidateToken) {
          missingData.push("Candidate information");
          missingReasons.Candidate = applicantEmail ? "Applicant not found with email: " + applicantEmail : "No applicant email provided";
        }

        return NextResponse.json(
          {
            error:
              "Cannot send email: Some template tokens could not be replaced with actual data",
            unreplacedTokens: unreplacedList,
            missingData:
              missingData.length > 0
                ? missingData
                : ["Required data not found"],
            missingReasons: missingReasons,
            details:
              "Token(s) could not be replaced: " + unreplacedList.join(", "),
          },
          { status: 400 },
        );
      }

      console.log(
        "[mg-send-email] All tokens successfully replaced, proceeding with send",
      );
    }

    // Build thread metadata BEFORE checking for Gmail send
    // This ensures both Gmail and Mailgun use the same thread metadata
    let _replyHeader: string | null = null;
    let replyReferencedThreadId: any = null;
    let outgoingReferencesRaw: string[] | null = null;
    let outgoingReferencesCanonical: string[] | null = null;
    let refsHeader: string | null = null;

    // Prefer the raw header if provided (preserves original case/angle brackets)
    if (inReplyToRaw) {
      _replyHeader = String(inReplyToRaw).trim();
    } else if (inReplyTo) {
      const cleaned = String(inReplyTo).trim();
      _replyHeader =
        cleaned.startsWith("<") && cleaned.endsWith(">")
          ? cleaned
          : `<${cleaned}>`;
    }

    if (_replyHeader) {
      // normalize header (ensure angle brackets)
      const normalizedReplyRaw =
        _replyHeader.startsWith("<") && _replyHeader.endsWith(">")
          ? _replyHeader
          : `<${String(_replyHeader).replace(/[<>]/g, "").trim()}>`;
      try {
        const refCanonical = String(normalizedReplyRaw)
          .replace(/[<>]/g, "")
          .trim()
          .toLowerCase();
        // try to find a message we previously stored that matches this Message-ID
        const refMsg = await db.collection("mailgun-messages").findOne({
          $or: [
            { mailgunMessageIdRaw: normalizedReplyRaw },
            { mailgunMessageId: refCanonical },
          ],
        });

        if (refMsg) {
          replyReferencedThreadId = refMsg.threadId || null;
          const priorRaw: string[] = Array.isArray(refMsg.mailgunReferencesRaw)
            ? refMsg.mailgunReferencesRaw
            : refMsg.mailgunReferencesRaw
              ? [refMsg.mailgunReferencesRaw]
              : [];
          const priorRawNormalized = priorRaw.map((r: string) =>
            String(r).trim().startsWith("<")
              ? String(r).trim()
              : `<${String(r).replace(/[<>]/g, "").trim()}>`,
          );
          outgoingReferencesRaw = Array.from(
            new Set([...priorRawNormalized, normalizedReplyRaw]),
          );
          outgoingReferencesCanonical = outgoingReferencesRaw.map((r) =>
            String(r).replace(/[<>]/g, "").trim().toLowerCase(),
          );
        } else {
          outgoingReferencesRaw = [normalizedReplyRaw];
          outgoingReferencesCanonical = [
            String(normalizedReplyRaw)
              .replace(/[<>]/g, "")
              .trim()
              .toLowerCase(),
          ];
        }
      } catch (e) {
        console.warn("mg-send-email: error building references chain", e);
        outgoingReferencesRaw = [_replyHeader];
        outgoingReferencesCanonical = [
          String(_replyHeader).replace(/[<>]/g, "").trim().toLowerCase(),
        ];
      }

      refsHeader = outgoingReferencesRaw
        ? outgoingReferencesRaw.join(" ")
        : _replyHeader;
    }

    if (rawDomain == "outlook") {
      try {
        const url =
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000");

        // Pass the authentication token from the current request
        const authToken = req.headers.get("authorization");

        // Forward to outlook/send
        // Note: outlook/send expects { orgID, to, cc, bcc, subject, body, threadId }
        // We need to map our body fields to what outlook/send expects.
        // It expects 'body' field to contain the HTML content.
        const response = await axios.post(
          `${url}/api/outlook/send`,
          {
            orgID: body.orgId,
            to: to,
            cc: body.cc,
            bcc: body.bcc,
            subject: processedSubject,
            body: processedHtml || processedText,
            threadId: body.threadId,
            careerId: body.careerId || careerId,
            attachments: attachments,
          },
          {
            headers: {
              Authorization: authToken || "",
              "Content-Type": "application/json",
            },
            timeout: 30000,
          },
        );

        return NextResponse.json(response.data);
      } catch (err: any) {
        console.error("Outlook proxy send error:", err);
        const status = err.response?.status || 500;
        const data = err.response?.data || {};
        return NextResponse.json(
          {
            error: data.error || "Failed to send via Outlook",
            details: data.details || err.message,
          },
          { status },
        );
      }
    }

    if (rawDomain == "google") {
      try {
        const url = process.env.NEXT_PUBLIC_APP_URL;
        if (!url) {
          return NextResponse.json(
            {
              error:
                "Server configuration error: NEXT_PUBLIC_APP_URL is not set",
            },
            { status: 500 },
          );
        }

        // If userId is not provided, try to extract it from email-settings using fromMailgunId
        let resolvedUserId = userId;
        if (!resolvedUserId && fromMailgunId) {
          try {
            // Check if fromMailgunId is an email-settings ID
            if (ObjectId.isValid(String(fromMailgunId))) {
              const emailSettings = await db
                .collection("email-settings")
                .findOne({
                  _id: new ObjectId(String(fromMailgunId)),
                });

              if (emailSettings && emailSettings.userID) {
                resolvedUserId = String(emailSettings.userID);
              }
            }
          } catch (e) {
            console.warn(
              "mg-send-email: failed to resolve userId from email-settings",
              e,
            );
          }
        }

        // Validate required fields before making the request
        if (!resolvedUserId) {
          console.error("[mg-send-email] Missing required field: userId. Could not resolve from email-settings.");
          return NextResponse.json(
            {
              error:
                "Missing required data",
            },
            { status: 400 },
          );
        }

        const response = await axios.post(
          `${url}/api/gmail/send`,
          {
            to,
            subject: processedSubject,
            body: processedHtml || processedText,
            userID: resolvedUserId,
            attachments,
            careerId,
            // Add thread metadata for Gmail
            inReplyTo: _replyHeader || undefined,
            references: refsHeader || undefined,
            threadId: body.threadId || undefined,
            campaignId: body.campaignId || undefined,
          },
          {
            timeout: 30000, // 30 second timeout
          },
        );

        // Check if the response indicates success
        if (response.data?.error) {
          return NextResponse.json(
            {
              error: response.data.error,
              details: response.data.details || null,
            },
            { status: response.status || 500 },
          );
        }

        // Gmail sends do not persist to mailgun-messages; remove the draft so it doesn't appear as a duplicate
        if (draftId) {
          try {
            let draftQuery: any = { isDraft: true };
            if (ObjectId.isValid(String(draftId))) {
              draftQuery._id = new ObjectId(String(draftId));
            } else {
              draftQuery._id = String(draftId);
            }
            await db.collection("mailgun-messages").deleteOne(draftQuery);
          } catch (e) {
            console.warn("mg-send-email: failed to remove draft after Gmail send", e);
          }
        }

        return NextResponse.json({
          success: true,
          data: response.data,
        });
      } catch (err: any) {
        console.error("Gmail send error:", err);

        // Handle axios errors
        if (err.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          const status = err.response.status || 500;
          const errorData = err.response.data;

          // Extract error message from response
          let errorMessage = "Failed to send email via Gmail";
          if (errorData?.error) {
            errorMessage = errorData.error;
          } else if (typeof errorData === "string") {
            errorMessage = errorData;
          }

          // Provide specific error messages based on status code
          if (status === 400) {
            return NextResponse.json(
              {
                error:
                  errorMessage ||
                  "Invalid request. Please check the email format and try again.",
                details: errorData?.details || null,
              },
              { status: 400 },
            );
          } else if (status === 401) {
            return NextResponse.json(
              {
                error:
                  errorMessage ||
                  "Gmail authentication failed. Please reconnect your Gmail account.",
                details: "The Gmail tokens may have expired or are invalid.",
              },
              { status: 424 },
            );
          } else if (status === 404) {
            return NextResponse.json(
              {
                error:
                  errorMessage ||
                  "Gmail account not found. Please check your email settings.",
                details: errorData?.details || null,
              },
              { status: 404 },
            );
          } else if (status === 429) {
            return NextResponse.json(
              {
                error: "Gmail API rate limit exceeded. Please try again later.",
                details:
                  "Too many requests to Gmail API. Please wait a moment and try again.",
              },
              { status: 429 },
            );
          } else {
            return NextResponse.json(
              {
                error: errorMessage,
                details:
                  errorData?.details || `Gmail API returned status ${status}`,
              },
              { status: status },
            );
          }
        } else if (err.request) {
          // The request was made but no response was received
          return NextResponse.json(
            {
              error:
                "No response from Gmail service. Please check your network connection and try again.",
              details: "The request timed out or the server is unreachable.",
            },
            { status: 503 },
          );
        } else if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
          // Network errors
          return NextResponse.json(
            {
              error:
                "Unable to connect to Gmail service. Please try again later.",
              details: err.message || "Connection error",
            },
            { status: 503 },
          );
        } else {
          // Something happened in setting up the request that triggered an Error
          return NextResponse.json(
            {
              error: "Failed to send email via Gmail",
              details: err.message || "Unknown error occurred",
            },
            { status: 500 },
          );
        }
      }
    }

    // Resolve mailgun account. Support fallback IDs in the form `fallback:email@domain` (hr or no-reply)
    let mgAccount: any = null;
    if (fromMailgunId) {
      const orClauses: any[] = [];
      try {
        if (ObjectId.isValid(String(fromMailgunId))) {
          orClauses.push({ _id: new ObjectId(String(fromMailgunId)) });
        }
      } catch (e) {
        // ignore invalid ObjectId conversion
      }
      // always allow string _id match
      orClauses.push({ _id: String(fromMailgunId) });
      mgAccount = await db
        .collection("mailgun-accounts")
        .findOne({ $or: orClauses });
    }

    // Allow client to pass a fallback account id in the form `fallback:email@domain`
    if (!mgAccount && String(fromMailgunId || "").startsWith("fallback:")) {
      const email = String(fromMailgunId).split(":")[1] || "";
      mgAccount = {
        _id: String(fromMailgunId),
        email,
        domain: email.split("@")[1] || null,
        organizationId: body.orgId || null,
      } as any;
    }

    if (!mgAccount) {
      return NextResponse.json(
        { error: "Mailgun account not found" },
        { status: 404 },
      );
    }

    // Determine organization context: prefer explicit orgId from account, then request body, then the authenticated user's membership
    let orgIdStr: string | null = mgAccount.organizationId
      ? String(mgAccount.organizationId)
      : body.orgId
        ? String(body.orgId)
        : null;

    // Verify authenticated user is a member of the org (try to infer org from member record if missing)
    const userEmail = req.user?.email;
    if (!userEmail)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // If orgIdStr not provided, try to infer from the member record
    if (!orgIdStr) {
      const maybeMember = await db
        .collection("members")
        .findOne({ email: userEmail });
      if (maybeMember) {
        orgIdStr = maybeMember.orgID || maybeMember.organizationId || null;
      }
    }

    if (!orgIdStr) {
      return NextResponse.json(
        { error: "Mailgun account not linked to an organization" },
        { status: 400 },
      );
    }

    // Guard ObjectId conversion in case orgIdStr is not a 24-char hex
    const orgIdIsValid = ObjectId.isValid(String(orgIdStr));
    const orgObjectId = orgIdIsValid ? new ObjectId(String(orgIdStr)) : null;
    const orgMatchers: any[] = [
      { orgID: orgIdStr },
      { organizationId: orgIdStr },
    ];
    if (orgObjectId) {
      orgMatchers.push({ orgID: orgObjectId }, { organizationId: orgObjectId });
    }

    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: orgMatchers,
    });

    if (!memberInOrg) {
      return NextResponse.json(
        {
          error:
            "Forbidden - you must be a member of the organization to send email",
        },
        { status: 403 },
      );
    }

    const orgIdentifier = orgObjectId || orgIdStr;
    // Load organization for fallback display name when needed
    let orgDoc: any = null;
    try {
      const orgMatchers2: any[] = [{ _id: orgIdStr }];
      if (orgObjectId) orgMatchers2.push({ _id: orgObjectId });
      orgDoc = await db
        .collection("organizations")
        .findOne({ $or: orgMatchers2 });
    } catch (_) {
      orgDoc = null;
    }

    // Helper: extract plain email addresses from display strings or arrays
    const extractEmails = (input?: any): string[] => {
      if (!input && input !== 0) return [];
      const src = Array.isArray(input) ? input.join(",") : String(input || "");
      const matches =
        src.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      const uniq = Array.from(new Set(matches.map((m) => String(m).trim())));
      return uniq;
    };

    // Prepare recipients array (sanitized)
    const toList: string[] = extractEmails(to);

    // Validate recipients server-side
    if (!toList || toList.length === 0) {
      return NextResponse.json(
        { error: "No valid recipient emails provided" },
        { status: 400 },
      );
    }

    // Handle attachments: upload each provided base64 attachment to R2 and collect metadata
    const uploadedAttachments: Array<{
      filename: string;
      url: string;
      mimeType?: string;
      size?: number;
    }> = [];
    // Keep buffers temporarily so we can attach the files to the Mailgun request
    const _tempBuffers: Array<{
      filename: string;
      buffer: Buffer;
      mimeType?: string;
    }> = [];
    // Initialize S3Client (R2) to handle draft-stored attachments
    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        try {
          const data = att.data || ""; // expected base64
          const hasStoredRef = !!(att.url || att.key);
          // When sending a draft, skip request-body items that are draft-stored (url/key, no data) so we don't create 0-byte duplicates; the draft block below will copy them from R2.
          if (draftId && hasStoredRef && !data) continue;

          const filename = att.filename || `attachment-${Date.now()}`;
          const mimeType = att.mimeType || "application/octet-stream";
          const buffer = Buffer.from(data, "base64");
          const key = `mailgun-attachments/${Date.now()}-${filename}`;

          const cmd = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
          });

          await s3Client.send(cmd);

          const url = `https://${
            process.env.R2_ACCOUNT_ID
          }.r2.cloudflarestorage.com/${
            process.env.R2_BUCKET_NAME
          }/${encodeURIComponent(key)}`;
          uploadedAttachments.push({
            filename,
            url,
            mimeType,
            size: buffer.length,
          });
          _tempBuffers.push({ filename, buffer, mimeType });
        } catch (err) {
          console.error("Attachment upload failed", err);
        }
      }
    }

    // If this send originates from a draft, move draft attachments from mailgun-drafts/ -> mailgun-attachments/
    if (draftId) {
      try {
        let draftQuery: any = {};
        if (ObjectId.isValid(String(draftId))) {
          draftQuery._id = new ObjectId(String(draftId));
        } else {
          draftQuery._id = String(draftId);
        }
        const draftOrgMatchers: any[] = [{ organizationId: orgIdStr }];
        if (orgObjectId) draftOrgMatchers.push({ organizationId: orgObjectId });
        draftQuery.$or = draftOrgMatchers;

        const draft = await db
          .collection("mailgun-messages")
          .findOne(draftQuery);
        if (
          draft &&
          Array.isArray(draft.draftAttachments) &&
          draft.draftAttachments.length > 0
        ) {
          for (const att of draft.draftAttachments) {
            try {
              const filename = att.filename || `attachment-${Date.now()}`;
              const mimeType = att.mimeType || "application/octet-stream";
              // Resolve old key from att.key or parse from URL
              let oldKey: string | null = null;
              if (att.key) oldKey = String(att.key);
              else if (att.url) {
                const prefix = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/`;
                if (String(att.url).startsWith(prefix)) {
                  oldKey = decodeURIComponent(
                    String(att.url).slice(prefix.length),
                  );
                }
              }
              if (!oldKey) {
                // if we can't determine key, try fetching by URL to get buffer, but still create a new key
                const newKey = `mailgun-attachments/${Date.now()}-${filename}`;
                const newUrl = `https://${
                  process.env.R2_ACCOUNT_ID
                }.r2.cloudflarestorage.com/${
                  process.env.R2_BUCKET_NAME
                }/${encodeURIComponent(newKey)}`;
                // try fetch URL to get buffer
                try {
                  const resp = await fetch(att.url);
                  if (resp.ok) {
                    const arrayBuf = await resp.arrayBuffer();
                    const buffer = Buffer.from(arrayBuf);
                    // Put object to newKey
                    const putCmd = new PutObjectCommand({
                      Bucket: process.env.R2_BUCKET_NAME,
                      Key: newKey,
                      Body: buffer,
                      ContentType: mimeType,
                    });
                    await s3Client.send(putCmd);
                    uploadedAttachments.push({
                      filename,
                      url: newUrl,
                      mimeType,
                      size: buffer.length,
                    });
                    _tempBuffers.push({ filename, buffer, mimeType });
                  }
                } catch (e) {
                  console.warn(
                    "mg-send-email: failed to fetch draft attachment by URL",
                    e,
                  );
                }
                continue;
              }

              // Choose a new key under mailgun-attachments/
              const newKey = `mailgun-attachments/${Date.now()}-${filename}`;

              // Copy object within R2 then delete the draft object
              try {
                const copyCmd = new CopyObjectCommand({
                  Bucket: process.env.R2_BUCKET_NAME,
                  CopySource: `${process.env.R2_BUCKET_NAME}/${oldKey}`,
                  Key: newKey,
                });
                await s3Client.send(copyCmd);

                const deleteCmd = new DeleteObjectCommand({
                  Bucket: process.env.R2_BUCKET_NAME,
                  Key: oldKey,
                });
                await s3Client.send(deleteCmd);

                const newUrl = `https://${
                  process.env.R2_ACCOUNT_ID
                }.r2.cloudflarestorage.com/${
                  process.env.R2_BUCKET_NAME
                }/${encodeURIComponent(newKey)}`;

                // Fetch object to obtain buffer for Mailgun multipart send
                try {
                  const getCmd = new GetObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: newKey,
                  });
                  const getResp = await s3Client.send(getCmd);
                  // getResp.Body is a stream - collect into buffer
                  const streamToBuffer = async (stream: any) => {
                    return new Promise<Buffer>((resolve, reject) => {
                      const chunks: any[] = [];
                      stream.on("data", (chunk: any) => chunks.push(chunk));
                      stream.on("error", reject);
                      stream.on("end", () => resolve(Buffer.concat(chunks)));
                    });
                  };
                  const bodyStream: any = getResp.Body as any;
                  const buffer = await streamToBuffer(bodyStream);
                  uploadedAttachments.push({
                    filename,
                    url: newUrl,
                    mimeType,
                    size: buffer.length,
                  });
                  _tempBuffers.push({ filename, buffer, mimeType });
                } catch (e) {
                  console.warn(
                    "mg-send-email: failed to get copied attachment from R2",
                    e,
                  );
                  // as a fallback, try to fetch by URL
                  try {
                    const resp = await fetch(newUrl);
                    if (resp.ok) {
                      const arrayBuf = await resp.arrayBuffer();
                      const buffer = Buffer.from(arrayBuf);
                      uploadedAttachments.push({
                        filename,
                        url: newUrl,
                        mimeType,
                        size: buffer.length,
                      });
                      _tempBuffers.push({ filename, buffer, mimeType });
                    }
                  } catch (e2) {
                    console.warn("mg-send-email: fallback fetch failed", e2);
                  }
                }
              } catch (e) {
                console.warn(
                  "mg-send-email: failed to copy/delete draft attachment in R2",
                  e,
                );
                // fallback: try to fetch original URL and attach directly
                if (att.url) {
                  try {
                    const resp = await fetch(att.url);
                    if (resp.ok) {
                      const arrayBuf = await resp.arrayBuffer();
                      const buffer = Buffer.from(arrayBuf);
                      const newKey2 = `mailgun-attachments/${Date.now()}-${filename}`;
                      const putCmd2 = new PutObjectCommand({
                        Bucket: process.env.R2_BUCKET_NAME,
                        Key: newKey2,
                        Body: buffer,
                        ContentType: mimeType,
                      });
                      await s3Client.send(putCmd2);
                      const newUrl2 = `https://${
                        process.env.R2_ACCOUNT_ID
                      }.r2.cloudflarestorage.com/${
                        process.env.R2_BUCKET_NAME
                      }/${encodeURIComponent(newKey2)}`;
                      uploadedAttachments.push({
                        filename,
                        url: newUrl2,
                        mimeType,
                        size: buffer.length,
                      });
                      _tempBuffers.push({ filename, buffer, mimeType });
                    }
                  } catch (e3) {
                    console.warn(
                      "mg-send-email: fallback attach from url failed",
                      e3,
                    );
                  }
                }
              }
            } catch (e) {
              console.warn(
                "mg-send-email: error processing draft attachment",
                e,
              );
            }
          }
        }
      } catch (e) {
        console.warn("mg-send-email: error fetching draft for attachments", e);
      }
    }

    // Enforce total attachments size limit (25 MB)
    try {
      const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB
      const totalFromBuffers = _tempBuffers.reduce(
        (acc, b) => acc + (b.buffer ? b.buffer.length : 0),
        0,
      );
      const totalFromUploaded = uploadedAttachments.reduce(
        (acc, a) => acc + (a.size ? a.size : 0),
        0,
      );
      const totalBytes = totalFromBuffers + totalFromUploaded;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: "Total attachments size exceeds 25 MB" },
          { status: 400 },
        );
      }
    } catch (e) {
      console.warn("mg-send-email: failed to validate attachment sizes", e);
    }

    // Build message payload for Mailgun
    const mailgun = new Mailgun(formData as any);
    let mg: any = null;
    let mailgunKey: string | null = null;

    const domain =
      mgAccount.domain ||
      process.env.MAILGUN_DOMAIN ||
      process.env.NEXT_PUBLIC_MAILGUN_DOMAIN ||
      "hellojia.ai";

    // Verify domain sending key matches organization-domains record
    try {
      const orgIdsToMatch = orgObjectId ? [orgObjectId, orgIdStr] : [orgIdStr];
      const subdomainRecord = await db
        .collection("organization-domains")
        .findOne({
          orgId: { $in: orgIdsToMatch },
          $or: [{ fullDomain: domain }, { domain: domain }],
        });

      if (!subdomainRecord) {
        return NextResponse.json(
          {
            error: "Domain not found in organization subdomains",
            details: "This domain is not registered for your organization",
          },
          { status: 403 },
        );
      }

      const rawDomainSendingKey = subdomainRecord.domainSendingKey;
      const expectedDomainSendingKey =
        typeof rawDomainSendingKey === "string"
          ? decrypt(rawDomainSendingKey) || rawDomainSendingKey
          : rawDomainSendingKey;

      const keySnippet = (key: string | null) => {
        if (!key || typeof key !== "string") return "N/A";
        return key.substring(0, 8) + "..." + key.substring(key.length - 4);
      };

      console.log(`[MG] Domain sending key verification for ${domain}:`, {
        rawKeyExists: !!rawDomainSendingKey,
        rawKey: keySnippet(rawDomainSendingKey as string),
        wasDecrypted:
          typeof rawDomainSendingKey === "string" &&
          decrypt(rawDomainSendingKey)
            ? true
            : false,
        expectedKey: keySnippet(expectedDomainSendingKey as string),
        expectedKeyExists: !!expectedDomainSendingKey,
      });

      if (!expectedDomainSendingKey) {
        return NextResponse.json(
          {
            error: "Domain sending key not configured",
            details: "Please configure the domain sending key for this domain",
          },
          { status: 403 },
        );
      }

      mailgunKey = expectedDomainSendingKey;
      mg = mailgun.client({
        username: "api",
        key: mailgunKey,
      });

      // Light-touch verification: ensure domain exists in Mailgun using the domain-specific key
      try {
        await mg.domains.get(domain);
        console.log(
          `[MG] ✓ Successfully verified domain ${domain} with sending key: ${keySnippet(
            mailgunKey,
          )}`,
        );
      } catch (mailgunError) {
        console.error("Failed to verify domain with Mailgun", mailgunError);
        return NextResponse.json(
          {
            error: "Failed to verify domain",
            details: "Could not verify domain with email service",
          },
          { status: 500 },
        );
      }
    } catch (subdomainError) {
      console.error("Failed to verify organization subdomain", subdomainError);
      return NextResponse.json(
        {
          error: "Domain verification failed",
          details: "Could not verify domain permissions",
        },
        { status: 500 },
      );
    }

    // Extract plain email + optional display name even if the stored value already includes quotes/angle brackets
    const parseEmailParts = (
      value: string | null | undefined,
    ): { email: string; displayName: string | null } => {
      if (!value) return { email: "", displayName: null };

      const trimmed = String(value).trim();
      // Match patterns like "Name" <email@domain>
      const angleMatch = trimmed.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
      if (angleMatch) {
        const candidateName = angleMatch[1]?.trim();
        const candidateEmail = angleMatch[2]?.trim();
        return {
          email: candidateEmail || trimmed,
          displayName: candidateName || null,
        };
      }

      // Fallback: if it's just a quoted string without angle brackets
      const quotedOnly = trimmed.match(/^"([^"]+)"$/);
      if (quotedOnly) {
        return { email: quotedOnly[1].trim(), displayName: null };
      }

      return { email: trimmed, displayName: null };
    };

    // Format from address with display name if available: "DisplayName <email@domain>"
    // Properly quote display names to ensure they show up correctly in email clients
    const formatFromAddress = (
      displayName: string | null | undefined,
      email: string,
    ): string => {
      if (!displayName || displayName.trim() === "") {
        return email;
      }
      // Escape quotes and backslashes in display name
      const escaped = displayName.replace(/\\/g, "\\").replace(/"/g, '\\"');
      // Always quote the display name for proper RFC 5322 compliance
      return `"${escaped}" <${email}>`;
    };

    const parsedFrom = parseEmailParts(mgAccount.email);
    const orgName = (orgDoc?.name && String(orgDoc.name).trim()) || null;
    const fallbackDisplayName = orgName
      ? String(mgAccount.email || "")
          .toLowerCase()
          .startsWith("no-reply-")
        ? orgName
        : `${orgName} HR`
      : null;
    const fromDisplayNameRaw =
      (mgAccount.displayName && String(mgAccount.displayName).trim()) ||
      parsedFrom.displayName ||
      fallbackDisplayName ||
      null;
    const fromEmail = parsedFrom.email;
    const fromAddress = formatFromAddress(fromDisplayNameRaw, fromEmail);

    // Normalize the stored mailgun-accounts record if it still contains quoted/angled address
    if (parsedFrom.email && parsedFrom.email !== mgAccount.email) {
      await db.collection("mailgun-accounts").updateOne(
        { _id: mgAccount._id },
        {
          $set: {
            email: parsedFrom.email,
            displayName: fromDisplayNameRaw,
            updatedAt: new Date(),
          },
        },
      );
    }

    const messageData: any = {
      from: fromAddress,
      to: toList,
      subject: processedSubject,
    };
    // Add cc and bcc if present
    if (body.cc && Array.isArray(body.cc) && body.cc.length > 0) {
      messageData.cc = extractEmails(body.cc);
    }
    if (body.bcc && Array.isArray(body.bcc) && body.bcc.length > 0) {
      messageData.bcc = extractEmails(body.bcc);
    }
    // Thread metadata is already built above (before Gmail check)
    // Use the already-built variables for Mailgun headers
    if (_replyHeader) {
      messageData.headers = {
        "In-Reply-To": _replyHeader,
        References: refsHeader,
      };
      try {
        messageData["h:In-Reply-To"] = _replyHeader;
        messageData["h:References"] = refsHeader;
      } catch (e) {
        // ignore
      }
    }

    if (processedHtml)
      messageData.html =
        processedHtml +
        (uploadedAttachments.length
          ? `<p>Attachments:<ul>${uploadedAttachments
              .map((a) => `<li><a href="${a.url}">${a.filename}</a></li>`)
              .join("")}</ul></p>`
          : "");
    if (processedText)
      messageData.text =
        processedText +
        (uploadedAttachments.length
          ? `\n\nAttachments:\n${uploadedAttachments
              .map((a) => `${a.filename}: ${a.url}`)
              .join("\n")}`
          : "");

    // Send via Mailgun. If buffers exist, post multipart/form-data directly
    // using Web FormData+Blob (undici-compatible). Otherwise use mailgun.js.
    let mgResult: any = null;
    try {
      if (_tempBuffers.length > 0) {
        const fd: any = new (globalThis as any).FormData();
        fd.append("from", fromAddress);
        for (const toAddr of toList) fd.append("to", toAddr);
        fd.append("subject", processedSubject);
        if (processedHtml) fd.append("html", processedHtml);
        if (processedText) fd.append("text", processedText);

        // Include reply headers for form-data path using Mailgun's `h:` prefix
        if (_replyHeader) {
          try {
            fd.append("h:In-Reply-To", _replyHeader);
            if (refsHeader) fd.append("h:References", refsHeader);
          } catch (e) {
            // ignore failures appending headers to form-data
          }
        }

        for (const tb of _tempBuffers) {
          const uint8 = new Uint8Array(tb.buffer as any);
          const blob = new Blob([uint8], {
            type: tb.mimeType || "application/octet-stream",
          });
          fd.append("attachment", blob, tb.filename);
        }

        if (!mailgunKey) {
          throw new Error("mailgunKey not initialized for send");
        }

        const auth =
          "Basic " + Buffer.from(`api:${mailgunKey}`).toString("base64");
        const res = await fetch(
          `https://api.mailgun.net/v3/${domain}/messages`,
          {
            method: "POST",
            headers: { Authorization: auth },
            body: fd,
          },
        );

        const resText = await res.text();
        if (!res.ok) throw new Error("Mailgun send failed: " + resText);
        mgResult = { status: res.status, body: resText };
      } else {
        if (!mg) {
          throw new Error("Mailgun client not initialized for send");
        }
        mgResult = await mg.messages.create(domain, messageData);
      }
    } catch (err) {
      console.error("Mailgun send error", err);
      return NextResponse.json(
        { error: "Mailgun send failed", details: String(err) },
        { status: 500 },
      );
    }

    // Manage thread record
    const normSubject = normalizeSubject(processedSubject);
    const isReplyFlow = Boolean(_replyHeader || body.threadId);
    // Prefer client-provided threadId to ensure replies reuse the same DB thread
    let thread: any = null;
    if (body.threadId) {
      try {
        // try to resolve as ObjectId first
        if (ObjectId.isValid(String(body.threadId))) {
          thread = await db
            .collection("mailgun-threads")
            .findOne({ _id: new ObjectId(String(body.threadId)) });
        }
        // fallback by threadId string field
        if (!thread) {
          thread = await db
            .collection("mailgun-threads")
            .findOne({ threadId: String(body.threadId) });
        }
      } catch (e) {
        console.warn("mg-send-email: failed to resolve provided threadId", e);
      }
    }

    // If replying to a known message, reuse that message's thread
    if (!thread && replyReferencedThreadId) {
      try {
        if (ObjectId.isValid(String(replyReferencedThreadId))) {
          thread = await db
            .collection("mailgun-threads")
            .findOne({ _id: new ObjectId(String(replyReferencedThreadId)) });
        }
        if (!thread) {
          thread = await db
            .collection("mailgun-threads")
            .findOne({ threadId: String(replyReferencedThreadId) });
        }
      } catch (e) {
        console.warn(
          "mg-send-email: failed to resolve thread from reply ref",
          e,
        );
      }
    }

    // If no thread found via provided threadId, find by organization, normalized subject and careerId
    const threadOrgMatchers: any[] = [{ organizationId: orgIdStr }];
    if (orgObjectId) threadOrgMatchers.push({ organizationId: orgObjectId });
    const threadQuery: any = {
      $or: threadOrgMatchers,
      normalizedSubject: normSubject,
    };
    if (careerId) {
      // careers use UUID strings; store as string
      threadQuery.careerId = String(careerId);
    } else {
      // match threads with no careerId set
      threadQuery.$or = [{ careerId: null }, { careerId: { $exists: false } }];
    }

    // Only reuse a thread by subject when replying; new compositions with identical subjects must create new threads
    if (!thread && isReplyFlow)
      thread = await db.collection("mailgun-threads").findOne(threadQuery);

    if (!thread) {
      const threadIdStr = new ObjectId().toHexString();
      const insertThread = {
        applicantId: null,
        organizationId: orgObjectId || orgIdStr,
        subject: processedSubject,
        normalizedSubject: normSubject,
        threadId: threadIdStr,
        careerId: careerId ? String(careerId) : null,
        lastUpdated: new Date(),
        // participants should track `mailgun-accounts` ids
        participants: [
          // preserve stored type: if mgAccount._id is an ObjectId use it, otherwise store as string
          typeof mgAccount._id === "object"
            ? mgAccount._id
            : String(mgAccount._id),
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        campaignId: body.campaignId || null,
      } as any;
      const tRes = await db
        .collection("mailgun-threads")
        .insertOne(insertThread);
      thread = await db
        .collection("mailgun-threads")
        .findOne({ _id: tRes.insertedId });
    } else {
      // ensure recruiter is listed
      // add the mailgun account id to participants (acts like the 'from' identity)
      const participantId =
        typeof mgAccount._id === "object"
          ? mgAccount._id
          : String(mgAccount._id);
      const updateFields: any = {
        lastUpdated: new Date(),
        updatedAt: new Date(),
      };
      if (body.campaignId) {
        updateFields.campaignId = body.campaignId;
      }
      await db.collection("mailgun-threads").updateOne(
        { _id: thread._id },
        {
          $set: updateFields,
          $addToSet: { participants: participantId },
        },
      );
    }

    // Persist mailgun message record
    const ccList =
      body.cc && Array.isArray(body.cc) && body.cc.length > 0
        ? extractEmails(body.cc)
        : [];
    const bccList =
      body.bcc && Array.isArray(body.bcc) && body.bcc.length > 0
        ? extractEmails(body.bcc)
        : [];
    const messageDoc: any = {
      threadId: thread._id,
      from:
        fromDisplayNameRaw && fromEmail
          ? `${fromDisplayNameRaw} <${fromEmail}>`
          : fromEmail,
      fromHeader: fromAddress,
      to: toList,
      cc: ccList,
      bcc: bccList,
      html: processedHtml || null,
      text: processedText || null,
      attachments: uploadedAttachments,
      direction: "outbound",
      mailgunMessageId: mgResult?.id || mgResult?.message || null,
      // track which mailgun account sent this message
      mailgunAccountId: mgAccount._id,
      // store the outgoing References chain (raw + canonical)
      mailgunReferencesRaw: outgoingReferencesRaw || null,
      mailgunReferences: outgoingReferencesCanonical || null,
      recruiterId: new ObjectId(String(memberInOrg._id)),
      applicantId: null,
      organizationId: orgObjectId || orgIdStr,
      receivedAt: null,
      sentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      campaignId: body.campaignId || null,
    };

    // If email is sent, remove isDraft flag, set direction to outbound and attach uploaded files).
    let insertMsg: any = null;
    if (draftId) {
      try {
        let draftQuery: any = {};
        if (ObjectId.isValid(String(draftId))) {
          draftQuery._id = new ObjectId(String(draftId));
        } else {
          draftQuery._id = String(draftId);
        }
        // restrict to same organization for safety
        const draftFinalOrgMatchers: any[] = [{ organizationId: orgIdStr }];
        if (orgObjectId)
          draftFinalOrgMatchers.push({ organizationId: orgObjectId });
        draftQuery.$or = draftFinalOrgMatchers;

        const draft = await db
          .collection("mailgun-messages")
          .findOne(draftQuery);
        if (draft) {
          // Build update payload merging messageDoc fields into existing draft
          const updatePayload: any = {
            $set: {
              threadId: messageDoc.threadId,
              from: messageDoc.from,
              to: messageDoc.to,
              cc: messageDoc.cc || [],
              bcc: messageDoc.bcc || [],
              html: messageDoc.html || null,
              text: messageDoc.text || null,
              attachments: messageDoc.attachments || [],
              direction: "outbound",
              isDraft: false,
              mailgunMessageId: messageDoc.mailgunMessageId || null,
              mailgunAccountId: messageDoc.mailgunAccountId || null,
              mailgunReferencesRaw: messageDoc.mailgunReferencesRaw || null,
              mailgunReferences: messageDoc.mailgunReferences || null,
              recruiterId: messageDoc.recruiterId || null,
              applicantId: messageDoc.applicantId || null,
              organizationId: messageDoc.organizationId || null,
              receivedAt: messageDoc.receivedAt || null,
              sentAt: messageDoc.sentAt || new Date(),
              updatedAt: new Date(),
            },
            $unset: { draftAttachments: "" },
          };

          await db
            .collection("mailgun-messages")
            .updateOne({ _id: draft._id }, updatePayload);
          insertMsg = { insertedId: draft._id };
        } else {
          // Draft not found or mismatch; insert as a new outbound message
          insertMsg = await db
            .collection("mailgun-messages")
            .insertOne(messageDoc);
        }
      } catch (e) {
        console.warn(
          "mg-send-email: failed to update draft, inserting new message",
          e,
        );
        insertMsg = await db
          .collection("mailgun-messages")
          .insertOne(messageDoc);
      }
    } else {
      insertMsg = await db.collection("mailgun-messages").insertOne(messageDoc);
    }

    try {
      // Merge outgoing message's references into the thread document so thread has aggregated chain
      const msgRefsRaw = messageDoc.mailgunReferencesRaw || [];
      const msgIdRaw =
        messageDoc.mailgunMessageId || messageDoc.mailgunMessageIdRaw || null;
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
          String(v).replace(/[<>]/g, "").trim().toLowerCase(),
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
          },
        );
      }
    } catch (e) {
      console.warn("mg-send-email: failed to merge references into thread", e);
    }

    // Automatically mark the logged-in user as having read the thread and message
    if (req.user && req.user.uid && req.user.email) {
      const userUid = req.user.uid;
      const userEmail = req.user.email;
      const now = new Date();
      // Update mailgun-threads: add user UID to readMap with timestamp
      try {
        await db.collection("mailgun-threads").updateOne(
          { _id: thread._id },
          {
            $set: { ["readMap." + userUid]: now },
          },
        );
      } catch (e) {
        console.error("Failed to update readMap in mailgun-threads:", e);
      }
      // Update mailgun-messages: add user email to readBy
      try {
        await db
          .collection("mailgun-messages")
          .updateOne(
            { _id: insertMsg.insertedId },
            { $addToSet: { readBy: userEmail } },
          );
      } catch (e) {
        console.error("Failed to update readBy in mailgun-messages:", e);
      }
    }

    // Log activity for emailing candidate
    try {
      if (careerId) {
        const extractEmail = (emailField: string | string[]): string | null => {
          const emailStr = Array.isArray(emailField) ? emailField[0] : emailField;
          const match = String(emailStr).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
          return match ? match[0].toLowerCase() : null;
        };
        const extractEmailsForLog = (input: any): string[] => {
          if (!input && input !== 0) return [];
          const src = Array.isArray(input) ? input.join(",") : String(input || "");
          const matches = src.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
          return Array.from(new Set(matches.map((m) => String(m).trim().toLowerCase())));
        };
        const toListLog = extractEmailsForLog(to);
        const ccListLog = extractEmailsForLog(body.cc);
        const bccListLog = extractEmailsForLog(body.bcc);
        const allRecipientEmails = [...new Set([...toListLog, ...ccListLog, ...bccListLog])];
        const orgMatcherForInterviews =
          orgIdStr && ObjectId.isValid(String(orgIdStr))
            ? [{ orgID: orgIdStr }, { orgID: new ObjectId(String(orgIdStr)) }]
            : orgIdStr
              ? [{ orgID: orgIdStr }]
              : [];
        const nameMap = new Map<string, string>();
        if (orgMatcherForInterviews.length > 0 && allRecipientEmails.length > 0) {
          const interviews = await db
            .collection("interviews")
            .find(
              { $or: orgMatcherForInterviews, email: { $in: allRecipientEmails } },
              { projection: { email: 1, name: 1 } }
            )
            .toArray();
          for (const i of interviews) {
            if (i.email && i.name) nameMap.set(String(i.email).toLowerCase(), i.name);
          }
        }
        const buildRecipients = (
          emails: string[],
          type: "to" | "cc" | "bcc"
        ): { email: string; name?: string; type: "to" | "cc" | "bcc" }[] =>
          emails.map((email) => ({
            email,
            name: nameMap.get(email) || undefined,
            type,
          }));
        const recipients: { email: string; name?: string; type: "to" | "cc" | "bcc" }[] = [
          ...buildRecipients(toListLog, "to"),
          ...buildRecipients(ccListLog, "cc"),
          ...buildRecipients(bccListLog, "bcc"),
        ];

        const recipientEmail = extractEmail(to);
        if (recipientEmail) {
          const interview = await db.collection("interviews").findOne({
            id: careerId,
            email: recipientEmail,
          });

          if (interview) {
            const career = await db.collection("careers").findOne({
              id: careerId,
            });

            const member = memberInOrg;

            await logActivity({
              db,
              kind: "recruiter_emailed_candidate",
              interview,
              career,
              actor: {
                type: "recruiter",
                id: member?.uid || member?._id?.toString(),
                email: member?.email,
                name: member?.name || member?.email,
                image: member?.image || member?.photoURL,
              },
              extraMetadata: {
                emailSubject: subject,
                ...(recipients.length > 0 && { recipients }),
              },
            });
          } else {
            const career = await db.collection("careers").findOne({ id: careerId });
            const member = memberInOrg;
            if (career && member && orgIdStr) {
              const actorName = member?.name || member?.email || "Recruiter";
              const applicantNameFromOrg = nameMap.get(recipientEmail);
              const displayName = applicantNameFromOrg || recipientEmail;
              await recordActivityHistory(db, {
                orgID: String(orgIdStr),
                careerId: career._id?.toString?.() || career?.id,
                action: "Emailed Candidate",
                source: "manual",
                actor: {
                  type: "recruiter",
                  id: member?.uid || member?._id?.toString(),
                  email: member?.email,
                  name: actorName,
                  image: member?.image || member?.photoURL,
                },
                metadata: {
                  applicant: { email: recipientEmail, name: applicantNameFromOrg ?? undefined },
                  emailSubject: subject,
                  message: `${actorName} emailed ${displayName}`,
                  ...(recipients.length > 0 && { recipients }),
                },
              });
            }
          }
        }
      }
    } catch (logError) {
      console.error("Error logging email activity:", logError);
      // Don't fail the email send if logging fails
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId: insertMsg.insertedId,
        mailgunResult: mgResult,
        threadId: thread.threadId || thread._id,
      },
    });
  } catch (err) {
    console.error("mg-send-email error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
