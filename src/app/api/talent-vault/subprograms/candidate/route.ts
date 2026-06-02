import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, type AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { findTalentVaultProfile } from "@/app/(talent-vault)/lib/server/findTalentVaultProfile";
import { tvErrorResponse } from "@/app/api/talent-vault/lib/tvApiError";

const SUBPROGRAM_COLLECTION = "tv-subprograms";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();

    // Enforce candidate profile requirement
    const candidateProfile = await findTalentVaultProfile(db, {
      email: request.user.email,
    });

    if (!candidateProfile) {
      return tvErrorResponse(
        403,
        "CANDIDATE_PROFILE_REQUIRED",
        "Candidate profile is required to access this resource."
      );
    }

    const filter = {
      status: "active",
      activityStatus: "Active",
      archivedAt: null,
    };

    const collection = db.collection(SUBPROGRAM_COLLECTION);

    const subprogramDocs = await collection
      .find(filter, {
        projection: {
          title: 1,
          roleType: 1,
        },
      })
      .sort({ title: 1 })
      .toArray();

    const subprograms = subprogramDocs.map((subprogram: any) => ({
      _id: subprogram._id.toString(),
      title: String(subprogram.title || "").trim(),
      roleType: String(subprogram.roleType || "").trim(),
    }));

    return NextResponse.json({
      subprograms,
    });
  } catch (error) {
    console.error("Error fetching candidate subprograms:", error);
    return tvErrorResponse(
      500,
      "FETCH_SUBPROGRAMS_FAILED",
      "Failed to fetch candidate subprograms."
    );
  }
});
