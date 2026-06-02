import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsAdmin } from "@/lib/utils/adminAuth";
import { Project } from "@/lib/types/projects";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { orgID, email } = await request.json();

  const { db } = await connectMongoDB();

  // Security Check: Verify if the requester is an admin
  const requesterEmail = request.user.email;
  if (!requesterEmail) {
    return NextResponse.json(
      { error: "User email not found in token" },
      { status: 401 }
    );
  }

  const authResult = await verifyUserIsAdmin(db, requesterEmail, orgID);
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.reason },
      { status: 403 }
    );
  }

  const member = await db.collection("members").findOne({ email, orgID });

  if (!member) {
    return NextResponse.json({ message: "Member not found" }, { status: 404 });
  }

  // Check if member owns any projects
  const projects = await db.collection("projects")
    .find({ orgID, "owner.email": email })
    .project({ _id: 1, name: 1 })
    .toArray();

  if (projects.length > 0) {
    return NextResponse.json({
      error: "Cannot delete member who owns projects",
      message: "Please transfer ownership before deleting:",
      projects: projects.map((p: Project) => ({ _id: p._id, name: p.name }))
    }, { status: 409 });
  }

  // Remove member from all projects members arrays
  await db.collection("projects").updateMany(
    {
      orgID,
      members: { $elemMatch: { email } }
    },
    {
      $pull: { members: { email } } as any,
      $set: { updatedAt: new Date() }
    }
  );

  await Promise.all([
    db.collection("members").deleteOne({ email, orgID }),
    db.collection("notifications").deleteMany({ userId: email, orgID }),
    db.collection("push-subscriptions").deleteMany({ userId: email, orgID }),
  ]);

  return NextResponse.json(
    { message: "Member deleted successfully" },
    { status: 200 }
  );
});
