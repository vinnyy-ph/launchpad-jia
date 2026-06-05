import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "../../../lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";
import { EXCLUDE_ARCHIVED } from "@/lib/utils/careerArchive";


export const GET = withAuth(async (request: AuthenticatedRequest) => {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const excludedIDs = searchParams.get("excludedIDs")?.split(",") || [];
    const email = request.user.email;

    if (!orgID) {
        return NextResponse.json({ error: "Org ID is required" }, { status: 400 });
    }

    const { db } = await connectMongoDB();
    const filter: any = { orgID, 'pipelineStages.0': { $exists: true }, ...EXCLUDE_ARCHIVED };

    const result = await verifyUserIsMember(db, email, orgID);
    if (!result.authorized) {
        return NextResponse.json({ error: result.reason }, { status: 403 });
    }

    if (excludedIDs.length > 0) {
        filter._id = { $nin: excludedIDs.map((id) => new ObjectId(id)) };
    }

    const careers = await db.collection("careers")
    .find(filter).toArray();

    return NextResponse.json(careers.map((career) => {
        return {
            _id: career._id.toString(),
            id: career.id,
            name: career.jobTitle,
            stages: career.pipelineStages,
        }
    }));
});