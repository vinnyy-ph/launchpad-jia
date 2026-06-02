import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const orgId =
      url.searchParams.get("orgId") || url.searchParams.get("orgID");
    const q = url.searchParams.get("q") || "";

    if (!orgId || !ObjectId.isValid(orgId)) {
      return NextResponse.json(
        { message: "Invalid or missing orgId" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const orgObjectId = new ObjectId(orgId);

    // Verify membership and get user role
    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: orgId },
        { orgID: orgObjectId },
        { organizationId: orgId },
        { organizationId: orgObjectId },
      ],
    });
    if (!memberInOrg)
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const userRole = memberInOrg.role || null;
    const isHiringManager = userRole === "hiring_manager";

    // Fetch all mailgun accounts for the organization to get user's email addresses
    const allAccounts = await db
      .collection("mailgun-accounts")
      .find({ organizationId: orgObjectId })
      .toArray();

    // Get user's mailgun account email(s) - needed for filtering hiring_manager messages
    const userMailgunEmails: string[] = [];
    if (isHiringManager) {
      // Find accounts belonging to this user
      const userAccounts = allAccounts.filter((acc: any) => {
        if (!acc.userId) return false;
        // Check if userId matches member's _id
        return String(acc.userId) === String(memberInOrg._id);
      });
      // Extract email addresses
      for (const acc of userAccounts) {
        if (acc.email) {
          userMailgunEmails.push(String(acc.email).toLowerCase());
        }
      }
      // Also include the user's direct email as a fallback
      if (userEmail) {
        userMailgunEmails.push(String(userEmail).toLowerCase());
      }
    }

    // If no query provided, return empty or fallback to fetch-messages behavior
    const trimmed = String(q || "").trim();
    if (!trimmed) {
      return NextResponse.json({ messages: [] }, { status: 200 });
    }

    const re = new RegExp(escapeRegex(trimmed), "i");

    // Build thread query
    const threadQuery: any = {
      organizationId: orgObjectId,
      subject: { $regex: re },
    };

    // Find threads whose subject matches the query
    const matchingThreads = await db
      .collection("mailgun-threads")
      .find(threadQuery)
      .project({ _id: 1 })
      .toArray();
    const threadIdsFromThreads = matchingThreads.map((t: any) => String(t._id));

    // Build message-level search filters
    const searchFilters: any[] = [
      { subject: { $regex: re } },
      { from: { $regex: re } },
      { toRaw: { $regex: re } },
      { text: { $regex: re } },
      { html: { $regex: re } },
      { "attachments.filename": { $regex: re } },
    ];

    // Also include messages whose threadId is in matching threads
    if (threadIdsFromThreads.length) {
      searchFilters.push({
        threadId: {
          $in: threadIdsFromThreads.map((id) =>
            ObjectId.isValid(id) ? new ObjectId(id) : id
          ),
        },
      });
    }

    const msgQuery: any = {
      organizationId: orgObjectId,
      $or: searchFilters,
    };

    // If user is a hiring_manager, add filtering to only their own messages
    if (isHiringManager && userMailgunEmails.length > 0) {
      // Build user email filters
      const userEmailFilters: any[] = [];

      // User is the sender (from field matches user's email)
      for (const email of userMailgunEmails) {
        userEmailFilters.push({
          from: { $regex: new RegExp(escapeRegex(email), "i") },
        });
      }

      // User is a recipient (to field contains user's email)
      for (const email of userMailgunEmails) {
        userEmailFilters.push(
          { to: { $regex: new RegExp(escapeRegex(email), "i") } },
          { toRaw: { $regex: new RegExp(escapeRegex(email), "i") } },
          { toList: { $in: [email] } }
        );
      }

      // Also check recruiterId matches user's member _id (for outbound messages)
      userEmailFilters.push({ recruiterId: memberInOrg._id });

      // Combine: message must match search query AND be from/to user
      msgQuery.$and = [
        { organizationId: orgObjectId },
        { $or: searchFilters },
        { $or: userEmailFilters },
      ];
      delete msgQuery.$or; // Remove the top-level $or since we're using $and now
    }

    const msgs = await db
      .collection("mailgun-messages")
      .find(msgQuery)
      .sort({ createdAt: -1 })
      .limit(1000)
      .toArray();

    // Normalize messages similar to mg-fetch-messages
    const threadIds: string[] = Array.from(
      new Set(msgs.map((m: any) => String(m.threadId || "")))
    ).filter(Boolean) as string[];

    const validObjectIdStrings = threadIds.filter((id: string) =>
      ObjectId.isValid(String(id))
    );
    const invalidIdStrings = threadIds.filter(
      (id: string) => !ObjectId.isValid(String(id))
    );

    let threads: any[] = [];
    if (validObjectIdStrings.length || invalidIdStrings.length) {
      const orF: any[] = [];
      if (validObjectIdStrings.length) {
        orF.push({
          _id: {
            $in: validObjectIdStrings.map((id) => new ObjectId(String(id))),
          },
        });
      }
      if (invalidIdStrings.length) {
        orF.push({ threadId: { $in: invalidIdStrings } });
      }
      threads = await db
        .collection("mailgun-threads")
        .find({ $or: orF })
        .toArray();
    }

    const threadMap: any = {};
    for (const t of threads) threadMap[String(t._id)] = t;

    // Resolve career titles for the messages/threads
    const careerIdSet = new Set<string>();
    const addCareerId = (v: any) => {
      if (!v) return;
      try {
        careerIdSet.add(String(v));
      } catch (e) {
        /* ignore */
      }
    };
    for (const m of msgs) addCareerId(m.careerId || m.careerID || m.career);
    for (const t of threads) addCareerId(t.careerId);

    const careerTitleById: Record<string, string> = {};
    if (careerIdSet.size > 0) {
      const allIds = Array.from(careerIdSet);
      const objectIds = allIds.filter((id) => ObjectId.isValid(String(id)));
      const stringIds = allIds.filter((id) => !ObjectId.isValid(String(id)));

      if (objectIds.length > 0) {
        const careers = await db
          .collection("careers")
          .find(
            { _id: { $in: objectIds.map((id) => new ObjectId(String(id))) } },
            { projection: { jobTitle: 1 } }
          )
          .toArray();
        for (const c of careers) {
          careerTitleById[String(c._id)] = c.jobTitle || "";
        }
      }

      // Fallback: some careerIds are stored as string IDs in the `id` field
      if (stringIds.length > 0) {
        const careersByString = await db
          .collection("careers")
          .find(
            { id: { $in: stringIds } },
            { projection: { jobTitle: 1, id: 1 } }
          )
          .toArray();
        for (const c of careersByString) {
          if (c.id) careerTitleById[String(c.id)] = c.jobTitle || "";
        }
      }
    }

    const emailToUserIdMap: Record<string, string> = {};
    for (const acc of allAccounts) {
      if (acc.email && acc.userId) {
        emailToUserIdMap[String(acc.email).toLowerCase()] = String(acc.userId);
      }
    }

    // Extract all unique userIds from accounts to fetch member images
    const userIds = Array.from(new Set(Object.values(emailToUserIdMap))).filter(
      Boolean
    ) as string[];

    // Extract all unique sender emails for applicants lookup
    const senderEmails = Array.from(
      new Set(
        msgs
          .map((m: any) => {
            if (!m.from) return null;
            // Parse email from "DisplayName <email>" format or plain email
            const match = String(m.from).match(/<([^>]+)>/);
            if (match && match[1]) {
              return match[1].toLowerCase();
            }
            const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
            const emailMatch = String(m.from).match(emailRegex);
            return emailMatch ? emailMatch[0].toLowerCase() : null;
          })
          .filter(Boolean)
      )
    ) as string[];

    // Fetch member images using userIds (for org members)
    const memberImagesByUserId: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const validObjectIds = userIds.filter((id) => ObjectId.isValid(id));
      if (validObjectIds.length > 0) {
        const members = await db
          .collection("members")
          .find({ _id: { $in: validObjectIds.map((id) => new ObjectId(id)) } })
          .toArray();

        for (const member of members) {
          memberImagesByUserId[String(member._id)] = member.image || null;
        }
      }
    }

    // Fetch applicant images for external senders
    const applicantImages: Record<string, string | null> = {};
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

    const norm = msgs.map((m: any) => {
      // Extract sender email
      const senderEmail = (() => {
        if (!m.from) return null;
        const match = String(m.from).match(/<([^>]+)>/);
        return match ? match[1].toLowerCase() : String(m.from).toLowerCase();
      })();

      const thread = m.threadId ? threadMap[String(m.threadId)] : null;
      const resolvedCareerId = m.careerId
        ? String(m.careerId)
        : thread && thread.careerId
        ? String(thread.careerId)
        : null;
      const careerTitle = resolvedCareerId
        ? careerTitleById[resolvedCareerId] || null
        : null;
      const threadCareerId =
        thread && thread.careerId ? String(thread.careerId) : null;
      const threadCareerTitle = threadCareerId
        ? careerTitleById[threadCareerId] || null
        : null;

      // Determine sender image: check if org member first, then applicant
      let senderImage: string | null = null;

      if (senderEmail && emailToUserIdMap[senderEmail]) {
        const userId = emailToUserIdMap[senderEmail];
        senderImage = memberImagesByUserId[userId] || null;
      }

      if (!senderImage && senderEmail) {
        senderImage = applicantImages[senderEmail] || null;
      }

      return {
        _id: String(m._id),
        threadId: m.threadId ? String(m.threadId) : null,
        from: m.from,
        toRaw: m.toRaw || m.to || null,
        toList: Array.isArray(m.toList)
          ? m.toList
          : m.to && Array.isArray(m.to)
          ? m.to
          : m.toList || [],
        to: m.to,
        subject: m.subject || threadMap[String(m.threadId)]?.subject || null,
        text: m.text || null,
        html: m.html || null,
        attachments: m.attachments || m.draftAttachments || [],
        draftAttachments: m.draftAttachments || [],
        careerId: resolvedCareerId,
        careerTitle: careerTitle,
        jobTitle: careerTitle,
        threadCareerId: threadCareerId,
        threadCareerTitle: threadCareerTitle,
        direction: m.direction || null,
        isDraft: !!(
          m.isDraft ||
          m.is_draft ||
          m.draft ||
          (typeof m.status === "string" &&
            m.status.toLowerCase() === "draft") ||
          (typeof m.direction === "string" &&
            m.direction.toLowerCase() === "draft")
        ),
        mailgunMessageId: m.mailgunMessageId || null,
        createdAt: m.createdAt || null,
        senderImage: senderImage,
      };
    });

    return NextResponse.json({ messages: norm }, { status: 200 });
  } catch (err) {
    console.error("search-messages error", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
});
