import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "../../../lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
    const { searchParams } = new URL(request.url);
    const interviewUID = searchParams.get("interviewUID");

    if (!interviewUID) {
        return NextResponse.json({ error: "Interview UID is required" }, { status: 400 });
    }

    try {
        const { db } = await connectMongoDB();
        const interviewLogs = await db.collection("interview-history").find({ interviewUID: interviewUID }).sort({ createdAt: -1 }).toArray();
        return NextResponse.json(interviewLogs);
    } catch (error) {
        console.log(error);
        return NextResponse.json({ error: "Failed to fetch interview history" }, { status: 500 });
    }
});