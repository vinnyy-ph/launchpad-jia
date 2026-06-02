import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

// GET - Fetch a specific email template by ID
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const userEmail = searchParams.get("userEmail");

    // Extract id from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    const { db } = await connectMongoDB();
    const templatesCollection = db.collection("templates");

    // First, get the template to check its type
    const template = await templatesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!template) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }

    // For system templates, no additional filtering needed
    if (template.templateType === "system") {
      return NextResponse.json({
        success: true,
        data: template,
      });
    }

    // For other templates, require orgID
    if (!orgID) {
      return NextResponse.json(
        { success: false, message: "Organization ID is required" },
        { status: 400 }
      );
    }

    // Build query with user email filtering for user templates
    const query: any = {
      _id: new ObjectId(id),
      orgID,
    };

    // For user templates, also filter by user email
    if (userEmail && template.templateType === "user") {
      query.userEmail = userEmail;
    }

    const filteredTemplate = await templatesCollection.findOne(query);

    if (!filteredTemplate) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredTemplate,
    });
  } catch (error) {
    console.error("Error fetching email template:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch email template" },
      { status: 500 }
    );
  }
});

// PUT - Update a specific email template
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { orgID, userEmail, ...updateData } = body;

    // Extract id from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    const { db } = await connectMongoDB();
    const templatesCollection = db.collection("templates");

    // Import super admin list for system template validation
    const { superAdminList } = await import("@/lib/SuperAdminUtils");

    // Find the existing template
    const existingTemplate = await templatesCollection.findOne({
      _id: new ObjectId(id),
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
    if (updateData.name !== undefined || updateData.action !== undefined) {
      const finalName =
        updateData.name !== undefined ? updateData.name : existingTemplate.name;
      const finalAction =
        updateData.action !== undefined
          ? updateData.action
          : existingTemplate.action;

      const duplicateTemplate = await templatesCollection.findOne({
        _id: { $ne: new ObjectId(id) }, // Exclude current template
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
    const updateFields: any = {
      dateModified: new Date(),
    };

    if (updateData.name !== undefined) updateFields.name = updateData.name;
    if (updateData.subject !== undefined) {
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

      updateFields.subject = convertHtmlTokensToPlainText(updateData.subject);
    }

    // Validate userEmail is not null for user templates
    if (
      updateData.userEmail !== undefined &&
      existingTemplate.templateType === "user"
    ) {
      if (
        !updateData.userEmail ||
        updateData.userEmail === null ||
        updateData.userEmail === undefined
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "User email is required for user templates",
          },
          { status: 400 }
        );
      }
      updateFields.userEmail = updateData.userEmail;
    }
    if (updateData.messageContent !== undefined) {
      updateFields.messageContent = updateData.messageContent;
      const textContent = updateData.messageContent
        .replace(/<[^>]*>/g, "")
        .trim();
      updateFields.messagePreview =
        textContent.length > 100
          ? textContent.substring(0, 100) + "..."
          : textContent;
    }
    if (updateData.action !== undefined) {
      // Validate action field
      if (
        updateData.action &&
        (updateData.action === "endorse" || updateData.action === "drop")
      ) {
        updateFields.action = updateData.action;
      } else {
        return NextResponse.json(
          {
            success: false,
            message: "Action field must be either 'endorse' or 'drop'",
          },
          { status: 400 }
        );
      }
    }
    if (updateData.templateType !== undefined)
      updateFields.templateType = updateData.templateType;
    if (updateData.variables !== undefined)
      updateFields.variables = updateData.variables;
    if (updateData.isActive !== undefined)
      updateFields.isActive = updateData.isActive;

    // Build query based on template type
    const query: any = { _id: new ObjectId(id) };
    if (existingTemplate.templateType !== "system") {
      query.orgID = orgID;
    }

    const result = await templatesCollection.updateOne(query, {
      $set: updateFields,
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

// DELETE - Delete a specific email template
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const userEmail = searchParams.get("userEmail");

    // Extract id from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    const { db } = await connectMongoDB();
    const templatesCollection = db.collection("templates");

    // Find the existing template
    const existingTemplate = await templatesCollection.findOne({
      _id: new ObjectId(id),
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
    const query: any = { _id: new ObjectId(id) };
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
