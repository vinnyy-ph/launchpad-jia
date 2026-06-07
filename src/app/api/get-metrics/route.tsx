import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import {
  AuthenticatedRequest,
  withAuth,
} from "../../../lib/utils/authMiddleware";
import { withExcludeArchived } from "@/lib/utils/careerArchive";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();
    const { orgID } = await req.json();

    // Get counts from each collection
    const careersCount = await db
      .collection("careers")
      .find(withExcludeArchived({ orgID, status: "active" }))
      .count();
    // Interviews/transcripts of archived careers stay counted-out too — same
    // exclusion semantic as careersCount (interview docs key on the career id).
    const archivedCareerIds = (
      await db
        .collection("careers")
        .find({ orgID, archived: true })
        .project({ id: 1 })
        .toArray()
    )
      .map((c: any) => c.id)
      .filter(Boolean);
    const archivedGate =
      archivedCareerIds.length > 0 ? { id: { $nin: archivedCareerIds } } : {};
    const interviewsCount = await db
      .collection("interviews")
      .find({ orgID, interviewStatus: { $ne: "Dropped" }, ...archivedGate })
      .count();
    const interviewIDs = await db
      .collection("interviews")
      .find({ orgID, ...archivedGate })
      .project({ interviewID: 1, _id: 0 })
      .toArray();
    const interviewIDList = interviewIDs.map((doc) => doc.interviewID);
    const transcriptsCount = await db
      .collection("transcripts")
      .countDocuments({ interviewID: { $in: interviewIDList } });
    const applicantsCount = await db
      .collection("affiliations")
      .find({ orgID })
      .count();

    // Prepare response in the required format
    const metricsData = [
      {
        icon: "la la-briefcase",
        name: "Total Careers / Job Openings",
        value: careersCount,
      },
      {
        icon: "la la-comments",
        name: "Total Interviews",
        value: interviewsCount,
      },
      {
        icon: "la la-file-text",
        name: "Total Transcripts",
        value: transcriptsCount,
      },
      {
        icon: "la la-users",
        name: "Total Applicants",
        value: applicantsCount,
      },
    ];

    return NextResponse.json(metricsData);
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
});
