import { useState, useEffect } from "react";
import { apiClient } from "@/lib/utils/apiClient";

export interface InterviewRecipientOption {
  id: string;
  value: string;
  label: string;
  subtitle: string;
  email: string;
  imageSrc: string;
}

export function useEmailRecipients(orgID: string | null) {
  const [recipientOptions, setRecipientOptions] = useState<
    InterviewRecipientOption[]
  >([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(true);

  useEffect(() => {
    if (!orgID) {
      setIsLoadingRecipients(false);
      return;
    }
    async function fetchInterviewRecipients() {
      try {
        setIsLoadingRecipients(true);
        const response = await apiClient.get(
          `/api/mailgun-module/fetch-applicants-emails?orgId=${orgID}`,
        );
        const recipients = response.data?.applicants || [];
        
        const options = recipients.map((recipient: any) => ({
          id: recipient._id,
          value: recipient.email,
          label: recipient.name || recipient.email,
          subtitle: recipient.email,
          email: recipient.email,
          imageSrc:
            recipient.image ||
            `https://api.dicebear.com/9.x/glass/svg?seed=${recipient.email}`,
        }));
        
        setRecipientOptions(options);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch interview recipients:", error);
        setRecipientOptions([]);
      } finally {
        setIsLoadingRecipients(false);
      }
    }
    fetchInterviewRecipients();
  }, [orgID]);

  return { recipientOptions, isLoadingRecipients };
}
