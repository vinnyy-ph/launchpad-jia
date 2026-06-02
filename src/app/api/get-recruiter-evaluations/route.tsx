import { NextResponse } from "next/server";
import connectMongoDB from "../../../lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const { interviewID } = await request.json();
    
    if (!interviewID) {
        return NextResponse.json(
          { error: "Interview ID is required" },
          { status: 400 }
        );
    }
    const { db } = await connectMongoDB();

    try {
        const recruiterEvaluations = await db.collection("recruiter-evaluations")
        .find({ interviewUID: interviewID })
        .sort({ createdAt: -1 })
        .toArray();
        return NextResponse.json(recruiterEvaluations);
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "Failed to load recruiter evaluations" },
            { status: 500 }
        );
    }
});