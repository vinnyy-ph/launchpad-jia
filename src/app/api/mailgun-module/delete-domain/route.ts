import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { deleteDomain as mgDeleteDomain } from "@/lib/mailgun/MailgunUtils";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const urlOrgId = url.searchParams.get("orgID") || url.searchParams.get("orgId");
    const body = await req.json().catch(() => ({}));
    const bodyOrgId = body?.orgId || body?.orgID;
    const orgId = String(urlOrgId || bodyOrgId || "").trim();
    const domain = String(body?.domain || "").trim();

    if (!orgId || !domain) {
      console.error("[delete-domain] Missing required data: orgId or domain");
      return NextResponse.json(
        { message: "Missing required data" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(orgId)) {
      return NextResponse.json({ message: "Invalid orgId" }, { status: 400 });
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const orgObjectId = new ObjectId(orgId);

    // Confirm membership in org
    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: orgId },
        { orgID: orgObjectId },
        { organizationId: orgId },
        { organizationId: orgObjectId },
      ],
    });

    if (!memberInOrg) {
      return NextResponse.json(
        { message: "Forbidden - member does not belong to this organization" },
        { status: 403 }
      );
    }

    console.log(`Starting domain deletion for ${domain} from org ${orgId}`);

    // Step 1: Remove domain from organizations collection's companyDomains array
    const orgUpdateResult = await db.collection("organizations").updateOne(
      { _id: orgObjectId },
      {
        $pull: { companyDomains: domain } as any,
        $set: { updatedAt: new Date() },
      }
    );

    console.log(`Removed domain from organization companyDomains array. Modified: ${orgUpdateResult.modifiedCount}`);

    // Step 2: Delete the domain document from organization-domains collection
    const domainDeleteResult = await db.collection("organization-domains").deleteOne({
      orgId: orgObjectId,
      fullDomain: domain,
    });

    console.log(`Deleted domain document from organization-domains. Deleted: ${domainDeleteResult.deletedCount}`);

    // Step 3: Set isActive to false for all mailgun-accounts using this domain
    const accountsUpdateResult = await db.collection("mailgun-accounts").updateMany(
      {
        organizationId: orgObjectId,
        domain: domain,
      },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`Deactivated ${accountsUpdateResult.modifiedCount} mailgun accounts for domain ${domain}`);

    // Step 4: Delete the domain from Mailgun
    let mailgunDeleteResult: any = { success: false, message: "Not attempted" };
    try {
      mailgunDeleteResult = await mgDeleteDomain(domain);
      if (mailgunDeleteResult.success) {
        console.log(`Successfully deleted domain ${domain} from Mailgun`);
      } else {
        console.warn(`Failed to delete domain ${domain} from Mailgun:`, mailgunDeleteResult.error);
      }
    } catch (mailgunError) {
      console.error(`Error deleting domain ${domain} from Mailgun:`, mailgunError);
      mailgunDeleteResult = { 
        success: false, 
        error: mailgunError instanceof Error ? mailgunError.message : String(mailgunError) 
      };
    }

    return NextResponse.json(
      {
        message: "Domain deletion completed",
        domain,
        results: {
          organizationUpdate: {
            success: orgUpdateResult.modifiedCount > 0,
            modifiedCount: orgUpdateResult.modifiedCount,
          },
          domainDocumentDelete: {
            success: domainDeleteResult.deletedCount > 0,
            deletedCount: domainDeleteResult.deletedCount,
          },
          mailgunAccountsDeactivated: {
            success: accountsUpdateResult.modifiedCount >= 0,
            modifiedCount: accountsUpdateResult.modifiedCount,
          },
          mailgunDeletion: {
            success: mailgunDeleteResult.success,
            message: mailgunDeleteResult.message || mailgunDeleteResult.error,
          },
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("delete-domain error", err);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
});
