import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, type AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { tvErrorResponse } from "@/app/api/talent-vault/lib/tvApiError";
import { deriveTalentVaultSummary } from "@/app/(talent-vault)/lib/talentVaultStatus";

const TV_PROFILES_COLLECTION = "tv-profiles";

const VALID_SORT_FIELDS = new Set(["updatedAt", "createdAt", "completedAt"]);
const VALID_ORDER_VALUES = new Set(["asc", "desc"]);
const VALID_STATE_VALUES = new Set(["completed", "draft", "expired"]);
const VALID_STATUS_VALUES = new Set(["active", "inactive"]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const GET = withAuth(
  async (
    request: AuthenticatedRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { db } = await connectMongoDB();

      // Admin role enforcement
      const userEmail = String(request.user?.email || "").trim().toLowerCase();
      if (!userEmail) {
        return tvErrorResponse(
          401,
          "AUTHENTICATION_REQUIRED",
          "Authentication is required to access this resource."
        );
      }

      const admin = await db
        .collection("admins")
        .findOne({ email: userEmail }, { projection: { _id: 1 } });

      if (!admin) {
        return tvErrorResponse(
          403,
          "ADMIN_ACCESS_REQUIRED",
          "Admin access is required to view candidates."
        );
      }

      const { id } = await params;

      if (!ObjectId.isValid(id)) {
        return tvErrorResponse(
          400,
          "INVALID_SUBPROGRAM_ID",
          "The provided subprogram ID is not valid."
        );
      }

      const { searchParams } = new URL(request.url);

      // Parse and validate query params
      const rawPage = parseInt(searchParams.get("page") || "1", 10);
      const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

      const rawLimit = parseInt(searchParams.get("limit") || "10", 10);
      const limit = Number.isNaN(rawLimit)
        ? 10
        : Math.min(Math.max(rawLimit, 1), 50);

      const search = String(searchParams.get("search") || "").trim();

      const rawSort = String(searchParams.get("sort") || "").trim();
      const sortField = VALID_SORT_FIELDS.has(rawSort) ? rawSort : "updatedAt";

      const rawOrder = String(searchParams.get("order") || "").trim().toLowerCase();
      const sortDirection: 1 | -1 = VALID_ORDER_VALUES.has(rawOrder)
        ? rawOrder === "asc"
          ? 1
          : -1
        : -1;

      const skip = (page - 1) * limit;
      const sortObj: Record<string, 1 | -1> = { [sortField]: sortDirection };

      // Parse state filter (derived field, filtered post-query)
      const rawStateFilter = String(searchParams.get("state") || "").trim();
      const requestedStates = rawStateFilter
        ? rawStateFilter.split(",").filter((s) => VALID_STATE_VALUES.has(s))
        : [];

      // Parse status filter (derived field, filtered post-query)
      const rawStatusFilter = String(searchParams.get("status") || "").trim();
      const requestedStatuses = rawStatusFilter
        ? rawStatusFilter.split(",").filter((s) => VALID_STATUS_VALUES.has(s))
        : [];

      // Build filter
      const escapedSearch = search ? escapeRegex(search) : "";
      const filter: Record<string, unknown> = {
        "profile.goals.selectedSubprogramId": id,
        ...(search
          ? {
              $or: [
                {
                  "userInfo.name": {
                    $regex: escapedSearch,
                    $options: "i",
                  },
                },
                {
                  "userInfo.email": {
                    $regex: escapedSearch,
                    $options: "i",
                  },
                },
              ],
            }
          : {}),
      };

      const projection = {
        "userInfo.name": 1,
        "userInfo.email": 1,
        "userInfo.image": 1,
        setup: 1,
        state: 1,
        status: 1,
        completedAt: 1,
        expiresAt: 1,
        expirationDate: 1,
        createdAt: 1,
        updatedAt: 1,
      };

      const collection = db.collection(TV_PROFILES_COLLECTION);

      function mapDocToCandidate(doc: any) {
        const { status, state } = deriveTalentVaultSummary(doc);
        return {
          _id: doc._id.toString(),
          name: (doc.userInfo as any)?.name || "",
          email: (doc.userInfo as any)?.email || "",
          image: (doc.userInfo as any)?.image || "",
          status,
          state,
          createdAt: doc.createdAt instanceof Date
            ? doc.createdAt.toISOString()
            : doc.createdAt
              ? String(doc.createdAt)
              : null,
          updatedAt: doc.updatedAt instanceof Date
            ? doc.updatedAt.toISOString()
            : doc.updatedAt
              ? String(doc.updatedAt)
              : null,
          completedAt: doc.completedAt instanceof Date
            ? doc.completedAt.toISOString()
            : doc.completedAt
              ? String(doc.completedAt)
              : null,
        };
      }

      // When state or status filter is active, we must derive then filter (both are computed),
      // so we fetch all matching docs and paginate in-memory.
      if (requestedStates.length > 0 || requestedStatuses.length > 0) {
        const allDocs = await collection
          .find(filter, { projection })
          .sort(sortObj)
          .toArray();

        const allCandidates = allDocs
          .map(mapDocToCandidate)
          .filter((c) => {
            if (requestedStates.length > 0 && !requestedStates.includes(c.state)) {
              return false;
            }
            if (requestedStatuses.length > 0 && !requestedStatuses.includes(c.status)) {
              return false;
            }
            return true;
          });

        const totalCount = allCandidates.length;
        const totalPages = Math.ceil(totalCount / limit);
        const candidates = allCandidates.slice(skip, skip + limit);

        return NextResponse.json({
          candidates,
          totalCount,
          page,
          limit,
          totalPages,
        });
      }

      const [docs, totalCount] = await Promise.all([
        collection
          .find(filter, { projection })
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .toArray(),
        collection.countDocuments(filter),
      ]);

      const candidates = docs.map(mapDocToCandidate);
      const totalPages = Math.ceil(totalCount / limit);

      return NextResponse.json({
        candidates,
        totalCount,
        page,
        limit,
        totalPages,
      });
    } catch {
      return tvErrorResponse(
        500,
        "FETCH_CANDIDATES_FAILED",
        "Failed to fetch candidates."
      );
    }
  }
);
