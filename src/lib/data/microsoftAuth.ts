import { getMicrosoftOAuthConfig } from "@/lib/data/microsoft";
import { OutlookScopes } from "@/lib/data/microsoftScope";

const MICROSOFT_GRAPH_ME = "https://graph.microsoft.com/v1.0/me";

export interface MicrosoftTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

export interface MicrosoftUserResponse {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  picture?: string;
}

export function getMicrosoftAuthUrl(state: string): string {
  const { clientId, redirectUri, authUrl } = getMicrosoftOAuthConfig();
  const scope = OutlookScopes.join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope,
    state,
    response_mode: "query",
    prompt: "select_account",
  });

  return `${authUrl}?${params.toString()}`;
}

export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string,
): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret, tokenUrl } = getMicrosoftOAuthConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token exchange failed: ${res.status} ${text}`);
  }

  const result = await res.json();

  return result as Promise<MicrosoftTokenResponse>;
}

export async function getMicrosoftUser(
  accessToken: string,
): Promise<MicrosoftUserResponse> {
  const res = await fetch(MICROSOFT_GRAPH_ME, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft Graph /me failed: ${res.status} ${text}`);
  }

  const userData = (await res.json()) as MicrosoftUserResponse;

  try {
    const photoRes = await fetch(`${MICROSOFT_GRAPH_ME}/photo/$value`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (photoRes.ok) {
      const photoBuffer = await photoRes.arrayBuffer();
      const contentType = photoRes.headers.get("Content-Type") || "image/jpeg";
      const base64 = Buffer.from(photoBuffer).toString("base64");
      userData.picture = `data:${contentType};base64,${base64}`;
    }
  } catch (err) {
    console.error("Failed to fetch Microsoft profile picture:", err);
  }

  return userData;
}

export async function refreshMicrosoftToken(
  refreshToken: string,
): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret, tokenUrl } = getMicrosoftOAuthConfig();
  const scope = OutlookScopes.join(" ");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope,
    prompt: "select_account",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<MicrosoftTokenResponse>;
}
