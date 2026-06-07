import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { EXCLUDE_ARCHIVED } from "@/lib/utils/careerArchive";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { id, orgID, includeChildCareers = false } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Career ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Check if id is a valid ObjectId (24 character hex string)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const query: any = isObjectId ? { _id: new ObjectId(id) } : { id: id };
    if (orgID) {
      query.orgID = orgID;
    }

    const career = await db.collection("careers").findOne(query);

    if (!career) {
      return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }

    // Resolve walkthrough language: career → org → english
    let walkthroughLanguage =
      career.walkthroughLanguage === "tagalog" || career.walkthroughLanguage === "english"
        ? career.walkthroughLanguage
        : undefined;
    if (walkthroughLanguage === undefined && career.orgID) {
      const org = await db.collection("organizations").findOne({
        _id: new ObjectId(career.orgID),
      });
      walkthroughLanguage =
        org?.walkthroughLanguage === "tagalog" ? "tagalog" : "english";
    } else if (walkthroughLanguage === undefined) {
      walkthroughLanguage = "english";
    }

    // Check if user has access to this career
    // const userEmail = request.user?.email;
    // const isTeamMember = career.teamMembers?.some(
    //   (member: any) => member.email === userEmail
    // );

    // if (!isTeamMember) {
    //   return NextResponse.json(
    //     { error: "You do not have access to this career" },
    //     { status: 403 }
    //   );
    // }

    // Resolve parent/child hierarchy for the badge
    const hierarchyProjection = { _id: 1, id: 1, jobTitle: 1, childTitle: 1 };
    let parentCareer = null;
    let childCareers: any[] | undefined;

    if (career.careerPostType === "receiving_pool" && career.parentCareerID) {
      parentCareer = await db
        .collection("careers")
        .findOne(
          // Hierarchy reads skip archived relatives (defense-in-depth; the career
          // itself stays fetchable by direct id — that's where Restore lives).
          { id: career.parentCareerID, orgID: career.orgID, ...EXCLUDE_ARCHIVED },
          { projection: hierarchyProjection }
        );
    }

    if (includeChildCareers && career.id) {
      childCareers = await db
        .collection("careers")
        .find(
          { parentCareerID: career.id, orgID: career.orgID, ...EXCLUDE_ARCHIVED },
          { projection: hierarchyProjection }
        )
        .toArray();
    }

    return NextResponse.json({
      ...career,
      walkthroughLanguage,
      ...(parentCareer && { parentCareer }),
      ...(includeChildCareers ? { childCareers: childCareers ?? [] } : {}),
    });
  } catch (error) {
    console.error("Error fetching career:", error);
    return NextResponse.json(
      { error: "Failed to fetch career data" },
      { status: 500 }
    );
  }
});
