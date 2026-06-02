import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { subdomain } = await request.json();

    if (!subdomain || typeof subdomain !== 'string') {
      return NextResponse.json({ error: "Invalid subdomain" }, { status: 400 });
    }

    const { db } = await connectMongoDB();
    const organizationsCollection = db.collection("organizations");

    const organization = await organizationsCollection.findOne({
      companySlug: subdomain.toLowerCase().trim(),
      brandedPortalEnabled: true,
      status: { $ne: "inactive" },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      orgID: organization._id.toString(),
      name: organization.name,
      logo: organization.image,
    });
  } catch (error) {
    console.error("Error resolving subdomain:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
