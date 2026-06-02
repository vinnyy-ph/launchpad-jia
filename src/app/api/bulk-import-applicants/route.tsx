import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const { orgID, applicants } = await request.json();
    if (!orgID || !applicants) {
        return NextResponse.json({ error: "OrgID and applicants are required" }, { status: 400 });
    }
    const { db } = await connectMongoDB();

    let applicantAccounts = await db.collection("applicants").find({ email: { $in: applicants.map(applicant => applicant.email) } }).toArray();
    const missingApplicantAccounts = applicants.filter(applicant => !applicantAccounts.some(account => account.email === applicant.email));
    if (missingApplicantAccounts.length > 0) {
        const newAccounts = missingApplicantAccounts.map(applicant => ({
            email: applicant.email,
            name: applicant.name,
            image: null,
            createdAt: new Date(),
            lastSeen: new Date(),
            role: "applicant",    
            status: "invited",
        }));
        await db.collection("applicants").insertMany(newAccounts);
        applicantAccounts = [...applicantAccounts, ...newAccounts];
    }
    const affiliations = await db.collection("affiliations").find({
        "applicantInfo.email": { $in: applicants.map(applicant => applicant.email) },
        orgID: orgID,
    }).toArray();
    const missingAffiliations = applicants.filter(applicant => !affiliations.some(affiliation => affiliation.applicantInfo.email === applicant.email));
    if (missingAffiliations.length > 0) {
        const newAffiliations = missingAffiliations.map(applicant => ({
                type: "applicant",
                applicantInfo: {
                  name: applicant.name,
                  email: applicant.email,
                  image: null,
                },
                createdAt: new Date(),
                orgID: orgID,
        }));
        await db.collection("affiliations").insertMany(newAffiliations);
    }
    let existingCVs = await db.collection("applicant-cv").find({ email: { $in: applicants.map(applicant => applicant.email) } }).toArray();
    const missingCVs = applicants.filter(applicant => !existingCVs.some(cv => cv.email === applicant.email));

    if (missingCVs.length > 0) {
        const newCVs = missingCVs.map(applicant => ({
            email: applicant.email,
            digitalCV: applicant.cvData.digitalCV,
            errorRemarks: applicant.cvData.errorRemarks,
            fileInfo: applicant.cvData.fileInfo,
            name: applicant.name,
            updatedAt: new Date(),
        }));
        await db.collection("applicant-cv").insertMany(newCVs);
        existingCVs = [...existingCVs, ...newCVs];

    }
    
    return NextResponse.json({
        applicantAccounts: applicantAccounts,
        currentCVs: existingCVs,
    });
});