import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const data = await request.json();
    const { orgID, cvData } = data;
    const email = data?.email?.trim();
    const name = data?.name?.trim();
    if (!email || !name || !orgID || !cvData) {
        console.error("[import-applicant] Missing required data: email, name, orgID, or cvData");
        return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }
    const { db } = await connectMongoDB();

    let applicantAccount = await db.collection("applicants").findOne({ email });

    if (!applicantAccount) {
        await db.collection("applicants").insertOne({
            email: email,
            name: name,
            image: null,
            createdAt: new Date(),
            lastSeen: new Date(),
            role: "applicant",
            status: "invited",
        });
        applicantAccount = await db.collection("applicants").findOne({ email });
    }
    const affiliation = await db.collection("affiliations").findOne({
        "applicantInfo.email": email,
        orgID: orgID,
    });
    if (!affiliation) {
        await db.collection("affiliations").insertOne({
            type: "applicant",
            applicantInfo: {
              name: name,
              email: email,
              image: null,
            },
            createdAt: new Date(),
            orgID: orgID,
        });
    }
    const existingCV = await db.collection("applicant-cv").findOne({ email });

    if (!existingCV) {
        await db.collection("applicant-cv").updateOne(
            {
              email,
            },
            {
              $set: {
                digitalCV: cvData.digitalCV,
                errorRemarks: cvData.errorRemarks,
                fileInfo: cvData.fileInfo,
                name: cvData.name,
                updatedAt: Date.now(),
              },
            },
            { upsert: true }
        );
    }
    
    return NextResponse.json({
        applicantAccount: applicantAccount,
        currentCV: existingCV,
    });
});