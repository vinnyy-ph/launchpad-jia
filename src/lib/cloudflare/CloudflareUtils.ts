interface CloudflareConfig {
  apiToken: string;
  zoneId: string;
  baseDomain: string;
}

interface DNSRecord {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
}

interface CloudflareAPIResponse {
  success: boolean;
  errors: any[];
  messages: any[];
  result?: any;
}

// Get Cloudflare configuration from environment variables
export function getCloudflareConfig(): CloudflareConfig | null {
  const apiToken = process.env.CLOUDFLARE_DOMAIN_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const baseDomain = "hellojia.ai";

  if (!apiToken) {
    console.warn("CLOUDFLARE_DOMAIN_API_TOKEN not found in environment");
    return null;
  }

  if (!zoneId) {
    console.warn("CLOUDFLARE_ZONE_ID not found in environment - required for DNS operations");
    return null;
  }

  return { apiToken, zoneId, baseDomain };
}

// Create a subdomain with only email DNS records (MX + SPF) in Cloudflare
export async function createSubdomain(
  subdomain: string
): Promise<{ success: boolean; subdomain: string; records?: any[]; error?: string }> {
  const config = getCloudflareConfig();
  
  if (!config) {
    return { 
      success: false, 
      subdomain, 
      error: "Cloudflare configuration missing" 
    };
  }

  const fullSubdomain = `${subdomain}.${config.baseDomain}`;

  try {
    // Check if subdomain already exists
    const existingRecords = await listDNSRecords(subdomain);
    if (existingRecords && existingRecords.length > 0) {
      return {
        success: true,
        subdomain: fullSubdomain,
        records: existingRecords,
        error: "Subdomain already exists"
      };
    }

    // Only create email-related records (MX + SPF)
    const emailSetup = await setupMailgunDNSRecords(subdomain);
    
    if (!emailSetup.success) {
      return {
        success: false,
        subdomain: fullSubdomain,
        error: `Failed to create email DNS records: ${emailSetup.errors.join(", ")}`
      };
    }

    return {
      success: true,
      subdomain: fullSubdomain,
      records: emailSetup.records
    };
  } catch (error: any) {
    console.error("Error creating subdomain:", error);
    return {
      success: false,
      subdomain: fullSubdomain,
      error: error.message || "Unknown error"
    };
  }
}

// Create a DNS record in Cloudflare
export async function createDNSRecord(record: DNSRecord): Promise<CloudflareAPIResponse> {
  const config = getCloudflareConfig();
  
  if (!config) {
    return {
      success: false,
      errors: ["Cloudflare configuration missing"],
      messages: []
    };
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(record),
    });

    const data = await response.json();
    return data as CloudflareAPIResponse;
  } catch (error: any) {
    console.error("Error creating DNS record:", error);
    return {
      success: false,
      errors: [error.message],
      messages: []
    };
  }
}

// List DNS records for a subdomain
export async function listDNSRecords(subdomain: string): Promise<any[] | null> {
  const config = getCloudflareConfig();
  
  if (!config) {
    return null;
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?name=${subdomain}.${config.baseDomain}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    
    if (data.success) {
      return data.result || [];
    }
    
    return null;
  } catch (error) {
    console.error("Error listing DNS records:", error);
    return null;
  }
}

// Delete a DNS record from Cloudflare
export async function deleteDNSRecord(recordId: string): Promise<CloudflareAPIResponse> {
  const config = getCloudflareConfig();
  
  if (!config) {
    return {
      success: false,
      errors: ["Cloudflare configuration missing"],
      messages: []
    };
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${recordId}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return data as CloudflareAPIResponse;
  } catch (error: any) {
    console.error("Error deleting DNS record:", error);
    return {
      success: false,
      errors: [error.message],
      messages: []
    };
  }
}

// Setup Mailgun DNS records for a subdomain - MX, TXT (SPF)
export async function setupMailgunDNSRecords(subdomain: string): Promise<{
  success: boolean;
  records: any[];
  errors: string[];
}> {
  const config = getCloudflareConfig();
  
  if (!config) {
    return {
      success: false,
      records: [],
      errors: ["Cloudflare configuration missing"]
    };
  }

  const records: DNSRecord[] = [
    // MX records for receiving email
    {
      type: "MX",
      name: subdomain,
      content: "mxa.mailgun.org",
      priority: 10,
      ttl: 3600
    },
    {
      type: "MX",
      name: subdomain,
      content: "mxb.mailgun.org",
      priority: 10,
      ttl: 3600
    },
    // SPF record
    {
      type: "TXT",
      name: subdomain,
      content: "v=spf1 include:mailgun.org ~all",
      ttl: 3600
    }
  ];

  const results: any[] = [];
  const errors: string[] = [];

  for (const record of records) {
    try {
      const result = await createDNSRecord(record);
      if (result.success) {
        results.push(result.result);
      } else {
        errors.push(`Failed to create ${record.type} record: ${JSON.stringify(result.errors)}`);
      }
    } catch (error: any) {
      errors.push(`Error creating ${record.type} record: ${error.message}`);
    }
  }

  return {
    success: errors.length === 0,
    records: results,
    errors
  };
}

// Generate a unique subdomain slug from organization name
export function generateSubdomainSlug(orgName: string, suffix?: string): string {
  const slug = (orgName || "org")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "") 
    .slice(0, 63); // DNS label max length

  return suffix ? `${slug}${suffix}` : slug;
}

// Convert a positive index (1-based for readability) into an alphabetical
// suffix sequence: 1 -> "a", 2 -> "b", ..., 26 -> "z", 27 -> "aa", etc.
export function indexToAlphaSuffix(index: number): string {
  if (index <= 0) return "";
  let n = index;
  let result = "";
  while (n > 0) {
    n--; // make it 0-based
    const charCode = 97 + (n % 26); // 'a' = 97
    result = String.fromCharCode(charCode) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

// Create DNS records from Mailgun domain creation response
// This extracts the DNS records that Mailgun provides and adds them to Cloudflare
export async function createDNSRecordsFromMailgunDomainResponse(
  subdomain: string,
  mailgunDomainResponse: any
): Promise<{ success: boolean; created: any[]; errors: string[] }> {
  const config = getCloudflareConfig();
  if (!config) {
    return { success: false, created: [], errors: ["Cloudflare config missing"] };
  }

  const created: any[] = [];
  const errors: string[] = [];

  try {
    // Extract all DNS record types from domain creation response
    const sendingRecords = mailgunDomainResponse?.sending_dns_records || [];
    const receivingRecords = mailgunDomainResponse?.receiving_dns_records || [];
    const trackingRecords = mailgunDomainResponse?.tracking_dns_records || [];
    const allRecords = [...sendingRecords, ...receivingRecords, ...trackingRecords];

    console.log(` Creating DNS records from Mailgun domain response: ${sendingRecords.length} sending + ${receivingRecords.length} receiving + ${trackingRecords.length} tracking`);

    for (const rec of allRecords) {
      try {
        const recordType = rec.record_type?.toUpperCase();
        let recordName = rec.name || "";
        let recordValue = rec.value || rec.target || "";

        console.log(` Processing record from domain response: ${recordType} ${recordName}`);

        if (!recordType || !recordName || !recordValue) {
          console.warn(" Skipping incomplete DNS record from domain response:", rec);
          continue;
        }

        // Extract just the subdomain part for Cloudflare
        let name = recordName;
        if (name.endsWith(`.${config.baseDomain}`)) {
          name = name.replace(`.${config.baseDomain}`, "");
        } else if (name === config.baseDomain) {
          name = subdomain;
        }

        const dnsRecord: DNSRecord = {
          type: recordType,
          name,
          content: recordValue,
          ttl: 3600,
          proxied: false,
        };

        // Add priority for MX records
        if (recordType === "MX" && rec.priority) {
          dnsRecord.priority = parseInt(rec.priority);
        }

        // Check if record already exists
        const fullName = `${name}.${config.baseDomain}`;
        const cfUrl = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=${recordType}&name=${encodeURIComponent(fullName)}`;
        const cfRes = await fetch(cfUrl, {
          headers: { Authorization: `Bearer ${config.apiToken}` }
        });
        const cfData = await cfRes.json();
        const existingRecords = cfData.success ? cfData.result : [];

        const normalize = (val: string, t: string) => {
          let v = (val || "").trim().toLowerCase();
          if (t.toUpperCase() === "CNAME") v = v.replace(/\.$/, "");
          return v;
        };

        const alreadyExists = existingRecords.some((e: any) =>
          e.type === recordType &&
          e.name.toLowerCase() === fullName.toLowerCase() &&
          normalize(e.content, e.type) === normalize(recordValue, recordType)
        );

        if (alreadyExists) {
          console.log(` Record already exists: ${recordType} ${fullName}`);
          continue;
        }

        // Special-case DKIM: if this is a TXT under _domainkey and a CNAME exists, skip creating TXT
        if (recordType === "TXT" && name.includes("._domainkey")) {
          const cfCnameUrl = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(fullName)}`;
          const cfCnameRes = await fetch(cfCnameUrl, { headers: { Authorization: `Bearer ${config.apiToken}` } });
          const cfCnameData = await cfCnameRes.json();
          const cnameExists = cfCnameData.success && (cfCnameData.result || []).some((e: any) => e.name.toLowerCase() === fullName.toLowerCase());
          if (cnameExists) {
            console.log(` DKIM CNAME exists for ${fullName}; skipping TXT creation`);
            continue;
          }
        }

        console.log(` Creating DNS record from domain response: ${recordType} ${name} = ${recordValue.substring(0, 60)}...`);
        
        const result = await createDNSRecord(dnsRecord);

        if (result.success) {
          created.push(result.result);
          console.log(` ✓ Created: ${recordType} ${name}`);
        } else {
          const errMsg = `Failed to create ${recordType} ${name}: ${JSON.stringify(result.errors)}`;
          errors.push(errMsg);
          console.error(` ✗ ${errMsg}`);
        }
      } catch (e: any) {
        const errMsg = `Error processing record from domain response: ${e.message}`;
        errors.push(errMsg);
        console.error(` ${errMsg}`, e);
      }
    }

    // Ensure DMARC and tracking CNAME exist even if not provided in domain response
    const fallbackRecords: { type: string; name: string; value: string }[] = [];
    // Prefer env var policy if provided
    const envDmarc = process.env.MAILGUN_DMARC_POLICY || process.env.DMARC_POLICY;
    const dmarcValue = envDmarc || "v=DMARC1; p=none; pct=100; fo=1; ri=3600;";
    fallbackRecords.push({
      type: "TXT",
      name: `_dmarc.${subdomain}.${config.baseDomain}`,
      value: dmarcValue,
    });

    // Tracking CNAME
    fallbackRecords.push({
      type: "CNAME",
      name: `email.${subdomain}.${config.baseDomain}`,
      value: "mailgun.org",
    });

    for (const rec of fallbackRecords) {
      try {
        const recordType = rec.type.toUpperCase();
        let name = rec.name;
        let recordValue = rec.value;

        if (name.endsWith(`.${config.baseDomain}`)) {
          name = name.replace(`.${config.baseDomain}`, "");
        }

        const fullName = `${name}.${config.baseDomain}`;
        const cfUrl = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=${recordType}&name=${encodeURIComponent(fullName)}`;
        const cfRes = await fetch(cfUrl, { headers: { Authorization: `Bearer ${config.apiToken}` } });
        const cfData = await cfRes.json();
        const existingRecords = cfData.success ? cfData.result : [];
        const alreadyExists = existingRecords.some((e: any) => e.type === recordType && e.name === fullName && e.content === recordValue);
        if (alreadyExists) {
          console.log(` Fallback record already exists: ${recordType} ${fullName}`);
          continue;
        }

        console.log(` Creating fallback record from domain response: ${recordType} ${name}`);
        const result = await createDNSRecord({
          type: recordType,
          name,
          content: recordValue,
          ttl: 3600,
          proxied: false,
        });
        if (result.success) {
          created.push(result.result);
          console.log(` ✓ Created fallback: ${recordType} ${name}`);
        } else {
          const errMsg = `Failed to create fallback ${recordType} ${name}: ${JSON.stringify(result.errors)}`;
          errors.push(errMsg);
          console.error(` ✗ ${errMsg}`);
        }
      } catch (e: any) {
        const errMsg = `Error creating fallback record: ${e.message}`;
        errors.push(errMsg);
        console.error(` ${errMsg}`, e);
      }
    }

    console.log(` Domain response records processed: ${created.length} created, ${errors.length} errors`);
    return { success: errors.length === 0, created, errors };
  } catch (e: any) {
    console.error(` Fatal error in createDNSRecordsFromMailgunDomainResponse:`, e);
    return { success: false, created, errors: [e.message] };
  }
}

// Parse Mailgun verify response and create missing DNS records in Cloudflare
export async function createMailgunVerificationRecords(
  subdomain: string,
  mailgunVerifyResult: any
): Promise<{ success: boolean; created: any[]; errors: string[] }> {
  const config = getCloudflareConfig();
  if (!config) {
    return { success: false, created: [], errors: ["Cloudflare config missing"] };
  }

  const created: any[] = [];
  const errors: string[] = [];

  try {
    // Get all DNS record requirements from Mailgun response
    const sendingRecords = mailgunVerifyResult?.sending_dns_records || [];
    const receivingRecords = mailgunVerifyResult?.receiving_dns_records || [];
    const trackingRecords = mailgunVerifyResult?.tracking_dns_records || [];

    // DMARC sometimes appears separately as dmarc_record
    const dmarcRecordValue = mailgunVerifyResult?.dmarc_record;

    // Combine all records we received
    const allRecords = [...sendingRecords, ...receivingRecords, ...trackingRecords];

    console.log(` Processing ${sendingRecords.length} sending + ${receivingRecords.length} receiving + ${trackingRecords.length} tracking records`);
    console.log(` Full verify result:`, JSON.stringify(mailgunVerifyResult, null, 2).substring(0, 800));

    for (const rec of allRecords) {
      try {
        const recordType = rec.record_type?.toUpperCase();
        let recordName = rec.name || "";
        let recordValue = rec.value || rec.target || "";

        console.log(` Processing record:`, { 
          type: recordType, 
          name: recordName, 
          value: recordValue?.substring(0, 50) + '...',
          valid: rec.valid,
          is_active: rec.is_active
        });

        if (!recordType || !recordName || !recordValue) {
          console.warn(" Skipping incomplete DNS record:", rec);
          continue;
        }

        // Skip if already valid/active
        if (rec.valid === 'valid' || rec.is_active === true) {
          console.log(` Record already valid/active, skipping: ${recordType} ${recordName}`);
          continue;
        }

        // Extract just the subdomain part for Cloudflare
        let name = recordName;
        
        // Remove the base domain suffix
        if (name.endsWith(`.${config.baseDomain}`)) {
          name = name.replace(`.${config.baseDomain}`, "");
        } else if (name === config.baseDomain) {
          name = subdomain;
        }

        const dnsRecord: DNSRecord = {
          type: recordType,
          name,
          content: recordValue,
          ttl: 3600,
          proxied: false,
        };

        // Add priority for MX records
        if (recordType === "MX" && rec.priority) {
          dnsRecord.priority = parseInt(rec.priority);
        }

        // Check if record already exists
        const fullName = `${name}.${config.baseDomain}`;
        console.log(` Checking if record exists: ${recordType} ${fullName}`);
        
        // Query Cloudflare for existing records matching this type and name
        const cfUrl = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=${recordType}&name=${encodeURIComponent(fullName)}`;
        const cfRes = await fetch(cfUrl, {
          headers: { Authorization: `Bearer ${config.apiToken}` }
        });
        const cfData = await cfRes.json();
        const existingRecords = cfData.success ? cfData.result : [];

        const normalize = (val: string, t: string) => {
          let v = (val || "").trim().toLowerCase();
          if (t.toUpperCase() === "CNAME") v = v.replace(/\.$/, "");
          return v;
        };

        const alreadyExists = existingRecords.some((e: any) =>
          e.type === recordType &&
          e.name.toLowerCase() === fullName.toLowerCase() &&
          normalize(e.content, e.type) === normalize(recordValue, recordType)
        );

        if (alreadyExists) {
          console.log(` Record already exists: ${recordType} ${name}`);
          continue;
        }

        // Special-case DKIM: if this is a TXT under _domainkey and a CNAME exists, skip creating TXT
        if (recordType === "TXT" && name.includes("._domainkey")) {
          const cfCnameUrl = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(fullName)}`;
          const cfCnameRes = await fetch(cfCnameUrl, { headers: { Authorization: `Bearer ${config.apiToken}` } });
          const cfCnameData = await cfCnameRes.json();
          const cnameExists = cfCnameData.success && (cfCnameData.result || []).some((e: any) => e.name.toLowerCase() === fullName.toLowerCase());
          if (cnameExists) {
            console.log(` DKIM CNAME exists for ${fullName}; skipping TXT creation`);
            continue;
          }
        }

        console.log(` Creating verification record: ${recordType} ${name}`);
        console.log(`   Value: ${recordValue.substring(0, 100)}...`);
        
        const result = await createDNSRecord(dnsRecord);

        if (result.success) {
          created.push(result.result);
          console.log(` ✓ Created: ${recordType} ${name}`);
        } else {
          const errMsg = `Failed to create ${recordType} ${name}: ${JSON.stringify(result.errors)}`;
          errors.push(errMsg);
          console.error(` ✗ ${errMsg}`);
        }
      } catch (e: any) {
        const errMsg = `Error processing record: ${e.message}`;
        errors.push(errMsg);
        console.error(` ${errMsg}`, e);
      }
    }

    // Fallbacks: if DMARC or tracking were not present in verify response, add them explicitly
    const fallbackRecords: { type: string; name: string; value: string }[] = [];

    // DMARC record - prefer env var, then response, then default policy
    const envDmarc = process.env.MAILGUN_DMARC_POLICY || process.env.DMARC_POLICY;
    let dmarcValue = envDmarc || dmarcRecordValue || "v=DMARC1; p=none; pct=100; fo=1; ri=3600;";
    fallbackRecords.push({
      type: "TXT",
      name: `_dmarc.${subdomain}.${config.baseDomain}`,
      value: dmarcValue,
    });

    // Tracking CNAME fallback (Mailgun default)
    fallbackRecords.push({
      type: "CNAME",
      name: `email.${subdomain}.${config.baseDomain}`,
      value: "mailgun.org",
    });

    for (const rec of fallbackRecords) {
      try {
        const recordType = rec.type.toUpperCase();
        let name = rec.name;
        let recordValue = rec.value;

        if (name.endsWith(`.${config.baseDomain}`)) {
          name = name.replace(`.${config.baseDomain}`, "");
        }

        const fullName = `${name}.${config.baseDomain}`;
        const cfUrl = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=${recordType}&name=${encodeURIComponent(fullName)}`;
        const cfRes = await fetch(cfUrl, { headers: { Authorization: `Bearer ${config.apiToken}` } });
        const cfData = await cfRes.json();
        const existingRecords = cfData.success ? cfData.result : [];
        const alreadyExists = existingRecords.some((e: any) => e.type === recordType && e.name === fullName && e.content === recordValue);
        if (alreadyExists) {
          console.log(` Fallback record already exists: ${recordType} ${fullName}`);
          continue;
        }

        console.log(` Creating fallback verification record: ${recordType} ${name}`);
        const result = await createDNSRecord({
          type: recordType,
          name,
          content: recordValue,
          ttl: 3600,
          proxied: false,
        });
        if (result.success) {
          created.push(result.result);
          console.log(` ✓ Created fallback: ${recordType} ${name}`);
        } else {
          const errMsg = `Failed to create fallback ${recordType} ${name}: ${JSON.stringify(result.errors)}`;
          errors.push(errMsg);
          console.error(` ✗ ${errMsg}`);
        }
      } catch (e: any) {
        const errMsg = `Error creating fallback record: ${e.message}`;
        errors.push(errMsg);
        console.error(` ${errMsg}`, e);
      }
    }

    console.log(` Verification complete: ${created.length} created, ${errors.length} errors`);
    return { success: errors.length === 0, created, errors };
  } catch (e: any) {
    console.error(` Fatal error in createMailgunVerificationRecords:`, e);
    return { success: false, created, errors: [e.message] };
  }
}
