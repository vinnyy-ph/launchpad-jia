import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

/**
 * This endpoint is used to update all records of the candidate if the email or name is changed.
 *
 * Collections that store candidate email and must be updated (oldEmail → newEmail):
 * - applicants
 * - affiliations
 * - applicant-cv
 * - interviews
 * - org-candidate-skills
 * - candidate-skills
 * - comments
 * - schedule-email
 * - mailgun-messages
 * - sourcing-projects
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const { newEmail, oldEmail, oldName, newName, orgID } = await request.json();
    const userEmail = request.user.email;

    const updateEmail = newEmail && oldEmail && newEmail !== oldEmail;
    const updateName = newName && newName !== (oldName ?? null);

    if (!updateEmail && !updateName) {
        return NextResponse.json(
            { error: "Provide (newEmail, oldEmail) and/or newName with actual changes. For name-only pass oldEmail to identify the candidate." },
            { status: 400 }
        );
    }

    if (!oldEmail || !orgID) {
        console.error("[update-candidate-details] Missing required data: oldEmail or orgID");
        return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    try {
        const { db } = await connectMongoDB();

        const member = await verifyUserIsMember(db, userEmail, orgID);
        if (!member.authorized) {
            return NextResponse.json({ error: member.reason }, { status: 403 });
        }

        // Validate candidate is not associated with any other org
        const otherOrg = await db.collection("affiliations").findOne({ "applicantInfo.email": oldEmail, orgID: { $ne: orgID } });
        if (otherOrg) {
            return NextResponse.json({ error: "Candidate details cannot be updated as they are associated with other organizations" }, { status: 400 });
        }

        await Promise.all([
            db.collection("applicants").updateOne({ email: oldEmail }, { $set: { email: newEmail, name: newName } }),
            db.collection("affiliations").updateMany({ "applicantInfo.email": oldEmail, orgID: orgID }, { $set: { "applicantInfo.email": newEmail, "applicantInfo.name": newName } }),
            db.collection("applicant-cv").updateOne({ email: oldEmail }, { $set: { email: newEmail, name: newName } }),
            db.collection("interviews").updateMany({ email: oldEmail, orgID: orgID }, { $set: { email: newEmail, name: newName } }),
            db.collection("org-candidate-skills").updateMany({ candidateEmail: oldEmail, orgID: orgID }, { $set: { candidateEmail: newEmail } }),
            db.collection("candidate-skills").updateMany({ candidateEmail: oldEmail }, { $set: { candidateEmail: newEmail } }),
            db.collection("comments").updateMany({ candidateEmail: oldEmail, orgID: orgID }, { $set: { candidateEmail: newEmail, name: newName } }),
            db.collection("schedule-email").updateMany({ to: oldEmail, orgID: orgID }, { $set: { to: newEmail } }),
            db.collection("mailgun-messages").updateMany({ organizationId: new ObjectId(orgID), toList: { $exists: true, $ne: null }, $expr: { $isArray: "$toList" } }, { $set: { "toList.$[elem]": newEmail }}, { arrayFilters: [{ "elem": oldEmail }] }),
            db.collection("mailgun-messages").updateMany({ organizationId: new ObjectId(orgID), to: { $exists: true, $ne: null }, $expr: { $isArray: "$to" } }, { $set: { "to.$[elem]": newEmail }}, { arrayFilters: [{ "elem": oldEmail }] }),
            db.collection("mailgun-messages").updateMany({ organizationId: new ObjectId(orgID), $or: [{ toRaw: oldEmail }, { toRaw: `${oldName} <${oldEmail}>` }] }, { $set: { toRaw: `${newName} <${newEmail}>` }}),
            db.collection("sourcing-projects").updateMany({ orgID: orgID, leads: { $exists: true, $ne: null }, $expr: { $isArray: "$leads" } }, { $set: { "leads.$[elem].candidateEmail": newEmail, "leads.$[elem].candidateName": newName }}, { arrayFilters: [{ "elem.candidateEmail": oldEmail }] })
        ]);

        return NextResponse.json({ message: "Candidate updated" });
    } catch (error) {
        console.error("Error updating candidate:", error);
        return NextResponse.json({ error: "Failed to update candidate" }, { status: 500 });
    }
});