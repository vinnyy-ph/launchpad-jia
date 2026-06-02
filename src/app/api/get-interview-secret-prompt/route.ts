import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { interviewID } = await request.json();

    if (!interviewID) {
      return NextResponse.json(
        { error: "Interview ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Get interview details to find the career ID
    const interview = await db.collection("interviews").findOne({
      interviewID: interviewID,
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    if (interview.flow === "talent-vault") {
      return NextResponse.json({ interviewSecretPrompt: "" });
    }

    // Get career details to fetch the secret prompt
    const career = await db.collection("careers").findOne({
      id: interview.id,
    });

    const interviewSecretPrompt = career?.interviewSecretPrompt || "";

    return NextResponse.json({ interviewSecretPrompt });
  } catch (error) {
    console.error("Error fetching interview secret prompt:", error);
    return NextResponse.json(
      { error: "Failed to fetch secret prompt" },
      { status: 500 }
    );
  }
});
