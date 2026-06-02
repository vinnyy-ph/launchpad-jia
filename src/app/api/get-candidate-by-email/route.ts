import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get("email");
        const orgID = searchParams.get("orgID");

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        if (!orgID) {
            return NextResponse.json(
                { error: "Organization ID is required" },
                { status: 400 }
            );
        }

        const { db } = await connectMongoDB();

        // Find candidate in affiliations collection
        const affiliation = await db.collection("affiliations").findOne({
            orgID: orgID,
            "applicantInfo.email": email.toLowerCase(),
        });

        if (!affiliation) {
            return NextResponse.json({
                success: true,
                candidate: null,
            });
        }

        // Get all interviews for this candidate
        const interviews = await db
            .collection("interviews")
            .find({
                orgID: orgID,
                email: email.toLowerCase(),
            })
            .toArray();

        // Get career details for each interview
        const activeApplications = await Promise.all(
            interviews.map(async (interview: any) => {
                const career = await db.collection("careers").findOne({
                    id: interview.careerID,
                });
                return {
                    jobTitle: career?.title || interview.jobTitle || "Unknown Position",
                    careerID: interview.careerID,
                    interviewID: interview.interviewID || interview._id?.toString() || interview._id,
                    status: interview.applicationStatus,
                    currentStep: interview.currentStep,
                };
            })
        );

        const candidate = {
            id: affiliation._id?.toString() || affiliation.id || "",
            name: affiliation.applicantInfo?.name || "",
            email: affiliation.applicantInfo?.email || email,
            image: affiliation.applicantInfo?.image || null,
            activeApplications: activeApplications.filter(
                (app) => app.status === "Ongoing"
            ),
        };

        return NextResponse.json({
            success: true,
            candidate: candidate,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                error: "Failed to fetch candidate information",
                details:
                    process.env.NODE_ENV === "development" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
});

