import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        {
          success: false,
          message: "orgId is required",
        },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(orgId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid orgId format",
        },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Query organization-domains collection for all domains belonging to this organization
    const domains = await db
      .collection("organization-domains")
      .find({
        orgId: new ObjectId(orgId),
      })
      .toArray();

    return NextResponse.json(domains, { status: 200 });
  } catch (error) {
    console.error("Error fetching organization domains:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch organization domains",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
