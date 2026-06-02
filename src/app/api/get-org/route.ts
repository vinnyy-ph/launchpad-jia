import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  const { user } = await request.json();

  const orgs = await db
    .collection("members")
    .aggregate([
      { $match: { email: user.email } },
      {
        $lookup: {
          from: "organizations",
          let: { orgIdStr: "$orgID" },
          pipeline: [
            {
              $addFields: {
                _idStr: { $toString: "$_id" },
              },
            },
            {
              $match: {
                $expr: { 
                  $and: [
                    { $eq: ["$_idStr", "$$orgIdStr"] },
                    { $eq: ["$status", "active"] }
                  ]
                },
              },
            },
          ],
          as: "organizationDetails",
        },
      },
      { $unwind: "$organizationDetails" },
      {
        $addFields: {
          "organizationDetails.role": "$role",
          "organizationDetails.careers": "$careers",
          "organizationDetails.status": "$status",
          "organizationDetails.lastLogin": "$lastLogin",
        },
      },
    ])
    .toArray();

  // Extract organization details and deduplicate by _id
  const orgList = orgs.map((org) => org.organizationDetails);
  
  // Remove duplicates - keep only unique organizations by _id
  const uniqueOrgList = Array.from(
    new Map(orgList.map(org => [org._id.toString(), org])).values()
  );

  await db.collection("members").updateMany(
    { email: user.email },
    {
      $set: {
        name: user.name,
        image: user.picture || user.image,
        lastLogin: new Date(),
        status: "joined",
      },
    }
  );
  return NextResponse.json(uniqueOrgList);
});

export async function GET() {
  const { db } = await connectMongoDB();

  const orgs = await db.collection("organizations").find({ status: "active" }).toArray();

  return NextResponse.json(orgs.map((org) => ({
    _id: org._id,
    name: org.name,
    image: org.image,
    status: org.status,
    tier: org.tier,
  })));
}
