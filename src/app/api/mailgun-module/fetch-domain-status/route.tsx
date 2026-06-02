import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyDomain as mgVerifyDomain } from "@/lib/mailgun/MailgunUtils";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    const domain = url.searchParams.get("domain");

    if (!orgId) {
      return NextResponse.json({ message: "Missing orgId" }, { status: 400 });
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

    // Build query: if domain is provided, search for that specific domain; otherwise, find Jia subdomain
    const query: any = { orgId: orgObjectId };
    if (domain) {
      query.fullDomain = domain;
    } else {
      query.fullDomain = { $regex: `\\.hellojia\\.ai$` }; // Default: look for Jia subdomains
    }

    const subdomainRecord = await db
      .collection("organization-domains")
      .findOne(query);

    if (!subdomainRecord) {
      return NextResponse.json(
        {
          status: "not_configured",
          message: domain
            ? `Domain ${domain} not found in Mailgun. Please add it first.`
            : "No subdomain configured. Please create a company slug first.",
        },
        { status: 200 }
      );
    }

    // Fetch live verification status from Mailgun API
    const fullDomain = subdomainRecord.fullDomain;
    let status = "unknown";
    let message = "";
    let verificationRecords = {};

    try {
      const verifyResult = await mgVerifyDomain(fullDomain);

      if (verifyResult.success && verifyResult.result) {
        const domain = verifyResult.result.domain || {};
        const records = verifyResult.result;

        // Store the verification records for reference
        verificationRecords = {
          sending: records.sending_dns_records || records.sending,
          receiving: records.receiving_dns_records || records.receiving,
          dkim: records.dkim_records || records.dkim,
          spf: records.spf || {},
          cname: records.cname || {},
        };

        // Determine status based on Mailgun's response
        if (domain.state === "active") {
          status = "active";
          message = "Domain is verified and active.";
        } else if (domain.state === "unverified") {
          status = "unverified";
          message = "Domain verification pending. DNS records propagating.";
        } else if (domain.state === "disabled") {
          status = "disabled";
          message =
            "Unable to fetch verification status. Please contact an administrator.";
        } else {
          // Check individual record validity
          const allRecords = [
            ...(records.sending_dns_records || []),
            ...(records.receiving_dns_records || []),
          ];

          const hasInvalidRecords = allRecords.some(
            (rec: any) => rec.valid === false
          );
          const allValid =
            allRecords.length > 0 &&
            allRecords.every((rec: any) => rec.valid === true);

          if (allValid) {
            status = "active";
            message = "Domain is verified and active.";
          } else if (hasInvalidRecords) {
            status = "unverified";
            message = "Domain verification pending. DNS records propagating.";
          } else {
            status = "pending";
            message = "Subdomain created, verification in progress";
          }
        }

        // Update database with latest verification status
        await db.collection("organization-domains").updateOne(
          { _id: subdomainRecord._id },
          {
            $set: {
              mailgunVerify: verifyResult.result,
              mailgunVerificationRecords: verificationRecords,
              lastVerified: new Date(),
              updatedAt: new Date(),
            },
          }
        );
      } else {
        // Mailgun API call failed, fall back to cached data
        status = "error";
        message =
          "Unable to fetch verification status. Please contact an administrator.";
        verificationRecords = subdomainRecord.mailgunVerificationRecords || {};
      }
    } catch (err) {
      console.error("Error fetching Mailgun verification status:", err);
      // Fall back to cached data from database
      const mailgunVerify = subdomainRecord.mailgunVerify || {};
      verificationRecords = subdomainRecord.mailgunVerificationRecords || {};

      if (mailgunVerify.domain?.state === "active") {
        status = "active";
        message = "Domain is verified and active.";
      } else if (subdomainRecord.cloudflareCreated) {
        status = "pending";
        message = "Verification status unavailable. Check again later.";
      } else {
        status = "unknown";
        message =
          "Unable to determine status. Please contact an administrator.";
      }
    }

    return NextResponse.json(
      {
        status,
        message,
        subdomain: subdomainRecord.subdomain,
        fullDomain: subdomainRecord.fullDomain,
        cloudflareCreated: subdomainRecord.cloudflareCreated,
        mailgunDomainCreated: subdomainRecord.mailgunDomainCreated,
        verificationRecords,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("fetch-domain-status error", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
});
