import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const userEmail = request.user?.email;

        if (!userEmail) {
            return NextResponse.json(
                { error: "User email is required" },
                { status: 400 }
            );
        }

        const { db } = await connectMongoDB();

        // Find the member record for this user and organization
        const member = await db.collection("members").findOne({
            email: userEmail,
        });

        if (!member) {
            return NextResponse.json({ isAdmin: false }, { status: 200 });
        }

        const isAdmin = member.role === "admin";
        return NextResponse.json({
            isAdmin,
            role: member.role || null,
        });
    } catch (error) {
        console.error("Error checking admin status:", error);
        return NextResponse.json(
            { error: "Failed to check admin status" },
            { status: 500 }
        );
    }
});

