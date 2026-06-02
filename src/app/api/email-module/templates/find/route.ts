import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endorseTo = searchParams.get("endorseTo");
    const action = searchParams.get("action") || "endorse";
    const orgID = searchParams.get("orgID");
    const userEmail = searchParams.get("userEmail");

    if (!endorseTo) {
      return NextResponse.json(
        { success: false, message: "endorseTo parameter is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const templatesCollection = db.collection("templates");

    // Normalize endorseTo value for matching
    const normalizeEndorseTo = (value: string): string => {
      // Extract stage name from "Stage: Substage" format
      const stageName = value.split(":")[0]?.trim() || value;

      const mapping: { [key: string]: string } = {
        "CV Screening": "CV Screening",
        "AI Interview": "AI Interview",
        "Human Interview": "Human Review",
        "Job Offer": "Job Offer",
        // Handle legacy values
        "Pending AI Interview": "AI Interview",
        "AI Interview Review": "Human Review",
        "For Human Interview": "Human Review",
        "Pending Job Interview": "Job Offer",
        "Job Offered": "Job Offer",
      };
      return mapping[stageName] || stageName;
    };

    const normalizedEndorseTo = normalizeEndorseTo(endorseTo);

    // Build queries for each template type - use strict matching for full endorseTo value and action
    const systemQuery = {
      templateType: "system",
      name: endorseTo, // Exact match for full "Stage: Substage" format
      action: action, // Match the specific action (endorse or drop)
      isActive: true,
    };

    const globalQuery = {
      templateType: "global",
      orgID: orgID,
      name: endorseTo, // Exact match for full "Stage: Substage" format
      action: action, // Match the specific action (endorse or drop)
      isActive: true,
    };

    const userQuery = {
      templateType: "user",
      orgID: orgID,
      userEmail: userEmail,
      name: endorseTo, // Exact match for full "Stage: Substage" format
      action: action, // Match the specific action (endorse or drop)
      isActive: true,
    };

    // Debug logging
    console.log("Template Find API - Debug:", {
      originalEndorseTo: endorseTo,
      normalizedEndorseTo,
      action,
      orgID: !!orgID,
      userEmail: !!userEmail,
      systemQuery,
      globalQuery,
      userQuery,
    });

    // Fetch templates for each type
    const [systemTemplates, globalTemplates, userTemplates] = await Promise.all(
      [
        templatesCollection.find(systemQuery).toArray(),
        orgID ? templatesCollection.find(globalQuery).toArray() : [],
        orgID && userEmail ? templatesCollection.find(userQuery).toArray() : [],
      ]
    );

    // Templates are already filtered by action in the database query
    const result = {
      system: systemTemplates,
      global: globalTemplates,
      user: userTemplates,
    };

    // Debug logging for results
    console.log("Template Find API - Results:", {
      systemCount: systemTemplates.length,
      globalCount: globalTemplates.length,
      userCount: userTemplates.length,
      systemTemplates: systemTemplates.map((t) => ({
        name: t.name,
        action: t.action,
        _id: t._id,
      })),
      globalTemplates: globalTemplates.map((t) => ({
        name: t.name,
        action: t.action,
        _id: t._id,
      })),
      userTemplates: userTemplates.map((t) => ({
        name: t.name,
        action: t.action,
        _id: t._id,
      })),
    });

    return NextResponse.json({
      success: true,
      data: result,
      query: {
        endorseTo,
        normalizedEndorseTo,
        action,
        orgID: !!orgID,
        userEmail: !!userEmail,
      },
    });
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch email templates" },
      { status: 500 }
    );
  }
}
