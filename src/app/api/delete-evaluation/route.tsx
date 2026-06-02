import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "../../../lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const { evaluationId } = await request.json();

    if (!evaluationId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const { db } = await connectMongoDB();
        const recruiterEvaluation = await db.collection("recruiter-evaluations").findOne({ _id: new ObjectId(evaluationId) });
        if (!recruiterEvaluation) {
            return NextResponse.json({ error: "Recruiter evaluation not found" }, { status: 404 });
        }
        const interview = await db.collection("interviews").findOne({ _id: new ObjectId(recruiterEvaluation.interviewUID) });
        if (!interview) {
            return NextResponse.json({ error: "Interview not found" }, { status: 404 });
        }

        const actorEmail = request.user?.email;
        const orgId = interview?.orgID;
        const orgMatch = ObjectId.isValid(String(orgId))
            ? [{ orgID: orgId }, { orgID: ObjectId.createFromHexString(String(orgId)) }]
            : [{ orgID: orgId }];

        const recruiterMember = actorEmail
            ? await db.collection("members").findOne({
                email: actorEmail,
                $or: orgMatch,
            })
            : null;

        const actorImage =
            recruiterMember?.image ||
            recruiterMember?.profileImage ||
            recruiterMember?.photoURL ||
            recruiterMember?.picture ||
            (request.user as any)?.image ||
            (request.user as any)?.picture ||
            null;

        const actorName =
            recruiterMember?.name ||
            request.user?.name ||
            actorEmail ||
            "Recruiter";

        let stageName = "a stage";
        if (interview?.pipelineStages) {
            const stage = interview.pipelineStages.find((s: any) => s.id === recruiterEvaluation.stageId);
            if (stage) {
                const substage = stage.substages?.find((sub: any) => sub.id === recruiterEvaluation.substageId);
                stageName = substage ? `${stage.name}: ${substage.name}` : stage.name;
            }
        }

        await db.collection("recruiter-evaluations").deleteOne({ _id: new ObjectId(evaluationId) });
        await db.collection("recruiter-history").insertOne({
            interviewUID: interview._id.toString(),
            orgID: interview.orgID,
            action: "Deleted Recruiter Evaluation",
            recruiterEmail: request.user?.email,
            createdAt: Date.now(),
        });

        await logActivity({
            db,
            kind: "recruiter_added_evaluation",
            interview,
            actor: {
                type: "recruiter",
                id: recruiterMember?._id?.toString() || request.user?.uid,
                email: actorEmail,
                name: actorName,
                image: actorImage,
            },
            extraMetadata: {
                stageName,
                matchFit: recruiterEvaluation.matchFit,
                evaluationNotes: recruiterEvaluation.evaluationNotes,
                isUpdate: false,
                isDeleted: true,
            },
        });

        return NextResponse.json({ message: "Recruiter evaluation deleted successfully" }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to delete recruiter evaluation" }, { status: 500 });
    }
    
});