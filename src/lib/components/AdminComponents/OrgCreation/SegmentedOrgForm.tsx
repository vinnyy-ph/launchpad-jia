"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppContext } from "@/lib/context/AppContext";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast, validateEmail } from "@/lib/Utils";
import {
  OrgFormState,
  OrgFormStep,
  INITIAL_ORG_FORM_STATE,
  ORG_FORM_STEPS,
} from "@/lib/types/orgForm";
import FullScreenLoadingAnimation from "../../CareerComponents/FullScreenLoadingAnimation";
import OrgFormSteps from "./OrgFormSteps";
import OrgDetailsStep from "./Steps/OrgDetailsStep";
import OrgPlanStep from "./Steps/OrgPlanStep";
import OrgMembersStep from "./Steps/OrgMembersStep";
import OrgReviewStep from "./Steps/OrgReviewStep";
import OrgActionModal from "./OrgActionModal";

export default function SegmentedOrgForm() {
  const { user } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentStep, setCurrentStep] = useState(0);
  const [accomplishedStep, setAccomplishedStep] = useState(0);
  const [formSteps, setFormSteps] = useState<OrgFormStep[]>(
    ORG_FORM_STEPS.map((s) => ({ ...s }))
  );
  const [formState, setFormState] = useState<OrgFormState>(INITIAL_ORG_FORM_STATE);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialLoadRef = useRef(true);

  // Sync step from URL
  useEffect(() => {
    const stepParam = searchParams.get("step");
    if (stepParam) {
      const stepIndex = parseInt(stepParam, 10);
      if (!isNaN(stepIndex) && stepIndex >= 0 && stepIndex <= accomplishedStep) {
        setCurrentStep(stepIndex);
      }
    }
  }, [searchParams, accomplishedStep]);

  // Track unsaved changes
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    setHasUnsavedChanges(true);
  }, [formState]);

  // Warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const validateCurrentStep = (): boolean => {
    const errors: Record<string, boolean> = {};

    if (currentStep === 0) {
      // Organization Details
      if (!formState.name.trim()) errors.name = true;
      if (!formState.image) errors.image = true;
    } else if (currentStep === 1) {
      // Plan and Usage
      if (!formState.planId) errors.planId = true;
      if (!formState.planStartDate) errors.planStartDate = true;
      if (!formState.planEndDate) errors.planEndDate = true;
      if (
        formState.planStartDate &&
        formState.planEndDate &&
        formState.planEndDate <= formState.planStartDate
      ) {
        errors.planEndDate = true;
      }
      if (formState.brandedPortalEnabled && !formState.brandedJobPortalSubdomain?.trim()) {
        errors.brandedJobPortalSubdomain = true;
      }
    } else if (currentStep === 2) {
      // Members
      const hasValidMember = formState.members.some(
        (m) => m.email.trim() && validateEmail(m.email) && m.role && !m.error
      );
      if (!hasValidMember) errors.members = true;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const hasFormProgress = (): boolean => {
    if (currentStep === 0) {
      return !!(
        formState.name ||
        formState.image ||
        formState.coverImage ||
        formState.description ||
        formState.province ||
        formState.city ||
        formState.address
      );
    } else if (currentStep === 1) {
      return !!(formState.planId || formState.planStartDate || formState.planEndDate);
    } else if (currentStep === 2) {
      return formState.members.some((m) => m.email.trim() || m.role);
    }
    return false;
  };

  const isFormValid = (): boolean => {
    // Minimum requirements to save as draft
    return !!(formState.name.trim() && formState.image);
  };

  const handleSaveAndContinue = () => {
    if (!validateCurrentStep()) return;

    setFormSteps((prev) =>
      prev.map((step, index) =>
        index <= currentStep ? { ...step, completed: true } : step
      )
    );
    setAccomplishedStep(currentStep + 1);
    setCurrentStep(currentStep + 1);
  };

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex <= accomplishedStep) {
      setCurrentStep(stepIndex);
    }
  };

  const uploadFile = async (file: File, fileName: string): Promise<string | null> => {
    try {
      const response = await api.post("/api/admin/get-presigned-url", {
        fileName,
        fileType: file.type,
      });
      const uploadResponse = await fetch(response.data.presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (uploadResponse.status !== 200) {
        throw new Error("Error uploading file");
      }
      return fileName;
    } catch {
      errorToast("Error uploading file", 1300);
      return null;
    }
  };

  const saveOrganization = async (status: "active" | "inactive") => {
    setShowSaveModal(null);
    if (!status) return;

    setIsSaving(true);
    try {
      const userInfoSlice = {
        image: user?.image,
        name: user?.name,
        email: user?.email,
      };

      // Determine the actual status based on intentionality and the toggle
      let actualStatus = status;
      if (status === "active" && !formState.accessEnabled) {
        actualStatus = "inactive";
      }

      // Prepare organization data
      const organizationData: Record<string, unknown> = {
        name: formState.name,
        description: formState.description,
        organizationType: "enterprise", // Default value
        status: actualStatus,
        members: formState.members.filter((m) => m.email && m.role && !m.error),
        planId: formState.planId,
        planStartDate: formState.planStartDate,
        planEndDate: formState.planEndDate,
        projectsEnabled: formState.projectsEnabled,
        guestPortalEnabled: formState.guestPortalEnabled,
        brandedPortalEnabled: formState.brandedPortalEnabled,
        brandedJobPortalSubdomain: formState.brandedJobPortalSubdomain?.trim() || undefined,
        globalHiringEnabled: formState.globalHiringEnabled,
        linkedCareersEnabled: formState.linkedCareersEnabled,
        country: formState.country,
        province: formState.province,
        city: formState.city,
        address: formState.address,
        locations: formState.locations,
        companySlug: formState.companySlug.trim() || undefined,
        companyDomains: formState.emailDomains
          .map((d) => (d || "").trim())
          .filter((d) => d.length > 0),
        defaultCurrency: formState.defaultCurrency,
        defaultSalaryUnit: formState.defaultSalaryUnit,
        lastEditedBy: userInfoSlice,
        createdBy: userInfoSlice,
        image: "",
        coverImage: "",
        documents: [],
      };

      // Create organization first
      const response = await api.post("/api/admin/add-organization", organizationData);
      if (response.status !== 200) {
        throw new Error("Failed to create organization");
      }

      const orgID = response.data.orgID;

      // Upload files
      let imageUrl = "";
      let coverImageUrl = "";
      const documents: { name: string; filename: string; filePath: string; fileType: string }[] = [];

      if (formState.image && typeof formState.image === "object") {
        const uploadedPath = await uploadFile(
          formState.image,
          `organization/profile-image/${orgID}.${formState.image.type.split("/")[1]}`
        );
        if (uploadedPath) {
          imageUrl = `https://cdn.hellojia.ai/${uploadedPath}`;
        }
      }

      if (formState.coverImage && typeof formState.coverImage === "object") {
        const uploadedPath = await uploadFile(
          formState.coverImage,
          `organization/cover-image/${orgID}.${formState.coverImage.type.split("/")[1]}`
        );
        if (uploadedPath) {
          coverImageUrl = `https://cdn.hellojia.ai/${uploadedPath}`;
        }
      }

      if (
        formState.documents.companyRegistration &&
        typeof formState.documents.companyRegistration === "object"
      ) {
        const file = formState.documents.companyRegistration;
        const uploadedPath = await uploadFile(
          file,
          `organization/documents/company-registration/${orgID}.${file.type.split("/")[1]}`
        );
        if (uploadedPath) {
          documents.push({
            name: "Company/SEC Registration",
            filename: file.name,
            filePath: uploadedPath,
            fileType: file.type.split("/")[1],
          });
        }
      }

      if (
        formState.documents.businessPermit &&
        typeof formState.documents.businessPermit === "object"
      ) {
        const file = formState.documents.businessPermit;
        const uploadedPath = await uploadFile(
          file,
          `organization/documents/business-permit/${orgID}.${file.type.split("/")[1]}`
        );
        if (uploadedPath) {
          documents.push({
            name: "Business Permit",
            filename: file.name,
            filePath: uploadedPath,
            fileType: file.type.split("/")[1],
          });
        }
      }

      // Update organization with uploaded files
      await api.post("/api/admin/update-organization", {
        orgID,
        update: {
          image: imageUrl,
          coverImage: coverImageUrl,
          documents,
        },
      });

      setHasUnsavedChanges(false);
      candidateActionToast(
        actualStatus === "active"
          ? "Organization created successfully"
          : "Organization saved as draft",
        1300,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }} />
      );

      setTimeout(() => {
        router.push("/admin-portal/organizations");
      }, 1300);
    } catch (error) {
      console.error("Error saving organization:", error);
      errorToast("Error saving organization", 1300);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmSave = (status: string) => {
    setShowSaveModal(status);
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Header Section */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "1800px", padding: "0 20px" }}>
          <div
            style={{
              marginBottom: "35px",
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              {formState.name && (
                <h1 style={{ fontSize: "24px", fontWeight: 550, color: "#717680" }}>
                  [Draft]
                </h1>
              )}
              <h1 style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}>
                {formState.name || "Add new organization"}
              </h1>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <button
                disabled={!isFormValid() || isSaving}
                style={{
                  width: "fit-content",
                  color: !isFormValid() || isSaving ? "#D5D7DA" : "#414651",
                  background: "#fff",
                  border: "1px solid #D5D7DA",
                  padding: "8px 16px",
                  borderRadius: "60px",
                  cursor: !isFormValid() || isSaving ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
                onClick={() => handleConfirmSave("inactive")}
              >
                Save as Unpublished
              </button>
              <button
                disabled={isSaving}
                style={{
                  width: "fit-content",
                  background: isSaving ? "#D5D7DA" : "black",
                  color: "#fff",
                  border: "1px solid #E9EAEB",
                  padding: "8px 16px",
                  borderRadius: "60px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
                onClick={() => {
                  if (currentStep < formSteps.length - 1) {
                    handleSaveAndContinue();
                  } else {
                    handleConfirmSave("active");
                  }
                }}
              >
                {currentStep === formSteps.length - 1 ? (
                  <>
                    Finish creating organization
                    <i
                      className="la la-arrow-right"
                      style={{ color: "#fff", fontSize: 20, marginLeft: 8 }}
                    />
                  </>
                ) : (
                  <>
                    Save and Continue
                    <i
                      className="la la-arrow-right"
                      style={{ color: "#fff", fontSize: 20, marginLeft: 8 }}
                    />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step Indicator */}
          <OrgFormSteps
            steps={formSteps}
            currentStep={currentStep}
            accomplishedStep={accomplishedStep}
            hasProgress={hasFormProgress()}
            validationErrors={validationErrors}
            onStepClick={handleStepClick}
          />
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          marginTop: "32px",
          marginBottom: "24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "1800px", padding: "0 20px" }}>
          <div
            style={{
              width: "100%",
              height: "1px",
              backgroundColor: "#E9EAEB",
            }}
          />
        </div>
      </div>

      {/* Content Section */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "1400px", padding: "0 20px 32px 20px" }}>
          {currentStep === 0 && (
            <OrgDetailsStep
              formState={formState}
              setFormState={setFormState}
              validationErrors={validationErrors}
              setValidationErrors={setValidationErrors}
            />
          )}
          {currentStep === 1 && (
            <OrgPlanStep
              formState={formState}
              setFormState={setFormState}
              validationErrors={validationErrors}
              setValidationErrors={setValidationErrors}
            />
          )}
          {currentStep === 2 && (
            <OrgMembersStep
              formState={formState}
              setFormState={setFormState}
              validationErrors={validationErrors}
              setValidationErrors={setValidationErrors}
            />
          )}
          {currentStep === 3 && (
            <OrgReviewStep
              formState={formState}
              setFormState={setFormState}
              setCurrentStep={setCurrentStep}
            />
          )}
        </div>
      </div>

      {/* Action Modal */}
      {showSaveModal && (
        <OrgActionModal
          action={showSaveModal}
          onAction={(action) => {
            if (action === "create") {
              saveOrganization(showSaveModal === "active" ? "active" : "inactive");
            } else {
              setShowSaveModal(null);
            }
          }}
        />
      )}

      {/* Loading Animation */}
      {isSaving && (
        <FullScreenLoadingAnimation
          title="Creating organization..."
          subtext="Please wait while we create the organization"
        />
      )}
    </div>
  );
}

