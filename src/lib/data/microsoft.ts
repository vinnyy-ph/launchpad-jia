/**
 * Microsoft OAuth2 config (Microsoft Identity Platform) for Outlook integration.
 * Authorization: https://login.microsoftonline.com/common/oauth2/v2.0/authorize
 * Token: https://login.microsoftonline.com/common/oauth2/v2.0/token
 */

const MICROSOFT_AUTH_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export function getMicrosoftOAuthConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and MICROSOFT_REDIRECT_URI must be set",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    authUrl: MICROSOFT_AUTH_URL,
    tokenUrl: MICROSOFT_TOKEN_URL,
  };
}
