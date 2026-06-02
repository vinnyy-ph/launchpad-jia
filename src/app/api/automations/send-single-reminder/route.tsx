import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import Mailgun from "mailgun.js";
import formData from "form-data";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const {
      interviewId,
      reminderType,
      emailSubject,
      emailContent,
      orgID: requestOrgID,
    } = body;

    // Validate required parameters
    if (!interviewId) {
      console.error("[send-single-reminder] Missing required data: interviewId");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required data",
        },
        { status: 400 }
      );
    }

    if (!emailSubject || !emailContent) {
      console.error("[send-single-reminder] Missing required data: emailSubject or emailContent");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required data",
        },
        { status: 400 }
      );
    }

    if (!reminderType) {
      console.error("[send-single-reminder] Missing required data: reminderType");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required data",
        },
        { status: 400 }
      );
    }

    // Validate email content length and format
    if (emailSubject.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: "Email subject is too long (max 200 characters)",
        },
        { status: 400 }
      );
    }

    if (emailContent.length > 50000) {
      return NextResponse.json(
        {
          success: false,
          error: "Email content is too long (max 50KB)",
        },
        { status: 400 }
      );
    }

    // Basic HTML validation
    if (!emailContent.includes("<html") || !emailContent.includes("</html>")) {
      return NextResponse.json(
        {
          success: false,
          error: "Email content must be valid HTML",
        },
        { status: 400 }
      );
    }

    // Fetch interview data for validation and logging
    const { db } = await connectMongoDB();
    const interview = await db
      .collection("interviews")
      .findOne({ _id: new ObjectId(interviewId) });

    if (!interview) {
      return NextResponse.json(
        {
          success: false,
          error: "Interview not found",
        },
        { status: 404 }
      );
    }

    // Get orgID from interview
    const orgID = interview.orgID || null;

    // Get organization context from authenticated user
    const userEmail = request.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine orgID with priority: requestOrgID > interview.orgID > user's member record
    let orgIdStr: string | null = null;

    // Priority 1: Use orgID from request body (current org being viewed)
    if (requestOrgID) {
      orgIdStr = String(requestOrgID);
    } else {
      // Priority 2: Use orgID from interview
      const orgID = interview.orgID || null;
      if (orgID) {
        orgIdStr = String(orgID);
      } else {
        // Priority 3: Try to infer organization from member record
        const maybeMember = await db
          .collection("members")
          .findOne({ email: userEmail });
        if (maybeMember) {
          orgIdStr = maybeMember.orgID || maybeMember.organizationId || null;
          if (orgIdStr) {
            orgIdStr = String(orgIdStr);
          }
        }
      }
    }

    // Use orgID from interview if available, otherwise use determined orgIdStr
    const finalOrgId = orgIdStr;
    if (!finalOrgId) {
      return NextResponse.json(
        {
          error:
            "Organization ID not found. Please ensure the interview has an orgID or you are associated with an organization.",
        },
        { status: 400 }
      );
    }

    const orgObjectId = new ObjectId(finalOrgId);

    // Fetch careerId from interview
    let finalCareerId = interview.careerId || interview.careerID || null;
    if (!finalCareerId && interview.id) {
      try {
        // Look up career by id field (interview.id matches career.id)
        const career = await db
          .collection("careers")
          .findOne({ id: interview.id });
        if (career && career.id) {
          finalCareerId = career.id.toString();
          console.log("Career ID fetched from interview:", finalCareerId);
        }
      } catch (error) {
        console.error("Error fetching career from interview:", error);
        // Continue without careerId if lookup fails
      }
    }

    // Log the reminder being sent
    console.log(`Sending reminder for interview ${interviewId}:`, {
      email: interview.email,
      name: interview.name,
      jobTitle: interview.jobTitle,
      status: interview.status,
      currentStep: interview.currentStep,
      reminderType: reminderType,
      emailSubject: emailSubject,
    });

    // Use fallback mailgun account for automated emails
    const mgAccount = {
      _id: "fallback:noreply@hellojia.ai",
      email: "noreply@hellojia.ai",
      domain: "hellojia.ai",
      organizationId: orgObjectId,
    };

    // Send email via Mailgun
    const mailgun = new Mailgun(formData as any);
    const mg = mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY,
    });

    const domain =
      mgAccount.domain ||
      process.env.MAILGUN_DOMAIN ||
      process.env.NEXT_PUBLIC_MAILGUN_DOMAIN ||
      "hellojia.ai";

    const fromAddress = (mgAccount as any).displayName
      ? `${(mgAccount as any).displayName} <${mgAccount.email}>`
      : mgAccount.email;

    const messageData: any = {
      from: fromAddress,
      to: [interview.email],
      subject: emailSubject,
      html: emailContent,
      orgID: orgID,
    };

    let mailgunResult: any = null;
    try {
      mailgunResult = await mg.messages.create(domain, messageData);
      console.log("Mailgun response:", mailgunResult);
    } catch (err) {
      console.error("Mailgun send error:", err);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send email via Mailgun",
          details: String(err),
        },
        { status: 500 }
      );
    }

    // Create a new thread per reminder
    function normalizeSubject(s: string) {
      if (!s) return "";
      return s.replace(/^([\s]*(?:re|fw|fwd)[\s]*[:\-\s]*)+/i, "").trim();
    }
    const normSubject = normalizeSubject(emailSubject);
    const threadIdStr = new ObjectId().toHexString();
    const insertThread = {
      applicantId: interview._id || null,
      organizationId: orgObjectId,
      subject: emailSubject,
      normalizedSubject: normSubject,
      threadId: threadIdStr,
      careerId: finalCareerId
        ? ObjectId.isValid(String(finalCareerId))
          ? new ObjectId(String(finalCareerId))
          : finalCareerId
        : null,
      lastUpdated: new Date(),
      participants: [
        typeof mgAccount._id === "object"
          ? mgAccount._id
          : String(mgAccount._id),
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    const tRes = await db
      .collection("mailgun-threads")
      .insertOne(insertThread);
    const thread = await db
      .collection("mailgun-threads")
      .findOne({ _id: tRes.insertedId });

    // Get member record for recruiterId
    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: finalOrgId },
        { orgID: orgObjectId },
        { organizationId: finalOrgId },
        { organizationId: orgObjectId },
      ],
    });

    // Persist mailgun message record
    const messageDoc: any = {
      threadId: thread._id,
      from: fromAddress,
      to: [interview.email],
      cc: [],
      bcc: [],
      html: emailContent || null,
      text: null,
      attachments: [],
      careerId: finalCareerId
        ? ObjectId.isValid(String(finalCareerId))
          ? new ObjectId(String(finalCareerId))
          : finalCareerId
        : null,
      direction: "outbound",
      isAutomated: true,
      mailgunMessageId: mailgunResult?.id || mailgunResult?.message || null,
      mailgunAccountId: mgAccount._id,
      mailgunReferencesRaw: null,
      mailgunReferences: null,
      recruiterId: memberInOrg?._id
        ? new ObjectId(String(memberInOrg._id))
        : null,
      applicantId: null,
      organizationId: orgObjectId,
      receivedAt: null,
      sentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertMsg = await db
      .collection("mailgun-messages")
      .insertOne(messageDoc);

    console.log("Email saved to mailgun-messages collection:", {
      messageId: insertMsg.insertedId,
      threadId: thread.threadId || thread._id,
    });

    // Also save to email-noreply collection for backward compatibility
    try {
      const emailRecord = {
        from: fromAddress,
        to: [interview.email],
        subject: emailSubject,
        message: emailContent,
        orgID: orgID || null,
        sentBy: null,
        sentByUserId: null,
        sentByGmail: null,
        CareerId: finalCareerId || null,
        mailgunId: mailgunResult?.id || mailgunResult?.message || null,
        status: "sent",
        metadata: {
          interviewId: interviewId,
          reminderType: reminderType,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "automated",
      };

      await db.collection("email-noreply").insertOne(emailRecord);
      console.log("Email saved to email-noreply collection:", emailRecord);
    } catch (dbError) {
      console.error("Error saving email record to email-noreply:", dbError);
      // Continue even if database save fails - email was already sent
    }

    // Update lastAutoReminder and reminderType in database
    const updateData: any = {
      lastAutoReminder: new Date(),
      reminderType: reminderType, // Always update the reminderType for consistency
    };

    await db
      .collection("interviews")
      .updateOne({ _id: new ObjectId(interviewId) }, { $set: updateData });

    console.log(
      `Database updated for interview ${interviewId} with reminderType: ${reminderType}`
    );

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      interviewId: interviewId,
      reminderType: reminderType,
      data: {
        messageId: insertMsg.insertedId,
        mailgunResult: mailgunResult,
        threadId: thread.threadId || thread._id,
      },
    });
  } catch (error) {
    console.error("Error in send-single-reminder endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
});
