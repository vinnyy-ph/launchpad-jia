export const GoogleScopesMapping = {
  "https://mail.google.com/": "Full Gmail access",
  "https://www.googleapis.com/auth/userinfo.email": "Access your email address",
  openid: "Authenticate with your Google account",
} as const;

export const GmailScopes: (keyof typeof GoogleScopesMapping)[] = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function getGmailScopeDescription(
  scopes: (keyof typeof GoogleScopesMapping)[]
) {
  return scopes.map((scope) => GoogleScopesMapping[scope]);
}
