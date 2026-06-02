/**
 * MongoDB utilities for auth handoff codes.
 *
 * A handoff code is a short-lived, single-use opaque token used to transfer
 * an authenticated identity from one domain (talentvault.{domain}) to its
 * canonical counterpart ({domain}).
 *
 * Security properties:
 *  - Only the SHA-256 hash of the code is persisted.
 *  - Codes are consumed via atomic findOneAndDelete (single-use).
 *  - A TTL index auto-deletes unclaimed codes after ~2 minutes.
 */

import crypto from "crypto";
import connectMongoDB from "@/lib/mongoDB/mongoDB";

const COLLECTION = "auth-handoff-codes";
const CODE_TTL_SECONDS = 90; // code valid for 90 seconds
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max codes per user per window

export interface HandoffCodeDoc {
  codeHash: string;
  uid: string;
  targetHost: string;
  redirectPath: string;
  createdAt: Date;
}

/** Hash a plaintext code with SHA-256 (hex). */
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Promise cache for index initialization (module-level, once per process). */
let indexPromise: Promise<void> | null = null;

/** Get or create the index promise for this collection (at-most-once per process). */
function getIndexPromise(
  collection: import("mongodb").Collection<HandoffCodeDoc>
): Promise<void> {
  if (!indexPromise) {
    indexPromise = ensureIndexes(collection);
  }
  return indexPromise;
}

/** Ensure indexes exist (idempotent – safe to call on every request). */
async function ensureIndexes(
  collection: import("mongodb").Collection<HandoffCodeDoc>
) {
  // TTL index – MongoDB deletes docs ~60s after expiry
  await collection
    .createIndex({ createdAt: 1 }, { expireAfterSeconds: CODE_TTL_SECONDS + 30 })
    .catch(() => {
      // Index already exists with same key — ignore
    });
}

/**
 * Create a new handoff code for the given user.
 *
 * @returns The plaintext code to set in the cookie.
 * @throws If rate-limited or DB error.
 */
export async function createHandoffCode(
  uid: string,
  targetHost: string,
  redirectPath: string = "/recruiter-dashboard"
): Promise<{ code: string; expiresInSeconds: number }> {
  const { db } = await connectMongoDB();
  const collection = db.collection<HandoffCodeDoc>(COLLECTION);

  await getIndexPromise(collection);

  // Rate limit: count recent codes for this user
  const recentCount = await collection.countDocuments({
    uid,
    createdAt: { $gt: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
  });

  if (recentCount >= RATE_LIMIT_MAX) {
    throw new Error("RATE_LIMITED");
  }

  // Generate a cryptographically secure random code
  const code = crypto.randomBytes(32).toString("base64url");

  await collection.insertOne({
    codeHash: hashCode(code),
    uid,
    targetHost: normalizeHost(targetHost),
    redirectPath,
    createdAt: new Date(),
  });

  return { code, expiresInSeconds: CODE_TTL_SECONDS };
}

/**
 * Consume (validate + delete) a handoff code.
 *
 * @returns The document if valid, or null if expired/used/nonexistent.
 */
export async function consumeHandoffCode(
  plaintextCode: string,
  requestHost: string
): Promise<HandoffCodeDoc | null> {
  const { db } = await connectMongoDB();
  const collection = db.collection<HandoffCodeDoc>(COLLECTION);

  const codeHash = hashCode(plaintextCode);
  const normalized = normalizeHost(requestHost);

  // Atomic find-and-delete with host validation in the query itself.
  // This ensures a host mismatch does NOT burn the code — the document
  // stays in place for the correct host to consume.
  const result = await collection.findOneAndDelete({
    codeHash,
    targetHost: normalized,
    createdAt: { $gt: new Date(Date.now() - CODE_TTL_SECONDS * 1000) },
  });

  if (!result) {
    return null;
  }

  return result;
}

/** Strip port, www prefix, lowercase, trim trailing dot. */
function normalizeHost(host: string): string {
  return host
    .split(":")[0]
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}
