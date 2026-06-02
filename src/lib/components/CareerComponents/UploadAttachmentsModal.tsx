"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Button from "@/lib/components/ui/button/Button";
import { api } from "@/lib/utils/apiClient";
import { toast } from "react-toastify";
import { assetConstants } from "@/lib/utils/constantsV2";
import styles from "@/lib/styles/components/stage-attachments.module.scss";
import {
  buildAcceptAttr,
  isAllowedStageAttachment,
} from "@/lib/utils/stageAttachmentsFileTypes";

interface UploadAttachmentsModalProps {
  onClose: () => void;
  onUploadComplete?: () => void;
  interviewId?: string;
  stageId?: string;
  substageId?: string;
  orgID?: string;
  user?: any;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  uploadedBytes: number;
  status: "pending" | "uploading" | "committing" | "complete" | "error" | "cancelled" | "deleting";
  error?: string;
  abortController?: AbortController;
  /** The attachment ID returned from the commit API - needed for deletion */
  attachmentId?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(mimeType: string): React.ReactNode {
  if (mimeType.startsWith("video/")) {
    return <i className="la la-video" />;
  }
  if (mimeType === "application/pdf") {
    return <i className="la la-file-pdf" />;
  }
  if (mimeType.startsWith("image/")) {
    return <i className="la la-image" />;
  }
  if (mimeType.startsWith("audio/")) {
    return <i className="la la-music" />;
  }
  return <i className="la la-file-alt" />;
}

function SparkleIcon() {
  return (
    <div className={styles.sparkleContainer}>
      <img
        src={assetConstants.gradientStar}
        alt=""
        className={`${styles.sparkleStar} ${styles.small}`}
      />
      <img
        src={assetConstants.gradientStar}
        alt=""
        className={`${styles.sparkleStar} ${styles.medium}`}
      />
      <img
        src={assetConstants.gradientStar}
        alt=""
        className={`${styles.sparkleStar} ${styles.tiny}`}
      />
    </div>
  );
}

function CloudUploadIcon() {
  return <i className="la la-cloud-upload-alt" style={{ fontSize: 16, color: "#6172F3" }} />;
}

export default function UploadAttachmentsModal({
  onClose,
  onUploadComplete,
  interviewId,
  stageId,
  substageId,
  orgID,
  user,
}: UploadAttachmentsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // abort all pending uploads when component unmounts
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => {
        controller.abort();
      });
      abortControllersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    const preventBrowserDefault = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("dragover", preventBrowserDefault);
    window.addEventListener("drop", preventBrowserDefault);

    return () => {
      window.removeEventListener("dragover", preventBrowserDefault);
      window.removeEventListener("drop", preventBrowserDefault);
    };
  }, []);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedFiles: File[] = [];

    Array.from(files).forEach((file) => {
      const validation = isAllowedStageAttachment({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
      });

      if (validation.allowed) {
        allowedFiles.push(file);
      } else {
        toast.error(`${file.name}: ${validation.reason}`);
      }
    });

    if (allowedFiles.length === 0) return;

    const newFiles: UploadingFile[] = allowedFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      uploadedBytes: 0,
      status: "pending" as const,
    }));

    setUploadingFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((uploadingFile) => {
      uploadFile(uploadingFile.file, uploadingFile.id);
    });
  };

  const uploadFile = async (file: File, fileId: string) => {
    if (!interviewId || !stageId || !substageId) {
      toast.error("Missing upload context");
      return;
    }

    try {
      if (!isMountedRef.current) return;
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "uploading" } : f))
      );

      const presignResponse = await api.post("/api/stage-attachments/presign", {
        interviewId,
        stageId,
        substageId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        orgID,
      });

      if (!isMountedRef.current) return;

      const { key, presignedUrl } = presignResponse.data;

      const abortController = new AbortController();
      // Track in ref for cleanup on unmount
      abortControllersRef.current.set(fileId, abortController);
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, abortController } : f))
      );

      await axios.put(presignedUrl, file, {
        headers: { "Content-Type": file.type || "application/octet-stream" },
        signal: abortController.signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && isMountedRef.current) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.id === fileId
                  ? { ...f, progress, uploadedBytes: progressEvent.loaded }
                  : f
              )
            );
          }
        },
      });

      // Remove from tracking once upload completes
      abortControllersRef.current.delete(fileId);

      if (!isMountedRef.current) return;

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: "committing", progress: 100, abortController: undefined } : f
        )
      );

      const commitResponse = await api.post("/api/stage-attachments/commit", {
        interviewId,
        orgID,
        stageId,
        substageId,
        key,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        uploadedBy: user
          ? {
              name: user.name || user.displayName || "Unknown",
              email: user.email || "",
              image: user.image || user.photoURL || undefined,
            }
          : undefined,
      });

      if (!isMountedRef.current) return;

      const attachmentId = commitResponse.data?.attachment?.id;

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, progress: 100, status: "complete", abortController: undefined, attachmentId } : f
        )
      );

      toast.success(`${file.name} uploaded successfully`);
    } catch (error: any) {
      // Clean up abort controller reference on error
      abortControllersRef.current.delete(fileId);
      
      if (error.name === "CanceledError" || error.message === "canceled") {
        return;
      }
      console.error("Upload error:", error);
      if (!isMountedRef.current) return;
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, status: "error", error: error.message || "Upload failed", abortController: undefined }
            : f
        )
      );
      toast.error(`Failed to upload ${file.name}`);
    }
  };

  const handleCancelUpload = (fileId: string) => {
    // Abort using the ref (preferred) or fall back to state
    const controller = abortControllersRef.current.get(fileId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(fileId);
    } else {
      const file = uploadingFiles.find((f) => f.id === fileId);
      if (file?.abortController) {
        file.abortController.abort();
      }
    }
    setUploadingFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: "cancelled", abortController: undefined } : f
      )
    );
  };

  const handleRemoveFile = async (fileId: string) => {
    const file = uploadingFiles.find((f) => f.id === fileId);
    
    if (file?.status === "complete" && file.attachmentId) {
      try {
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "deleting" } : f))
        );

        await api.post("/api/stage-attachments/delete", {
          interviewId,
          stageId,
          substageId,
          attachmentId: file.attachmentId,
          orgID,
        });

        setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId));
        toast.success(`${file.file.name} deleted`);
      } catch (error) {
        console.error("Delete error:", error);
        toast.error(`Failed to delete ${file.file.name}`);
        
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "complete" } : f))
        );
      }
    } else {
      setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const completedCount = uploadingFiles.filter(
    (f) => f.status === "complete"
  ).length;
  const isUploading = uploadingFiles.some(
    (f) => f.status === "uploading" || f.status === "committing" || f.status === "pending"
  );
  const isDeleting = uploadingFiles.some((f) => f.status === "deleting");
  const allComplete = uploadingFiles.length > 0 && uploadingFiles.every(
    (f) => f.status === "complete" || f.status === "error" || f.status === "cancelled"
  );
  const hasUploads = uploadingFiles.length > 0;

  const handleDone = () => {
    if (hasUploads && allComplete) {
      onUploadComplete?.();
    } else {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalWrapper}>
        <div className={styles.modalShell} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>Upload Attachments</h3>
            <button onClick={onClose} className={styles.closeButton}>
              <img src={assetConstants.x} alt="Close" />
            </button>
          </div>

          <div className={styles.modalContent}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={buildAcceptAttr()}
              style={{ display: "none" }}
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            {isUploading && (
              <div className={styles.uploadingHeader}>
                <SparkleIcon />
                <div>
                  <div className={styles.uploadingTitle}>Uploading Attachments</div>
                  <div className={styles.uploadingSubtitle}>
                    Please wait while your files are being uploaded.
                  </div>
                </div>
              </div>
            )}

            {hasUploads && allComplete && !isDeleting && (
              <div className={styles.uploadCompleteHeader}>
                <div className={styles.uploadCompleteTitle}>Upload complete!</div>
                <div className={styles.uploadCompleteSubtitle}>
                  <span className={styles.uploadCompleteCheck}>✓</span>
                  {completedCount} {completedCount === 1 ? "file" : "files"} successfully uploaded
                </div>
              </div>
            )}

            {hasUploads && !allComplete && (
              <div className={styles.progressCounter}>
                {completedCount} of {uploadingFiles.length}
              </div>
            )}

            {!hasUploads && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`${styles.dropZone} ${isDragging ? styles.dragging : ""}`}
              >
                <div className={styles.dropZoneIcon}>
                  <img src={assetConstants.fileV2} alt="File" />
                </div>

                <div className={styles.dropZoneText}>
                  <span className={styles.dropZoneTitle}>Upload Attachments</span>
                  <span className={styles.dropZoneDescription}>
                    Upload attachments or files for this candidate.
                  </span>
                </div>

                <div className={styles.dropZoneHelper}>
                  <span>Drop files here</span>
                  <span>or</span>
                </div>

                <Button
                  label="Select files to upload"
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                />
              </div>
            )}

            {uploadingFiles.length > 0 && (
              <div className={styles.filesList}>
                {uploadingFiles.map((uploadingFile) => {
                  const isActive =
                    uploadingFile.status === "uploading" ||
                    uploadingFile.status === "committing" ||
                    uploadingFile.status === "pending";
                  const isDeleting = uploadingFile.status === "deleting";
                  const isComplete = uploadingFile.status === "complete";
                  const progressPercent = Math.round(uploadingFile.progress);

                  return (
                    <div key={uploadingFile.id} className={styles.fileCard}>
                      <div className={styles.fileRow}>
                        <div className={styles.fileIcon}>
                          {getFileIcon(uploadingFile.file.type)}
                        </div>

                        <div className={styles.fileDetails}>
                          <div className={styles.fileInfo}>
                            <span className={styles.fileName}>
                              {uploadingFile.file.name}
                            </span>
                            <span className={styles.fileSize}>
                              {isActive
                                ? `${formatFileSize(uploadingFile.uploadedBytes)} of ${formatFileSize(uploadingFile.file.size)}`
                                : formatFileSize(uploadingFile.file.size)}
                            </span>
                            {isActive && (
                              <span className={styles.uploadStatus}>
                                <CloudUploadIcon />
                                {uploadingFile.status === "committing"
                                  ? "Saving..."
                                  : "Uploading..."}
                              </span>
                            )}
                            {isComplete && (
                              <span className={styles.statusComplete}>✓ Complete</span>
                            )}
                            {isDeleting && (
                              <span className={styles.uploadStatus}>Deleting...</span>
                            )}
                            {uploadingFile.status === "error" && (
                              <span className={styles.statusError}>✕ Failed</span>
                            )}
                            {uploadingFile.status === "cancelled" && (
                              <span className={styles.statusCancelled}>Cancelled</span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            isActive
                              ? handleCancelUpload(uploadingFile.id)
                              : handleRemoveFile(uploadingFile.id)
                          }
                          className={styles.cancelButton}
                          title={isActive ? "Cancel upload" : isComplete ? "Delete" : "Remove"}
                          disabled={isDeleting}
                          style={{ opacity: isDeleting ? 0.5 : 1, cursor: isDeleting ? "not-allowed" : "pointer" }}
                        >
                          {isComplete ? (
                            <i className="la la-trash" style={{ fontSize: 18, color: "#717680" }} />
                          ) : (
                            <img
                              src={assetConstants.x}
                              alt={isActive ? "Cancel" : "Remove"}
                            />
                          )}
                        </button>
                      </div>

                      {isActive && (
                        <div className={styles.progressContainer}>
                          <div className={styles.progressTrack}>
                            <div
                              className={styles.progressFill}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span className={styles.progressPercent}>
                            {progressPercent}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {hasUploads && allComplete && (
              <div className={styles.doneButtonContainer}>
                <Button label="Done" variant="primary" onClick={handleDone} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
