import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { AuthenticatedRequest, withAuth } from "@/lib/utils/authMiddleware";
import { defaultAnalyticsDashboard } from "@/lib/utils/recruiterAnalytics";
import { NextResponse } from "next/server";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const body = await request.json();
    const { db } = await connectMongoDB();
    const userEmail = request.user.email;
    const { orgID, analyticsDashboard } = body;

    if (!userEmail) {
        return NextResponse.json({ error: "User email is required" }, { status: 400 });
    }

    if (!orgID) {
        return NextResponse.json({ error: "Org ID is required" }, { status: 400 });
    }

    if (!analyticsDashboard) {
        return NextResponse.json({ error: "Analytics dashboard is required" }, { status: 400 });
    }

    const now = new Date();

    await db.collection("analytics-dashboard").updateOne(
        { orgID, userEmail },
        {
            $setOnInsert: {
                recruiterEmail: userEmail,
                createdAt: now,
                orgID,
            },
            $set: { 
                analyticsDashboard,
                updatedAt: now,
            } 
        },
        { upsert: true }
    );

    return NextResponse.json({ message: "Analytics dashboard saved successfully" });
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
    const { db } = await connectMongoDB();
    const userEmail = request.user.email;
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");

    if (!orgID) {
        return NextResponse.json({ error: "Org ID is required" }, { status: 400 });
    }

    try {
        const analyticsDashboard = await db.collection("analytics-dashboard").findOne({ orgID, userEmail });
        return NextResponse.json({
            success: true,
            data: analyticsDashboard?.analyticsDashboard || defaultAnalyticsDashboard,
        });
    } catch (error) {
        console.error("Error fetching analytics dashboard:", error);
        // Return default analytics dashboard if error occurs
        return NextResponse.json({ error: "Error fetching analytics dashboard", data: defaultAnalyticsDashboard });
    }
});