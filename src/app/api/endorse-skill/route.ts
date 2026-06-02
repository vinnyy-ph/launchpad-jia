import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";

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

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { candidateEmail, skillName, endorserRole, orgID: orgIDFromBody } = await request.json();
    const { db } = await connectMongoDB();

    // Get the authenticated user's information from Firebase token
    const endorserEmail = request.user?.email;
    const endorserId = request.user?.uid;
    
    const orgIDRaw = orgIDFromBody || null;

    if (!orgIDRaw) {
      return NextResponse.json(
        { error: "Organization context is required to endorse a skill" },
        { status: 403 }
      );
    }

    const orgID = typeof orgIDRaw === "string" ? orgIDRaw : orgIDRaw?.toString?.();
    const orgIDQueryValues: Array<string | ObjectId> = orgID ? [orgID] : [];
    if (orgID && ObjectId.isValid(orgID)) {
      orgIDQueryValues.push(new ObjectId(orgID));
    }

    // Fetch user profile from members collection scoped to the org if provided.
    // This prevents incorrect org resolution for users that belong to multiple orgs.
    const userProfile = await db
      .collection("members")
      .findOne({ email: endorserEmail, orgID: { $in: orgIDQueryValues } });

    if (!userProfile) {
      return NextResponse.json(
        { error: "You are not a member of this organization" },
        { status: 403 }
      );
    }

    // Use profile data if available, otherwise fallback to token data
    const endorserName = userProfile?.name || 
                        request.user?.name || 
                        request.user?.display_name || 
                        request.user?.displayName ||
                        request.user?.email?.split('@')[0] || 
                        "Unknown User";
    const endorserPicture = userProfile?.image || 
                           request.user?.picture || 
                           request.user?.photo_url || 
                           request.user?.photoURL || 
                           null;
    const endorserRoleFromProfile = userProfile?.role || "Recruiter";

    if (!candidateEmail || !skillName || !endorserEmail) {
      console.error("[endorse-skill] Missing required data: candidateEmail, skillName, or endorserEmail");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    // Check if user has already endorsed this skill for this candidate within the same organization
    const existingEndorsement = await db.collection("skill-endorsements").findOne({
      candidateEmail,
      skillName,
      endorserEmail,
      orgID: { $in: orgIDQueryValues },
    });

    if (existingEndorsement) {
      return NextResponse.json(
        { error: "You have already endorsed this skill for this candidate" },
        { status: 409 }
      );
    }

    // Create new endorsement
    const endorsement = {
      candidateEmail,
      skillName,
      endorserEmail,
      endorserId,
      endorserName,
      endorserRole: endorserRole || endorserRoleFromProfile,
      endorserAvatar: endorserPicture,
      orgID,
      endorsedDate: new Date().toISOString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save endorsement to database
    const result = await db.collection("skill-endorsements").insertOne(endorsement);
    const formattedEndorsement = formatEndorsementForResponse(endorsement, result.insertedId);

    return NextResponse.json({
      message: "Skill endorsed successfully",
      endorsementId: result.insertedId,
      endorsement: formattedEndorsement
    });

  } catch (error) {
    console.error("Error endorsing skill:", error);
    return NextResponse.json(
      { error: "Failed to endorse skill" },
      { status: 500 }
    );
  }
});
