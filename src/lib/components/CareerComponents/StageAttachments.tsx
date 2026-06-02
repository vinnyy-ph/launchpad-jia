"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Button from "@/lib/components/ui/button/Button";
import UploadAttachmentsModal from "./UploadAttachmentsModal";
import DeleteAttachmentModal from "./DeleteAttachmentModal";
import AttachmentViewerModal from "./AttachmentViewerModal";
import { assetConstants } from "@/lib/utils/constantsV2";
import styles from "@/lib/styles/components/stage-attachments.module.scss";
import { api } from "@/lib/utils/apiClient";

// Dynamically import PDFViewer with SSR disabled (required for react-pdf with Next.js)
const PDFViewer = dynamic(() => import("./PDFViewer"), {
  ssr: false,
  loading: () => (
    <div className={styles.pdfLoading}>
      <i className="la la-spinner la-spin" />
      <span>Loading PDF...</span>
    </div>
  ),
});

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  key: string;
  url: string;
  uploadedBy: {
    name: string;
    email: string;
    image?: string;
  };
  uploadedAt: string;
}

interface StageAttachmentsProps {
  attachments?: Attachment[];
  onUploadComplete?: () => void;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  interviewId?: string;
  stageId?: string;
  substageId?: string;
  orgID?: string;
  user?: any;
  /** When true, hides Upload button and disables upload modal (view-only mode) */
  readOnly?: boolean;
  /** Shareable assessment context (CandidateProfile) */
  profileId?: string;
  passcode?: string;
}

interface DeleteModalState {
  isOpen: boolean;
  attachment: Attachment | null;
  isDeleting: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " " + date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getFileType(mimeType: string): "pdf" | "video" | "audio" | "image" | "document" {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  return "document";
}

function PDFPreview({ url }: { url: string }) {
  return (
    <div className={`${styles.previewContainer} ${styles.pdfPreview}`}>
      <PDFViewer url={url} />
    </div>
  );
}

function VideoPreview({ url }: { url: string }) {
  return (
    <div className={`${styles.previewContainer} ${styles.videoPreview}`}>
      <video controls preload="metadata">
        <source src={url} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

function AudioPreview({ url }: { url: string }) {
  return (
    <div className={`${styles.previewContainer} ${styles.audioPreview}`}>
      {/* Audio icon */}
      <div className={styles.audioIcon}>
        <i className="la la-music" />
      </div>
      <audio controls preload="metadata" className={styles.audioPlayer}>
        <source src={url} />
        Your browser does not support the audio tag.
      </audio>
    </div>
  );
}

function ImagePreview({ url, filename }: { url: string; filename: string }) {
  return (
    <div className={`${styles.previewContainer} ${styles.imagePreview}`}>
      <img
        src={url}
        alt={filename}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `
              <div class="${styles.imageFallback}">
                <i class="la la-image"></i>
                <span>Image preview unavailable</span>
              </div>
            `;
          }
        }}
      />
    </div>
  );
}

function DocumentPreview({
  filename,
  onDownload,
  isDownloading,
}: {
  filename: string;
  onDownload: () => void;
  isDownloading?: boolean;
}) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  let iconClass = "la la-file-alt";

  if (ext === "xls" || ext === "xlsx") {
    iconClass = "la la-file-excel";
  } else if (ext === "doc" || ext === "docx") {
    iconClass = "la la-file-word";
  }

  return (
    <div className={`${styles.previewContainer} ${styles.documentPreview}`}>
      <i className={iconClass} />
      <button
        className={styles.documentDownloadButton}
        onClick={(e) => {
          e.stopPropagation();
          onDownload();
        }}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <i className="la la-spinner la-spin" />
        ) : (
          <i className="la la-cloud-download-alt" />
        )}
        Download
      </button>
    </div>
  );
}

function KebabMenu({
  attachment,
  onDownload,
  onDelete,
}: {
  attachment: Attachment;
  onDownload: () => void;
  onDelete?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Stop propagation so card click doesn't open viewer modal
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div ref={menuRef} className={styles.kebabContainer} onClick={handleContainerClick}>
      <button onClick={() => setIsOpen(!isOpen)} className={styles.kebabButton}>
        <i className="la la-ellipsis-v" />
      </button>

      {isOpen && (
        <div className={styles.kebabMenu}>
          <div className={styles.menuHeader}>File options</div>
          <button
            onClick={() => {
              onDownload();
              setIsOpen(false);
            }}
            className={styles.menuItem}
          >
            <i className="la la-cloud-download-alt" />
            Download
          </button>
          {onDelete && (
            <button
              onClick={() => {
                onDelete();
                setIsOpen(false);
              }}
              className={styles.menuItem}
            >
              <i className="la la-trash-alt" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AttachmentCard({
  attachment,
  onDownload,
  onDelete,
  onClick,
  previewUrl,
  isDownloading,
}: {
  attachment: Attachment;
  onDownload: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  previewUrl: string | null;
  isDownloading?: boolean;
}) {
  const fileType = getFileType(attachment.mimeType);

  return (
    <div
      className={styles.attachmentCard}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined }}
    >
      <div className={styles.attachmentCardHeader}>
        <div className={styles.attachmentCardInfo}>
          <div className={styles.attachmentNameRow}>
            <span className={styles.attachmentFilename}>{attachment.filename}</span>
            <span className={styles.attachmentSize}>{formatFileSize(attachment.size)}</span>
          </div>

          <div className={styles.attachmentMeta}>
            Uploaded by {attachment.uploadedBy?.name || "Unknown"} on{" "}
            {formatDateTime(attachment.uploadedAt)}
          </div>
        </div>

        <KebabMenu
          attachment={attachment}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      </div>

      <div
        className={styles.attachmentCardContent}
        onClick={(e) => e.stopPropagation()}
      >
        {!previewUrl ? (
          <div className={styles.pdfLoading}>
            <i className="la la-spinner la-spin" />
            <span>Loading preview...</span>
          </div>
        ) : (
          <>
            {fileType === "pdf" && <PDFPreview url={previewUrl} />}
            {fileType === "video" && <VideoPreview url={previewUrl} />}
            {fileType === "audio" && <AudioPreview url={previewUrl} />}
            {fileType === "image" && (
              <ImagePreview url={previewUrl} filename={attachment.filename} />
            )}
            {fileType === "document" && (
              <DocumentPreview
                filename={attachment.filename}
                onDownload={onDownload}
                isDownloading={isDownloading}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function StageAttachments({
  attachments = [],
  onUploadComplete,
  onDeleteAttachment,
  interviewId,
  stageId,
  substageId,
  orgID,
  user,
  readOnly = false,
  profileId,
  passcode,
}: StageAttachmentsProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    attachment: null,
    isDeleting: false,
  });
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (attachments.length === 0) return;

    const fetchPreviewUrls = async () => {
      const results: Record<string, string> = {};

      await Promise.all(
        attachments.map(async (attachment) => {
          if (previewUrls[attachment.id]) return;

          try {
            const payload =
              profileId && passcode
                ? { profileId, passcode, stageId, substageId, attachmentId: attachment.id, mode: "preview" }
                : { orgID, interviewId, stageId, substageId, attachmentId: attachment.id, mode: "preview" };

            const response = await api.post("/api/stage-attachments/download-url", payload);
            if (response.data.downloadUrl) {
              results[attachment.id] = response.data.downloadUrl;
            }
          } catch (error) {
            console.error(`Failed to get preview URL for ${attachment.filename}:`, error);
          }
        })
      );

      if (Object.keys(results).length > 0) {
        setPreviewUrls((prev) => ({ ...prev, ...results }));
      }
    };

    fetchPreviewUrls();
  }, [attachments, orgID, interviewId, stageId, substageId, profileId, passcode]);

  const handleDownload = async (attachment: Attachment) => {
    if (downloadingAttachmentId) return;
    setDownloadingAttachmentId(attachment.id);
    try {
      const payload =
        profileId && passcode
          ? {
              profileId,
              passcode,
              stageId,
              substageId,
              attachmentId: attachment.id,
            }
          : {
              orgID,
              interviewId,
              stageId,
              substageId,
              attachmentId: attachment.id,
            };

      const response = await api.post("/api/stage-attachments/download-url", payload);
      window.open(response.data.downloadUrl, "_blank");
    } catch (error) {
      console.error("Failed to get download URL:", error);
      window.open(attachment.url, "_blank");
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const handleUploadComplete = () => {
    setShowUploadModal(false);
    onUploadComplete?.();
  };

  const handleDeleteClick = (attachment: Attachment) => {
    setDeleteModal({
      isOpen: true,
      attachment,
      isDeleting: false,
    });
  };

  const handleDeleteCancel = () => {
    setDeleteModal({
      isOpen: false,
      attachment: null,
      isDeleting: false,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.attachment || !onDeleteAttachment) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      await onDeleteAttachment(deleteModal.attachment.id);
      setDeleteModal({
        isOpen: false,
        attachment: null,
        isDeleting: false,
      });
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  return (
    <>
      <div className={styles.attachmentsContainer}>
        <div
          className={`${styles.attachmentsHeader}`}
        >
          <div className={styles.attachmentsHeaderLeft}>
            {attachments.length > 0 && (
              <div className={styles.attachmentsIcon}>
                <i className="la la-copy" />
              </div>
            )}
            <span className={styles.attachmentsTitle}>Attachments</span>
          </div>
          {!readOnly && (
            <Button
              label="Upload"
              icon={assetConstants.upload}
              variant="primary"
              onClick={() => setShowUploadModal(true)}
            />
          )}
        </div>

        {attachments.length > 0 && (
          <div className={styles.attachmentsList}>
            {attachments.map((attachment) => (
              <AttachmentCard
                key={attachment.id}
                attachment={attachment}
                onDownload={() => handleDownload(attachment)}
                onDelete={
                  onDeleteAttachment
                    ? () => handleDeleteClick(attachment)
                    : undefined
                }
                onClick={() => setSelectedAttachment(attachment)}
                previewUrl={previewUrls[attachment.id] || null}
                isDownloading={downloadingAttachmentId === attachment.id}
              />
            ))}
          </div>
        )}
      </div>

      {!readOnly && showUploadModal && (
        <UploadAttachmentsModal
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={handleUploadComplete}
          interviewId={interviewId}
          stageId={stageId}
          substageId={substageId}
          orgID={orgID}
          user={user}
        />
      )}

      {deleteModal.isOpen && deleteModal.attachment && (
        <DeleteAttachmentModal
          filename={deleteModal.attachment.filename}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          isDeleting={deleteModal.isDeleting}
        />
      )}

      {selectedAttachment && (
        <AttachmentViewerModal
          attachment={selectedAttachment}
          onClose={() => setSelectedAttachment(null)}
          onDownload={() => handleDownload(selectedAttachment)}
          isDownloading={downloadingAttachmentId === selectedAttachment.id}
          previewUrl={previewUrls[selectedAttachment.id] || null}
        />
      )}
    </>
  );
}
