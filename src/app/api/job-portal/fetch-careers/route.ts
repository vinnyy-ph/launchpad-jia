import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { EXCLUDE_ARCHIVED } from "@/lib/utils/careerArchive";

export async function POST(request: Request) {
  const { db } = await connectMongoDB();
  const { jobID, orgID, email } = await request.json();
  const careerModel = db.collection("careers");

  // Smoke test restriction: only whitelisted users can see careers from these orgs
  const SMOKE_TEST_RESTRICTIONS = {
    "693f958b2e23d72fdce1502a": [
      "shain.sahagun@whitecloak.com",
      "sa.sahagunbsnss@gmail.com",
    ],
  };
  
  const subdomain = request.headers.get('x-org-subdomain');
  let resolvedOrgID = orgID;

  if (subdomain) {
    const organizationsCollection = db.collection("organizations");
    const organization = await organizationsCollection.findOne({
      brandedJobPortalSubdomain: subdomain.toLowerCase().trim(),
      brandedPortalEnabled: true,
      status: { $ne: "inactive" },
    });

    if (organization) {
      resolvedOrgID = organization._id.toString();
    } else {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
  }
  
  const earlyMatchConditions: any = {
    status: "active",
    orgID: { $ne: "6850d1f32eb27a8356bfe968" }, // Exclude specific org [Test Cloak]
    // Defense-in-depth: archived careers are forced inactive, but keep them out
    // of the public job portal even if that invariant ever slips.
    ...EXCLUDE_ARCHIVED,
  };

  if (jobID != "all") {
    if (!ObjectId.isValid(jobID)) {
      return NextResponse.json({ error: "No job found for the given ID." });
    }
    earlyMatchConditions._id = new ObjectId(jobID);
  }

  if (resolvedOrgID && resolvedOrgID.trim()) {
    earlyMatchConditions.orgID = resolvedOrgID.trim();
  }

  const lateMatchConditions: any = {
    $and: [
      { "organization.tier": { $in: ["corporate", "enterprise", "startup"] } },
      { "organization.status": { $ne: "inactive" } },
    ]
  };

  const careers = await careerModel
    .aggregate([
      { $match: earlyMatchConditions },
      {
        $lookup: {
          from: "organizations",
          let: { orgID: "$orgID" },
          pipeline: [
            {
              $addFields: {
                _id: { $toString: "$_id" },
              },
            },
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$orgID"],
                },
              },
            },
          ],
          as: "organization",
        },
      },
      {
        $unwind: {
          path: "$organization",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $match: lateMatchConditions },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $project: {
          cvSecretPrompt: 0,
          interviewSecretPrompt: 0,
        },
      },
    ])
    .toArray();

  // Smoke test filter: hide restricted org's careers from non-whitelisted users
  const filteredCareers = careers.filter((career) => {
    const allowedEmails = SMOKE_TEST_RESTRICTIONS[career.orgID];
    if (!allowedEmails) return true;
    return email && allowedEmails.includes(email.toLowerCase());
  });

  if (jobID != "all" && filteredCareers.length == 0) {
    return NextResponse.json({ error: "No job found for the given ID." });
  }

  return NextResponse.json(filteredCareers);
}
