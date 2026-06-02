/**
 * Shared Firebase Admin SDK initialization
 *
 * Provides a lazily-initialized admin instance that can be imported by any
 * server-side module.  The existing `backendAuthCheck.js` also initializes
 * admin – both paths converge on the same singleton (`admin.apps`), so
 * whichever runs first wins and subsequent calls are no-ops.
 */

import admin from "firebase-admin";

function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccount) {
    throw new Error(
      "[Firebase Admin] FIREBASE_SERVICE_ACCOUNT env var is not set."
    );
  }

  let parsed;
  try {
    // Try parsing raw JSON first (already valid)
    parsed = JSON.parse(serviceAccount);
  } catch {
    // Fallback: convert escaped newlines to actual newlines, then parse
    try {
      const sanitized = serviceAccount.replace(/\\n/g, "\n");
      parsed = JSON.parse(sanitized);
    } catch (error) {
      throw new Error(
        "[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT. Tried raw JSON and escaped-newline conversion."
      );
    }
  }

  return admin.initializeApp({
    credential: admin.credential.cert(parsed),
  });
}

/**
 * Create a short-lived custom token that a client can exchange via
 * `firebase.auth().signInWithCustomToken(token)`.
 */
export async function createCustomToken(uid: string): Promise<string> {
  getAdminApp();
  return admin.auth().createCustomToken(uid);
}

export { admin, getAdminApp };
