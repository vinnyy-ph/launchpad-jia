import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { getDomainCredentials as mgGetDomainCredentials } from "@/lib/mailgun/MailgunUtils";

// Normalize and transliterate special characters for email usernames (handles enye, accents, etc)
function generateEmailUsername(input) {
  return (
    (input || "")
      // Normalize Unicode
      .normalize("NFD")

      // Handle special letters that do NOT decompose
      .replace(/[Ææ]/g, "ae")
      .replace(/[Œœ]/g, "oe")
      .replace(/[ß]/g, "ss")
      .replace(/[Øø]/g, "o")
      .replace(/[Đđ]/g, "d")
      .replace(/[Łł]/g, "l")
      .replace(/[Ññ]/g, "n")

      // Remove diacritics
      .replace(/[\u0300-\u036f]/g, "")

      // Convert to lowercase
      .toLowerCase()

      // Replace spaces with dots
      .replace(/\s+/g, ".")

      // Remove anything not allowed in email usernames
      .replace(/[^a-z0-9._-]/g, "")

      // Remove duplicate dots
      .replace(/\.{2,}/g, ".")

      // Trim dots from start/end
      .replace(/^\.|\.$/g, "")
  );
}

// Build professional-looking mailbox candidates using generateEmailUsername for normalization
function buildMailboxCandidates(member: any): string[] {
  const rawEmailLocal = (member?.email || "").split("@")[0] || "";
  const first = generateEmailUsername(
    member?.firstName || member?.first_name || "",
  );
  const last = generateEmailUsername(
    member?.lastName || member?.last_name || "",
  );
  const fullName = generateEmailUsername(member?.name || "");
  const emailLocal = generateEmailUsername(rawEmailLocal);

  const candidates: string[] = [];
  if (first && last) {
    candidates.push(`${first}.${last}`);
    candidates.push(`${first}${last}`);
    candidates.push(`${first.charAt(0)}${last}`);
  }
  if (fullName) candidates.push(fullName);
  if (emailLocal) candidates.push(emailLocal);

  // Deduplicate while preserving order
  return Array.from(new Set(candidates.filter(Boolean)));
}

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    // Prefer orgId from the request URL (current org in UI), fall back to body
    const url = new URL(req.url);
    const urlOrgId =
      url.searchParams.get("orgID") || url.searchParams.get("orgId");

    const body = await req.json();
    const bodyOrgId = body?.orgId || body?.orgID;
    const createInbound = !!body?.createInbound;

    const effectiveOrgId = String(urlOrgId || bodyOrgId || "").trim();

    if (!effectiveOrgId) {
      return NextResponse.json({ message: "Missing orgId" }, { status: 400 });
    }

    // Validate org id format
    if (!ObjectId.isValid(effectiveOrgId)) {
      return NextResponse.json({ message: "Invalid orgId" }, { status: 400 });
    }

    const { db } = await connectMongoDB();

    // Determine the authenticated member from the token
    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Find a member record for this email that belongs to the effective org.
    const orgObjectId = new ObjectId(effectiveOrgId);
    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: effectiveOrgId },
        { orgID: orgObjectId },
        { organizationId: effectiveOrgId },
        { organizationId: orgObjectId },
      ],
    });

    if (!memberInOrg) {
      return NextResponse.json(
        { message: "Forbidden - member does not belong to this organization" },
        { status: 403 },
      );
    }

    const member = memberInOrg;

    const org = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(effectiveOrgId) });

    if (!member || !org) {
      return NextResponse.json(
        { message: "User or organization not found" },
        { status: 404 },
      );
    }

    // Fetch organization's domains (fullDomain) from organization-domains
    const orgSubdomains = await db
      .collection("organization-domains")
      .find({
        $or: [{ orgId: orgObjectId }, { orgId: effectiveOrgId }],
      })
      .toArray();

    if (!orgSubdomains.length) {
      return NextResponse.json(
        { message: "No domains were found for that organization" },
        { status: 404 },
      );
    }

    const primaryDomainRecord = orgSubdomains[0];
    const fullDomain = (primaryDomainRecord?.fullDomain || "").trim();

    if (!fullDomain) {
      return NextResponse.json(
        { message: "No domains were found for that organization" },
        { status: 404 },
      );
    }

    // Fetch domain-level sending credentials if available
    let domainSendingKey: string | null = null;
    try {
      if (process.env.MAILGUN_DOMAIN_KEY) {
        console.log(
          `Fetching domain credentials for shared domain ${fullDomain}...`,
        );
        const credentialsResult = await mgGetDomainCredentials(fullDomain);
        if (credentialsResult.success && credentialsResult.result) {
          const items =
            credentialsResult.result?.items ||
            credentialsResult.result?.credentials ||
            [];
          if (items.length > 0 && items[0].login) {
            domainSendingKey = items[0].login;
            console.log(
              `✓ Retrieved domain sending key: ${domainSendingKey?.substring(0, 8)}...`,
            );
          } else if (credentialsResult.result?.smtp_login) {
            domainSendingKey = credentialsResult.result.smtp_login;
            console.log(
              `✓ Retrieved domain SMTP login: ${domainSendingKey?.substring(0, 8)}...`,
            );
          }
        } else {
          console.warn(
            `Failed to fetch domain credentials:`,
            credentialsResult.error,
          );
        }
      }
    } catch (e) {
      console.warn(
        `Mailgun domain credential lookup encountered an issue for ${fullDomain}:`,
        e,
      );
    }

    // Build mailbox name from user info with professional fallbacks (no numbers by default)
    const candidateBases = buildMailboxCandidates(member);
    const baseMailboxName =
      candidateBases[0] ||
      generateEmailUsername((member.email || "user").split("@")[0]);
    const userObjectId = new ObjectId(String(member._id));

    // Create accounts for all available organization domains
    const createdIdentities: any[] = [];

    for (const domainRecord of orgSubdomains) {
      const accountDomain = (domainRecord?.fullDomain || "").trim();
      if (!accountDomain) continue;

      // Build email for this domain
      const accountMailboxName = baseMailboxName;
      const accountEmail = `${accountMailboxName}@${accountDomain}`;

      // If this exact email already exists for any user, skip creating another to avoid duplicates
      const existingEmail = await db
        .collection("mailgun-accounts")
        .findOne({ email: accountEmail });
      if (existingEmail) {
        console.log(
          `Email already provisioned (${accountEmail}); skipping duplicate creation`,
        );
        createdIdentities.push({
          _id: String(existingEmail._id),
          userId: existingEmail.userId ? String(existingEmail.userId) : null,
          organizationId: existingEmail.organizationId
            ? String(existingEmail.organizationId)
            : null,
          subdomainId: existingEmail.subdomainId
            ? String(existingEmail.subdomainId)
            : null,
          email: existingEmail.email,
          domain: existingEmail.domain,
          routeId: existingEmail.routeId || null,
          displayName: existingEmail.displayName || null,
          canSend: false,
          canReceive: !!existingEmail.routeId,
          skipped: true,
        });
        continue;
      }

      const newAccount: any = {
        userId: userObjectId,
        organizationId: new ObjectId(effectiveOrgId),
        subdomainId: domainRecord?._id || null,
        displayName: (() => {
          try {
            if (member && member.name) return String(member.name);
            const first = member?.firstName || member?.first_name || "";
            const last = member?.lastName || member?.last_name || "";
            const combined = `${first} ${last}`.trim();
            if (combined) return combined;
            if (member && member.email)
              return String(member.email).split("@")[0];
          } catch (e) {
            /* ignore */
          }
          return accountMailboxName;
        })(),
        email: accountEmail,
        mailboxName: accountMailboxName,
        domain: accountDomain,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        const saved = await db
          .collection("mailgun-accounts")
          .findOneAndUpdate(
            { email: accountEmail },
            { $setOnInsert: newAccount },
            { upsert: true, returnDocument: "after" },
          );

        // If it already existed between our check and insert, treat as skipped
        if (saved.lastErrorObject?.updatedExisting && saved.value) {
          createdIdentities.push({
            _id: String(saved.value._id),
            userId: saved.value.userId ? String(saved.value.userId) : null,
            organizationId: saved.value.organizationId
              ? String(saved.value.organizationId)
              : null,
            subdomainId: saved.value.subdomainId
              ? String(saved.value.subdomainId)
              : null,
            email: saved.value.email,
            domain: saved.value.domain,
            displayName: saved.value.displayName || null,
            canSend: false,
            canReceive: !!saved.value.routeId,
            skipped: true,
          });
          console.log(
            `Account already existed for ${accountEmail}, skip creating duplicate`,
          );
        } else if (saved.value) {
          createdIdentities.push({
            _id: String(saved.value._id),
            userId: saved.value.userId ? String(saved.value.userId) : null,
            organizationId: saved.value.organizationId
              ? String(saved.value.organizationId)
              : null,
            subdomainId: saved.value.subdomainId
              ? String(saved.value.subdomainId)
              : null,
            email: saved.value.email,
            domain: saved.value.domain,
            displayName: saved.value.displayName || null,
            // Mark capabilities true so the client can proceed; actual ability depends on domain wiring
            canSend: true,
            canReceive: true,
          });
          console.log(`Created account: ${saved.value.email}`);
        }
      } catch (err) {
        console.error(`Failed to create account for ${accountEmail}:`, err);
        // Continue creating accounts for other domains
      }
    }

    return NextResponse.json(
      {
        identities: createdIdentities,
        totalCreated: createdIdentities.length,
        message: `Created ${createdIdentities.length} mailgun account(s) for organization domains`,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("mg-enable-account error", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
});
