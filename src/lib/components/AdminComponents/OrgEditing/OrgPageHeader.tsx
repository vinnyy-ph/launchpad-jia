"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast } from "@/lib/Utils";

interface OrgPageHeaderProps {
  organization: {
    _id?: string;
    name: string;
    description?: string;
    address?: string;
    city?: string;
    province?: string;
    country?: string;
    image?: string;
    coverImage?: string;
  };
  onUpdate?: (updates: Partial<OrgPageHeaderProps["organization"]>) => void;
}

export default function OrgPageHeader({ organization, onUpdate }: OrgPageHeaderProps) {
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    try {
      const response = await api.post("/api/admin/get-presigned-url", {
        fileName: path,
        fileType: file.type,
      });
      const uploadResponse = await fetch(response.data.presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (uploadResponse.status !== 200) throw new Error("Upload failed");
      return `https://cdn.hellojia.ai/${path}`;
    } catch (error) {
      errorToast("Error uploading file", 1300);
      return null;
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      errorToast("File size must be less than 2MB", 1300);
      return;
    }

    setIsUploadingLogo(true);
    try {
      const ext = file.type.split("/")[1];
      const profileImageId = `${organization._id}-${new Date().getTime()}`;
      const path = `organization/profile-image/${profileImageId}.${ext}`;
      const url = await uploadFile(file, path);
      
      if (url) {
        await api.post("/api/admin/update-organization", {
          orgID: organization._id,
          update: { image: url },
          replaceFiles: organization.image ? [organization.image] : [],
        });
        onUpdate?.({ image: url });
        candidateActionToast("Logo updated", 1300, <i className="la la-check-circle text-success" />);
      }
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      errorToast("File size must be less than 2MB", 1300);
      return;
    }

    setIsUploadingCover(true);
    try {
      const ext = file.type.split("/")[1];
      const coverImageId = `${organization._id}-${new Date().getTime()}`;
      const path = `organization/cover-image/${coverImageId}.${ext}`;
      const url = await uploadFile(file, path);
      
      if (url) {
        await api.post("/api/admin/update-organization", {
          orgID: organization._id,
          update: { coverImage: url },
          replaceFiles: organization.coverImage ? [organization.coverImage] : [],
        });
        onUpdate?.({ coverImage: url });
        candidateActionToast("Cover image updated", 1300, <i className="la la-check-circle text-success" />);
      }
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleDeleteCover = async () => {
    if (!organization.coverImage) return;
    if (!confirm("Are you sure you want to remove the cover image?")) return;

    try {
      await api.post("/api/admin/update-organization", {
        orgID: organization._id,
        update: { coverImage: "" },
      });
      onUpdate?.({ coverImage: "" });
      candidateActionToast("Cover image removed", 1300, <i className="la la-check-circle text-success" />);
    } catch (error) {
      errorToast("Error removing cover image", 1300);
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Cover Image */}
      <div
        style={{
          width: "100%",
          height: 200,
          borderRadius: 16,
          background: organization.coverImage
            ? `url(${organization.coverImage}) center/cover no-repeat`
            : "linear-gradient(90deg, #9FCAED, #CEB6DA, #EBACC9, #FCCEC0)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            gap: 8,
          }}
        >
          <button
            onClick={() => coverInputRef.current?.click()}
            disabled={isUploadingCover}
            style={{
              background: "rgba(255,255,255,0.9)",
              border: "1px solid #D5D7DA",
              borderRadius: 999,
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="la la-camera" />
            {isUploadingCover ? "Uploading..." : "Replace cover"}
          </button>
          <button
            onClick={handleDeleteCover}
            disabled={!organization.coverImage || isUploadingCover}
            style={{
              background: "rgba(255,255,255,0.9)",
              border: "1px solid #D5D7DA",
              borderRadius: 999,
              padding: "8px 14px",
              cursor: !organization.coverImage || isUploadingCover ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: !organization.coverImage || isUploadingCover ? 0.55 : 1,
            }}
          >
            <i className="la la-trash" style={{ color: "#B42318" }} />
            Delete
          </button>
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={handleCoverChange}
          style={{ display: "none" }}
        />
      </div>

      {/* Logo and Info */}
      <div
        style={{
          background: "transparent",
          borderRadius: 0,
          padding: "0 24px 24px",
          marginTop: 0,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
          {/* Logo */}
          <div
            style={{
              width: 180,
              height: 180,
              marginTop: -40,
              borderRadius: "50%",
              border: "8px solid #fff",
              background: organization.image
                ? `url(${organization.image}) center/cover no-repeat`
                : "#E9EAEB",
              position: "relative",
              zIndex: 1,
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              style={{ display: "none" }}
            />
          </div>

          {/* Info */}
          <div style={{ flex: 1, paddingTop: 24 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#181D27",
                margin: 0,
                marginBottom: 12,
              }}
            >
              {organization.name}
            </h1>
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={isUploadingLogo}
              style={{
                background: "#FFFFFF",
                border: "1px solid #D5D7DA",
                borderRadius: 999,
                padding: "8px 14px",
                cursor: isUploadingLogo ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 500,
                color: "#414651",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <i className={`la ${isUploadingLogo ? "la-spinner la-spin" : "la-camera"}`} />
              {isUploadingLogo ? "Uploading..." : "Replace Logo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
