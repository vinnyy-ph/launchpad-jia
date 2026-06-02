import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  createSubdomain,
  generateSubdomainSlug,
  indexToAlphaSuffix,
  createMailgunVerificationRecords,
  createDNSRecordsFromMailgunDomainResponse,
} from "@/lib/cloudflare/CloudflareUtils";
import {
  getDomain as mgGetDomain,
  createDomain as mgCreateDomain,
  getDomainVerifyRecords as mgGetDomainVerifyRecords,
  verifyDomainWithRetry as mgVerifyDomainWithRetry,
  getDomainCredentials as mgGetDomainCredentials,
  createDomainSendingKey as mgCreateDomainSendingKey,
} from "@/lib/mailgun/MailgunUtils";
import { encrypt } from "@/lib/utils/cryptography";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const urlOrgId = url.searchParams.get("orgID") || url.searchParams.get("orgId");
    const skipVerification = url.searchParams.get("skipVerification") === "true";

    const body = await req.json();
    const bodyOrgId = body?.orgId || body?.orgID;

    const effectiveOrgId = String(urlOrgId || bodyOrgId || "").trim();

    if (!effectiveOrgId) {
      return NextResponse.json({ message: "Missing orgId" }, { status: 400 });
    }

    if (!ObjectId.isValid(effectiveOrgId)) {
      return NextResponse.json({ message: "Invalid orgId" }, { status: 400 });
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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
        { status: 403 }
      );
    }

    const org = await db.collection("organizations").findOne({ _id: orgObjectId });

    if (!org) {
      return NextResponse.json({ message: "Organization not found" }, { status: 404 });
    }

    const baseDomain = "hellojia.ai";
    const preferredSlug = String(org.companySlug || "").trim();
    let orgSubdomain = preferredSlug || generateSubdomainSlug(org.name || "org");
    let fullDomain = `${orgSubdomain}.${baseDomain}`;
    let subdomainRecordId: ObjectId | null = null;
    let cloudflareCreated = false;
    let cloudflareError: any = null;

    // Only reuse existing subdomain record if it's actually a Jia subdomain (ends with hellojia.ai)
    const existingSubdomainRecord = await db.collection("organization-domains").findOne({
      orgId: orgObjectId,
      fullDomain: { $regex: `\\.${baseDomain}$` }, // Must end with .hellojia.ai
    });

    if (existingSubdomainRecord) {
      fullDomain =
        existingSubdomainRecord.fullDomain || `${existingSubdomainRecord.subdomain}.${baseDomain}`;
      orgSubdomain = existingSubdomainRecord.subdomain;
      subdomainRecordId = existingSubdomainRecord._id;
      console.log(`Reusing existing subdomain for org ${effectiveOrgId}: ${fullDomain}`);
    } else {
      let attempt = 1;
      const MAX_SUBDOMAIN_ATTEMPTS = 100;

      while (attempt <= MAX_SUBDOMAIN_ATTEMPTS) {
        const testSubdomain = attempt === 1 ? orgSubdomain : `${orgSubdomain}${indexToAlphaSuffix(attempt - 1)}`;

        const cloudflareResult = await createSubdomain(testSubdomain);

        if (cloudflareResult.success && !cloudflareResult.error) {
          orgSubdomain = testSubdomain;
          fullDomain = cloudflareResult.subdomain;
          cloudflareCreated = true;

          const subdomainDoc = {
            orgId: orgObjectId,
            subdomain: orgSubdomain,
            fullDomain,
            baseDomain,
            cloudflareCreated: true,
            cloudflareRecords: cloudflareResult.records || [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const insertResult = await db.collection("organization-domains").insertOne(subdomainDoc);
          subdomainRecordId = insertResult.insertedId;

          console.log(`Created new Cloudflare subdomain for org: ${fullDomain}`);
          break;
        } else if (cloudflareResult.success && cloudflareResult.error?.includes("already exists")) {
          const existsInDB = await db.collection("organization-domains").findOne({
            subdomain: testSubdomain,
            baseDomain,
          });

          if (existsInDB) {
            console.log(`Subdomain ${testSubdomain} exists in both Cloudflare and DB, trying next...`);
            attempt++;
            continue;
          }

          orgSubdomain = testSubdomain;
          fullDomain = `${testSubdomain}.${baseDomain}`;
          cloudflareCreated = false;

          const subdomainDoc = {
            orgId: orgObjectId,
            subdomain: orgSubdomain,
            fullDomain,
            baseDomain,
            cloudflareCreated: false,
            cloudflareRecords: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const insertResult = await db.collection("organization-domains").insertOne(subdomainDoc);
          subdomainRecordId = insertResult.insertedId;

          console.log(`Reused orphaned Cloudflare subdomain for org: ${fullDomain}`);
          break;
        } else {
          console.error("Cloudflare subdomain creation failed:", cloudflareResult.error);
          cloudflareError = cloudflareResult.error;
          fullDomain = baseDomain;
          break;
        }
      }

      if (attempt > MAX_SUBDOMAIN_ATTEMPTS) {
        cloudflareError = "Could not find unique subdomain";
        fullDomain = baseDomain;
      }
    }

    let mailgunDomainCreated = false;
    let mailgunDomainInfo: any = null;
    let domainSendingKey: string | null = null;
    let verificationStatus: {
      success: boolean;
      attempts?: number;
      recordStatus?: Record<string, any>;
      result?: any;
      partialResult?: any;
      error?: any;
    } | null = null;

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
      if (process.env.MAILGUN_DOMAIN_KEY) {
        console.log(`Checking Mailgun domain for org ${effectiveOrgId}: ${fullDomain}`);
        const existingMG = await mgGetDomain(fullDomain);
        if (!existingMG) {
          console.log(`Domain not found in Mailgun. Creating: ${fullDomain}`);
          const created = await mgCreateDomain(fullDomain, { spamAction: "disabled", wildcard: false });
          if (created.success) {
            mailgunDomainCreated = true;
            mailgunDomainInfo = created.result;
            console.log(`Domain created successfully in Mailgun: ${fullDomain}`);

            console.log(`Fetching domain credentials for ${fullDomain}...`);
            const credentialsResult = await mgGetDomainCredentials(fullDomain);
            if (credentialsResult.success && credentialsResult.result) {
              const items = credentialsResult.result?.items || credentialsResult.result?.credentials || [];
              if (items.length > 0 && items[0].login) {
                domainSendingKey = items[0].login;
                console.log(`Retrieved domain sending key: ${domainSendingKey?.substring(0, 8)}...`);
              } else if (credentialsResult.result?.smtp_login) {
                domainSendingKey = credentialsResult.result.smtp_login;
                console.log(`Retrieved domain SMTP login: ${domainSendingKey?.substring(0, 8)}...`);
              }
            } else {
              console.warn(`Failed to fetch domain credentials:`, credentialsResult.error);
            }

            console.log(`Creating DNS records from Mailgun domain response...`);
            const domainRecordsResult = await createDNSRecordsFromMailgunDomainResponse(orgSubdomain, created.result);
            if (domainRecordsResult.success) {
              console.log(`Created ${domainRecordsResult.created.length} DNS records from domain response`);
            } else {
              console.warn(`Some DNS records from domain response failed:`, domainRecordsResult.errors);
            }

            // Create domain-specific sending key right after domain creation
            try {
              console.log(`Creating domain-specific sending key for ${fullDomain}...`);
              const orgName = org?.name || effectiveOrgId;
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
                  
                  // Save the domain sending key to database immediately
                  if (subdomainRecordId) {
                    await db.collection("organization-domains").updateOne(
                      { _id: subdomainRecordId },
                      {
                        $set: {
                          domainSendingKey: encryptSendingKey(keySecret),
                          updatedAt: new Date(),
                        },
                      }
                    );
                    console.log(`Saved domain sending key to database for ${fullDomain}`);
                  }
                }
              } else {
                console.warn("Domain sending key creation failed:", keyResult.error);
              }
            } catch (e) {
              console.warn("Exception during domain sending key creation:", e);
            }
          } else {
            console.error(`Mailgun domain create failed for ${fullDomain}:`, created.error);
          }
        } else {
          mailgunDomainInfo = existingMG;
          console.log(`Domain already exists in Mailgun: ${fullDomain}`);

          // Always create a new sending key for this organization
          try {
            console.log(`Creating new domain-specific sending key for ${fullDomain}...`);
            const orgName = org?.name || effectiveOrgId;
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

          // Save the existing Mailgun domain info and new sending key to DB
          console.log(`Saving existing Mailgun domain info to database for ${fullDomain}...`);
          await db.collection("organization-domains").updateOne(
            { _id: subdomainRecordId },
            {
              $set: {
                fullDomain,
                mailgunDomainInfo,
                mailgunDomainCreated: false, // Domain wasn't created by us, it already existed
                domainSendingKey: encryptSendingKey(domainSendingKey),
                updatedAt: new Date(),
              },
            }
          );
          console.log(`Saved existing Mailgun domain info for ${fullDomain} in organization-domains record ${String(subdomainRecordId)}`);
          
          // Set verification status to success since domain already exists
          verificationStatus = { success: true };
        }
      }
    } catch (e) {
      console.warn(`Mailgun domain registration step encountered an issue for ${fullDomain}:`, e);
    }

    // Skip blocking verification wait if skipVerification is true
    if (!skipVerification && (!verificationStatus || !verificationStatus.success)) {
      const blockEnabled = (process.env.MAILGUN_VERIFY_BLOCK_UNTIL_SUCCESS ?? "true") === "true";
      const maxBlockTotalMs = Number(process.env.MAILGUN_VERIFY_BLOCK_MAX_TOTAL_MS ?? 12 * 60 * 1000);
      const pollDelayMs = Number(process.env.MAILGUN_VERIFY_BLOCK_POLL_DELAY_MS ?? 15000);

      if (blockEnabled) {
        console.log(`Domain verification pending; blocking request and polling until verified (max ${maxBlockTotalMs}ms)...`);
        const startedAt = Date.now();
        while (!verificationStatus?.success && Date.now() - startedAt < maxBlockTotalMs) {
          console.log(`Pending records detected. Sleeping ${pollDelayMs}ms before next verify...`);
          await new Promise((r) => setTimeout(r, pollDelayMs));
          const nextVerify = await mgVerifyDomainWithRetry(fullDomain);
          verificationStatus = nextVerify;

          try {
            await db.collection("organization-domains").updateOne(
              { _id: subdomainRecordId },
              {
                $set: {
                  mailgunVerify: nextVerify.result || nextVerify.partialResult || {},
                  mailgunVerificationRecords: nextVerify.recordStatus || {},
                  updatedAt: new Date(),
                },
              }
            );
          } catch (_) {}
        }

        if (!verificationStatus?.success) {
          console.error(`Timed out waiting for Mailgun verification after ${Date.now() - startedAt}ms`);
          return NextResponse.json(
            {
              message: "Timed out waiting for Mailgun verification.",
              subdomain: orgSubdomain,
              fullDomain,
              verification: {
                success: false,
                attempts: verificationStatus?.attempts || 0,
                recordStatus: verificationStatus?.recordStatus || {},
              },
            },
            { status: 504 }
          );
        }
        console.log("Domain verification completed during blocking wait.");

        try {
          console.log(`Creating domain-specific sending key for ${fullDomain}...`);
          const orgName = org?.name || effectiveOrgId;
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
              if (subdomainRecordId) {
                await db.collection("organization-domains").updateOne(
                  { _id: subdomainRecordId },
                  {
                    $set: {
                      domainSendingKey: encryptSendingKey(keySecret),
                      updatedAt: new Date(),
                    },
                  }
                );
              }
            } else {
              console.warn("Domain sending key created but secret not found.");
            }
          } else {
            console.warn("Domain sending key creation failed:", keyResult.error);
          }
        } catch (e) {
          console.warn("Exception during domain sending key creation:", e);
        }
      }
    }

    const responsePayload: any = {
      message: "Subdomain provisioned",
      subdomain: orgSubdomain,
      fullDomain,
      cloudflareCreated,
      cloudflareError,
      mailgunDomainCreated,
      domainSendingKey: encryptSendingKey(domainSendingKey),
    };

    if (subdomainRecordId) {
      responsePayload.subdomainRecordId = String(subdomainRecordId);
    }

    // Create mailgun accounts for all org members in the background
    if (mailgunDomainCreated || mailgunDomainInfo) {
      (async () => {
        try {
          const members = await db.collection("members").find({
            $or: [
              { orgID: effectiveOrgId },
              { orgID: orgObjectId },
              { organizationId: effectiveOrgId },
              { organizationId: orgObjectId },
            ],
          }).toArray();

          if (members.length > 0) {
            console.log(`Creating mailgun accounts for ${members.length} members in background for subdomain ${fullDomain}`);
            
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
                  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mailgun-module/mg-enable-acount?orgId=${effectiveOrgId}`,
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
              console.log(`Completed background account creation for subdomain ${fullDomain}`);
            }).catch((err) => {
              console.error(`Background account creation error for subdomain ${fullDomain}:`, err);
            });
          }
        } catch (err) {
          console.error(`Error fetching members for background account creation:`, err);
        }
      })();
    }

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err) {
    console.error("add-subdomain error", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
