import { useState, useRef, useCallback } from "react";

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  data: string;
  size: number;
  url?: string;
  key?: string;
}

/** Normalize draft/API attachment shape to EmailAttachment for the editor. */
function normalizeDraftAttachments(list: any[] | null | undefined): EmailAttachment[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.map((a) => ({
    filename: a.filename || a.fileName || "attachment",
    mimeType: a.mimeType || a.contentType || "application/octet-stream",
    data: a.data || "",
    size: typeof a.size === "number" ? a.size : 0,
    url: a.url,
    key: a.key,
  }));
}

export const useEmailAttachments = (initialAttachments?: any[] | null) => {
  const [attachments, setAttachments] = useState<EmailAttachment[]>(() =>
    normalizeDraftAttachments(initialAttachments),
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setAttachmentsFromDraft = useCallback((draftAttachments: any[] | null | undefined) => {
    setAttachments(normalizeDraftAttachments(draftAttachments));
  }, []);

  const handleAttachmentClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleAttachmentChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const files = e.target?.files;
    if (!files) return;

    const newAttachments: EmailAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            let strResult = typeof result === "string" ? result : "";
            const idx = strResult.indexOf("base64,");
            resolve(idx >= 0 ? strResult.slice(idx + 7) : strResult);
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(f);
        });

        newAttachments.push({
          filename: f.name,
          mimeType: f.type,
          data: base64,
          size: f.size,
        });
      } catch (error) {
        console.error(`Failed to process file ${f.name}:`, error);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAttachments = () => {
    setAttachments([]);
  };

  const formatAttachmentsForPayload = () => {
    return attachments.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      data: a.data,
      url: a.url,
      key: a.key,
      size: a.size,
    }));
  };

  return {
    attachments,
    setAttachmentsFromDraft,
    fileInputRef,
    handleAttachmentClick,
    handleAttachmentChange,
    removeAttachment,
    clearAttachments,
    formatAttachmentsForPayload,
  };
};
