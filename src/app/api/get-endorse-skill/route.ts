import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

const formatRole = (role: string | null | undefined) => {
  if (!role) return "";
  return role
    .toString()
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const formatEndorsementForResponse = (endorsement: any, id?: any) => {
  const dateSource = endorsement.endorsedDate || endorsement.createdAt || new Date().toISOString();

  return {
    id: (id || endorsement._id || endorsement.id)?.toString(),
    skillName: endorsement.skillName,
    endorserName: endorsement.endorserName,
    endorserEmail: endorsement.endorserEmail,
    endorserRole: formatRole(endorsement.endorserRole),
    endorserAvatar: endorsement.endorserAvatar,
    endorsedDate: new Date(dateSource).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    candidateEmail: endorsement.candidateEmail,
  };
};

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const candidateEmail = searchParams.get("candidateEmail");
    const skillName = searchParams.get("skillName");
    const orgID = searchParams.get("orgID");

    if (!candidateEmail) {
      return NextResponse.json(
        { error: "candidateEmail parameter is required" },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();

    const query: any = { candidateEmail };
    if (skillName) {
      query.skillName = skillName;
    }
    if (orgID) {
      query.orgID = orgID;
    }

    const endorsements = await db
      .collection("skill-endorsements")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const formattedEndorsements = endorsements.map((endorsement) =>
      formatEndorsementForResponse(endorsement, endorsement._id),
    );

    return NextResponse.json({
      endorsements: formattedEndorsements,
      count: formattedEndorsements.length,
    });
  } catch (error) {
    console.error("Error fetching endorsements:", error);
    return NextResponse.json(
      { error: "Failed to fetch endorsements" },
      { status: 500 },
    );
  }
});
