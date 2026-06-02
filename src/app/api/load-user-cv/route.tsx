import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json();
  const { db } = await connectMongoDB();

  let { email, uid } = body;

  let userCV = null;

  if (email && !uid) {
    userCV = await db.collection("applicant-cv").findOne({
      email: email,
    });

    if (uid && !email) {
      userCV = await db.collection("applicant-cv").findOne({
        _id: new ObjectId(uid),
      });
    }
  }
  return NextResponse.json(userCV);
});
