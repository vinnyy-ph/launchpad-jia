import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth } from "@/lib/utils/authMiddleware";

export const GET = withAuth(async (request: NextRequest) => {
    try {
        const { searchParams } = new URL(request.url);
        const name = searchParams.get("name");

        if (!name || !name.trim()) {
            return NextResponse.json(
                { available: true, message: "Name is required" },
                { status: 400 }
            );
        }

        const { db } = await connectMongoDB();

        // Case-insensitive search for existing organization
        const existingOrganization = await db.collection("organizations").findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        });

        if (existingOrganization) {
            return NextResponse.json({
                available: false,
                message: "This organization name is already taken",
            });
        }

        return NextResponse.json({
            available: true,
            message: "Organization name is available",
        });
    } catch (error) {
        console.error("Error checking organization name:", error);
        return NextResponse.json(
            { available: true, message: "Error checking organization name" },
            { status: 500 }
        );
    }
});
