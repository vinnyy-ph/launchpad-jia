import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { getDomainVerifyRecords as mgGetDomainVerifyRecords, getDmarcRecord as mgGetDmarcRecord } from "@/lib/mailgun/MailgunUtils";

function normalizeRecords(payload: any, domain?: string) {
  const rows: { type: string; host: string; value: string }[] = [];
  const push = (rec: any) => {
    if (!rec) return;
    const type = rec.type || rec.record_type || rec.kind || "";
    const host = rec.name || rec.host || rec.hostname || rec.label || "";
    const value = rec.value || rec.target || rec.record || rec.data || rec.rdata || "";
    if (type && (host || value)) {
      let finalHost = String(host);
      // For MX, TXT, SPF records without a host, use the domain itself
      if (!finalHost && domain && ["MX", "TXT", "SPF"].includes(String(type).toUpperCase())) {
        finalHost = domain;
      }
      if (finalHost || value) {
        rows.push({ type: String(type).toUpperCase(), host: finalHost, value: String(value) });
      }
    }
  };

  const groups = [
    payload?.sending_dns_records,
    payload?.receiving_dns_records,
    payload?.tracking_dns_records,
    payload?.dkim_records,
    payload?.cname_records,
    payload?.mx_records,
    payload?.txt_records,
    payload?.spf_records,
    payload?.sending,
    payload?.receiving,
    payload?.dkim,
    payload?.cname,
  ];

  for (const group of groups) {
    if (!group) continue;
    if (Array.isArray(group)) group.forEach(push);
    else if (typeof group === "object") Object.values(group).forEach(push);
  }

  // DMARC record may come from separate endpoint
  const dmarcRecord =
    payload?.dmarc_record ||
    payload?.dmarc?.record ||
    payload?.dmarc?.value ||
    payload?.dmarc?.dmarc_record ||
    payload?.dmarc?.policy_record;
  if (dmarcRecord) {
    const dmarcHost = payload?.dmarc_name || payload?.dmarc?.name || payload?.dmarc?.authority || (domain ? `_dmarc.${domain}` : "_dmarc");
    push({ type: "TXT", name: dmarcHost, value: dmarcRecord });
  }

  // Deduplicate
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.type}|${r.host}|${r.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    const domainParam = url.searchParams.get("domain");

    if (!orgId && !domainParam) {
      return NextResponse.json({ message: "Provide orgId or domain" }, { status: 400 });
    }

    const { db } = await connectMongoDB();

    // Require an authenticated member
    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let fullDomain = (domainParam || "").trim();

    if (orgId) {
      if (!ObjectId.isValid(orgId)) {
        return NextResponse.json({ message: "Invalid orgId" }, { status: 400 });
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

      // If caller passed domain explicitly, respect it; otherwise fallback to org subdomain
      if (!fullDomain) {
        const subdomainRecord = await db
          .collection("organization-domains")
          .findOne({ orgId: orgObjectId });

        if (!subdomainRecord || !subdomainRecord.fullDomain) {
          return NextResponse.json(
            { message: "No subdomain configured for this organization" },
            { status: 404 }
          );
        }
        fullDomain = subdomainRecord.fullDomain;
      }
    }

    if (!fullDomain) {
      return NextResponse.json({ message: "Missing domain" }, { status: 400 });
    }

    // Get DNS records required for verification (GET variant)
    const verifyRequirements = await mgGetDomainVerifyRecords(fullDomain);
    if (!verifyRequirements.success) {
      const errorText = String(verifyRequirements.error || "");
      const isNotFound = errorText.includes("404") || errorText.toLowerCase().includes("not found");
      const isConfigMissing = errorText.toLowerCase().includes("missing mailgun config");
      const status = isNotFound ? 404 : isConfigMissing ? 500 : 502;
      const message = isNotFound
        ? "Domain not found in Mailgun. Add the domain first."
        : isConfigMissing
        ? "Mailgun configuration missing on the server."
        : "Failed to fetch verification records";
      return NextResponse.json(
        { message, error: verifyRequirements.error },
        { status }
      );
    }

    let verifyPayload: any = verifyRequirements.result || {};

    // If DMARC record missing, fetch it explicitly
    if (!verifyPayload?.dmarc_record && fullDomain) {
      try {
        console.log(`DMARC missing in verify payload for ${fullDomain}, fetching explicitly...`);
        const dmarcResult = await mgGetDmarcRecord(fullDomain);
        console.log(`DMARC fetch result:`, JSON.stringify(dmarcResult, null, 2));
        
        if (dmarcResult.success && dmarcResult.result) {
          const dmarcData: any = dmarcResult.result;
          const dmarcValue = dmarcData?.record || dmarcData?.value || dmarcData?.dmarc_record || dmarcData?.policy_record;
          const dmarcName = dmarcData?.name || dmarcData?.authority || `_dmarc.${fullDomain}`;
          
          if (dmarcValue) {
            verifyPayload = {
              ...verifyPayload,
              dmarc: dmarcData,
              dmarc_record: dmarcValue,
              dmarc_name: dmarcName,
            };
            console.log(`DMARC fetched for ${fullDomain}: name=${dmarcName} value=${dmarcValue}`);
          } else {
            console.warn(`DMARC API returned success but no value for ${fullDomain}`);
          }
        } else {
          console.error(`DMARC fetch failed for ${fullDomain}:`, dmarcResult.error);
        }
      } catch (e) {
        console.error(`DMARC fetch exception for ${fullDomain}:`, e);
      }
    }

    const normalized = normalizeRecords(verifyPayload, fullDomain);

    return NextResponse.json(
      {
        domain: fullDomain,
        records: normalized,
        raw: verifyRequirements.result || {},
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("fetch-dns-records error", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
