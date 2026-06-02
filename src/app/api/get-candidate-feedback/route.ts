import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";
import { AuthenticatedRequest, withAuth } from "@/lib/utils/authMiddleware";
import { NextResponse } from "next/server";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
    const { searchParams } = new URL(request.url);
    const userEmail = request.user?.email;
    const orgID = searchParams.get("orgID");
    const interviewID = searchParams.get("interviewID");
    
    if (!interviewID) {
        return NextResponse.json({ error: "Missing interviewID" }, { status: 400 });
    }
    
    const { db } = await connectMongoDB();
    const member = await verifyUserIsMember(db, userEmail, orgID);
    if (!member.authorized) {
        return NextResponse.json({ error: member.reason }, { status: 403 });
    }
    const feedback = await db.collection("feedback").findOne({ interviewID, orgID });
    return NextResponse.json(feedback);
});