import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, type AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  escapeRegex,
  toNormalizedName,
} from "@/app/(talent-vault)/lib/server/talentVaultProfiles";

let ensureUniversitiesIndexesPromise: Promise<void> | null = null;

async function ensureUniversitiesIndexes(db: any) {
  if (!ensureUniversitiesIndexesPromise) {
    ensureUniversitiesIndexesPromise = (async () => {
      const universities = db.collection("universities");

      await universities.createIndex(
        { normalizedName: 1 },
        { name: "idx_universities_normalized_name" }
      );
      await universities.createIndex({ name: 1 }, { name: "idx_universities_name" });
    })().catch((error) => {
      ensureUniversitiesIndexesPromise = null;
      throw error;
    });
  }

  await ensureUniversitiesIndexesPromise;
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") || "").trim();
    const normalizedQuery = toNormalizedName(query);
    const limitRaw = Number.parseInt(String(searchParams.get("limit") || "5"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 5)
      : 5;

    const { db } = await connectMongoDB();
    await ensureUniversitiesIndexes(db);

    const universities = db.collection("universities");

    let docs: any[] = [];

    if (!normalizedQuery) {
      docs = await universities
        .find(
          {},
          {
            projection: {
              name: 1,
              country: 1,
              alpha_two_code: 1,
            },
          }
        )
        .sort({ name: 1 })
        .limit(limit)
        .toArray();
    } else {
      const escapedQuery = escapeRegex(normalizedQuery);
      const startsWithRegex = new RegExp(`^${escapedQuery}`);
      const startsWithNameRegex = new RegExp(`^${escapeRegex(query)}`, "i");

      const primaryDocs = await universities
        .find(
          {
            $or: [
              { normalizedName: startsWithRegex },
              { name: startsWithNameRegex },
            ],
          },
          {
            projection: {
              name: 1,
              country: 1,
              alpha_two_code: 1,
            },
          }
        )
        .sort({ name: 1 })
        .limit(limit)
        .toArray();

      docs = primaryDocs;

      if (docs.length < limit) {
        const remaining = limit - docs.length;
        const existingIds = docs.map((doc) => doc?._id).filter(Boolean);
        const containsRegex = new RegExp(escapeRegex(query), "i");

        const secondaryDocs = await universities
          .find(
            {
              name: containsRegex,
              ...(existingIds.length > 0 ? { _id: { $nin: existingIds } } : {}),
            },
            {
              projection: {
                name: 1,
                country: 1,
                alpha_two_code: 1,
              },
            }
          )
          .sort({ name: 1 })
          .limit(remaining)
          .toArray();

        docs = [...docs, ...secondaryDocs];
      }
    }

    const data = docs
      .map((doc) => ({
        id: doc?._id?.toString?.() || "",
        name: String(doc?.name || "").trim(),
        country:
          typeof doc?.country === "string" && doc.country.trim().length > 0
            ? doc.country.trim()
            : null,
        alphaTwoCode:
          typeof doc?.alpha_two_code === "string" && doc.alpha_two_code.trim().length > 0
            ? doc.alpha_two_code.trim().toUpperCase()
            : null,
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    return NextResponse.json({
      data,
      meta: {
        count: data.length,
      },
    });
  } catch (error) {
    console.error("Error fetching universities:", error);
    return NextResponse.json(
      { error: "Failed to fetch universities" },
      { status: 500 }
    );
  }
});
