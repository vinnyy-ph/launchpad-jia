import crypto from "crypto";

interface MailgunConfig {
  apiKey: string;
  baseUrl: string; 
}

export function getMailgunConfig(): MailgunConfig | null {
  const apiKey = process.env.MAILGUN_DOMAIN_KEY;
  if (!apiKey) {
    console.warn("MAILGUN_DOMAIN_KEY not found in environment");
    return null;
  }
  const baseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";
  return { apiKey, baseUrl };
}

// Admin/primary API key config (for privileged operations like key creation)
export function getMailgunAdminConfig(): MailgunConfig | null {
  const apiKey = process.env.MAILGUN_DOMAIN_KEY;
  if (!apiKey) {
    console.warn("MAILGUN_DOMAIN_KEY (developer) not found in environment");
    return null;
  }
  const baseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";
  return { apiKey, baseUrl };
}

function authHeader(apiKey: string) {
  const token = Buffer.from(`api:${apiKey}`).toString("base64");
  return `Basic ${token}`;
}

export async function getDomain(domain: string) {
  const cfg = getMailgunConfig();
  if (!cfg) return null;
  const url = `${cfg.baseUrl}/v3/domains/${encodeURIComponent(domain)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: authHeader(cfg.apiKey) },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mailgun getDomain failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function createDomain(domain: string, opts?: {
  smtpPassword?: string;
  spamAction?: "disabled" | "tag";
  wildcard?: boolean;
}) {
  const cfg = getMailgunConfig();
  if (!cfg) return { success: false, error: "Missing Mailgun config" } as const;
  const form = new URLSearchParams();
  form.set("name", domain);
  form.set("spam_action", opts?.spamAction || "disabled");
  form.set("wildcard", String(!!opts?.wildcard));
  form.set("smtp_password", opts?.smtpPassword || crypto.randomBytes(12).toString("base64"));

  const url = `${cfg.baseUrl}/v3/domains`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg.apiKey),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: JSON.stringify(data) } as const;
  }
  return { success: true, result: data } as const;
}

export async function verifyDomain(domain: string) {
  const cfg = getMailgunConfig();
  if (!cfg) return { success: false, error: "Missing Mailgun config" } as const;
  const url = `${cfg.baseUrl}/v3/domains/${encodeURIComponent(domain)}/verify`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: authHeader(cfg.apiKey) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: JSON.stringify(data) } as const;
  }
  return { success: true, result: data } as const;
}

// Fetch verification requirements without triggering verification (GET variant)
export async function getDomainVerifyRecords(domain: string) {
  const cfg = getMailgunConfig();
  if (!cfg) return { success: false, error: "Missing Mailgun config" } as const;
  const domainUrl = `${cfg.baseUrl}/v4/domains/${encodeURIComponent(domain)}`;

  // Fetch domain details (includes sending/receiving/tracking DNS records)
  const domainRes = await fetch(domainUrl, {
    method: "GET",
    headers: { Authorization: authHeader(cfg.apiKey) },
  });
  const domainData = await domainRes.json().catch(() => ({}));

  if (!domainRes.ok) {
    return {
      success: false,
      error: `Mailgun domain lookup failed: ${domainRes.status} ${domainRes.statusText} ${JSON.stringify(domainData)}`,
    } as const;
  }

  // Optional: fetch DMARC record suggestions
  let dmarcData: any = null;
  try {
    const dmarcUrl = `${cfg.baseUrl}/v1/dmarc/records/${encodeURIComponent(domain)}`;
    const dmarcRes = await fetch(dmarcUrl, {
      method: "GET",
      headers: { Authorization: authHeader(cfg.apiKey) },
    });
    dmarcData = await dmarcRes.json().catch(() => ({}));
    if (!dmarcRes.ok) {
      domainData._dmarcError = `DMARC lookup failed: ${dmarcRes.status} ${dmarcRes.statusText}`;
    }
  } catch (err: any) {
    domainData._dmarcError = `DMARC lookup error: ${err?.message || err}`;
  }

  const dmarcRecordValue = dmarcData?.record || dmarcData?.value || dmarcData?.dmarc_record || dmarcData?.policy_record;
  const dmarcName = dmarcData?.name || dmarcData?.authority || `_dmarc.${domain}`;

  return {
    success: true,
    result: {
      ...domainData,
      dmarc: dmarcData,
      dmarc_record: dmarcRecordValue,
      dmarc_name: dmarcName,
    },
  } as const;
}

// Fetch DMARC record (policy) for a domain
export async function getDmarcRecord(domain: string) {
  // Prefer admin key; fallback to subdomain key
  const cfgAdmin = getMailgunAdminConfig();
  const cfg = cfgAdmin || getMailgunConfig();
  if (!cfg) return { success: false, error: "Missing Mailgun config" } as const;

  const url = `${cfg.baseUrl}/v1/dmarc/records/${encodeURIComponent(domain)}`;
  console.log(`[MG] Fetching DMARC from URL: ${url}`);
  
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: authHeader(cfg.apiKey) },
  });
  
  console.log(`[MG] DMARC API response status: ${res.status} ${res.statusText}`);
  
  const text = await res.text();
  console.log(`[MG] DMARC API raw response: ${text}`);
  
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error(`[MG] Failed to parse DMARC response as JSON:`, e);
    return { success: false, error: `Invalid JSON response: ${text}` } as const;
  }
  
  if (!res.ok) {
    console.error(`[MG] DMARC API error response:`, data);
    return { success: false, error: `${res.status} ${res.statusText}: ${JSON.stringify(data)}` } as const;
  }

  console.log(`[MG] DMARC API parsed data:`, data);

  // Normalize fields - try various possible field names
  // Mailgun returns DMARC in "entry" field (recommended policy) or "current" field (current policy)
  const dmarcRecordValue = data?.entry || data?.current || data?.record || data?.value || data?.dmarc_record || data?.policy_record || null;
  const dmarcName = data?.name || data?.authority || `_dmarc.${domain}`;

  console.log(`[MG] DMARC normalized: name=${dmarcName}, value=${dmarcRecordValue}`);

  return {
    success: true,
    result: {
      ...data,
      dmarc_record: dmarcRecordValue,
      dmarc_name: dmarcName,
    },
  } as const;
}

// Get domain-specific sending credentials/API key
export async function getDomainCredentials(domain: string) {
  const cfg = getMailgunConfig();
  if (!cfg) return { success: false, error: "Missing Mailgun config" } as const;
  const url = `${cfg.baseUrl}/v3/domains/${encodeURIComponent(domain)}/credentials`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: authHeader(cfg.apiKey) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: JSON.stringify(data) } as const;
  }
  return { success: true, result: data } as const;
}

// Intelligent verify with retry logic and DNS propagation waiting
// Returns detailed status of all verification records
export async function verifyDomainWithRetry(
  domain: string,
  maxRetries?: number,
  initialDelayMs?: number,
  options?: {
    backoffFactor?: number; // multiplier for each attempt
    maxDelayMs?: number;    // cap per-attempt delay
    maxTotalMs?: number;    // total time budget
  }
) {
  const cfg = getMailgunConfig();
  if (!cfg) {
    return { 
      success: false, 
      error: "Missing Mailgun config",
      attempts: 0,
      recordStatus: {}
    } as const;
  }

  // Load patience from env or fall back to sensible defaults
  const envMaxRetries = Number(process.env.MAILGUN_VERIFY_MAX_RETRIES || process.env.NEXT_PUBLIC_MAILGUN_VERIFY_MAX_RETRIES);
  const envInitialDelay = Number(process.env.MAILGUN_VERIFY_INITIAL_DELAY_MS || process.env.NEXT_PUBLIC_MAILGUN_VERIFY_INITIAL_DELAY_MS);
  const envBackoff = Number(process.env.MAILGUN_VERIFY_BACKOFF_FACTOR || process.env.NEXT_PUBLIC_MAILGUN_VERIFY_BACKOFF_FACTOR);
  const envMaxDelay = Number(process.env.MAILGUN_VERIFY_MAX_DELAY_MS || process.env.NEXT_PUBLIC_MAILGUN_VERIFY_MAX_DELAY_MS);
  const envMaxTotal = Number(process.env.MAILGUN_VERIFY_MAX_TOTAL_MS || process.env.NEXT_PUBLIC_MAILGUN_VERIFY_MAX_TOTAL_MS);

  const retries = Number.isFinite(envMaxRetries) && envMaxRetries > 0 ? envMaxRetries : (maxRetries ?? 10);
  const startDelay = Number.isFinite(envInitialDelay) && envInitialDelay > 0 ? envInitialDelay : (initialDelayMs ?? 8000);
  const backoff = Number.isFinite(envBackoff) && envBackoff > 0 ? envBackoff : (options?.backoffFactor ?? 2);
  const maxDelay = Number.isFinite(envMaxDelay) && envMaxDelay > 0 ? envMaxDelay : (options?.maxDelayMs ?? 60000);
  const maxTotal = Number.isFinite(envMaxTotal) && envMaxTotal > 0 ? envMaxTotal : (options?.maxTotalMs ?? 10 * 60 * 1000); // default 10 minutes

  let lastError = null;
  let lastResult = null;
  let recordStatus: Record<string, { valid?: boolean; status?: string; }> = {};
  let totalWaited = 0;

  console.log(`[MG] verifyDomainWithRetry config → retries=${retries}, initialDelayMs=${startDelay}, backoff=${backoff}, maxDelay=${maxDelay}, maxTotalMs=${maxTotal}`);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Wait before verify attempts (longer on first attempt for DNS propagation)
      const rawDelay = attempt === 0 ? startDelay : startDelay * Math.pow(backoff, attempt - 1);
      const delayMs = Math.min(rawDelay, maxDelay);
      console.log(`[MG] Verify attempt ${attempt + 1}/${retries} - waiting ${delayMs}ms for DNS propagation...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      totalWaited += delayMs;

      if (totalWaited > maxTotal) {
        lastError = `Exceeded max total wait time (${maxTotal}ms)`;
        console.warn(`[MG] Stopping verification retries: ${lastError}`);
        break;
      }

      // Trigger verification
      console.log(`[MG] Triggering verification (PUT) for ${domain}...`);
      const url = `${cfg.baseUrl}/v3/domains/${encodeURIComponent(domain)}/verify`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { Authorization: authHeader(cfg.apiKey) },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        lastError = JSON.stringify(data);
        console.warn(`[MG] Verify attempt ${attempt + 1} failed: ${lastError}`);
        continue;
      }

      lastResult = data;
      
      // Parse record verification status
      const sendingRecords = data.sending_dns_records || [];
      const receivingRecords = data.receiving_dns_records || [];
      const trackingRecords = data.tracking_dns_records || [];
      const allRecords = [...sendingRecords, ...receivingRecords, ...trackingRecords];

      // Track which records are verified
      recordStatus = {};
      let allValid = true;
      
      for (const rec of allRecords) {
        const recordKey = `${rec.record_type} ${rec.name}`;
        const isValid = rec.valid === 'valid' || rec.is_active === true;
        recordStatus[recordKey] = {
          valid: isValid,
          status: rec.valid || (rec.is_active ? 'active' : 'pending')
        };
        if (!isValid) allValid = false;
      }

      // Log status of each record
      console.log(`[MG] Verification attempt ${attempt + 1} results:`);
      for (const [key, status] of Object.entries(recordStatus)) {
        const symbol = status.valid ? '✓' : '✗';
        console.log(`[MG]   ${symbol} ${key}: ${status.status}`);
      }

      if (allValid && allRecords.length > 0) {
        console.log(`[MG] ✓ All verification records are valid!`);
        return {
          success: true,
          result: data,
          attempts: attempt + 1,
          recordStatus
        } as const;
      } else {
        console.log(`[MG] Some records still pending, will retry...`);
      }
    } catch (err: any) {
      lastError = err.message;
      console.error(`[MG] Verify attempt ${attempt + 1} error:`, lastError);
    }
  }

  // All retries exhausted
  console.error(`[MG] Verification failed after ${retries} attempts`);
  return {
    success: false,
    error: lastError,
    attempts: retries,
    recordStatus,
    partialResult: lastResult
  } as const;
}

// Create a domain-specific sending API key (restricted to sending on specified domain)
// Uses POST /v1/keys with kind='domain' and role='sending'
// Returns the key secret only once; must be stored immediately
export async function createDomainSendingKey(domain: string, description?: string) {
  const cfg = getMailgunAdminConfig();
  if (!cfg) return { success: false, error: "Missing Mailgun Admin API key" } as const;

  const form = new FormData();
  form.append("kind", "domain");
  form.append("domain_name", domain);
  form.append("role", "sending");
  form.append("description", description || `Sending key for ${domain}`);

  const url = `${cfg.baseUrl}/v1/keys`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg.apiKey),
    } as any,
    body: form as any,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: JSON.stringify(data) } as const;
  }
  return { success: true, result: data } as const;
}

// Delete a domain from Mailgun
export async function deleteDomain(domain: string) {
  const cfg = getMailgunConfig();
  if (!cfg) return { success: false, error: "Missing Mailgun config" } as const;
  const url = `${cfg.baseUrl}/v3/domains/${encodeURIComponent(domain)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: authHeader(cfg.apiKey) },
  });
  
  if (res.status === 404) {
    return { success: true, message: "Domain not found in Mailgun (may have been deleted already)" } as const;
  }
  
  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `Mailgun deleteDomain failed: ${res.status} ${text}` } as const;
  }
  
  return { success: true, message: "Domain deleted successfully" } as const;
}
