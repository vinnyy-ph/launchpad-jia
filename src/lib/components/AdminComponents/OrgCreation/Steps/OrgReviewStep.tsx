"use client";

import React, { useEffect, useState, useRef } from "react";
import { OrgFormState } from "@/lib/types/orgForm";
import { api } from "@/lib/utils/apiClient";
import { PricingPlan } from "@/lib/types/organization";
import OrgReviewSection from "../OrgReviewSection";
import OrganizationStatus from "../../OrgEditing/OrganizationStatus";
import PricingPlanBadge from "../../PricingPlans/PricingPlanBadge";
import { errorToast } from "@/lib/Utils";

interface OrgReviewStepProps {
  formState: OrgFormState;
  setFormState: React.Dispatch<React.SetStateAction<OrgFormState>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
}

export default function OrgReviewStep({ formState, setFormState, setCurrentStep }: OrgReviewStepProps) {
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({
    organizationDetails: true,
    businessDocuments: true,
    emailDomains: true,
    planDetails: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    });
  };

  useEffect(() => {
    if (formState.planId) {
      const fetchPlan = async () => {
        try {
          const response = await api.get("/api/pricing-plan/admin/get-pricing-plans");
          const plan = response.data.find((p: PricingPlan) => p._id === formState.planId);
          setSelectedPlan(plan || null);
        } catch (error) {
          console.error("Error fetching plan:", error);
        }
      };
      fetchPlan();
    }
  }, [formState.planId]);

  const validateFile = (file: File): boolean => {
    if (file.size > 1024 * 1024 * 2) {
      errorToast("File size must be less than 2MB", 1300);
      return false;
    }
    return true;
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setFormState((prev) => ({ ...prev, coverImage: file }));
    }
    e.target.value = "";
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setFormState((prev) => ({ ...prev, image: file }));
    }
    e.target.value = "";
  };

  // Track File objects and URLs with refs
  const coverImageFileRef = useRef<File | null>(null);
  const logoImageFileRef = useRef<File | null>(null);
  const coverImageUrlRef = useRef<string | null>(null);
  const logoImageUrlRef = useRef<string | null>(null);

  // Initialize state with URLs if File objects exist
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(() => {
    if (!formState.coverImage) return null;
    if (typeof formState.coverImage === "string") return formState.coverImage.trim() || null;
    const url = URL.createObjectURL(formState.coverImage);
    coverImageFileRef.current = formState.coverImage;
    coverImageUrlRef.current = url;
    return url;
  });
  const [logoImagePreview, setLogoImagePreview] = useState<string | null>(() => {
    if (!formState.image) return null;
    if (typeof formState.image === "string") return formState.image.trim() || null;
    const url = URL.createObjectURL(formState.image);
    logoImageFileRef.current = formState.image;
    logoImageUrlRef.current = url;
    return url;
  });

  // Update URLs when File objects change
  useEffect(() => {
    // Handle cover image
    if (!formState.coverImage) {
      if (coverImageUrlRef.current && coverImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(coverImageUrlRef.current);
      }
      coverImageUrlRef.current = null;
      coverImageFileRef.current = null;
      setCoverImagePreview(null);
    } else if (typeof formState.coverImage === "string") {
      if (coverImageUrlRef.current && coverImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(coverImageUrlRef.current);
      }
      const trimmed = formState.coverImage.trim() || null;
      coverImageUrlRef.current = trimmed;
      coverImageFileRef.current = null;
      setCoverImagePreview(trimmed);
    } else {
      // File object - check if File reference changed or URL doesn't exist
      if (coverImageFileRef.current !== formState.coverImage || !coverImageUrlRef.current) {
        // File changed or URL missing - revoke old URL and create new one
        if (coverImageUrlRef.current && coverImageUrlRef.current.startsWith("blob:")) {
          URL.revokeObjectURL(coverImageUrlRef.current);
        }
        const url = URL.createObjectURL(formState.coverImage);
        coverImageFileRef.current = formState.coverImage;
        coverImageUrlRef.current = url;
        setCoverImagePreview(url);
      }
      // If File reference is the same and URL exists, keep using existing URL
    }

    // Handle logo image
    if (!formState.image) {
      if (logoImageUrlRef.current && logoImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(logoImageUrlRef.current);
      }
      logoImageUrlRef.current = null;
      logoImageFileRef.current = null;
      setLogoImagePreview(null);
    } else if (typeof formState.image === "string") {
      if (logoImageUrlRef.current && logoImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(logoImageUrlRef.current);
      }
      const trimmed = formState.image.trim() || null;
      logoImageUrlRef.current = trimmed;
      logoImageFileRef.current = null;
      setLogoImagePreview(trimmed);
    } else {
      // File object - check if File reference changed or URL doesn't exist
      if (logoImageFileRef.current !== formState.image || !logoImageUrlRef.current) {
        // File changed or URL missing - revoke old URL and create new one
        if (logoImageUrlRef.current && logoImageUrlRef.current.startsWith("blob:")) {
          URL.revokeObjectURL(logoImageUrlRef.current);
        }
        const url = URL.createObjectURL(formState.image);
        logoImageFileRef.current = formState.image;
        logoImageUrlRef.current = url;
        setLogoImagePreview(url);
      }
      // If File reference is the same and URL exists, keep using existing URL
    }
  }, [formState.coverImage, formState.image]);

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (coverImageUrlRef.current && coverImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(coverImageUrlRef.current);
      }
      if (logoImageUrlRef.current && logoImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(logoImageUrlRef.current);
      }
    };
  }, []);

  const formatDate = (date: Date | null): string => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatRoleName = (role: string) => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* Cover Image and Logo Section */}
      <div style={{ marginBottom: 0 }}>
        {/* Cover Image */}
        <div
          style={{
            width: "100%",
            height: 200,
            borderRadius: 16,
            background: coverImagePreview
              ? `url(${coverImagePreview}) center/cover no-repeat`
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
            <input
              type="file"
              id="coverImage"
              accept="image/jpeg, image/png, image/jpg"
              hidden
              onChange={handleCoverImageChange}
            />
            <button
              type="button"
              onClick={() => document.getElementById("coverImage")?.click()}
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
              {formState.coverImage ? "Replace cover" : "Add cover image"}
            </button>
            {formState.coverImage && (
              <button
                type="button"
                onClick={() => setFormState((prev) => ({ ...prev, coverImage: null }))}
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
                <i className="la la-trash" style={{ color: "#B42318" }} />
                Delete
              </button>
            )}
          </div>
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
                background: logoImagePreview
                  ? `url(${logoImagePreview}) center/cover no-repeat`
                  : "#F8F9FC",
                position: "relative",
                zIndex: 1,
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {!formState.image && (
                <img
                  src="/user-profile.png"
                  alt="Profile placeholder"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: "20px",
                  }}
                />
              )}
              <input
                type="file"
                id="logo"
                accept="image/jpeg, image/png, image/jpg"
                hidden
                onChange={handleLogoChange}
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
                {formState.name || "New Organization"}
              </h1>
              <button
                type="button"
                onClick={() => document.getElementById("logo")?.click()}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #D5D7DA",
                  borderRadius: 999,
                  padding: "8px 14px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#414651",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <i className="la la-camera" />
                {formState.image ? "Replace Logo" : "Upload Logo"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Organization Details Card */}
      <div
        style={{
          background: "#F8F9FC",
          borderRadius: 16,
          padding: 8,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            cursor: "pointer",
          }}
          onClick={() => toggleSection("organizationDetails")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <i
              className={`la la-angle-${expandedSections.organizationDetails ? "up" : "down"
                }`}
              style={{ fontSize: 18, color: "#717680" }}
            />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
              Organization Details
            </h3>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentStep(0);
            }}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E9EAEB",
              cursor: "pointer",
              padding: 8,
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="la la-pencil" style={{ fontSize: 18, color: "#535862" }} />
          </button>
        </div>

        {/* Content */}
        {expandedSections.organizationDetails && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Organization Name */}
              <div>
                <label
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#717680",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Organization Name
                </label>
                <div style={{ fontSize: 16, fontWeight: 500, color: "#181D27" }}>
                  {formState.name || "-"}
                </div>
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  background: "#E9EAEB",
                  margin: "8px 0",
                }}
              />

              {/* Description */}
              <div>
                <label
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#717680",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Description
                </label>
                <div
                  style={{ fontSize: 16, fontWeight: 400, color: "#181D27" }}
                  dangerouslySetInnerHTML={{
                    __html: formState.description || "<em>No description</em>",
                  }}
                />
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  background: "#E9EAEB",
                  margin: "8px 0",
                }}
              />

              {/* Organization Address */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginBottom: 12 }}>
                  Organization Address
                </div>

                {/* Group locations by country */}
                {formState.locations && formState.locations.length > 0 ? (
                  Object.entries(
                    formState.locations.reduce((acc, loc) => {
                      const country = loc.country || "Unknown";
                      if (!acc[country]) acc[country] = [];
                      acc[country].push(loc);
                      return acc;
                    }, {} as Record<string, typeof formState.locations>)
                  ).map(([country, locations]) => (
                    <div key={country} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27", marginBottom: 8 }}>
                        {country}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {locations.map((location, index) => (
                          <li key={index} style={{ fontSize: 14, color: "#414651", marginBottom: 4 }}>
                            <span>{location.address || "No address specified"}</span>
                            {location.isHQ && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  padding: "2px 8px",
                                  background: "#FEE4E2",
                                  borderRadius: 4,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: "#D92D20",
                                }}
                              >
                                HQ
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 14, color: "#717680" }}>No locations specified</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Business Documents Card */}
      <div
        style={{
          background: "#F8F9FC",
          borderRadius: 16,
          padding: 8,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            cursor: "pointer",
          }}
          onClick={() => toggleSection("businessDocuments")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <i
              className={`la la-angle-${expandedSections.businessDocuments ? "up" : "down"
                }`}
              style={{ fontSize: 18, color: "#717680" }}
            />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
              Business Documents
            </h3>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentStep(0);
            }}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E9EAEB",
              cursor: "pointer",
              padding: 8,
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="la la-pencil" style={{ fontSize: 18, color: "#535862" }} />
          </button>
        </div>

        {/* Content */}
        {expandedSections.businessDocuments && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Company/SEC Registration */}
              <div>
                <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 8 }}>
                  Company/SEC Registration
                </p>
                {formState.documents.companyRegistration ? (
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
                      {typeof formState.documents.companyRegistration === "string"
                        ? formState.documents.companyRegistration
                        : formState.documents.companyRegistration.name}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "16px 24px",
                      background: "#F8F9FC",
                      borderRadius: 8,
                      color: "#717680",
                      fontSize: 14,
                    }}
                  >
                    Not uploaded
                  </div>
                )}
              </div>

              {/* Business Permit */}
              <div>
                <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 8 }}>
                  Business Permit
                </p>
                {formState.documents.businessPermit ? (
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
                      {typeof formState.documents.businessPermit === "string"
                        ? formState.documents.businessPermit
                        : formState.documents.businessPermit.name}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "16px 24px",
                      background: "#F8F9FC",
                      borderRadius: 8,
                      color: "#717680",
                      fontSize: 14,
                    }}
                  >
                    Not uploaded
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email Domains Card */}
      <div
        style={{
          background: "#F8F9FC",
          borderRadius: 16,
          padding: 8,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            cursor: "pointer",
          }}
          onClick={() => toggleSection("emailDomains")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <i
              className={`la la-angle-${expandedSections.emailDomains ? "up" : "down"}`}
              style={{ fontSize: 18, color: "#717680" }}
            />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
              Email Domains
            </h3>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentStep(0);
            }}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E9EAEB",
              cursor: "pointer",
              padding: 8,
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="la la-pencil" style={{ fontSize: 18, color: "#535862" }} />
          </button>
        </div>

        {/* Content */}
        {expandedSections.emailDomains && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {formState.emailDomains.filter((d) => d && d.trim()).length > 0 ? (
                formState.emailDomains
                  .filter((d) => d && d.trim())
                  .map((domain, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        background: "#F8F9FC",
                        borderRadius: 8,
                      }}
                    >
                      <i className="la la-globe" style={{ fontSize: 18, color: "#717680" }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                        {domain.trim()}
                      </span>
                    </div>
                  ))
              ) : (
                <p style={{ fontSize: 14, color: "#717680", margin: 0 }}>
                  No email domains configured
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Plan Details Card */}
      <div
        style={{
          background: "#F8F9FC",
          borderRadius: 16,
          padding: 8,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            cursor: "pointer",
          }}
          onClick={() => toggleSection("planDetails")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <i
              className={`la la-angle-${expandedSections.planDetails ? "up" : "down"
                }`}
              style={{ fontSize: 18, color: "#717680" }}
            />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
              Plan Details
            </h3>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentStep(1);
            }}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E9EAEB",
              cursor: "pointer",
              padding: 8,
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="la la-pencil" style={{ fontSize: 18, color: "#535862" }} />
          </button>
        </div>

        {/* Content */}
        {expandedSections.planDetails && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Organization Access */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginBottom: 8 }}>
                  Organization Access
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14, color: "#717680" }}>
                    Enable organization's access to Jia immediately after creation
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                      {formState.accessEnabled ? "Yes" : "No"}
                    </span>
                    {formState.accessEnabled ? (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#D1FADF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <i className="la la-check" style={{ fontSize: 12, color: "#039855" }} />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#FEE4E2",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <i className="la la-times" style={{ fontSize: 12, color: "#D92D20" }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  background: "#E9EAEB",
                  margin: "8px 0",
                }}
              />

              {/* Plan */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginBottom: 12 }}>
                  Plan
                </div>
                {selectedPlan ? (
                  <div
                    style={{
                      border: "1px solid #e6e6e6",
                      borderRadius: 12,
                      padding: "16px 20px",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#181D27" }}>
                        {selectedPlan.name}
                      </span>
                      <PricingPlanBadge schema={selectedPlan.schema} />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 16,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                          Plan Schema
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                          {selectedPlan.schema === "credit-based" ? "Credit-based" : "Premium"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                          {selectedPlan.schema === "premium" ? "Cost" : "Cost / month"}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                          ₱ {selectedPlan.costPerMonth.toLocaleString()}
                          {selectedPlan.schema === "premium" && selectedPlan.costPerYear && (
                            <span style={{ color: "#717680" }}>
                              {" "}
                              / month or ₱ {selectedPlan.costPerYear.toLocaleString()} / year
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedPlan.schema === "credit-based" && (
                        <div>
                          <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                            New Credits / month
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                            {selectedPlan.creditsPerMonth || 0} Credits
                          </div>
                        </div>
                      )}
                      {selectedPlan.schema === "premium" && (
                        <div>
                          <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                            Additional Job Post cost
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                            ₱ {selectedPlan.additionalJobPostCost?.toLocaleString() || 0}
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 16,
                        marginTop: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                          Maximum Active {selectedPlan.schema === "credit-based" ? "Credit-based" : "Premium"} Job Posts
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                          {selectedPlan.maxActiveJobPosts === null
                            ? "Unlimited"
                            : `${selectedPlan.maxActiveJobPosts} ${selectedPlan.schema === "credit-based" ? "Credit-based" : "Premium"} Job Posts`}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                          Maximum Admin Seats
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                          {selectedPlan.maxAdminSeats === null ? "Unlimited" : `${selectedPlan.maxAdminSeats} Admin Seats`}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                          Maximum Guest or HM Seats
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                          {selectedPlan.maxGuestHMSeats === null ? "Unlimited" : `${selectedPlan.maxGuestHMSeats} Guest or HM Seats`}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: "#717680" }}>No plan selected</div>
                )}
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  background: "#E9EAEB",
                  margin: "8px 0",
                }}
              />

              {/* Plan Schedule */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginBottom: 12 }}>
                  Plan Schedule
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>Start Date</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                      {formState.planStartDate
                        ? new Date(formState.planStartDate).toLocaleDateString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                          year: "numeric",
                        })
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>End Date</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                      {formState.planEndDate
                        ? new Date(formState.planEndDate).toLocaleDateString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                          year: "numeric",
                        })
                        : "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  background: "#E9EAEB",
                  margin: "8px 0",
                }}
              />

              {/* Additional Features */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginBottom: 12 }}>
                  Additional Features
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, color: "#717680" }}>Projects</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                        {formState.projectsEnabled ? "Active" : "Inactive"}
                      </span>
                      {formState.projectsEnabled ? (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#D1FADF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="la la-check" style={{ fontSize: 12, color: "#039855" }} />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#FEE4E2",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="la la-times" style={{ fontSize: 12, color: "#D92D20" }} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, color: "#717680" }}>Requisitions</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                        {formState.guestPortalEnabled ? "Active" : "Inactive"}
                      </span>
                      {formState.guestPortalEnabled ? (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#D1FADF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="la la-check" style={{ fontSize: 12, color: "#039855" }} />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#FEE4E2",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="la la-times" style={{ fontSize: 12, color: "#D92D20" }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, color: "#717680" }}>Branded Job Portal</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                        {formState.brandedPortalEnabled ? "Active" : "Inactive"}
                      </span>
                      {formState.brandedPortalEnabled ? (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#D1FADF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="la la-check" style={{ fontSize: 12, color: "#039855" }} />
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, color: "#717680" }}>Global Hiring</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                        {formState.globalHiringEnabled ? "Active" : "Inactive"}
                      </span>
                      {formState.globalHiringEnabled ? (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#D1FADF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="la la-check" style={{ fontSize: 12, color: "#039855" }} />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#FEE4E2",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="la la-times" style={{ fontSize: 12, color: "#D92D20" }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, color: "#717680" }}>Linked Careers</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                        {formState.linkedCareersEnabled ? "Active" : "Inactive"}
                      </span>
                      {formState.linkedCareersEnabled ? (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#D1FADF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="la la-check" style={{ fontSize: 12, color: "#039855" }} />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#FEE4E2",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="la la-times" style={{ fontSize: 12, color: "#D92D20" }} />
                        </div>
                      )}
                    </div>
                  </div>
                  {formState.brandedPortalEnabled && formState.brandedJobPortalSubdomain && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 12 }}>
                      <div style={{ fontSize: 13, color: "#717680" }}>Portal Slug</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#181D27" }}>
                        {formState.brandedJobPortalSubdomain}.{process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "hellojia.ai"}
                      </div>
                    </div>
                  )}
                </div>
                      ) : (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#FEE4E2",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="la la-times" style={{ fontSize: 12, color: "#D92D20" }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Members Section */}
      <OrgReviewSection title="Members" onEdit={() => setCurrentStep(2)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {formState.members
            .filter((m) => m.email && m.role)
            .map((member, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "#F8F9FC",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#E9EAEB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <i className="la la-user" style={{ fontSize: 18, color: "#717680" }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                    {member.email}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "4px 12px",
                    background: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E9EAEB",
                    color: "#414651",
                  }}
                >
                  {formatRoleName(member.role)}
                </span>
              </div>
            ))}
          {formState.members.filter((m) => m.email && m.role).length === 0 && (
            <div style={{ fontSize: 14, color: "#717680", fontStyle: "italic" }}>
              No members added
            </div>
          )}
        </div>
      </OrgReviewSection>
    </div>
  );
}

