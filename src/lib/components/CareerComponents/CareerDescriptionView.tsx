"use client";

import React, { useState, useMemo, useEffect } from "react";
import PipelineStageBuilder from "./PipelineStageBuilder";
import { DEFAULT_JOB_PIPELINE } from "../../utils/constants";
import { useAppContext } from "@/lib/context/AppContext";
import { api } from "@/lib/utils/apiClient";
import Swal from "sweetalert2";
import {
  candidateActionToast,
  errorToast,
  isStageEnabled,
  getEnabledStages,
} from "@/lib/Utils";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { Button } from "../ui";
import { generateJobPortalUrl } from "@/lib/utils/subdomainUtils";
import {
  deleteCareer as deleteCareerWithNotice,
  type CareerDeletePreview,
} from "@/lib/utils/careerDelete";
import {
  HIRING_MANAGER_ROLE,
  normalizeCareerTeamRole,
} from "@/lib/utils/careerTeamRole";
import {
  END_TO_END_LABEL,
  LINKED_CAREER_LABEL,
  PARENT_POST_LABEL,
  CHILD_POST_LABEL,
} from "@/lib/utils/careerPostType";

export default function CareerDescriptionView({
  formData,
  setFormData,
  deletePreview,
  onEdit,
}: {
  formData: any;
  setFormData: (data: any) => void;
  deletePreview?: CareerDeletePreview;
  onEdit?: (section: string) => void;
}) {
  const { user, orgID } = useAppContext();
  const [activeOrg] = useLocalStorage("activeOrg", null);
  const router = useRouter();
  const [userMemberRole, setUserMemberRole] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    careerDetails: true,
    cvReview: true,
    aiInterview: true,
    interviewQuestions: true,
    pipelineStages: true,
  });

  // Fetch user's member role from members collection (org-level permissions)
  useEffect(() => {
    const fetchUserMemberRole = async () => {
      if (!user?.email || !orgID) return;
      try {
        const response = await api.post("/api/get-org-members", { orgID });
        if (response.status === 200 && response.data?.members) {
          const member = response.data.members.find(
            (m: any) => m.email === user.email
          );
          if (member) {
            setUserMemberRole(member.role);
          }
        }
      } catch (error) {
        console.error("Error fetching user member role:", error);
      }
    };
    fetchUserMemberRole();
  }, [user?.email, orgID]);

  // Determine current user's role (career-specific team member role)
  const currentUserRole = useMemo(() => {
    if (!user?.email) {
      return HIRING_MANAGER_ROLE;
    }
    
    // If teamMembers exists and is an array, check it first
    if (formData?.teamMembers && Array.isArray(formData.teamMembers) && formData.teamMembers.length > 0) {
      const member = formData.teamMembers.find(
        (m: any) => m.email === user.email
      );
      if (member?.role) {
        return normalizeCareerTeamRole(member.role) || member.role;
      }
    }
    
    // Fallback: For old careers without teamMembers, check if user is the creator
    // This handles legacy careers created before teamMembers was implemented
    if (formData?.createdBy?.email && formData.createdBy.email === user.email) {
      return "Job Owner";
    }
    
    return HIRING_MANAGER_ROLE;
  }, [user?.email, formData?.teamMembers, formData?.createdBy]);

  // Check if user can edit: Job Owner OR org admin/super_admin
  const canEdit = useMemo(() => {
    // Career-specific permission: Job Owner can always edit
    if (currentUserRole === "Job Owner") {
      return true;
    }
    
    // Org-level permissions: admin or super_admin can edit any career in their org
    if (userMemberRole === "admin" || userMemberRole === "super_admin") {
      return true;
    }
    
    return false;
  }, [currentUserRole, userMemberRole]);

  const isCVScreeningEnabled = () => {
    const stages = formData.pipelineStages || DEFAULT_JOB_PIPELINE;
    const cvStage = stages.find((s: any) => s.id === "1");
    return cvStage?.enabled !== false;
  };

  const isAIInterviewEnabled = () => {
    const stages = formData.pipelineStages || DEFAULT_JOB_PIPELINE;
    const aiStage = stages.find((s: any) => s.id === "2");
    return aiStage?.enabled !== false;
  };

  // Fetch project information by career ID
  useEffect(() => {
    const fetchProjectByCareer = async () => {
      if (!formData._id || !orgID) return;

      try {
        const response = await api.post("/api/projects/get-by-career", {
          careerId: formData._id,
          orgID,
        });

        if (response.status === 200 && response.data.success && response.data.project) {
          setFormData({
            ...formData,
            project: response.data.project.name,
            projectId: response.data.project._id,
          });
        }
      } catch (error) {
        console.error("Failed to fetch project by career:", error);
      }
    };

    fetchProjectByCareer();
  }, [formData._id, orgID]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleEdit = (section: string) => {
    if (onEdit && canEdit) {
      onEdit(section);
    }
  };

  const handleOpenLink = () => {
    if (directInterviewLink) {
      window.open(directInterviewLink, "_blank");
    }
  };

  const handleToggleDirectInterviewLink = async () => {
    if (!canEdit) return;

    const isEnabled = formData.directInterviewLinkEnabled !== false; // Default to true if not set
    const action = isEnabled ? "disable" : "enable";
    const actionText = isEnabled ? "Disable" : "Enable";

    const result = await Swal.fire({
      title: `${actionText} Direct Interview Link?`,
      text: `Are you sure you want to ${action} the direct interview link? ${
        isEnabled
          ? "People will no longer be able to apply through this link."
          : "People will be able to apply through this link again."
      }`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: isEnabled ? "#d33" : "#3085d6",
      cancelButtonColor: "#6c757d",
      confirmButtonText: `Yes, ${action} it!`,
    });

    if (result.isConfirmed) {
      Swal.fire({
        title: `${actionText.slice(0, -1)}ing link...`,
        text: "Please wait...",
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
          Swal.showLoading();
        },
      });

      try {
        const response = await api.post("/api/update-career", {
          _id: formData._id,
          directInterviewLinkEnabled: !isEnabled,
          updatedAt: Date.now(),
          lastEditedBy: {
            name: user.name,
            email: user.email,
            image: user.image,
          },
        });

        if (response.status === 200) {
          Swal.close();
          candidateActionToast(
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginLeft: 8,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                Direct interview link {isEnabled ? "disabled" : "enabled"}{" "}
                successfully
              </span>
            </div>,
            1300,
            <i
              className="la la-check-circle"
              style={{ color: "#039855", fontSize: 32 }}
            ></i>
          );
          setFormData({
            ...formData,
            directInterviewLinkEnabled: !isEnabled,
          });
        }
      } catch (error) {
        console.error("Error updating direct interview link:", error);
        Swal.fire({
          title: "Error!",
          text: "An error occurred while updating the link",
          icon: "error",
        });
      }
    }
  };

  const handleDeleteCareer = async () => {
    if (!canEdit) return;
    await deleteCareerWithNotice(formData._id, {
      orgID,
      preview: deletePreview,
    });
  };

  const handleCopyLink = () => {
    if (directInterviewLink) {
      navigator.clipboard.writeText(directInterviewLink);
      candidateActionToast(
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginLeft: 8,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
            Link copied to clipboard
          </span>
        </div>,
        1300,
        <i
          className="la la-check-circle"
          style={{ color: "#039855", fontSize: 32 }}
        ></i>
      );
    }
  };

  const displayJobTitle = activeOrg?.linkedCareersEnabled && formData.childTitle && formData.parentCareerTitle
    ? formData.parentCareerTitle
    : formData.jobTitle;

  // Generate career links
  const careerLink = useMemo(() => {
    if (formData._id) {
       const brandedJobPortalSubdomain = activeOrg?.brandedJobPortalSubdomain || formData?.organization?.brandedJobPortalSubdomain;
       const brandedPortalEnabled = formData?.organization?.brandedPortalEnabled ?? activeOrg?.brandedPortalEnabled;
       
       if (brandedJobPortalSubdomain && brandedPortalEnabled) {
         return generateJobPortalUrl(brandedJobPortalSubdomain, formData._id);
       }
       
       const fallbackUrl = typeof window !== "undefined" ? window.location.origin : "";
       const isLocalhost = typeof window !== "undefined" && window.location.hostname.includes("localhost");
       const protocol = typeof window !== "undefined" ? window.location.protocol : (isLocalhost ? "http:" : "https:");
       
       const domain = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN;
       
       const baseUrl = domain ? `${protocol}//${domain}` : fallbackUrl;
       
       let link = `${baseUrl}/job-openings/${formData._id}`;
       
       return link;
    }
    return null;
  }, [formData._id, activeOrg, orgID, formData?.organization]);

  const directInterviewLink = useMemo(() => {
    if (formData._id) {
      const fallbackUrl = typeof window !== "undefined" ? window.location.origin : "";
      const isLocalhost = typeof window !== "undefined" && window.location.hostname.includes("localhost");
      const protocol = typeof window !== "undefined" ? window.location.protocol : (isLocalhost ? "http:" : "https:");
      
      const domain = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN;
      const baseUrl = domain ? `${protocol}//www.${domain}` : fallbackUrl;
      return `${baseUrl}/direct-interview/${formData._id}`;
    }
    return null;
  }, [formData._id]);

  return (
    <div style={{ display: "flex", gap: 24, marginTop: 24, marginBottom: 40 }}>
      {/* Left Column */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
        }}
      >
        {/* Career Details & Team Access */}
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
              onClick={() => toggleSection("careerDetails")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <i
                  className={`la la-angle-${
                    expandedSections.careerDetails ? "up" : "down"
                  }`}
                  style={{ fontSize: 18, color: "#717680" }}
                />
                <span
                  style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}
                >
                  Career Details & Team Access
                </span>
              </div>
              <button
                disabled={!canEdit}
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: "50%",
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.5,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canEdit) {
                    handleEdit("careerDetails");
                  }
                }}
              >
                <i className="la la-pencil" style={{ fontSize: 16 }} />
              </button>
            </div>

            {expandedSections.careerDetails && (
              <div className="layered-card-content">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px 32px",
                  }}
                >
                  {/* Career Posting Type / Category Type row - only when linkedCareersEnabled */}
                  {activeOrg?.linkedCareersEnabled && (
                    <>
                      <div>
                        <span
                          style={{
                            fontSize: 14,
                            color: "#414651",
                            fontWeight: 700,
                            display: "block",
                            marginBottom: 4,
                          }}
                        >
                          Career Posting Type
                        </span>
                        <span style={{ fontSize: 15, color: "#717680" }}>
                          {formData.careerPostType === "standalone"
                            ? END_TO_END_LABEL
                            : formData.careerPostType === "candidate_pool" || formData.careerPostType === "receiving_pool"
                            ? LINKED_CAREER_LABEL
                            : "Not set"}
                        </span>
                      </div>
                      {(formData.careerPostType === "candidate_pool" || formData.careerPostType === "receiving_pool") && (
                        <div>
                          <span
                            style={{
                              fontSize: 14,
                              color: "#414651",
                              fontWeight: 700,
                              display: "block",
                              marginBottom: 4,
                            }}
                          >
                            Category Type
                          </span>
                          <span style={{ fontSize: 15, color: "#717680" }}>
                            {formData.careerPostType === "candidate_pool"
                              ? PARENT_POST_LABEL
                              : CHILD_POST_LABEL}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          height: "1px",
                          backgroundColor: "#E9EAEB",
                        }}
                      />
                    </>
                  )}

                  {/* Job Title */}
                  <div style={{ gridColumn: activeOrg?.linkedCareersEnabled && formData.childTitle ? "span 1" : "1 / -1" }}>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Job Title
                    </span>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {formData.jobTitle ? (typeof window !== "undefined" ? new DOMParser().parseFromString(formData.jobTitle, "text/html").body.textContent : formData.jobTitle) : "N/A"}
                    </span>
                  </div>

                  {/* Child Title - only when linked careers enabled and assigned */}
                  {activeOrg?.linkedCareersEnabled && formData.childTitle && (
                    <div>
                      <span
                        style={{
                          fontSize: 14,
                          color: "#414651",
                          fontWeight: 700,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Child Title
                      </span>
                      <span style={{ fontSize: 15, color: "#717680" }}>
                        {formData.childTitle}
                      </span>
                    </div>
                  )}

                  {/* Divider after Job Title */}
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      height: "1px",
                      backgroundColor: "#E9EAEB",
                    }}
                  />

                  {/* Employment Type */}
                  <div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Employment Type
                    </span>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {formData.employmentType || "N/A"}
                    </span>
                  </div>

                  {/* Work Arrangement */}
                  <div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Work Arrangement
                    </span>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {formData.workSetup || "N/A"}
                    </span>
                  </div>

                  {/* Empty cell */}
                  <div></div>

                  {/* Divider after Employment Type row */}
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      height: "1px",
                      backgroundColor: "#E9EAEB",
                    }}
                  />

                  {/* Country */}
                  {/* <div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Country
                    </span>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {formData.country || "N/A"}
                    </span>
                  </div> */}
                  
                  {/* Location */}
                  <div style={{ gridColumn: "span 2" }}>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Location
                    </span>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {formData.location || "N/A"}
                    </span>
                  </div>

                  {/* Enable Global Hiring */}
                  {activeOrg?.globalHiringEnabled !== false && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span
                        style={{
                          fontSize: 14,
                          color: "#414651",
                          fontWeight: 700,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Enable Global Hiring?
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, color: "#717680" }}>
                          {formData.globalHiringEnabled ? "Yes" : "No"}
                        </span>
                        {formData.globalHiringEnabled && (
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              backgroundColor: "#ECFDF5",
                              border: "1px solid #A7F3D0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <i
                              className="la la-check"
                              style={{
                                color: "#10B981",
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Divider after Location row */}
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      height: "1px",
                      backgroundColor: "#E9EAEB",
                    }}
                  />

                  {/* Minimum Salary */}
                  <div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Minimum Salary
                    </span>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {formData.salaryNegotiable
                        ? "Negotiable"
                        : formData.minimumSalary
                        ? `₱${formData.minimumSalary}`
                        : "N/A"}
                    </span>
                  </div>

                  {/* Maximum Salary */}
                  <div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Maximum Salary
                    </span>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {formData.salaryNegotiable
                        ? "Negotiable"
                        : formData.maximumSalary
                        ? `₱${formData.maximumSalary}`
                        : "N/A"}
                    </span>
                  </div>

                  {/* Salary Unit */}
                  <div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Salary Unit
                    </span>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {formData.salaryUnit || "Monthly"}
                    </span>
                  </div>

                  {/* Divider after Salary row */}
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      height: "1px",
                      backgroundColor: "#E9EAEB",
                    }}
                  />

                  {/* Show salary to applicants */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Show salary to applicants
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, color: "#717680" }}>
                        {formData.showSalaryToApplicants ? "Yes" : "No"}
                      </span>
                      {formData.showSalaryToApplicants && (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            backgroundColor: "#ECFDF5",
                            border: "1px solid #A7F3D0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i
                            className="la la-check"
                            style={{
                              color: "#10B981",
                              fontSize: 12,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "1px",
                    backgroundColor: "#E9EAEB",
                    margin: "12px 0",
                  }}
                />

                <span
                  style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}
                >
                  Job Description
                </span>
                <div
                  style={{
                    fontSize: 15,
                    color: "#717680",
                    lineHeight: 1.6,
                    marginTop: 8,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: formData.description || "N/A",
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* CV Review & Pre-Screening Questions */}
        {isCVScreeningEnabled() && (
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
              onClick={() => toggleSection("cvReview")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <i
                  className={`la la-angle-${
                    expandedSections.cvReview ? "up" : "down"
                  }`}
                  style={{ fontSize: 18, color: "#717680" }}
                />
                <span
                  style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}
                >
                  CV Review & Pre-Screening Questions
                </span>
              </div>
              <button
                disabled={!canEdit}
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: "50%",
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.5,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canEdit) {
                    handleEdit("cvReview");
                  }
                }}
              >
                <i className="la la-pencil" style={{ fontSize: 16 }} />
              </button>
            </div>

            {expandedSections.cvReview && (
              <div className="layered-card-content">
                <span
                  style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}
                >
                  CV Screening
                </span>
                <span
                  style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}
                >
                  Automatically endorse candidates who are{" "}
                  <span
                    style={{
                      backgroundColor: "#E0F2FE",
                      color: "#0369A1",
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontWeight: 600,
                      fontSize: 14,
                      border: "1px solid #7DD3FC",
                    }}
                  >
                    {formData.screeningSetting?.replace(" and above", "") ||
                      "Good Fit"}
                  </span>
                </span>

                {formData.cvSecretPrompt && (
                  <>
                    <div
                      style={{
                        width: "100%",
                        height: "1px",
                        backgroundColor: "#E9EAEB",
                        margin: "12px 0",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: "24px",
                          height: "24px",
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={{
                            position: "absolute",
                            left: "0",
                            top: "2px",
                          }}
                        >
                          <path
                            d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                            fill="#E9A5C9"
                            opacity="0.8"
                          />
                        </svg>
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={{
                            position: "absolute",
                            right: "-2px",
                            top: "-2px",
                          }}
                        >
                          <path
                            d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                            fill="#9FCAED"
                            opacity="0.7"
                          />
                        </svg>
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={{
                            position: "absolute",
                            left: "2px",
                            bottom: "-2px",
                          }}
                        >
                          <path
                            d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                            fill="#C8B5DA"
                            opacity="0.6"
                          />
                        </svg>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          color: "#414651",
                          fontWeight: 700,
                        }}
                      >
                        CV Secret Prompt
                      </span>
                    </div>
                    <ul
                      style={{
                        margin: "8px 0",
                        paddingLeft: 20,
                        color: "#717680",
                        fontSize: 15,
                      }}
                    >
                      {formData.cvSecretPrompt
                        .split("\n")
                        .map(
                          (line: string, index: number) =>
                            line.trim() && <li key={index}>{line.trim()}</li>
                        )}
                    </ul>
                  </>
                )}

                {formData.preScreeningQuestions &&
                  formData.preScreeningQuestions.length > 0 && (
                    <>
                      <div
                        style={{
                          width: "100%",
                          height: "1px",
                          backgroundColor: "#E9EAEB",
                          margin: "12px 0",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#414651",
                          }}
                        >
                          Pre-Screening Questions
                        </span>
                        <span
                          style={{
                            backgroundColor: "#F8F9FC",
                            color: "#363F72",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 700,
                            border: "1px solid #D5D9EB",
                          }}
                        >
                          {formData.preScreeningQuestions.length}
                        </span>
                      </div>
                      <ol
                        style={{
                          margin: 0,
                          paddingLeft: 20,
                          color: "#717680",
                          fontSize: 15,
                        }}
                      >
                        {formData.preScreeningQuestions.map(
                          (question: any, index: number) => (
                            <li key={index} style={{ marginBottom: 8 }}>
                              {question.question}
                              {question.answers &&
                                question.answers.length > 0 && (
                                  <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                                    {question.answers.map(
                                      (answer: any, ansIndex: number) => (
                                        <li key={ansIndex}>{answer.value}</li>
                                      )
                                    )}
                                  </ul>
                                )}
                            </li>
                          )
                        )}
                      </ol>
                    </>
                  )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* AI Interview Setup */}
        {isAIInterviewEnabled() && (
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
              onClick={() => toggleSection("aiInterview")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <i
                  className={`la la-angle-${
                    expandedSections.aiInterview ? "up" : "down"
                  }`}
                  style={{ fontSize: 18, color: "#717680" }}
                />
                <span
                  style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}
                >
                  AI Interview Setup
                </span>
              </div>
              <button
                disabled={!canEdit}
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: "50%",
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.5,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canEdit) {
                    handleEdit("aiInterview");
                  }
                }}
              >
                <i className="la la-pencil" style={{ fontSize: 16 }} />
              </button>
            </div>

            {expandedSections.aiInterview && (
              <div className="layered-card-content">
                <span
                  style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}
                >
                  AI Interview Screening
                </span>
                <span
                  style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}
                >
                  Automatically endorse candidates who are{" "}
                  <span
                    style={{
                      backgroundColor: "#E0F2FE",
                      color: "#0369A1",
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontWeight: 600,
                      fontSize: 14,
                      border: "1px solid #7DD3FC",
                    }}
                  >
                    {formData.screeningSetting?.replace(" and above", "") ||
                      "Good Fit"}
                  </span>
                </span>

                <div
                  style={{
                    width: "100%",
                    height: "1px",
                    backgroundColor: "#E9EAEB",
                    margin: "12px 0",
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}
                  >
                    Require Video on Interview
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        color: "#717680",
                        fontWeight: 400,
                      }}
                    >
                      {formData.requireVideo ? "Yes" : "No"}
                    </span>
                    {formData.requireVideo && (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          backgroundColor: "#ECFDF5",
                          border: "1px solid #A7F3D0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <i
                          className="la la-check"
                          style={{
                            color: "#10B981",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "1px",
                    backgroundColor: "#E9EAEB",
                    margin: "12px 0",
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}
                  >
                    AI Interview Video Walkthrough
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      color: "#717680",
                      fontWeight: 400,
                    }}
                  >
                    {(formData.walkthroughLanguage ??
                      activeOrg?.walkthroughLanguage ??
                      "english") === "tagalog"
                      ? "Tagalog"
                      : "English (Default)"}
                  </span>
                </div>

                {formData.interviewSecretPrompt && (
                  <>
                    <div
                      style={{
                        width: "100%",
                        height: "1px",
                        backgroundColor: "#E9EAEB",
                        margin: "12px 0",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: "24px",
                          height: "24px",
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={{
                            position: "absolute",
                            left: "0",
                            top: "2px",
                          }}
                        >
                          <path
                            d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                            fill="#E9A5C9"
                            opacity="0.8"
                          />
                        </svg>
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={{
                            position: "absolute",
                            right: "-2px",
                            top: "-2px",
                          }}
                        >
                          <path
                            d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                            fill="#9FCAED"
                            opacity="0.7"
                          />
                        </svg>
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={{
                            position: "absolute",
                            left: "2px",
                            bottom: "-2px",
                          }}
                        >
                          <path
                            d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                            fill="#C8B5DA"
                            opacity="0.6"
                          />
                        </svg>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          color: "#414651",
                          fontWeight: 700,
                        }}
                      >
                        Interview Secret Prompt
                      </span>
                    </div>
                    <ul
                      style={{
                        margin: "8px 0",
                        paddingLeft: 20,
                        color: "#717680",
                        fontSize: 15,
                      }}
                    >
                      {formData.interviewSecretPrompt
                        .split("\n")
                        .map(
                          (line: string, index: number) =>
                            line.trim() && <li key={index}>{line.trim()}</li>
                        )}
                    </ul>
                  </>
                )}

                {formData.questions && formData.questions.length > 0 && (
                  <>
                    <div
                      style={{
                        width: "100%",
                        height: "1px",
                        backgroundColor: "#E9EAEB",
                        margin: "12px 0",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#414651",
                        }}
                      >
                        Interview Questions
                      </span>
                      <span
                        style={{
                          backgroundColor: "#F8F9FC",
                          color: "#363F72",
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 700,
                          border: "1px solid #D5D9EB",
                        }}
                      >
                        {formData.questions.reduce(
                          (acc: number, group: any) =>
                            acc + (group.questions?.length || 0),
                          0
                        )}
                      </span>
                    </div>
                    {formData.questions.map(
                      (group: any, groupIndex: number) =>
                        group.questions &&
                        group.questions.length > 0 && (
                          <div key={groupIndex} style={{ marginBottom: 12 }}>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#414651",
                                marginBottom: 4,
                              }}
                            >
                              {group.category}
                            </div>
                            <ol
                              style={{
                                margin: 0,
                                paddingLeft: 20,
                                color: "#717680",
                                fontSize: 15,
                              }}
                            >
                              {group.questions.map((q: any, qIndex: number) => (
                                <li key={qIndex} style={{ marginBottom: 4 }}>
                                  {q.question}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Pipeline Stages */}
        <div className="layered-card-outer" style={{ marginBottom: 40 }}>
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
              onClick={() => toggleSection("pipelineStages")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <i
                  className={`la la-angle-${
                    expandedSections.pipelineStages ? "up" : "down"
                  }`}
                  style={{ fontSize: 18, color: "#717680" }}
                />
                <span
                  style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}
                >
                  Pipeline Stages
                </span>
                <span
                  style={{
                    backgroundColor: "#F8F9FC",
                    color: "#363F72",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "1px solid #D5D9EB",
                  }}
                >
                  {getEnabledStages(formData.pipelineStages || DEFAULT_JOB_PIPELINE).length}
                </span>
              </div>
              <button
                disabled={!canEdit}
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: "50%",
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.5,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canEdit) {
                    handleEdit("pipelineStages");
                  }
                }}
              >
                <i className="la la-pencil" style={{ fontSize: 16 }} />
              </button>
            </div>

            {expandedSections.pipelineStages && (
              <div className="layered-card-content">
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    overflowX: "auto",
                    paddingBottom: 8,
                  }}
                >
                  {getEnabledStages(formData.pipelineStages || DEFAULT_JOB_PIPELINE).map(
                    (stage: any, index: number) => (
                      <div
                        key={stage.id || index}
                        style={{
                          background: "#F9FAFB",
                          border: "1px solid #E9EAEB",
                          borderRadius: 12,
                          padding: 20,
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          minWidth: 320,
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <i
                            className={stage.icon || "la la-clipboard"}
                            style={{ fontSize: 20, color: "#414651" }}
                          />
                          <span
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: "#181D27",
                            }}
                          >
                            {stage.alias || stage.name}
                          </span>
                        </div>
                        {stage.substages && stage.substages.length > 0 && (
                          <>
                            <span
                              style={{
                                fontSize: 13,
                                color: "#717680",
                                fontWeight: 500,
                              }}
                            >
                              Substages
                            </span>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                              }}
                            >
                              {stage.substages.map(
                                (substage: any, subIndex: number) => (
                                  <div
                                    key={substage.id || subIndex}
                                    style={{
                                      background: "#FFFFFF",
                                      border: "1px solid #E9EAEB",
                                      borderRadius: 8,
                                      padding: "10px 12px",
                                      fontSize: 14,
                                      color: "#414651",
                                    }}
                                  >
                                    {substage.name}
                                  </div>
                                )
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div
        style={{
          width: 400,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Team Access */}
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  color: "#414651",
                  fontWeight: 700,
                }}
              >
                Team Access
              </span>
              <button
                disabled={!canEdit}
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: "50%",
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.5,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canEdit) {
                    handleEdit("teamAccess");
                  }
                }}
              >
                <i className="la la-pencil" style={{ fontSize: 16 }} />
              </button>
            </div>

            <div className="layered-card-content">
              {/* Linked Project */}
              {activeOrg?.projectsEnabled && 
                <div style={{ marginBottom: 16 }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: "#414651",
                      fontWeight: 700,
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Linked Project
                  </span>
                  <span style={{ fontSize: 15, color: "#414651", fontWeight: 500 }}>
                    {formData.project ? formData.project
                      : "No linked project"}
                  </span>
                </div>
              }

              {/* Team Members */}
              <div>
                <span
                  style={{
                    fontSize: 14,
                    color: "#414651",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: 12,
                  }}
                >
                  Members
                </span>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {formData.teamMembers && formData.teamMembers.length > 0 ? (
                  formData.teamMembers
                    .filter(
                      (member: any, index: number, self: any[]) =>
                        index ===
                        self.findIndex((m) => m.email === member.email)
                    )
                    .sort((a: any, b: any) => {
                      // Current user first
                      if (a.email === user?.email) return -1;
                      if (b.email === user?.email) return 1;
                      return 0;
                    })
                    .map((member: any, index: number) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        {member.image ||
                        member.profilePicture ||
                        (member.email === user?.email &&
                          (user?.image || user?.profilePicture)) ? (
                          <img
                            src={
                              member.image ||
                              member.profilePicture ||
                              (member.email === user?.email
                                ? user?.image || user?.profilePicture
                                : "")
                            }
                            alt={member.name}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: "50%",
                              backgroundColor: "#E9EAEB",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 16,
                              fontWeight: 600,
                              color: "#414651",
                            }}
                          >
                            {member.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 600,
                              color: "#181D27",
                              marginBottom: 2,
                            }}
                          >
                            {member.name}
                            {member.email === user?.email && (
                              <span
                                style={{ color: "#717680", fontWeight: 400 }}
                              >
                                {" "}
                                (You)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 14, color: "#717680" }}>
                            {member.email}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            color: "#717680",
                            fontWeight: 400,
                          }}
                        >
                          {normalizeCareerTeamRole(member.role) || member.role}
                        </div>
                      </div>
                    ))
                ) : formData.createdBy ? (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <img
                      src={formData.createdBy.image || "/user-profile.png"}
                      alt={formData.createdBy.name}
                      style={{ width: 38, height: 38, borderRadius: "50%" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#181D27",
                          marginBottom: 2,
                        }}
                      >
                        {formData.createdBy.name}
                        {formData.createdBy.email === user?.email && (
                          <span
                            style={{ color: "#717680", fontWeight: 400 }}
                          >
                            {" "}
                            (You)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, color: "#717680" }}>
                        {formData.createdBy.email}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#717680",
                        fontWeight: 400,
                      }}
                    >
                      Job Owner
                    </div>
                  </div>
                  ) : (
                    <span style={{ fontSize: 14, color: "#717680" }}>
                      No team members added
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Career Link */}
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <span
              style={{
                fontSize: 16,
                color: "#414651",
                fontWeight: 700,
                display: "block",
              }}
            >
              Career Link
            </span>
            <div className="layered-card-content">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    background: "#FFFFFF",
                    border: "1px solid #E9EAEB",
                    borderRadius: 8,
                    padding: "12px 16px",
                    fontSize: 14,
                    color: "#717680",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {careerLink || "N/A"}
                </div>
                <button
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={() => {
                    if (careerLink) {
                      navigator.clipboard.writeText(careerLink);
                    }
                  }}
                >
                  <i
                    className="la la-copy"
                    style={{ fontSize: 24, color: "#717680" }}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Direct Interview Link */}
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <span
              style={{
                fontSize: 16,
                color: "#414651",
                fontWeight: 700,
                display: "block",
              }}
            >
              Direct Interview Link
            </span>
            <div className="layered-card-content">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    background: "#FFFFFF",
                    border: "1px solid #E9EAEB",
                    borderRadius: 8,
                    padding: "12px 16px",
                    fontSize: 14,
                    color: "#717680",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {directInterviewLink || "N/A"}
                </div>
                <button
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={() => {
                    if (directInterviewLink) {
                      navigator.clipboard.writeText(directInterviewLink);
                    }
                  }}
                >
                  <i
                    className="la la-copy"
                    style={{ fontSize: 24, color: "#717680" }}
                  />
                </button>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#98A2B3",
                  marginBottom: 6,
                  textAlign: "center",
                }}
              >
                Share the link to an applicant for a direct interview.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  onClick={handleOpenLink}
                  variant="secondary"
                  style={{
                    flex: 1,
                  }}
                  label="Open link"
                  icon="/link.svg"
                > 
                </Button>
                <Button
                  onClick={handleToggleDirectInterviewLink}
                  disabled={!canEdit}
                  variant={canEdit ? formData.directInterviewLinkEnabled !== false ? "tertiary-filled-destructive" : "secondary-filled-success" : "secondary"}
                  style={{
                    flex: 1,
                  }}
                  label={formData.directInterviewLinkEnabled !== false
                    ? "Disable link"
                    : "Enable link"}
                  icon={formData.directInterviewLinkEnabled !== false
                    ? "/disable-link.svg"
                    : "/circle-check.svg"
                  }
                >
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="layered-card-outer" style={{ marginBottom: 40 }}>
          <div className="layered-card-middle">
            <span
              style={{
                fontSize: 16,
                color: "#414651",
                fontWeight: 700,
                display: "block",
              }}
            >
              Advanced Settings
            </span>
            <div className="layered-card-content">
              <Button
                onClick={handleDeleteCareer}
                disabled={!canEdit}
                label="Delete this career"
                variant={canEdit ? "tertiary-filled-destructive" : "secondary"}
                style={{
                  width: "100%",
                }}
                icon="/icons/trash-2.svg"
              >
              </Button>
              <div
                style={{
                  fontSize: 13,
                  color: "#98A2B3",
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                Be careful, this action cannot be undone.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
