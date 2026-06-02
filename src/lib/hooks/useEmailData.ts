import { useMemo, useCallback } from "react";
import { useEmailSenders } from "./useEmailSenders";
import { useEmailRecipients } from "./useEmailRecipients";
import { useAppContext } from "@/lib/context/AppContext";
import { useLocalStorage } from "./useLocalStorage";

/**
 * Combined hook for email senders and recipients with optimized caching
 * This prevents duplicate API calls when multiple components need the same data
 */
export const useEmailData = (orgID: string | null | undefined) => {
  const { user } = useAppContext();
  const [activeOrg] = useLocalStorage("activeOrg", null);

  // Current org role comes from activeOrg (used by AuthGuard), not always from user.roles/orgRoles
  const currentOrgRole =
    activeOrg && orgID != null && String(activeOrg._id) === String(orgID)
      ? activeOrg.role
      : null;

  const {
    senderOptions,
    gmailEmails,
    outlookEmails,
    defaultSender,
    isLoadingAccounts: isSendersLoading,
    outlookUser,
    outlookEmail,
  } = useEmailSenders(
    orgID,
    null,
    user?.email,
    user?._id,
    user?.roles,
    user?.orgRoles,
    currentOrgRole,
  );

  const { recipientOptions, isLoadingRecipients: isRecipientsLoading } =
    useEmailRecipients(orgID);

  const isLoading = isSendersLoading || isRecipientsLoading;

  // Memoize options by email for quick lookup
  const recipientOptionsByEmail = useMemo(() => {
    const map = new Map<string, any>();
    recipientOptions.forEach((option: any) => {
      if (option.email) {
        map.set(option.email.toLowerCase(), option);
      }
    });
    return map;
  }, [recipientOptions]);

  // Memoize user emails from sender options
  const userEmails = useMemo(() => {
    return new Set(
      senderOptions.map((s: any) => s.email?.toLowerCase()).filter(Boolean),
    );
  }, [senderOptions]);

  /**
   * Match participant emails to recipient options
   * Memoized with useCallback to prevent unnecessary re-renders
   */
  const matchRecipientsFromEmails = useCallback(
    (emails: string[]): any[] => {
      const matched: any[] = [];
      emails.forEach((email) => {
        const matchedOption = recipientOptionsByEmail.get(email.toLowerCase());
        if (matchedOption) {
          matched.push(matchedOption);
        }
      });
      return matched;
    },
    [recipientOptionsByEmail],
  );

  return {
    // Sender data
    senderOptions,
    gmailEmails,
    outlookEmails,
    defaultSender,
    isSendersLoading,
    outlookUser,
    outlookEmail,
    currentOrgRole,
    recipientOptions,
    isRecipientsLoading,
    isLoading,
    recipientOptionsByEmail,
    userEmails,
    matchRecipientsFromEmails,
  };
};
