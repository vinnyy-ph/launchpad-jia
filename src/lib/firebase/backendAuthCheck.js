import admin from "firebase-admin";

export default async function backendAuthCheck(idToken) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccount) {
    console.error({
      error: "[Backend Auth Check] - Service Account data not provided.",
    });
    return false;
  }

  if (!idToken) {
    console.error({ error: "[Backend Auth Check] - AuthToken not provided." });
    return false;
  }

  if (admin.apps.length === 0) {
    try {
      const sanitizedServiceAccount = serviceAccount.replace(/\n/g, "\\n");
      const parseServiceAccount = JSON.parse(sanitizedServiceAccount);

      admin.initializeApp({
        credential: admin.credential.cert(parseServiceAccount),
      });
    } catch (error) {
      console.error({
        error: "[Backend Auth Check] - Error parsing service account.",
      });
      return false;
    }
  }

  try {
    // checkRevoked: true ensures tokens revoked via revokeRefreshTokens() are rejected
    const decodedToken = await admin.auth().verifyIdToken(idToken, true);
    console.log("Firebase Token verified successfully",);
    return decodedToken;
  } catch (error) {
    console.error({
      error: "[Backend Auth Check] - Error verifying token.",
    });
    return false;
  }
}
