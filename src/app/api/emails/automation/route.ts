import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { isValidObjectId } from "@/lib/utils/requisitionAuthGuard";
import { defaultEmailAutomations } from "@/lib/data/emailAutomation";
import { recordEmailAutomationActivity } from "@/lib/utils/emailAutomationActivityLogger";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const body = await request.json();
    const { db } = await connectMongoDB();

    const created = await db
      .collection("automations")
      .insertOne({ ...body, createdAt: new Date(), updatedAt: new Date() });

    try {
      await recordEmailAutomationActivity({
        db,
        orgID: String(body?.orgID || ""),
        careerId: body?.careerId,
        actor: {
          uid: user?.uid,
          email: user?.email,
          name: (user as any)?.name,
          picture: (user as any)?.picture,
        },
        action: "Created Email Automation",
        automationName: body?.automation?.automation_name || "Untitled",
        stageName: body?.stage_name && body?.substage_name
          ? `${body.stage_name}: ${body.substage_name}`
          : body?.substage_name || body?.stage_name || "selected",
      });
    } catch (logError) {
      console.error("Failed to log created email automation activity:", logError);
    }

    return NextResponse.json({
      success: true,
      id: created.insertedId.toString(),
      message: "Automation created successfully",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to create automation" },
      { status: 500 }
    );
  }
});

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    const url = new URL(request.url);
    const orgID = url.searchParams.get("orgID");
    const careerId = url.searchParams.get("careerId");
    const automations = await db
      .collection("automations")
      .find({
        orgID,
        careerId,
      })
      .project({
        automation_id: "$_id",
        stage_id: 1,
        stage_name: 1,
        substage_id: 1,
        substage_name: 1,
        automation: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .sort({ "automation.default_automation_id": -1 })
      .toArray();
    return NextResponse.json(automations);
  } catch (error) {
    console.error(error);
  }
}

/**
 * PATCH /api/emails/automation
 *
 * Updates an email automation's active status
 *
 * Body:
 * - automation_id: Automation ID (required)
 * - orgID: Organization ID (required)
 * - active: Boolean status (required)
 */
export const PATCH = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user } = req;
    const body = await req.json();
    const { automation_id, orgID, active, careerId } = body;

    // Validate required fields
    if (!automation_id) {
      return NextResponse.json(
        { success: false, error: "Automation ID (automation_id) is required" },
        { status: 400 }
      );
    }

    if (!orgID) {
      return NextResponse.json(
        { success: false, error: "Organization ID (orgID) is required" },
        { status: 400 }
      );
    }

    if (typeof active !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Active status (active) must be a boolean" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const automationsCollection = db.collection("automations");

    // If automation_id contains "default", create a new document from defaultEmailAutomations
    if (String(automation_id).toLowerCase().includes("default")) {
      const defaultAutomation = defaultEmailAutomations.find(
        (d) =>
          d.automation_id === automation_id ||
          d.automation.default_automation_id === automation_id
      );

      if (!defaultAutomation) {
        return NextResponse.json(
          { success: false, error: "Default automation not found" },
          { status: 404 }
        );
      }

      if (!careerId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Career ID (careerId) is required when activating a default automation",
          },
          { status: 400 }
        );
      }

      const doc = {
        orgID: String(orgID),
        careerId: String(careerId),
        stage_id: defaultAutomation.stage_id,
        stage_name: defaultAutomation.stage_name,
        substage_id: defaultAutomation.substage_id,
        substage_name: defaultAutomation.substage_name,
        automation: {
          ...defaultAutomation.automation,
          active,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await automationsCollection.insertOne(doc);

      try {
        await recordEmailAutomationActivity({
          db,
          orgID: String(orgID),
          careerId: String(careerId),
          actor: {
            uid: user?.uid,
            email: user?.email,
            name: (user as any)?.name,
            picture: (user as any)?.picture,
          },
          action: active
            ? "Activated Email Automation"
            : "Deactivated Email Automation",
          automationName:
            defaultAutomation?.automation?.automation_name || "Untitled",
          stageName:
            defaultAutomation?.stage_name && defaultAutomation?.substage_name
              ? `${defaultAutomation.stage_name}: ${defaultAutomation.substage_name}`
              : defaultAutomation?.substage_name ||
                defaultAutomation?.stage_name ||
                "selected",
        });
      } catch (logError) {
        console.error("Failed to log automation toggle activity:", logError);
      }

      return NextResponse.json({
        success: true,
        message: `Automation ${
          active ? "activated" : "deactivated"
        } successfully`,
      });
    }

    // Validate ObjectId format (prevents injection via ID)
    if (!isValidObjectId(automation_id)) {
      return NextResponse.json(
        { success: false, error: "Invalid automation ID format" },
        { status: 400 }
      );
    }

    // Find the existing automation
    const existingAutomation = await automationsCollection.findOne({
      _id: new ObjectId(automation_id),
    });

    if (!existingAutomation) {
      return NextResponse.json(
        { success: false, error: "Automation not found" },
        { status: 404 }
      );
    }

    // Verify organization access - ensure the automation belongs to the specified org
    if (String(existingAutomation.orgID) !== String(orgID)) {
      return NextResponse.json(
        { success: false, error: "Organization access denied" },
        { status: 403 }
      );
    }

    // Update the automation's active status
    const result = await automationsCollection.updateOne(
      {
        _id: new ObjectId(automation_id),
        orgID: String(orgID), // Additional safety check
      },
      {
        $set: {
          "automation.active": active,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Automation not found" },
        { status: 404 }
      );
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: "No changes made to automation" },
        { status: 400 }
      );
    }

    try {
      await recordEmailAutomationActivity({
        db,
        orgID: String(orgID),
        careerId: existingAutomation?.careerId ? String(existingAutomation.careerId) : careerId ? String(careerId) : undefined,
        actor: {
          uid: user?.uid,
          email: user?.email,
          name: (user as any)?.name,
          picture: (user as any)?.picture,
        },
        action: active
          ? "Activated Email Automation"
          : "Deactivated Email Automation",
        automationName:
          existingAutomation?.automation?.automation_name || "Untitled",
        stageName:
          existingAutomation?.stage_name && existingAutomation?.substage_name
            ? `${existingAutomation.stage_name}: ${existingAutomation.substage_name}`
            : existingAutomation?.substage_name ||
              existingAutomation?.stage_name ||
              "selected",
      });
    } catch (logError) {
      console.error("Failed to log automation toggle activity:", logError);
    }

    return NextResponse.json({
      success: true,
      message: `Automation ${
        active ? "activated" : "deactivated"
      } successfully`,
    });
  } catch (error: any) {
    console.error("Error updating automation status:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update automation status",
        details: error.message,
      },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/emails/automation
 *
 * Updates an email automation's configuration
 * Note: stage_id, stage_name, substage_id, substage_name are preserved from existing document
 * Only the automation object fields are updated (automation_name, trigger_on_event, etc.)
 *
 * Body:
 * - automation_id: Automation ID (required)
 * - orgID: Organization ID (required)
 * - automation: Automation object with all fields (required)
 * - careerId: Career ID (optional, preserved if not provided)
 * - stage_id, stage_name, substage_id, substage_name: (optional, ignored - preserved from existing)
 */
export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user } = req;
    const body = await req.json();
    const {
      automation_id,
      orgID,
      stage_id,
      stage_name,
      substage_id,
      substage_name,
      automation,
      careerId,
    } = body;

    // Validate required fields
    if (!automation_id) {
      return NextResponse.json(
        { success: false, error: "Automation ID (automation_id) is required" },
        { status: 400 }
      );
    }

    if (!orgID) {
      return NextResponse.json(
        { success: false, error: "Organization ID (orgID) is required" },
        { status: 400 }
      );
    }

    if (!automation) {
      return NextResponse.json(
        { success: false, error: "Automation data is required" },
        { status: 400 }
      );
    }

    // Validate required automation fields
    if (
      !automation.automation_name ||
      !automation.trigger_on_event ||
      !automation.sender ||
      !automation.template_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Automation must include automation_name, trigger_on_event, sender, and template_id",
        },
        { status: 400 }
      );
    }

    // Ensure template_id is a string (not undefined)
    if (typeof automation.template_id !== "string") {
      return NextResponse.json(
        { success: false, error: "template_id must be a valid string" },
        { status: 400 }
      );
    }

    // Validate ObjectId format (prevents injection via ID)
    if (!isValidObjectId(automation_id)) {
      return NextResponse.json(
        { success: false, error: "Invalid automation ID format" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const automationsCollection = db.collection("automations");

    // Find the existing automation
    const existingAutomation = await automationsCollection.findOne({
      _id: new ObjectId(automation_id),
    });

    if (!existingAutomation) {
      return NextResponse.json(
        { success: false, error: "Automation not found" },
        { status: 404 }
      );
    }

    // Verify organization access - ensure the automation belongs to the specified org
    if (String(existingAutomation.orgID) !== String(orgID)) {
      return NextResponse.json(
        { success: false, error: "Organization access denied" },
        { status: 403 }
      );
    }

    // Update the automation with new data
    // Preserve existing stage/substage fields - only update the automation object itself
    // When editing, we don't change the stage/substage location, only the automation configuration
    const updateData: any = {
      automation,
      updatedAt: new Date(),
      orgID: String(orgID),
    };

    // Preserve careerId - use the one from request if provided, otherwise keep existing
    if (careerId) {
      updateData.careerId = careerId;
    } else if (existingAutomation.careerId) {
      updateData.careerId = existingAutomation.careerId;
    }

    // Note: stage_id, stage_name, substage_id, substage_name are NOT updated
    // They represent where the automation is located and should remain unchanged when editing

    const result = await automationsCollection.updateOne(
      {
        _id: new ObjectId(automation_id),
        orgID: String(orgID), // Additional safety check
      },
      {
        $set: updateData,
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Automation not found" },
        { status: 404 }
      );
    }

    try {
      await recordEmailAutomationActivity({
        db,
        orgID: String(orgID),
        careerId: careerId ? String(careerId) : existingAutomation?.careerId ? String(existingAutomation.careerId) : undefined,
        actor: {
          uid: user?.uid,
          email: user?.email,
          name: (user as any)?.name,
          picture: (user as any)?.picture,
        },
        action: "Updated Email Automation",
        automationName: automation?.automation_name || "Untitled",
        stageName:
          existingAutomation?.stage_name && existingAutomation?.substage_name
            ? `${existingAutomation.stage_name}: ${existingAutomation.substage_name}`
            : existingAutomation?.substage_name ||
              existingAutomation?.stage_name ||
              stage_name ||
              "selected",
      });
    } catch (logError) {
      console.error("Failed to log updated email automation activity:", logError);
    }

    return NextResponse.json({
      success: true,
      message: "Automation updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating automation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update automation",
        details: error.message,
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/emails/automation
 *
 * Deletes an email automation from the automations collection
 *
 * Query params:
 * - automation_id: Automation ID (required)
 * - orgID: Organization ID (required)
 */
export const DELETE = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const automation_id = searchParams.get("automation_id");
    const orgID = searchParams.get("orgID");

    // Validate required fields
    if (!automation_id) {
      return NextResponse.json(
        { success: false, error: "Automation ID (automation_id) is required" },
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
    if (!isValidObjectId(automation_id)) {
      return NextResponse.json(
        { success: false, error: "Invalid automation ID format" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const automationsCollection = db.collection("automations");

    // Find the existing automation
    const existingAutomation = await automationsCollection.findOne({
      _id: new ObjectId(automation_id),
    });

    if (!existingAutomation) {
      return NextResponse.json(
        { success: false, error: "Automation not found" },
        { status: 404 }
      );
    }

    // Verify organization access - ensure the automation belongs to the specified org
    if (String(existingAutomation.orgID) !== String(orgID)) {
      return NextResponse.json(
        { success: false, error: "Organization access denied" },
        { status: 403 }
      );
    }

    // Delete the automation
    const result = await automationsCollection.deleteOne({
      _id: new ObjectId(automation_id),
      orgID: String(orgID), // Additional safety check
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to delete automation" },
        { status: 500 }
      );
    }

    // Log the deletion activity
    try {
      await recordEmailAutomationActivity({
        db,
        orgID: String(orgID),
        careerId: existingAutomation?.careerId ? String(existingAutomation.careerId) : undefined,
        actor: {
          uid: req.user?.uid,
          email: req.user?.email,
          name: (req.user as any)?.name,
          picture: (req.user as any)?.picture,
        },
        action: "Deleted Email Automation",
        automationName:
          existingAutomation?.automation?.automation_name || "Untitled",
        stageName:
          existingAutomation?.stage_name && existingAutomation?.substage_name
            ? `${existingAutomation.stage_name}: ${existingAutomation.substage_name}`
            : existingAutomation?.substage_name ||
              existingAutomation?.stage_name ||
              "selected",
      });
    } catch (logError) {
      console.error("Failed to log deleted email automation activity:", logError);
    }

    return NextResponse.json({
      success: true,
      message: "Automation deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting automation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete automation",
        details: error.message,
      },
      { status: 500 }
    );
  }
});
