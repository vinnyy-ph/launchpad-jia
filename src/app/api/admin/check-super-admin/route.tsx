import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { email } = await request.json();

  try {
    const { db } = await connectMongoDB();
    const user = await db.collection("admins").findOne({ email });

    return NextResponse.json({ isSuperAdmin: !!user });
  } catch (error) {
    console.error("Error checking super admin:", error);
    return NextResponse.json({ isSuperAdmin: false }, { status: 500 });
  }
});