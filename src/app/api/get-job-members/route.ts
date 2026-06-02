import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";
import { ObjectId } from "mongodb";
import { attachMemberIdsByEmail } from "@/lib/utils/memberIdentity";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const search = searchParams.get("search") || "";
    const memberRole = searchParams.get("memberRole") || "Job Owner";
    const projectId = searchParams.get("projectId");
    
    const { db } = await connectMongoDB();
    const authResult = await verifyUserIsMember(db, request.user.email, orgID);
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.reason }, { status: 403 });
    }
    const projectCareerIds: ObjectId[] = [];
    if (projectId) {
        const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId), orgID });
        if (project) {
            projectCareerIds.push(...project.careers.map((c: any) => new ObjectId(c)));
        }
    }

    const careers = await db.collection("careers").aggregate([
        {
            $match: {
                orgID,
                ...(projectCareerIds.length > 0 ? { _id: { $in: projectCareerIds } } : {}),
                ...(search?.trim() ? {
                    $or: [
                        { "teamMembers.email": { $regex: search, $options: "i" } },
                        { "createdBy.email": { $regex: search, $options: "i" } },
                    ]
                } : {})
            }
        },
        {
            $project: {
                teamMembers: 1,
                createdBy: 1,
            }
        }
    ]).toArray();
    const jobOwners = [];
    for (const c of careers) {
        if (c.teamMembers?.find((m) => m.role === memberRole)) {
            const owner = c.teamMembers?.find((m) => m.role === memberRole);
            if (!jobOwners.find((j) => j.email === owner?.email) && owner?.email !== request.user.email) {
                jobOwners.push(owner);
            }
        } else if (memberRole === "Job Owner") {
            const createdBy = c.createdBy;
            if (!jobOwners.find((j) => j.email === createdBy?.email) && createdBy?.email !== request.user.email) {
                jobOwners.push(createdBy);
            }
        }
    }
    jobOwners.sort((a, b) => a.name.localeCompare(b.name));
    // Add the current user to the start of the list of job owners
    jobOwners.unshift({ email: request.user.email, name: request.user.name });

    const jobOwnersWithIds = await attachMemberIdsByEmail(db, orgID, jobOwners);

    return NextResponse.json(jobOwnersWithIds);
});