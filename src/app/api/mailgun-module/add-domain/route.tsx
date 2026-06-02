import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { 
  getDomain as mgGetDomain, 
  createDomain as mgCreateDomain,
  getDomainCredentials as mgGetDomainCredentials,
  createDomainSendingKey as mgCreateDomainSendingKey,
  getDmarcRecord as mgGetDmarcRecord,
} from "@/lib/mailgun/MailgunUtils";
import { encrypt } from "@/lib/utils/cryptography";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const urlOrgId = url.searchParams.get("orgID") || url.searchParams.get("orgId");
    const body = await req.json().catch(() => ({}));
    const bodyOrgId = body?.orgId || body?.orgID;
    const orgId = String(urlOrgId || bodyOrgId || "").trim();
    const explicitDomain = String(body?.domain || "").trim();
    const spamActionRaw = String(body?.spamAction || "disabled").toLowerCase();
    const spamAction: "disabled" | "tag" = spamActionRaw === "tag" ? "tag" : "disabled";
    const wildcard = Boolean(body?.wildcard || false);

    if (!orgId && !explicitDomain) {
      return NextResponse.json({ message: "Provide orgId or domain" }, { status: 400 });
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let orgObjectId: ObjectId | null = null;
    let fullDomain = explicitDomain;
    let org: any = null;

    if (orgId) {
      if (!ObjectId.isValid(orgId)) {
        return NextResponse.json({ message: "Invalid orgId" }, { status: 400 });
      }
      orgObjectId = new ObjectId(orgId);

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

      // Find subdomain record for this org to resolve domain
      const subdomainRecord = await db
        .collection("organization-domains")
        .findOne({ orgId: orgObjectId });

      if (!subdomainRecord && !fullDomain) {
        return NextResponse.json(
          { message: "No subdomain configured for this organization and no explicit domain provided" },
          { status: 404 }
        );
      }
      fullDomain = fullDomain || subdomainRecord?.fullDomain || "";

      // Check domain limit (max 5 domains per organization)
      org = await db.collection("organizations").findOne({ _id: orgObjectId });
      const existingDomains = org?.companyDomains || [];
      if (existingDomains.length >= 5) {
        return NextResponse.json(
          { message: "Organization has reached maximum of 5 domains" },
          { status: 400 }
        );
      }
    }

    if (!fullDomain) {
      return NextResponse.json({ message: "Missing domain" }, { status: 400 });
    }

    // Check if domain already exists across any organization (not just Mailgun)
    const existingDomainRecord = await db.collection("organization-domains").findOne({
      fullDomain: fullDomain,
    });

    if (existingDomainRecord && String(existingDomainRecord.orgId) !== String(orgObjectId)) {
      // Domain exists in a different organization
      return NextResponse.json(
        { 
          error: "This domain is already registered in another organization",
          message: "Domain already exists across organizations"
        },
        { status: 409 }
      );
    }

    // Check if domain already exists in current org
    const existingOrgDomain = await db.collection("organization-domains").findOne({
      orgId: orgObjectId,
      fullDomain: fullDomain,
    });

    if (existingOrgDomain) {
      // Check if we should reactivate instead of creating new
      const existingAccount = await db.collection("mailgun-accounts").findOne({
        orgId: orgObjectId,
        domain: fullDomain,
        email: userEmail,
        isActive: false,
      });

      if (existingAccount) {
        // Reactivate the existing account
        console.log(`Reactivating existing mailgun account for ${userEmail} on domain ${fullDomain}`);
        await db.collection("mailgun-accounts").updateOne(
          { _id: existingAccount._id },
          { $set: { isActive: true, updatedAt: new Date() } }
        );

        return NextResponse.json(
          {
            message: "Domain reactivated successfully",
            domain: fullDomain,
            reactivated: true,
          },
          { status: 200 }
        );
      }

      // Domain already exists and is active
      return NextResponse.json(
        { 
          error: "This domain is already configured for your organization",
          message: "Domain already exists in organization"
        },
        { status: 409 }
      );
    }

    // Check if domain already exists in Mailgun
    let existing = null;
    try {
      existing = await mgGetDomain(fullDomain);
    } catch (_) { /* ignore missing */ }

    if (existing) {
      console.log(`Domain already exists in Mailgun: ${fullDomain}. Saving to DB and creating new sending key...`);
      
      // Always create a new sending key for this organization
      let domainSendingKey: string | null = null;
      const encryptSendingKey = (key: string | null) => {
        if (!key) return null;
        const encrypted = encrypt(key);
        if (!encrypted) {
          console.warn("Failed to encrypt domain sending key; storing raw value");
          return key;
        }
        return encrypted;
      };
      
      try {
        console.log(`Creating new domain-specific sending key for ${fullDomain}...`);
        const orgName = org?.name || orgId;
        const keyResult = await mgCreateDomainSendingKey(fullDomain, `Domain sending key for ${orgName}`);
        if (keyResult.success) {
          const keyData: any = keyResult.result || {};
          let keySecret = null;
          if (typeof keyData.key === "string") {
            keySecret = keyData.key;
          } else if (keyData.key && typeof keyData.key.secret === "string") {
            keySecret = keyData.key.secret;
          } else if (typeof keyData.secret === "string") {
            keySecret = keyData.secret;
          }
          if (keySecret) {
            domainSendingKey = keySecret;
            console.log(`Domain sending key created for existing domain ${fullDomain}`);
          }
        } else {
          console.warn("Domain sending key creation failed:", keyResult.error);
        }
      } catch (e) {
        console.warn("Exception during domain sending key creation:", e);
      }

      // Save to database if org context exists
      if (orgObjectId) {
        await db.collection("organization-domains").updateOne(
          { orgId: orgObjectId, fullDomain },
          {
            $set: {
              fullDomain,
              mailgunDomainInfo: existing,
              mailgunDomainCreated: false, // Domain wasn't created by us, it already existed
              domainSendingKey: encryptSendingKey(domainSendingKey),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );

        // Also add domain to organizations collection companyDomains
        await db.collection("organizations").updateOne(
          { _id: orgObjectId },
          {
            $addToSet: { companyDomains: fullDomain },
            $set: { updatedAt: new Date() },
          }
        );
        console.log(`Saved existing Mailgun domain info to database for ${fullDomain}`);

        // Create mailgun accounts for all org members in the background if they don't exist
        (async () => {
          try {
            const members = await db.collection("members").find({
              $or: [
                { orgID: orgId },
                { orgID: orgObjectId },
                { organizationId: orgId },
                { organizationId: orgObjectId },
              ],
            }).toArray();

            if (members.length > 0) {
              console.log(`Creating mailgun accounts for ${members.length} members in background for existing domain ${fullDomain}`);
              
              const accountCreationPromises = members.map(async (member) => {
                try {
                  // Check if account already exists
                  const existingAccount = await db.collection("mailgun-accounts").findOne({
                    orgId: orgObjectId,
                    domain: fullDomain,
                    email: member.email,
                  });

                  if (existingAccount) {
                    // If account exists but is inactive, reactivate it
                    if (existingAccount.isActive === false) {
                      console.log(`Reactivating existing mailgun account for member ${member.email} on domain ${fullDomain}`);
                      await db.collection("mailgun-accounts").updateOne(
                        { _id: existingAccount._id },
                        { $set: { isActive: true, updatedAt: new Date() } }
                      );
                    } else {
                      console.log(`Mailgun account already exists and is active for member ${member.email} on domain ${fullDomain}`);
                    }
                    return;
                  }

                  // Create new account via API
                  const authHeader = req.headers.get("authorization") || "";
                  const response = await fetch(
                    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mailgun-module/mg-enable-acount?orgId=${orgId}`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(authHeader && { "Authorization": authHeader }),
                      },
                      body: JSON.stringify({ userId: String(member._id) }),
                    }
                  );
                  if (response.ok) {
                    console.log(`Created mailgun account for member ${member.email}`);
                  } else {
                    console.warn(`Failed to create mailgun account for member ${member.email}:`, await response.text());
                  }
                } catch (err) {
                  console.error(`Error creating mailgun account for member ${member.email}:`, err);
                }
              });

              Promise.allSettled(accountCreationPromises).then(() => {
                console.log(`Completed background account creation for existing domain ${fullDomain}`);
              }).catch((err) => {
                console.error(`Background account creation error for existing domain ${fullDomain}:`, err);
              });
            }
          } catch (err) {
            console.error(`Error fetching members for background account creation:`, err);
          }
        })();
      }

      return NextResponse.json(
        { 
          message: "Domain already exists in Mailgun and has been saved to database", 
          domain: fullDomain, 
          info: existing,
          domainSendingKey: encryptSendingKey(domainSendingKey),
          existingDomain: true,
        }, 
        { status: 200 }
      );
    }

    // Create domain in Mailgun
    const created = await mgCreateDomain(fullDomain, { spamAction, wildcard });
    if (!created.success) {
      return NextResponse.json(
        { message: "Failed to create domain in Mailgun", error: created.error },
        { status: 502 }
      );
    }

    // Fetch domain-specific credentials if available
    let domainSendingKey: string | null = null;
    const encryptSendingKey = (key: string | null) => {
      if (!key) return null;
      const encrypted = encrypt(key);
      if (!encrypted) {
        console.warn("Failed to encrypt domain sending key; storing raw value");
        return key;
      }
      return encrypted;
    };
    try {
      const credentials = await mgGetDomainCredentials(fullDomain);
      if (credentials.success && credentials.result) {
        const items = credentials.result?.items || credentials.result?.credentials || [];
        if (items.length > 0 && items[0].login) {
          domainSendingKey = items[0].login;
        } else if (credentials.result?.smtp_login) {
          domainSendingKey = credentials.result.smtp_login;
        }
      }
    } catch (_) { /* non-fatal */ }

    // Create domain-specific sending key
    try {
      const orgName = org?.name || orgId;
      const keyResult = await mgCreateDomainSendingKey(fullDomain, `Domain sending key for ${orgName}`);
      if (keyResult.success) {
        const keyData: any = keyResult.result || {};
        let keySecret = null;
        if (typeof keyData.key === "string") {
          keySecret = keyData.key;
        } else if (keyData.key && typeof keyData.key.secret === "string") {
          keySecret = keyData.key.secret;
        } else if (typeof keyData.secret === "string") {
          keySecret = keyData.secret;
        }
        if (keySecret) {
          domainSendingKey = keySecret;
          console.log(`Domain sending key created for ${fullDomain}`);
        }
      }
    } catch (_) { /* non-fatal */ }

    // Fetch DMARC record so we can persist it
    let dmarcRecord: string | null = null;
    let dmarcName: string | null = null;
    try {
      console.log(`Fetching DMARC record for ${fullDomain}...`);
      const dmarcRes = await mgGetDmarcRecord(fullDomain);
      console.log(`DMARC API response:`, JSON.stringify(dmarcRes, null, 2));
      
      if (dmarcRes.success && dmarcRes.result) {
        console.log(`DMARC result object:`, JSON.stringify(dmarcRes.result, null, 2));
        dmarcRecord = dmarcRes.result?.dmarc_record || dmarcRes.result?.record || dmarcRes.result?.value || dmarcRes.result?.policy_record || null;
        dmarcName = dmarcRes.result?.dmarc_name || dmarcRes.result?.name || dmarcRes.result?.authority || `_dmarc.${fullDomain}`;
        console.log(`DMARC parsed for ${fullDomain}: name=${dmarcName} value=${dmarcRecord}`);
      } else {
        console.error(`DMARC fetch failed for ${fullDomain}:`, dmarcRes.error);
      }
    } catch (err) {
      console.error(`DMARC fetch exception for ${fullDomain}:`, err);
    }

    // Persist in organization-domains if org context
    if (orgObjectId) {
      const updateDoc: any = {
        fullDomain,
        mailgunDomainInfo: created.result,
        mailgunDomainCreated: true,
        domainSendingKey: encryptSendingKey(domainSendingKey) || null,
        updatedAt: new Date(),
      };

      // Only save DMARC if we actually got a value from Mailgun
      if (dmarcRecord && dmarcName) {
        updateDoc["mailgunVerificationRecords.dmarc"] = { name: dmarcName, value: dmarcRecord };
        console.log(`Saving DMARC for ${fullDomain}: ${dmarcName} = ${dmarcRecord}`);
      } else {
        console.warn(`No DMARC record to save for ${fullDomain}`);
      }

      await db.collection("organization-domains").updateOne(
        { orgId: orgObjectId, fullDomain },
        { $set: updateDoc },
        { upsert: true }
      );

      // Also add domain to organizations collection companyDomains
      await db.collection("organizations").updateOne(
        { _id: orgObjectId },
        {
          $addToSet: { companyDomains: fullDomain },
          $set: { updatedAt: new Date() },
        }
      );

      // Create mailgun accounts for all org members in the background
      (async () => {
        try {
          const members = await db.collection("members").find({
            $or: [
              { orgID: orgId },
              { orgID: orgObjectId },
              { organizationId: orgId },
              { organizationId: orgObjectId },
            ],
          }).toArray();

          if (members.length > 0) {
            console.log(`Creating/reactivating mailgun accounts for ${members.length} members in background for domain ${fullDomain}`);
            
            // Call mg-enable-account for each member without awaiting
            const accountCreationPromises = members.map(async (member) => {
              try {
                // Check if account already exists
                const existingAccount = await db.collection("mailgun-accounts").findOne({
                  orgId: orgObjectId,
                  domain: fullDomain,
                  email: member.email,
                });

                if (existingAccount) {
                  console.log(`Mailgun account already exists for member ${member.email} on domain ${fullDomain}`);
                  return;
                }

                // Create new account via API
                // Extract Bearer token from original request headers for authentication
                const authHeader = req.headers.get("authorization") || "";
                const response = await fetch(
                  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mailgun-module/mg-enable-acount?orgId=${orgId}`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(authHeader && { "Authorization": authHeader }),
                    },
                    body: JSON.stringify({ userId: String(member._id) }),
                  }
                );
                if (response.ok) {
                  console.log(`Created mailgun account for member ${member.email}`);
                } else {
                  console.warn(`Failed to create mailgun account for member ${member.email}:`, await response.text());
                }
              } catch (err) {
                console.error(`Error creating mailgun account for member ${member.email}:`, err);
              }
            });

            // Don't await - let them run in background
            Promise.allSettled(accountCreationPromises).then(() => {
              console.log(`Completed background account creation/reactivation for domain ${fullDomain}`);
            }).catch((err) => {
              console.error(`Background account creation error for domain ${fullDomain}:`, err);
            });
          }
        } catch (err) {
          console.error(`Error fetching members for background account creation:`, err);
        }
      })();
    }

    return NextResponse.json(
      {
        message: "Domain created in Mailgun",
        domain: fullDomain,
        mailgunDomainCreated: true,
        mailgunDomainInfo: created.result,
        domainSendingKey: encryptSendingKey(domainSendingKey),
        dmarcRecord: dmarcRecord
          ? { type: "TXT", host: dmarcName || `_dmarc.${fullDomain}`, value: dmarcRecord }
          : null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("add-domain error:", err);
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ 
      message: "Internal server error", 
      details: errorMessage,
      error: errorMessage 
    }, { status: 500 });
  }
});
