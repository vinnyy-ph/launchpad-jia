import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { cleanEmailSubject } from "@/lib/utils/emailCandidate";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Received campaign data:", JSON.stringify(body, null, 2));
    
    // userId is removed as per user request
    const { campaignId, threadIds, senderEmail, orgId, subject, careerId } = body;

    // Log missing fields if any
    if (!campaignId || !threadIds || !senderEmail || !orgId) {
      const missing = [];
      if (!campaignId) missing.push("campaignId");
      if (!threadIds) missing.push("threadIds");
      if (!senderEmail) missing.push("senderEmail");
      if (!orgId) missing.push("orgId");
      
      console.error("Missing required fields in campaign data:", missing.join(", "));
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const cleanedSubject = cleanEmailSubject(subject ?? "");
    const campaignData = {
      _id: new ObjectId(campaignId),
      threadIds,
      senderEmail,
      subject: cleanedSubject || "(No Subject)",
      // userId field removed
      orgId,
      ...(careerId != null && careerId !== "" && { careerId }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("email-campaigns").insertOne(campaignData);
    console.log("Campaign saved to MongoDB:", result.insertedId);

    return NextResponse.json({ success: true, message: "Campaign saved successfully", id: result.insertedId });
  } catch (error: any) {
    console.error("Error saving email campaign:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const { db } = await connectMongoDB();

    const campaigns = await db
      .collection("email-campaigns")
      .find({ orgId: orgId })
      .sort({ createdAt: -1 })
      .toArray();

    const formattedCampaigns = campaigns.map((campaign: any) => ({
      _id: campaign._id,
      subject: campaign.subject || "(No Subject)",
      senderEmail: campaign.senderEmail,
      recipientCount: campaign.threadIds?.length || 0,
      careerId: campaign.careerId ?? null,
      createdAt: campaign.createdAt,
    }));

    return NextResponse.json({ campaigns: formattedCampaigns });
  } catch (error: any) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
