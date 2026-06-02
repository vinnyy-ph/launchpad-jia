export const MicrosoftScopesMapping = {
  openid: "Authenticate with your Microsoft account",
  profile: "Access your profile",
  email: "Access your email address",
  "User.Read": "Read your profile",
  "Mail.Read": "Read your mail",
  "Mail.Send": "Send mail as you",
  offline_access: "Maintain access to your data",
  "MailboxSettings.Read": "Read your mailbox settings",
} as const;

export const OutlookScopes: (keyof typeof MicrosoftScopesMapping)[] = [
  "openid",
  "profile",
  "email",
  "User.Read",
  "Mail.Read",
  "Mail.Send",
  "offline_access",
  "MailboxSettings.Read",
];

export function getOutlookScopeDescription(
  scopes: (keyof typeof MicrosoftScopesMapping)[],
) {
  return scopes.map((scope) => MicrosoftScopesMapping[scope]);
}
