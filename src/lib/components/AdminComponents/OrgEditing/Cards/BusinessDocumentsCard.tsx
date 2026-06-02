"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import { Organization, OrganizationDocument } from "@/lib/types/organization";

interface BusinessDocumentsCardProps {
  organization: Organization;
  onUpdate: (updates: Partial<Organization>) => void;
}

const documentTypes = [
  { name: "Company/SEC Registration", key: "companyRegistration" },
  { name: "Business Permit", key: "businessPermit" },
];

export default function BusinessDocumentsCard({ organization, onUpdate }: BusinessDocumentsCardProps) {
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const getDocument = (docName: string): OrganizationDocument | undefined => {
    return organization.documents?.find((d) => d.name === docName);
  };

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
      return path;
    } catch (error) {
      errorToast("Error uploading file", 1300);
      return null;
    }
  };

  const handleFileChange = async (docType: typeof documentTypes[0], e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      errorToast("File size must be less than 2MB", 1300);
      return;
    }

    setIsUploading(docType.key);
    try {
      const ext = file.type.split("/")[1];
      const documentId = `${organization._id}-${new Date().getTime()}`;
      const path = `organization/documents/${docType.key}/${documentId}.${ext}`;
      const uploadedPath = await uploadFile(file, path);

      if (uploadedPath) {
        const newDoc: OrganizationDocument = {
          name: docType.name,
          filename: file.name,
          filePath: uploadedPath,
          fileType: ext,
        };

        const existingDocs = organization.documents || [];
        const fileToReplace = existingDocs.find((d) => d.name === docType.name)?.filePath;
        const updatedDocs = existingDocs.filter((d) => d.name !== docType.name);
        updatedDocs.push(newDoc);

        await api.post("/api/admin/update-organization", {
          orgID: organization._id,
          update: { documents: updatedDocs },
          replaceFiles: fileToReplace ? [fileToReplace] : [],
        });

        onUpdate({ documents: updatedDocs });
        candidateActionToast("Document uploaded", 1300, <i className="la la-check-circle text-success" />);
      }
    } finally {
      setIsUploading(null);
      const inputRef = fileInputRefs.current[docType.key];
      if (inputRef) inputRef.value = "";
    }
  };

  const handleDelete = async (docType: typeof documentTypes[0]) => {
    if (!confirm(`Are you sure you want to delete ${docType.name}?`)) return;

    try {
      const existingDocs = organization.documents || [];
      const updatedDocs = existingDocs.filter((d) => d.name !== docType.name);

      await api.post("/api/admin/update-organization", {
        orgID: organization._id,
        update: { documents: updatedDocs },
      });

      onUpdate({ documents: updatedDocs });
      candidateActionToast("Document deleted", 1300, <i className="la la-check-circle text-success" />);
    } catch (error) {
      errorToast("Error deleting document", 1300);
    }
  };

  return (
    <div
      style={{
        background: "#F8F9FC",
        borderRadius: 16,
        padding: 8,
      }}
    >
      {/* Header */}
      <div style={{ padding: "10px 12px" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
          Business Documents
        </h3>
      </div>

      {/* Content */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {documentTypes.map((docType) => {
            const doc = getDocument(docType.name);
            const isCurrentlyUploading = isUploading === docType.key;

            return (
              <div key={docType.key}>
                <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 8 }}>
                  {docType.name}
                </p>
                {doc ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: "#F8F9FC",
                      borderRadius: 8,
                      padding: "16px 24px",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        background: "#181D27",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i className="la la-file" style={{ color: "#fff", fontSize: 20 }} />
                    </div>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#181D27",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {doc.filename}
                    </span>
                    <button
                      onClick={() => handleDelete(docType)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 6,
                      }}
                    >
                      <i className="la la-trash" style={{ fontSize: 20, color: "#535862" }} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRefs.current[docType.key]?.click()}
                    disabled={isCurrentlyUploading}
                    style={{
                      width: "100%",
                      padding: "24px",
                      border: "2px dashed #E9EAEB",
                      borderRadius: 8,
                      background: "#F8F9FC",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <i className="la la-cloud-upload" style={{ fontSize: 24, color: "#717680" }} />
                    <span style={{ fontSize: 14, color: "#717680" }}>
                      {isCurrentlyUploading ? "Uploading..." : "Click to upload"}
                    </span>
                  </button>
                )}
                <input
                  ref={(el: HTMLInputElement | null) => { fileInputRefs.current[docType.key] = el; }}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(docType, e)}
                  style={{ display: "none" }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
