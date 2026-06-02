import { useState } from "react";
import { apiClient } from "@/lib/utils/apiClient";
import { successToast, errorToast } from "@/lib/Utils";
import {
  extractRecipientEmails,
  extractFromMailgunId,
  validateEmailForm,
  formatInReplyToHeader,
  htmlToText,
  isGmailAccount,
  extractGmailAccountId,
} from "@/lib/utils/emailCandidate";

export interface SendEmailParams {
  fromSender: any[];
  toRecipients: any[];
  ccRecipients?: any[];
  bccRecipients?: any[];
  subject: string;
  body: string;
  orgId: string | null | undefined;
  careerId?: string | null;
  attachments?: any[];
  // Reply-specific fields
  threadId?: string | null;
  inReplyTo?: string | null;
  requireSubject?: boolean;
  gmailEmails?: string[];
  isCampaign?: boolean;
  campaignId?: string;
  draftId?: string | null;
}

export interface SendEmailResponse {
  success: boolean;
  threadId?: string;
  messageId?: string;
}

export interface UseEmailSendingReturn {
  isSending: boolean;
  sendEmail: (params: SendEmailParams) => Promise<SendEmailResponse>;
}

export const useEmailSending = (): UseEmailSendingReturn => {
  const [isSending, setIsSending] = useState(false);

  const sendEmail = async (params: SendEmailParams): Promise<SendEmailResponse> => {
    const {
      fromSender,
      toRecipients,
      ccRecipients = [],
      bccRecipients = [],
      subject,
      body,
      orgId,
      careerId = null,
      attachments = [],
      threadId,
      inReplyTo,
      requireSubject = true,
      gmailEmails = [],
      isCampaign = false,
      campaignId,
      draftId,
    } = params;

    // Validate form
    const validation = validateEmailForm(
      fromSender,
      toRecipients,
      subject,
      body,
      requireSubject,
    );

    if (!validation.isValid) {
      errorToast(validation.error || "Validation failed", 1600);
      return { success: false };
    }

    try {
      setIsSending(true);

      // Check if this is a Gmail account
      const isGmail = isGmailAccount(fromSender, gmailEmails);
      let fromMailgunId = extractFromMailgunId(fromSender);

      // If Gmail account, extract the email-settings ID (remove "gmail:" prefix)
      if (isGmail) {
        const gmailAccountId = extractGmailAccountId(fromSender);
        if (gmailAccountId) {
          fromMailgunId = gmailAccountId;
        }
      }

      const toEmails = extractRecipientEmails(toRecipients);
      const ccEmails =
        ccRecipients.length > 0 ? extractRecipientEmails(ccRecipients) : [];
      const bccEmails =
        bccRecipients.length > 0 ? extractRecipientEmails(bccRecipients) : [];

      // Outlook: use same API as outlook-test (POST /api/outlook/send)
      const isOutlook = String(fromSender?.[0]?.value || "").startsWith(
        "outlook:",
      );
      if (isOutlook) {
        if (!orgId) {
          errorToast("Organization is required to send via Outlook.", 1600);
          return { success: false };
        }
        const outlookPayload = {
          orgID: orgId,
          to: toEmails,
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          bcc: bccEmails.length > 0 ? bccEmails : undefined,
          subject,
          body,
          threadId: threadId || undefined,
          careerId: careerId ?? undefined,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            data: a.data,
            url: a.url,
            key: a.key,
            size: a.size,
          })),
          campaignId: campaignId || undefined,
        };
        try {
          const response = await apiClient.post(
            "/api/outlook/send",
            outlookPayload,
          );
          if (response.data?.messageId != null) {
            return {
              success: true,
              threadId: response.data.threadId,
              messageId: response.data.messageId,
            };
          }
          errorToast(
            response.data?.error || "Failed to send via Outlook. Please try again.",
            1600,
          );
          return { success: false };
        } catch (outlookError: any) {
          const status = outlookError.response?.status;
          const data = outlookError.response?.data;
          if (status === 401 && data?.code === "OUTLOOK_AUTH_EXPIRED") {
            errorToast(
              "Outlook session expired. Please go to Settings → Email Integration → Outlook and reconnect.",
              4000,
            );
          } else {
            errorToast(
              data?.error || outlookError.message || "Failed to send via Outlook. Please try again.",
              1600,
            );
          }
          return { success: false };
        }
      }

      // Mailgun / Gmail: use mg-send-email
      const emailPayload: any = {
        fromMailgunId,
        to: toEmails,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        bcc: bccEmails.length > 0 ? bccEmails : undefined,
        subject,
        html: body,
        text: htmlToText(body),
        careerId,
        orgId: orgId || undefined,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          data: a.data,
          url: a.url,
          key: a.key,
          size: a.size,
        })),
        isCampaign,
        campaignId,
      };

      // Add Gmail-specific fields if this is a Gmail account
      if (isGmail) {
        emailPayload.rawDomain = "google";
      }

      // Add reply-specific fields if provided
      if (threadId) {
        emailPayload.threadId = threadId;
      }
      if (inReplyTo) {
        emailPayload.inReplyTo = inReplyTo;
        emailPayload.inReplyToRaw = formatInReplyToHeader(inReplyTo);
      }
      if (draftId) {
        emailPayload.draftId = draftId;
      }

      const response = await apiClient.post(
        "/api/mailgun-module/mg-send-email",
        emailPayload,
      );

      if (response.data?.success) {
        return {
          success: true,
          threadId: response.data?.data?.threadId,
          messageId: response.data?.data?.messageId,
        };
      } else {
        errorToast("Failed to send email. Please try again.", 1600);
        return { success: false };
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      
      const status = error.response?.status;
      const errorData = error.response?.data;

      // Handle Gmail/Outlook auth errors (424) specifically
      if (status === 424) {
        console.log(errorData?.error);
        errorToast(
          "Email authentication failed. Please reconnect your account.",
          3000
        );
      } else {
        console.log(errorData?.error);
        errorToast(
          "An error occurred while sending the email. Please try again.",
          1600,
        );
      }
      return { success: false };
    } finally {
      setIsSending(false);
    }
  };

  return {
    isSending,
    sendEmail,
  };
};
