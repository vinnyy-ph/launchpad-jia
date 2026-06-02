import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const userEmail = request.user?.email;

    if (!orgID) {
      return NextResponse.json(
        { success: false, message: "Organization ID is required" },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();
    const emailTemplatesModel = db.collection("email-templates");
    const membersModel = db.collection("members");

    // PERMISSION CHECKING
    const isMember = await membersModel.findOne({
      orgID: orgID,
      email: userEmail,
    });

    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden. You do not have the required permissions.",
        },
        { status: 403 },
      );
    }

    // FETCH TEMPLATES
    // User can see: their own User templates, all Global templates, and all System templates
    const templates = await emailTemplatesModel
      .find({
        orgID: orgID,
        $or: [
          { type: { $ne: "User" } }, // Global or System
          { creatorID: isMember._id.toString() }, // User's own templates
        ],
      })
      .sort({ dateUpdated: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      templates: templates.map((t) => ({
        _id: t._id.toString(),
        template_id: t._id.toString(),
        template_name: t.template_name,
        name: t.template_name,
        subject: t.subject,
        message: t.message,
        messageContent: t.message,
        fullMessage: t.message,
        type: t.type,
        templateType: t.type?.toLowerCase(),
        dateCreated: t.dateCreated,
        dateUpdated: t.dateUpdated,
        date_created: t.dateCreated,
        date_updated: t.dateUpdated,
        creatorID: t.creatorID,
        orgID: t.orgID,
        isActive: true,
        schedule_delay: t.schedule_delay,
        schedule_delay_unit: t.schedule_delay_unit,
      })),
      count: templates.length,
    });
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch email templates" },
      { status: 500 },
    );
  }
});
