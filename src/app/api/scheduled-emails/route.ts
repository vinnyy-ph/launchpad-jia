import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { isValidObjectId } from "@/lib/utils/requisitionAuthGuard";

/**
 * GET /api/scheduled-emails
 * 
 * Fetches scheduled emails from the schedule-email collection
 * 
 * Query params:
 * - orgID: Organization ID (required)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - status: Filter by status (active, sent, failed, cancelled)
 * - search: Search by recipient email or subject
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const orgID = searchParams.get("orgID");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status") || null;
    const search = searchParams.get("search") || "";

    if (!orgID) {
      return NextResponse.json(
        { error: "Organization ID (orgID) is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const scheduleEmailCollection = db.collection("schedule-email");

    // Build query - orgID is stored as string in the database (e.g., "682d3fc222462d03263b0881")
    const query: any = {
      orgID: String(orgID), // Match orgID as string
    };

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Add search filter (recipient email or subject)
    if (search.trim()) {
      query.$and = [
        { orgID: String(orgID) },
        {
          $or: [
            { to: { $regex: search, $options: "i" } },
            { subject: { $regex: search, $options: "i" } },
          ],
        },
      ];
      // Remove orgID from top level since it's in $and
      delete query.orgID;
    }

    console.log("Scheduled emails query:", JSON.stringify(query, null, 2));
    console.log("orgID received:", orgID);

    // Calculate skip
    const skip = (page - 1) * limit;

    // Fetch scheduled emails with pagination
    // Sort: Most recent sendDate first (upcoming emails will show first, then sent emails)
    const [scheduledEmails, totalCount] = await Promise.all([
      scheduleEmailCollection
        .find(query)
        .sort({ 
          sendDate: -1, // Most recent sendDate first (future dates first, then past dates)
          createdAt: -1 // Then by createdAt descending (most recently created first)
        })
        .skip(skip)
        .limit(limit)
        .toArray(),
      scheduleEmailCollection.countDocuments(query),
    ]);

    console.log(
      `Found ${scheduledEmails.length} scheduled emails out of ${totalCount} total`,
    );

    // Fetch sender images for all scheduled emails
    const senderEmails = scheduledEmails
      .map((email) => {
        const match = String(email.sender || "").match(/<([^>]+)>/);
        return match
          ? match[1].toLowerCase()
          : String(email.sender || "").toLowerCase();
      })
      .filter(Boolean);

    // Map sender email -> userId from mailgun-accounts
    const emailToUserIdMap: Record<string, string> = {};
    if (senderEmails.length > 0) {
      const accounts = await db
        .collection("mailgun-accounts")
        .find({ email: { $in: senderEmails } })
        .toArray();
      for (const acc of accounts) {
        if (acc.email && acc.userId) {
          emailToUserIdMap[String(acc.email).toLowerCase()] = String(
            acc.userId,
          );
        }
      }
    }

    // Get unique userIds
    const userIds = Array.from(new Set(Object.values(emailToUserIdMap)));

    // Fetch member images from members collection
    const memberImagesByUserId: Record<string, string> = {};
    if (userIds.length > 0) {
      const members = await db
        .collection("members")
        .find({ userId: { $in: userIds } })
        .toArray();
      for (const member of members) {
        if (member.userId && member.image) {
          memberImagesByUserId[String(member.userId)] = member.image;
        }
      }
    }

    // Fetch applicant images
    const applicantImages: Record<string, string> = {};
    if (senderEmails.length > 0) {
      const applicants = await db
        .collection("applicants")
        .find({
          $or: [
            { email: { $in: senderEmails } },
            { emailAddress: { $in: senderEmails } },
            { email_address: { $in: senderEmails } },
            { contactEmail: { $in: senderEmails } },
          ],
        })
        .toArray();

      for (const applicant of applicants) {
        const email =
          applicant.email ||
          applicant.emailAddress ||
          applicant.email_address ||
          applicant.contactEmail;
        if (email) {
          applicantImages[String(email).toLowerCase()] =
            applicant.image || null;
        }
      }
    }

    // Format the response - include all fields from the sample data
    const formattedEmails = scheduledEmails.map((email) => {
      // Extract sender email
      const senderEmail = (() => {
        if (!email.sender) return null;
        const match = String(email.sender).match(/<([^>]+)>/);
        return match
          ? match[1].toLowerCase()
          : String(email.sender).toLowerCase();
      })();

      // Determine sender image: check org member first, then applicant
      let senderImage: string | null = null;
      if (senderEmail && emailToUserIdMap[senderEmail]) {
        const userId = emailToUserIdMap[senderEmail];
        senderImage = memberImagesByUserId[userId] || null;
      }
      if (!senderImage && senderEmail) {
        senderImage = applicantImages[senderEmail] || null;
      }

      return {
        _id: email._id.toString(),
        body: email.body,
        subject: email.subject,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        sender: email.sender,
        senderImage: senderImage,
        mode: email.mode,
        status: email.status,
        sendDate: email.sendDate,
        accountId: email.accountId,
        userId: email.userId,
        scheduleDelay: email.scheduleDelay,
        scheduleDelayUnit: email.scheduleDelayUnit,
        enablePreferredTime: email.enablePreferredTime,
        preferredTime: email.preferredTime,
        orgID: email.orgID,
        careerId: email.careerId,
        threadId: email.threadId || null,
        interviewId: email.interviewId,
        templateId: email.templateId,
        createdAt: email.createdAt,
        updatedAt: email.updatedAt,
        gmailMessageId: email.gmailMessageId || null,
        sentAt: email.sentAt || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedEmails,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching scheduled emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled emails", details: error.message },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/scheduled-emails
 * 
 * Deletes a scheduled email from the schedule-email collection
 * 
 * Query params:
 * - _id: Scheduled email ID (required)
 * - orgID: Organization ID (required)
 */
export const DELETE = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const _id = searchParams.get("_id");
    const orgID = searchParams.get("orgID");

    // Validate required fields
    if (!_id) {
      return NextResponse.json(
        { success: false, error: "Scheduled email ID (_id) is required" },
        { status: 400 }
      );
    }

    if (!orgID) {
      return NextResponse.json(
        { success: false, error: "Organization ID (orgID) is required" },
        { status: 400 }
      );
    }

    // Validate ObjectId format (prevents injection via ID)
    if (!isValidObjectId(_id)) {
      return NextResponse.json(
        { success: false, error: "Invalid scheduled email ID format" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const scheduleEmailCollection = db.collection("schedule-email");

    // Find the existing scheduled email
    const existingEmail = await scheduleEmailCollection.findOne({
      _id: new ObjectId(_id),
    });

    if (!existingEmail) {
      return NextResponse.json(
        { success: false, error: "Scheduled email not found" },
        { status: 404 }
      );
    }

    // Verify organization access - ensure the email belongs to the specified org
    if (String(existingEmail.orgID) !== String(orgID)) {
      return NextResponse.json(
        { success: false, error: "Organization access denied" },
        { status: 403 }
      );
    }

    // Delete the scheduled email
    const result = await scheduleEmailCollection.deleteOne({
      _id: new ObjectId(_id),
      orgID: String(orgID), // Additional safety check
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to delete scheduled email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Scheduled email deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting scheduled email:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete scheduled email", details: error.message },
      { status: 500 }
    );
  }
});
