// TODO (Vince) - For Merging

import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { EXCLUDE_ARCHIVED } from "@/lib/utils/careerArchive";

export async function GET() {
  const { db } = await connectMongoDB();
  const orgIDs = ["682d3fc222462d03263b0881", "6850d1f32eb27a8356bfe968"];
  const careers = await db
    .collection("careers")
    // Defense-in-depth: archived careers are forced inactive; exclude them
    // explicitly rather than relying on the status filter below.
    .find({ orgID: { $in: orgIDs }, ...EXCLUDE_ARCHIVED })
    .sort({ createdAt: -1 })
    .toArray();
  const activeCareers = careers.filter((career) => career.status === "active");

  return NextResponse.json(activeCareers);
}
