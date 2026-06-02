import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json();
  const { db } = await connectMongoDB();

  const { fields } = body;

  let globalSettings = {};

  if (!fields || Object.keys(fields).length === 0) {
    globalSettings = await db
      .collection("global-settings")
      .findOne({ name: "global-settings" });
  }

  if (Object.keys(fields).length > 0) {
    globalSettings = await db
      .collection("global-settings")
      .findOne({ name: "global-settings" }, { projection: fields });
  }

  return NextResponse.json(globalSettings);
});
