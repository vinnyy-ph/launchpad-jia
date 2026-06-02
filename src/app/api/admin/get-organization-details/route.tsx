import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const email = request.user.email;
    if (!id) {
        return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }
   try {
    const { db } = await connectMongoDB();
    const organization = await db.collection("organizations").findOne({ _id: new ObjectId(id) });
    const members = await db.collection("members").find({ orgID: id }).toArray();
    if (!organization) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const isMember = members.find((member) => member.email === email);
    const adminAccount = await db.collection("admins").findOne({ email: email });
    if (!isMember && !adminAccount) {
        return NextResponse.json({ error: "You are not a member of this organization" }, { status: 403 });
    }
    organization.members = members;
    return NextResponse.json(organization);
   } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json({ error: "Error fetching organization" }, { status: 500 });
   }
});