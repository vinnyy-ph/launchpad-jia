import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { Sort } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { searchParams } = new URL(request.url);
  const authUserEmail = request.user.email;
  const orgID = searchParams.get("orgID");
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const limit = Math.max(parseInt(searchParams.get("limit") || "10", 10), 1);
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");
  const role = searchParams.get("role");
  const sortConfig = searchParams.get("sortConfig");

  if (!orgID) {
    return NextResponse.json(
      { error: "orgID is required" },
      { status: 400 }
    );
  }

  if (!authUserEmail) {
    return NextResponse.json(
      { error: "User email not found in token" },
      { status: 401 }
    );
  }

  try {
    const { db } = await connectMongoDB();

    // Security Check: Verify if the requester is a member of the organization or a SuperAdmin
    const authResult = await verifyUserIsMember(db, authUserEmail, orgID);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.reason },
        { status: 403 }
      );
    }

    const filter: Record<string, any> = { orgID };

    if (search) {
      const regex = { $regex: search, $options: "i" };
      filter.$or = [{ email: regex }, { name: regex }];
    }

    // Filter by status
    if (status && status !== "All Statuses") {
      filter.status = status.toLowerCase();
    }

    // Filter by role
    if (role && role !== "All Roles") {
      // Map display role names to DB values
      const roleMap: Record<string, string> = {
        "Admin": "admin",
        "Hiring Manager": "hiring_manager",
        "Guest": "guest",
      };
      filter.role = roleMap[role] || role.toLowerCase();
    }

    // Build sort config
    let defaultSort: Sort = { createdAt: 1, _id: 1 }; // Oldest first by default
    if (sortConfig) {
      try {
        const config = JSON.parse(sortConfig);
        const key = config.key;
        defaultSort = { [key]: config.direction === "ascending" ? 1 : -1, _id: 1 };
      } catch (e) {
        // Keep default sort on parse error
      }
    }

    const collection = db.collection("members");
    const members = await collection
      .find(filter)
      .sort(defaultSort)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments(filter);

    return NextResponse.json({
      members,
      totalMembers: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("search-members error:", error);
    return NextResponse.json(
      { error: "Failed to search members" },
      { status: 500 }
    );
  }
});