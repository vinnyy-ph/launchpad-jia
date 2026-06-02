import { useMemo } from "react";

/**
 * Returns a Set of email addresses that represent the current user:
 * login email plus all sender account emails (Gmail, Mailgun, etc.).
 * Used e.g. to filter threads to those where the user is a participant.
 */
export function useUserEmailsSet(
  user: { email?: string | null } | null | undefined,
  senderOptions: Array<{ email?: string; subtitle?: string }> | null | undefined,
): Set<string> {
  return useMemo(() => {
    const emails: string[] = [];
    if (user?.email) emails.push(String(user.email));
    (senderOptions || []).forEach((s: any) => {
      if (s?.email) emails.push(String(s.email));
      if (s?.subtitle && s.subtitle !== s?.email)
        emails.push(String(s.subtitle));
    });
    return new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  }, [user?.email, senderOptions]);
}
