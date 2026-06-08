"use client";

import styles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";
import CreateProfileCard from "@/lib/components/ManualProfile/CreateProfileCard";
import { useRef } from "react";

interface SubmitCVStepProps {
  hasCV?: boolean;
  onReviewCV?(): void;
  onFileSelect?(file: File): void;
  onCreateManually?(): void;
  isUploading?: boolean;
}

export function SubmitCVStep({
  hasCV = false,
  onReviewCV,
  onFileSelect,
  onCreateManually,
  isUploading = false,
}: SubmitCVStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadCV = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFileSelect) {
      onFileSelect(files[0]);
      // Reset input so the same file can be selected again
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && onFileSelect) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div className={styles.cvManageContainer}>
      <CreateProfileCard className={styles.cvContainer} onClick={onCreateManually} />

      <div
        className={styles.cvContainer}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <img alt="" src="/iconsV3/uploadV2.svg" />
        <button onClick={handleUploadCV} disabled={isUploading}>
          {isUploading ? "Uploading..." : "Upload CV"}
        </button>
        <span>
          Choose or drag and drop a file here. Our AI tools will
          automatically pre-fill your CV and also check how well it matches
          the role.
        </span>
      </div>

      <input
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      <div className={styles.cvContainer}>
        <img alt="" src="/iconsV3/review.svg" />
        <button 
          className={hasCV ? "" : "disabled"} 
          disabled={!hasCV}
          onClick={onReviewCV}
        >
          Review Current CV
        </button>
        <span>
          Already uploaded a CV? Take a moment to review your details
          before we proceed.
        </span>
      </div>
    </div>
  );
}