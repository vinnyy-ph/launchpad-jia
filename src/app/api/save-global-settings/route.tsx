import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json();
  const { db } = await connectMongoDB();
  const { _id, ...updateData } = body;

  await db.collection("global-settings").updateOne(
    {
      name: "global-settings",
    },
    { $set: updateData },
    { upsert: true }
  );

  return NextResponse.json({
    message: "Settings saved successfully",
  });
});
