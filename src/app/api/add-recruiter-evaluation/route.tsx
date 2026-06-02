import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "../../../lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";
import { logActivity } from "@/lib/utils/activityLogger";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const { recruiterEvaluation } = await request.json();

    if (!recruiterEvaluation.matchFit || !recruiterEvaluation.stageId || !recruiterEvaluation.substageId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const { db } = await connectMongoDB();
        const interview = await db.collection("interviews").findOne({ _id: new ObjectId(recruiterEvaluation.interviewUID) });
        if (!interview) {
            return NextResponse.json({ error: "Interview not found" }, { status: 404 });
        }

        const actorEmail = recruiterEvaluation?.updatedBy?.email || request.user?.email;
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
            recruiterEvaluation?.updatedBy?.image ||
            recruiterMember?.image ||
            recruiterMember?.profileImage ||
            recruiterMember?.photoURL ||
            recruiterMember?.picture ||
            (request.user as any)?.image ||
            (request.user as any)?.picture ||
            null;

        const actorName =
            recruiterEvaluation?.updatedBy?.name ||
            recruiterMember?.name ||
            request.user?.name ||
            actorEmail ||
            "Recruiter";

        await db.collection("recruiter-evaluations").insertOne({
            ...recruiterEvaluation,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        await db.collection("recruiter-history").insertOne({
            interviewUID: recruiterEvaluation.interviewUID,
            orgID: interview.orgID,
            action: "Added Recruiter Evaluation",
            recruiterEmail: recruiterEvaluation.updatedBy?.email,
            createdAt: Date.now(),
        });

        // Get stage name for activity log
        let stageName = "a stage";
        if (interview?.pipelineStages) {
            const stage = interview.pipelineStages.find((s: any) => s.id === recruiterEvaluation.stageId);
            if (stage) {
                const substage = stage.substages?.find((sub: any) => sub.id === recruiterEvaluation.substageId);
                stageName = substage ? `${stage.name}: ${substage.name}` : stage.name;
            }
        }

        // Log activity
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
            },
        });

        return NextResponse.json({ message: "Recruiter evaluation added successfully" }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to add recruiter evaluation" }, { status: 500 });
    }
    
});