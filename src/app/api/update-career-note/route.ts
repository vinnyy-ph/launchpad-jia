import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

// JIA-431 "[Pipeline Report] Be able to add note in a job/career":
// adds/updates a recruiter-only note on a career. The note lives on the career
// document and is only ever surfaced in the recruiter portal (pipeline report) —
// no applicant-facing route reads `notes`.

// Generous for a per-career recruiter note; blocks multi-MB payloads being stored verbatim.
const MAX_NOTE_LENGTH = 5000;

export const POST = withAuth(async (request: AuthenticatedRequest) => {
    const { _id, orgID, note } = await request.json();
    const email = request.user?.email;

    if (!_id) {
        return NextResponse.json({ error: "Career _id is required" }, { status: 400 });
    }
    // Malformed ids previously reached `new ObjectId(_id)` and threw -> unhandled 500.
    if (!ObjectId.isValid(_id)) {
        return NextResponse.json({ error: "Invalid career _id" }, { status: 400 });
    }
    if (!orgID) {
        return NextResponse.json({ error: "orgID is required" }, { status: 400 });
    }
    if (typeof note === "string" && note.length > MAX_NOTE_LENGTH) {
        return NextResponse.json({ error: `note exceeds ${MAX_NOTE_LENGTH} characters` }, { status: 400 });
    }

    const { db } = await connectMongoDB();

    const authResult = await verifyUserIsMember(db, email, orgID);
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.reason }, { status: 403 });
    }

    const career = await db.collection("careers").findOne({ _id: new ObjectId(_id) });
    if (!career) {
        return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }
    // Ensure the career belongs to the caller's organization.
    if (String(career.orgID) !== String(orgID)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.collection("careers").updateOne(
        { _id: new ObjectId(_id) },
        { $set: { notes: typeof note === "string" ? note : "", updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, notes: typeof note === "string" ? note : "" });
});
