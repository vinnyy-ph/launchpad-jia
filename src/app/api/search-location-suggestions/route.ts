import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

/**
 * Location suggestions API for candidate location filtering (Advanced Filters + Location dropdown)
 * Returns locations matching the query with candidate counts.
 * Processes all data in MongoDB for the organization.
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const query = searchParams.get("q") || "";

    if (!orgID) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return NextResponse.json({ locations: [] });
    }

    const { db } = await connectMongoDB();

    // Get org-scoped candidate emails (so we don't scan unrelated CVs)
    const orgCandidateEmails = await db.collection("affiliations").distinct("applicantInfo.email", { orgID });

    // Aggregate matching locations grouped by "city" (first part before comma),
    // similar to the client-side `useLocationDropdownData` grouping.
    const pipeline: any[] = [
      {
        $match: {
          email: { $in: orgCandidateEmails },
          location: { $regex: trimmed, $options: "i" },
        },
      },
      {
        $addFields: {
          __locStr: { $ifNull: ["$location", ""] },
        },
      },
      {
        $addFields: {
          __locParts: { $split: ["$__locStr", ","] },
        },
      },
      {
        $addFields: {
          city: {
            $trim: {
              input: { $ifNull: [{ $arrayElemAt: ["$__locParts", 0] }, ""] },
            },
          },
          region: {
            $let: {
              vars: {
                rest: {
                  $slice: ["$__locParts", 1, { $size: "$__locParts" }],
                },
              },
              in: {
                $trim: {
                  input: {
                    $reduce: {
                      input: "$$rest",
                      initialValue: "",
                      in: {
                        $concat: [
                          "$$value",
                          { $cond: [{ $eq: ["$$value", ""] }, "", ", "] },
                          { $trim: { input: "$$this" } },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      { $match: { city: { $ne: "" } } },
      {
        $group: {
          _id: "$city",
          candidateEmails: { $addToSet: "$email" },
          regions: { $addToSet: "$region" },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: { $size: "$candidateEmails" },
          regions: 1,
        },
      },
      { $sort: { count: -1, name: 1 } },
      { $limit: 25 },
    ];

    const rows = await db
      .collection("applicant-cv")
      .aggregate(pipeline, { allowDiskUse: true, maxTimeMS: 5000 })
      .toArray();

    const locations = rows.map((row: any) => {
      const regions: string[] = Array.isArray(row.regions)
        ? row.regions.map((r: any) => String(r || "").trim()).filter(Boolean)
        : [];
      // pick the "most informative" region (longest string)
      const region = regions.sort((a, b) => b.length - a.length)[0];

      return {
        name: String(row.name || ""),
        count: Number(row.count || 0),
        ...(region ? { region } : {}),
      };
    }).filter((l: any) => l.name);

    return NextResponse.json({ locations });
  } catch (error: any) {
    console.error("Error fetching location suggestions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch location suggestions",
        details: error.message,
      },
      { status: 500 },
    );
  }
});


