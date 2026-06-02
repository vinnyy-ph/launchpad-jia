import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import Mailgun from "mailgun.js";
import formData from "form-data";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { to, subject, message, _id, careerId, orgID: requestOrgID } = body;

    // Debug logging
    console.log("Send email reminder request:", {
      user: request.user?.email || "unknown",
      to,
      subject: subject?.substring(0, 50) + "...",
      messageLength: message?.length || 0,
      candidateId: _id,
    });

    // Validate required parameters
    if (!to || !subject || !message) {
      console.error("[send-email-reminder] Missing required data: to, subject, or message");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required data",
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email format",
        },
        { status: 400 }
      );
    }

    // Get orgID from interview if _id is provided
    let orgID: string | null = null;
    if (_id) {
      try {
        const { db } = await connectMongoDB();
        const interview = await db
          .collection("interviews")
          .findOne({ _id: new ObjectId(_id) });
        if (interview?.orgID) {
          orgID = interview.orgID;
        }
      } catch (dbError) {
        console.error("Error fetching interview for orgID:", dbError);
      }
    }

    const { db } = await connectMongoDB();

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
      orgID = String(requestOrgID);
    } else if (orgID) {
      // Priority 2: Use orgID from interview
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

    if (!orgIdStr) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    const orgObjectId = new ObjectId(orgIdStr);

    // Fetch careerId from interview if _id is provided but careerId is not
    let finalCareerId = careerId;
    if (!finalCareerId && _id) {
      try {
        const interview = await db
          .collection("interviews")
          .findOne({ _id: new ObjectId(_id) });

        if (interview) {
          // Check if interview already has careerId or careerID
          if (interview.careerId || interview.careerID) {
            finalCareerId = interview.careerId || interview.careerID;
          } else if (interview.id) {
            // Look up career by id field (interview.id matches career.id)
            const career = await db
              .collection("careers")
              .findOne({ id: interview.id });
            if (career && career._id) {
              finalCareerId = career._id.toString();
              console.log("Career ID fetched from interview:", finalCareerId);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching career from interview:", error);
        // Continue without careerId if lookup fails
      }
    }

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
      to: [to],
      subject: subject,
      html: message,
      orgID: orgID,
    };

    let mgResult: any = null;
    try {
      mgResult = await mg.messages.create(domain, messageData);
    } catch (err) {
      console.error("Mailgun send error", err);
      return NextResponse.json(
        { error: "Mailgun send failed", details: String(err) },
        { status: 500 }
      );
    }

    // Manage thread record
    const normSubject = subject;
    const threadQuery: any = {
      organizationId: orgObjectId,
      normalizedSubject: normSubject,
    };
    if (finalCareerId) {
      try {
        threadQuery.careerId = new ObjectId(finalCareerId);
      } catch (e) {
        threadQuery.careerId = finalCareerId;
      }
    } else {
      threadQuery.$or = [{ careerId: null }, { careerId: { $exists: false } }];
    }

    let thread = await db.collection("mailgun-threads").findOne(threadQuery);

    if (!thread) {
      const threadIdStr = new ObjectId().toHexString();
      const insertThread = {
        applicantId: null,
        organizationId: orgObjectId,
        subject,
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
      thread = await db
        .collection("mailgun-threads")
        .findOne({ _id: tRes.insertedId });
    } else {
      // Ensure mailgun account is listed in participants
      const participantId =
        typeof mgAccount._id === "object"
          ? mgAccount._id
          : String(mgAccount._id);
      await db.collection("mailgun-threads").updateOne(
        { _id: thread._id },
        {
          $set: { lastUpdated: new Date(), updatedAt: new Date() },
          $addToSet: { participants: participantId },
        }
      );
    }

    // Get member record for recruiterId
    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: orgIdStr },
        { orgID: orgObjectId },
        { organizationId: orgIdStr },
        { organizationId: orgObjectId },
      ],
    });

    // Persist mailgun message record
    const messageDoc: any = {
      threadId: thread._id,
      from: fromAddress,
      to: [to],
      cc: [],
      bcc: [],
      html: message || null,
      text: null,
      attachments: [],
      careerId: finalCareerId
        ? ObjectId.isValid(String(finalCareerId))
          ? new ObjectId(String(finalCareerId))
          : finalCareerId
        : null,
      direction: "outbound",
      isAutomated: true,
      mailgunMessageId: mgResult?.id || mgResult?.message || null,
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

    // Update lastAutoReminder in database if _id is provided
    if (_id) {
      try {
        await db
          .collection("interviews")
          .updateOne(
            { _id: new ObjectId(_id) },
            { $set: { lastAutoReminder: new Date() } }
          );
      } catch (dbError) {
        console.error("Error updating lastAutoReminder:", dbError);
        // Don't fail the email sending if DB update fails
      }
    }

    await db.collection("recruiter-history").insertOne({
      interviewUID: _id,
      orgID: orgIdStr,
      action: "Sent Email Reminder",
      recruiterEmail: userEmail,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      data: {
        messageId: insertMsg.insertedId,
        mailgunResult: mgResult,
        threadId: thread.threadId || thread._id,
      },
    });
  } catch (error) {
    console.error("Error in send-email-reminder endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
});
