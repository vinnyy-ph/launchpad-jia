import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { careerID } = await request.json();

    if (!careerID) {
      return NextResponse.json(
        { error: "careerID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const career = await db
      .collection("careers")
      .findOne({ _id: new ObjectId(careerID) });

    if (!career) {
      return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }

    if (career.status === "inactive") {
      return NextResponse.json(
        { error: "Career is inactive" },
        { status: 403 }
      );
    }

    // Check if user has access to this career
    const userEmail = request.user?.email;
    const isTeamMember = career.teamMembers?.some(
      (member: any) => member.email === userEmail
    );

    if (!isTeamMember) {
      return NextResponse.json(
        { error: "You do not have access to this career" },
        { status: 403 }
      );
    }

    return NextResponse.json(career);
  } catch (error) {
    console.error("Error fetching career:", error);
    return NextResponse.json(
      { error: "Failed to fetch career data" },
      { status: 500 }
    );
  }
});
