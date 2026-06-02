import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const templateType = searchParams.get("type") || "user"; // user, global, system
    const search = searchParams.get("search") || "";
    const dateFilter = searchParams.get("dateFilter") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const userEmail = searchParams.get("userEmail") || "";

    // For system templates, orgID is not required
    if (!orgID && templateType !== "system") {
      return NextResponse.json(
        { success: false, message: "Organization ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const templatesCollection = db.collection("templates");

    // Build query based on template type
    let query: any = {};

    if (templateType === "system") {
      // System templates don't require orgID
      query.templateType = "system";
    } else if (templateType === "global") {
      query.templateType = "global";
      query.orgID = orgID;
    } else {
      // For user templates, show only user-created templates
      query.templateType = "user";
      query.orgID = orgID;

      // Filter by user email for user-specific templates
      if (userEmail) {
        query.userEmail = userEmail;
      }
    }

    // Add search filter
    if (search.trim()) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { messagePreview: { $regex: search, $options: "i" } },
        { fullMessage: { $regex: search, $options: "i" } },
        { messageContent: { $regex: search, $options: "i" } },
      ];
    }

    // Add date filter
    if (dateFilter) {
      const now = new Date();
      let filterStartDate: Date;
      let filterEndDate: Date;

      switch (dateFilter) {
        case "today":
          filterStartDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          filterEndDate = new Date(now);
          filterEndDate.setHours(23, 59, 59, 999);
          break;
        case "week":
          filterStartDate = new Date(now);
          filterStartDate.setDate(filterStartDate.getDate() - 7);
          filterEndDate = new Date(now);
          filterEndDate.setHours(23, 59, 59, 999);
          break;
        case "month":
          filterStartDate = new Date(now);
          filterStartDate.setMonth(filterStartDate.getMonth() - 1);
          filterEndDate = new Date(now);
          filterEndDate.setHours(23, 59, 59, 999);
          break;
        case "quarter":
          filterStartDate = new Date(now);
          filterStartDate.setMonth(filterStartDate.getMonth() - 3);
          filterEndDate = new Date(now);
          filterEndDate.setHours(23, 59, 59, 999);
          break;
        case "year":
          filterStartDate = new Date(now);
          filterStartDate.setFullYear(filterStartDate.getFullYear() - 1);
          filterEndDate = new Date(now);
          filterEndDate.setHours(23, 59, 59, 999);
          break;
        case "custom":
          if (startDate && endDate) {
            filterStartDate = new Date(startDate);
            filterEndDate = new Date(endDate);
            filterEndDate.setHours(23, 59, 59, 999);
          } else {
            filterStartDate = new Date(0);
            filterEndDate = new Date();
          }
          break;
        default:
          filterStartDate = new Date(0); // All time
          filterEndDate = new Date();
      }

      query.dateCreated = {
        $gte: filterStartDate,
        $lte: filterEndDate,
      };
    }

    const templates = await templatesCollection
      .find(query)
      .sort({ dateCreated: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch email templates" },
      { status: 500 }
    );
  }
});

// POST - Create a new email template or duplicate existing one
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const {
      name,
      subject,
      messageContent,
      action,
      templateType = "user",
      orgID,
      variables = [],
      isActive = true,
      userEmail,
      createdBy,
      // Duplication fields
      duplicateFromId,
      newName,
    } = body;

    // Validate required fields
    if (!name || !subject || !messageContent) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, subject, and message content are required",
        },
        { status: 400 }
      );
    }

    // Validate action field
    if (!action || (action !== "endorse" && action !== "drop")) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Action field is required and must be either 'endorse' or 'drop'",
        },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const templatesCollection = db.collection("templates");

    // Import super admin list for system template validation
    const { superAdminList } = await import("@/lib/SuperAdminUtils");

    // Handle duplication
    if (duplicateFromId && newName) {
      if (!orgID) {
        return NextResponse.json(
          { success: false, message: "Organization ID is required" },
          { status: 400 }
        );
      }

      // Find the original template
      const originalTemplate = await templatesCollection.findOne({
        _id: new ObjectId(duplicateFromId),
        orgID,
      });

      if (!originalTemplate) {
        return NextResponse.json(
          { success: false, message: "Original template not found" },
          { status: 404 }
        );
      }

      // Check if a template with the new name and same action already exists
      const existingTemplate = await templatesCollection.findOne({
        name: newName,
        action: originalTemplate.action || "endorse",
        orgID,
        templateType: originalTemplate.templateType,
      });

      if (existingTemplate) {
        return NextResponse.json(
          {
            success: false,
            message: `A template with the name "${newName}" and action "${
              originalTemplate.action || "endorse"
            }" already exists for ${
              originalTemplate.templateType
            } templates. Please choose a different name or action.`,
          },
          { status: 409 }
        );
      }

      // Create the duplicate template
      const duplicatedTemplate = {
        ...originalTemplate,
        _id: undefined, // Remove the original ID
        name: newName,
        action: originalTemplate.action || "endorse", // Ensure action is preserved or defaulted
        dateCreated: new Date(),
        dateModified: new Date(),
        createdBy: body.createdBy || "system",
        isActive: true,
      };

      const result = await templatesCollection.insertOne(duplicatedTemplate);

      return NextResponse.json({
        success: true,
        message: "Email template duplicated successfully",
        data: { _id: result.insertedId, ...duplicatedTemplate },
      });
    }

    // Handle new template creation
    // Validation
    if (!name || !subject || !messageContent) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate userEmail is not null for user templates
    if (
      templateType === "user" &&
      (!userEmail || userEmail === null || userEmail === undefined)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "User email is required for user templates",
        },
        { status: 400 }
      );
    }

    // System templates require super admin access
    if (templateType === "system") {
      if (!userEmail || !superAdminList.includes(userEmail)) {
        return NextResponse.json(
          {
            success: false,
            message: "Only super admins can create system templates",
          },
          { status: 403 }
        );
      }
      // System templates don't require orgID
    } else {
      // User and global templates require orgID
      if (!orgID) {
        return NextResponse.json(
          { success: false, message: "Organization ID is required" },
          { status: 400 }
        );
      }

      // User templates require userEmail
      if (templateType === "user" && !userEmail) {
        return NextResponse.json(
          {
            success: false,
            message: "User email is required for user templates",
          },
          { status: 400 }
        );
      }
    }

    // Note: Duplicate validation is now handled below with proper action field checking

    // Create message preview (first 100 characters, strip HTML tags)
    const textContent = messageContent.replace(/<[^>]*>/g, "").trim();
    const messagePreview =
      textContent.length > 100
        ? textContent.substring(0, 100) + "..."
        : textContent;

    // Convert HTML token pills in subject to plain text
    const convertHtmlTokensToPlainText = (htmlContent: string): string => {
      if (!htmlContent) return "";

      let plainText = htmlContent;

      // Replace HTML token pills with plain text tokens
      plainText = plainText
        .replace(
          /<span[^>]*data-token="\[\[([^\]]+)\]\]"[^>]*>([^<]+)<\/span>/g,
          "[[$1]]"
        )
        .replace(
          /<span[^>]*class="[^"]*token-pill[^"]*"[^>]*>([^<]+)<\/span>/g,
          "[[$1]]"
        )
        .replace(
          /<span[^>]*class="[^"]*em-dynamic-var[^"]*"[^>]*>([^<]+)<\/span>/g,
          "[[$1]]"
        );

      return plainText;
    };

    const plainTextSubject = convertHtmlTokensToPlainText(subject);

    // Validation: Check for duplicate template with same name, action, and templateType
    const finalAction = action || "endorse";

    console.log("Template creation validation:", {
      name,
      action: finalAction,
      templateType,
      orgID: orgID || "",
      userEmail: userEmail || "unknown",
      validationQuery: {
        name,
        action: finalAction,
        templateType,
        ...(templateType === "system" ? {} : { orgID: orgID || "" }),
        ...(templateType === "user"
          ? { userEmail: userEmail || "unknown" }
          : {}),
      },
    });

    const duplicateTemplate = await templatesCollection.findOne({
      name,
      action: finalAction,
      templateType,
      ...(templateType === "system" ? {} : { orgID: orgID || "" }),
      ...(templateType === "user" ? { userEmail: userEmail || "unknown" } : {}),
    });

    if (duplicateTemplate) {
      console.log("Duplicate template found:", {
        existingTemplate: {
          name: duplicateTemplate.name,
          action: duplicateTemplate.action,
          templateType: duplicateTemplate.templateType,
          orgID: duplicateTemplate.orgID,
          userEmail: duplicateTemplate.userEmail,
        },
      });

      return NextResponse.json(
        {
          success: false,
          message: `A template with the name "${name}" and action "${finalAction}" already exists for ${templateType} templates. Please choose a different name or action.`,
        },
        { status: 409 }
      );
    }

    const newTemplate = {
      name,
      subject: plainTextSubject,
      messageContent,
      messagePreview,
      action: action || "endorse", // Ensure action is never null/undefined
      templateType,
      orgID: templateType === "system" ? null : orgID || "", // System templates don't have orgID
      variables,
      isActive,
      dateCreated: new Date(),
      dateModified: new Date(),
      createdBy: createdBy || userEmail || "system",
      userEmail: templateType === "user" ? userEmail || "unknown" : null, // Only user templates store user email
    };

    const result = await templatesCollection.insertOne(newTemplate);

    return NextResponse.json({
      success: true,
      message: "Email template created successfully",
      data: { _id: result.insertedId, ...newTemplate },
    });
  } catch (error) {
    console.error("Error creating email template:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create email template" },
      { status: 500 }
    );
  }
});

// PUT - Update an existing email template
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const {
      _id,
      name,
      subject,
      messageContent,
      action,
      templateType,
      variables,
      isActive,
      orgID,
      userEmail,
    } = body;

    if (!_id) {
      return NextResponse.json(
        {
          success: false,
          message: "Template ID is required",
        },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const templatesCollection = db.collection("templates");

    // Import super admin list for system template validation
    const { superAdminList } = await import("@/lib/SuperAdminUtils");

    // Find the existing template
    const existingTemplate = await templatesCollection.findOne({
      _id: new ObjectId(_id),
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }

    // Check access permissions based on template type
    if (existingTemplate.templateType === "system") {
      // System templates can only be edited by super admins
      if (!userEmail || !superAdminList.includes(userEmail)) {
        return NextResponse.json(
          {
            success: false,
            message: "Only super admins can edit system templates",
          },
          { status: 403 }
        );
      }
    } else if (existingTemplate.templateType === "user") {
      // User templates can only be edited by their creator
      if (!userEmail || existingTemplate.userEmail !== userEmail) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only edit your own user templates",
          },
          { status: 403 }
        );
      }
      // Also verify organization access
      if (!orgID || existingTemplate.orgID !== orgID) {
        return NextResponse.json(
          { success: false, message: "Organization access denied" },
          { status: 403 }
        );
      }
    } else if (existingTemplate.templateType === "global") {
      // Global templates can be edited by anyone in the organization
      if (!orgID || existingTemplate.orgID !== orgID) {
        return NextResponse.json(
          { success: false, message: "Organization access denied" },
          { status: 403 }
        );
      }
    }

    // Validation: Check for duplicate template with same name, action, and templateType
    // Only validate if name or action is being changed
    if (name !== undefined || action !== undefined) {
      const finalName = name !== undefined ? name : existingTemplate.name;
      const finalAction =
        action !== undefined ? action : existingTemplate.action;

      console.log("Template update validation:", {
        templateId: _id,
        finalName,
        finalAction,
        templateType: existingTemplate.templateType,
        orgID: existingTemplate.orgID,
        userEmail: existingTemplate.userEmail,
        validationQuery: {
          _id: { $ne: new ObjectId(_id) },
          name: finalName,
          action: finalAction,
          templateType: existingTemplate.templateType,
          ...(existingTemplate.templateType === "system"
            ? {}
            : { orgID: existingTemplate.orgID }),
          ...(existingTemplate.templateType === "user"
            ? { userEmail: existingTemplate.userEmail }
            : {}),
        },
      });

      const duplicateTemplate = await templatesCollection.findOne({
        _id: { $ne: new ObjectId(_id) }, // Exclude current template
        name: finalName,
        action: finalAction,
        templateType: existingTemplate.templateType,
        ...(existingTemplate.templateType === "system"
          ? {}
          : { orgID: existingTemplate.orgID }),
        ...(existingTemplate.templateType === "user"
          ? { userEmail: existingTemplate.userEmail }
          : {}),
      });

      if (duplicateTemplate) {
        return NextResponse.json(
          {
            success: false,
            message: `A template with the name "${finalName}" and action "${finalAction}" already exists for ${existingTemplate.templateType} templates. Please choose a different name or action.`,
          },
          { status: 409 }
        );
      }
    }

    // Build update object
    const updateData: any = {
      dateModified: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (subject !== undefined) {
      // Convert HTML token pills in subject to plain text
      const convertHtmlTokensToPlainText = (htmlContent: string): string => {
        if (!htmlContent) return "";

        let plainText = htmlContent;

        // Replace HTML token pills with plain text tokens
        plainText = plainText
          .replace(
            /<span[^>]*data-token="\[\[([^\]]+)\]\]"[^>]*>([^<]+)<\/span>/g,
            "[[$1]]"
          )
          .replace(
            /<span[^>]*class="[^"]*token-pill[^"]*"[^>]*>([^<]+)<\/span>/g,
            "[[$1]]"
          )
          .replace(
            /<span[^>]*class="[^"]*em-dynamic-var[^"]*"[^>]*>([^<]+)<\/span>/g,
            "[[$1]]"
          );

        return plainText;
      };

      updateData.subject = convertHtmlTokensToPlainText(subject);
    }
    if (messageContent !== undefined) {
      updateData.messageContent = messageContent;
      const textContent = messageContent.replace(/<[^>]*>/g, "").trim();
      updateData.messagePreview =
        textContent.length > 100
          ? textContent.substring(0, 100) + "..."
          : textContent;
    }
    if (templateType !== undefined) updateData.templateType = templateType;
    if (variables !== undefined) updateData.variables = variables;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Build query based on template type
    const query: any = { _id: new ObjectId(_id) };
    if (existingTemplate.templateType !== "system") {
      query.orgID = orgID;
    }

    const result = await templatesCollection.updateOne(query, {
      $set: updateData,
    });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email template updated successfully",
    });
  } catch (error) {
    console.error("Error updating email template:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update email template" },
      { status: 500 }
    );
  }
});

// DELETE - Delete an email template
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const _id = searchParams.get("_id");
    const orgID = searchParams.get("orgID");
    const userEmail = searchParams.get("userEmail");

    if (!_id) {
      return NextResponse.json(
        {
          success: false,
          message: "Template ID is required",
        },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const templatesCollection = db.collection("templates");

    // Find the existing template
    const existingTemplate = await templatesCollection.findOne({
      _id: new ObjectId(_id),
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }

    // Check access permissions based on template type
    if (existingTemplate.templateType === "system") {
      // System templates cannot be deleted by anyone
      return NextResponse.json(
        { success: false, message: "System templates cannot be deleted" },
        { status: 403 }
      );
    } else if (existingTemplate.templateType === "user") {
      // User templates can only be deleted by their creator
      if (!userEmail || existingTemplate.userEmail !== userEmail) {
        return NextResponse.json(
          {
            success: false,
            message: "You can only delete your own user templates",
          },
          { status: 403 }
        );
      }
      // Also verify organization access
      if (!orgID || existingTemplate.orgID !== orgID) {
        return NextResponse.json(
          { success: false, message: "Organization access denied" },
          { status: 403 }
        );
      }
    } else if (existingTemplate.templateType === "global") {
      // Global templates can be deleted by anyone in the organization
      if (!orgID || existingTemplate.orgID !== orgID) {
        return NextResponse.json(
          { success: false, message: "Organization access denied" },
          { status: 403 }
        );
      }
    }

    // Build query based on template type
    const query: any = { _id: new ObjectId(_id) };
    if (existingTemplate.templateType !== "system") {
      query.orgID = orgID;
    }

    const result = await templatesCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email template deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting email template:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete email template" },
      { status: 500 }
    );
  }
});
