"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import styles from "@/lib/styles/components/stage-attachments.module.scss";

// Dynamically import PDFViewer with SSR disabled (required for react-pdf with Next.js)
const PDFViewer = dynamic(() => import("./PDFViewer"), {
  ssr: false,
  loading: () => (
    <div className={styles.pdfLoading}>
      <i className="la la-spinner la-spin" />
      <span>Loading PDF viewer...</span>
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

interface AttachmentViewerModalProps {
  attachment: Attachment;
  onClose: () => void;
  onDownload: () => void;
  isDownloading?: boolean;
  previewUrl?: string | null;
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
  return (
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " " +
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
}

function getFileType(
  mimeType: string
): "pdf" | "video" | "audio" | "image" | "other" {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  return "other";
}

function PDFPreview({ url }: { url: string }) {
  return <PDFViewer url={url} />;
}

function VideoPreview({ url }: { url: string }) {
  return (
    <div className={styles.viewerVideoPreview}>
      <video controls preload="metadata">
        <source src={url} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

function AudioPreview({ url }: { url: string }) {
  return (
    <div className={styles.viewerAudioPreview}>
      <div className={styles.viewerAudioIcon}>
        <i className="la la-music" />
      </div>
      <audio controls preload="metadata" className={styles.viewerAudioPlayer}>
        <source src={url} />
        Your browser does not support the audio tag.
      </audio>
    </div>
  );
}

function ImagePreview({ url, filename }: { url: string; filename: string }) {
  return (
    <div className={styles.viewerImagePreview}>
      <img
        src={url}
        alt={filename}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `
              <div class="${styles.viewerImageFallback}">
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

function DocumentPlaceholder({
  filename,
  onDownload,
  isDownloading,
}: {
  filename: string;
  onDownload?: () => void;
  isDownloading?: boolean;
}) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  let iconClass = "la la-file-alt";
  let label = "Document";

  if (ext === "xls" || ext === "xlsx") {
    iconClass = "la la-file-excel";
    label = "Spreadsheet";
  } else if (ext === "doc" || ext === "docx") {
    iconClass = "la la-file-word";
    label = "Word Document";
  } else if (ext === "txt") {
    iconClass = "la la-file-alt";
    label = "Text File";
  }

  return (
    <div className={styles.viewerDocumentPlaceholder}>
      <i className={iconClass} />
      <span>{label}</span>
      {onDownload ? (
        <button
          className={styles.documentDownloadButton}
          onClick={onDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <i className="la la-spinner la-spin" />
          ) : (
            <i className="la la-cloud-download-alt" />
          )}
          Download
        </button>
      ) : (
        <span className={styles.noPreviewText}>No preview available</span>
      )}
    </div>
  );
}

export default function AttachmentViewerModal({
  attachment,
  onClose,
  onDownload,
  isDownloading = false,
  previewUrl,
}: AttachmentViewerModalProps) {
  const fileType = getFileType(attachment.mimeType);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prevent background scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div className={styles.viewerOverlay} onClick={handleOverlayClick}>
      <div className={styles.viewerContainer}>
        {/* Header */}
        <div className={styles.viewerHeader}>
          <div className={styles.viewerHeaderLeft}>
            <div className={styles.viewerFilenameRow}>
              <span className={styles.viewerFilename}>{attachment.filename}</span>
              <span className={styles.viewerFileSize}>
                {formatFileSize(attachment.size)}
              </span>
            </div>
            <div className={styles.viewerMeta}>
              Uploaded by {attachment.uploadedBy?.name || "Unknown"} on{" "}
              {formatDateTime(attachment.uploadedAt)}
            </div>
          </div>
          <div className={styles.viewerHeaderRight}>
            <button
              className={styles.viewerActionButton}
              onClick={onDownload}
              disabled={isDownloading}
              title="Download"
            >
              {isDownloading ? (
                <i className="la la-spinner la-spin" />
              ) : (
                <i className="la la-cloud-download-alt" />
              )}
            </button>
            <button
              className={styles.viewerCloseButton}
              onClick={onClose}
              title="Close"
            >
              <i className="la la-times" />
            </button>
          </div>
        </div>

        {/* Body / Preview */}
        <div className={styles.viewerBody}>
          <div className={styles.viewerPreviewContent}>
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
                {fileType === "other" && (
                  <DocumentPlaceholder
                    filename={attachment.filename}
                    onDownload={onDownload}
                    isDownloading={isDownloading}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render via portal to document.body
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
}

