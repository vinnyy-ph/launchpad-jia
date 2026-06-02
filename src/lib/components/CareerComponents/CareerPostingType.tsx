"use client";

import { useEffect, useRef, useState } from "react";
import ParentCareerDropdown from "./ParentCareerDropdown";
import PostingTypeHelpModal from "./PostingTypesHelp/HelpModal";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { api } from "@/lib/utils/apiClient";
import SelectDropdown, {
  SelectOption,
} from "@/lib/components/ui/select-dropdown/SelectDropdown";
import { decodeHtmlEntities } from "@/lib/utils/sanitizeInput";
import {
  CHILD_POST_DESCRIPTION,
  CHILD_POST_LABEL,
  END_TO_END_DESCRIPTION,
  END_TO_END_LABEL,
  LINKED_CAREER_DESCRIPTION,
  LINKED_CAREER_LABEL,
  PARENT_POST_DESCRIPTION,
  PARENT_POST_LABEL,
} from "@/lib/utils/careerPostType";
import type { CareerPostType } from "@/lib/utils/careerPostType";
import styles from "./LinkedCareers/linked-careers.module.scss";

interface CareerPostingTypeProps {
  careerForm: {
    careerPostType: CareerPostType;
    parentCareerID?: string | null;
    parentCareerTitle?: string | null;
    jobTitle?: string;
  };
  formType: "add" | "edit";
  careerId: string;
  setCareerForm: (careerForm: any) => void;
  validationErrors?: { [key: string]: boolean };
  setValidationErrors?: (errors: { [key: string]: boolean }) => void;
  onParentSelected?: (parentId: string | null, parentTitle: string | null) => void;
}

type PostingTypeValue = "standalone" | "for_staffing";
type CategoryTypeValue = "candidate_pool" | "receiving_pool";

const postingTypeOptions: SelectOption[] = [
  {
    value: "standalone",
    label: END_TO_END_LABEL,
    description: END_TO_END_DESCRIPTION,
  },
  {
    value: "for_staffing",
    label: LINKED_CAREER_LABEL,
    description: LINKED_CAREER_DESCRIPTION,
  },
];

const categoryTypeOptions: SelectOption[] = [
  {
    value: "candidate_pool",
    label: PARENT_POST_LABEL,
    description: PARENT_POST_DESCRIPTION,
  },
  {
    value: "receiving_pool",
    label: CHILD_POST_LABEL,
    description: CHILD_POST_DESCRIPTION,
  },
];

const getPostingTypeValue = (
  careerPostType: CareerPostType
): PostingTypeValue | null => {
  if (careerPostType === "standalone") {
    return "standalone";
  }

  if (careerPostType === "candidate_pool" || careerPostType === "receiving_pool") {
    return "for_staffing";
  }

  return null;
};

const getCategoryTypeValue = (
  careerPostType: CareerPostType
): CategoryTypeValue | null => {
  if (careerPostType === "candidate_pool") {
    return "candidate_pool";
  }

  if (careerPostType === "receiving_pool") {
    return "receiving_pool";
  }

  return null;
};

export default function CareerPostingType({
  careerForm,
  formType,
  careerId,
  setCareerForm,
  validationErrors = {},
  setValidationErrors,
  onParentSelected,
}: CareerPostingTypeProps) {
  const [activeOrg] = useLocalStorage("activeOrg", null);
  const [showPostingTypeHelpModal, setShowPostingTypeHelpModal] =
    useState(false);
  const [postingTypeValue, setPostingTypeValue] =
    useState<PostingTypeValue | null>(getPostingTypeValue(careerForm.careerPostType));
  const [selectedParentTitle, setSelectedParentTitle] = useState<string | null>(null);
  const fetchedParentRef = useRef<string | null>(null);
  const originalJobTitleRef = useRef<string | null>(null);

  const restoreJobTitle = () => {
    const title = originalJobTitleRef.current ?? careerForm.jobTitle;
    originalJobTitleRef.current = null;
    return title;
  };

  useEffect(() => {
    const fetchParentTitle = async () => {
      if (
        formType === "edit" &&
        careerForm.parentCareerID &&
        !careerForm.parentCareerTitle &&
        fetchedParentRef.current !== careerForm.parentCareerID &&
        activeOrg?._id
      ) {
        fetchedParentRef.current = careerForm.parentCareerID;
        try {
          const response = await api.post("/api/career-data", {
            id: careerForm.parentCareerID,
            orgID: activeOrg._id,
          });

          if (response.status === 200 && response.data.jobTitle) {
            const decodedParentTitle = decodeHtmlEntities(response.data.jobTitle);
            setSelectedParentTitle(decodedParentTitle);
            onParentSelected?.(careerForm.parentCareerID!, decodedParentTitle);
          }
        } catch (err) {
          console.error("Failed to fetch parent career title:", err);
        }
      }
    };

    fetchParentTitle();
  }, [careerForm.parentCareerID, careerForm.parentCareerTitle, activeOrg?._id, formType]);

  useEffect(() => {
    if (careerForm.careerPostType === "standalone") {
      setPostingTypeValue("standalone");
      return;
    }

    if (
      careerForm.careerPostType === "candidate_pool" ||
      careerForm.careerPostType === "receiving_pool"
    ) {
      setPostingTypeValue("for_staffing");
    }
  }, [careerForm.careerPostType]);

  const categoryTypeValue = getCategoryTypeValue(careerForm.careerPostType);
  const isLinkedCareer = postingTypeValue === "for_staffing";
  const resolvedParentTitle =
    selectedParentTitle ??
    careerForm.parentCareerTitle ??
    null;
  const shouldShowChildConnectionBanner =
    careerForm.careerPostType === "receiving_pool" &&
    Boolean(careerForm.parentCareerID && resolvedParentTitle);

  const clearParentSelection = () => {
    setSelectedParentTitle(null);
    fetchedParentRef.current = null;
  };

  const clearTypeValidation = () => {
    if (!setValidationErrors) {
      return;
    }

    const shouldClear = validationErrors.careerPostType || validationErrors.sourcePool;
    if (!shouldClear) {
      return;
    }

    setValidationErrors({
      ...validationErrors,
      careerPostType: false,
      sourcePool: false,
    });
  };

  const handleSelectPostingType = (value: string) => {
    if (value === "standalone") {
      setPostingTypeValue("standalone");
      clearParentSelection();
      setCareerForm({
        ...careerForm,
        careerPostType: "standalone",
        parentCareerID: null,
        parentCareerTitle: "",
        childTitle: "",
        jobTitle: restoreJobTitle(),
      });
      onParentSelected?.(null, null);
      clearTypeValidation();
      return;
    }

    const existingLinkedType: CareerPostType =
      careerForm.careerPostType === "candidate_pool" ||
      careerForm.careerPostType === "receiving_pool"
        ? careerForm.careerPostType
        : null;

    setPostingTypeValue("for_staffing");

    if (existingLinkedType === "candidate_pool") {
      clearParentSelection();
    }

    setCareerForm({
      ...careerForm,
      careerPostType: existingLinkedType,
      parentCareerID: existingLinkedType === "candidate_pool" ? null : careerForm.parentCareerID,
    });

    clearTypeValidation();
  };

  const handleSelectCategoryType = (value: string) => {
    const resolvedType: CareerPostType =
      value === "candidate_pool" ? "candidate_pool" : "receiving_pool";

    setPostingTypeValue("for_staffing");

    if (resolvedType === "candidate_pool") {
      clearParentSelection();
      setCareerForm({
        ...careerForm,
        careerPostType: resolvedType,
        parentCareerID: null,
        parentCareerTitle: "",
        childTitle: "",
        jobTitle: restoreJobTitle(),
      });
      onParentSelected?.(null, null);
    } else {
      setCareerForm({
        ...careerForm,
        careerPostType: resolvedType,
        parentCareerID: careerForm.parentCareerID,
        parentCareerTitle: careerForm.parentCareerTitle,
      });
    }

    clearTypeValidation();
  };

  const handleSelectParent = (parentId: string | null, parentTitle: string | null) => {
    const normalizedParentTitle = parentTitle
      ? decodeHtmlEntities(parentTitle)
      : "";

    if (originalJobTitleRef.current === null) {
      originalJobTitleRef.current = careerForm.jobTitle || "";
    }
    setCareerForm({
      ...careerForm,
      parentCareerID: parentId,
      parentCareerTitle: normalizedParentTitle,
      jobTitle: normalizedParentTitle,
    });
    setSelectedParentTitle(normalizedParentTitle);
    fetchedParentRef.current = parentId;
    onParentSelected?.(parentId, normalizedParentTitle || null);

    if (parentId && setValidationErrors && validationErrors.sourcePool) {
      setValidationErrors({ ...validationErrors, sourcePool: false });
    }
  };

  return (
    <div className="layered-card-outer">
      <div className="layered-card-middle">
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
            1. Career Posting Options
          </span>
        </div>
        <div className="layered-card-content">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                width: "50%",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 14, color: "#414651", fontWeight: 500 }}>
                  Posting Type <span style={{ color: "#EF4444" }}>*</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPostingTypeHelpModal(true)}
                  aria-label="Open posting type help"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "1px solid #D5D7DA",
                    cursor: "pointer",
                    fontSize: 11,
                    color: "#717680",
                    fontWeight: 600,
                    background: "transparent",
                  }}
                >
                  ?
                </button>
              </div>
              <div style={{ width: "100%", minWidth: 260 }}>
                <SelectDropdown
                  options={postingTypeOptions}
                  value={postingTypeValue}
                  onSelect={handleSelectPostingType}
                  placeholder="Select posting type..."
                  wide
                  noShadow
                  hasError={validationErrors.careerPostType && !postingTypeValue}
                  errorText="This is a required field."
                />
              </div>
            </div>

            {isLinkedCareer && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 8,
                  width: "50%",
                }}
              >
                <span style={{ fontSize: 14, color: "#414651", fontWeight: 500 }}>
                  Category Type <span style={{ color: "#EF4444" }}>*</span>
                </span>
                <div style={{ width: "100%", minWidth: 260 }}>
                  <SelectDropdown
                    options={categoryTypeOptions}
                    value={categoryTypeValue}
                    onSelect={handleSelectCategoryType}
                    placeholder="Select category type..."
                    wide
                    noShadow
                    hasError={validationErrors.careerPostType && isLinkedCareer && !categoryTypeValue}
                    errorText="This is a required field."
                  />
                </div>
              </div>
            )}
          </div>

          {careerForm.careerPostType === "receiving_pool" && (
            <>
              <div
                style={{
                  width: "100%",
                  height: 1,
                  backgroundColor: "#E9EAEB",
                  marginTop: 16,
                  marginBottom: 16,
                }}
              />

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 8,
                  width: "100%",
                }}
              >
                <span style={{ fontSize: 14, color: "#414651", fontWeight: 500 }}>
                  Connect to Parent Post <span style={{ color: "#EF4444" }}>*</span>
                </span>

                <div style={{ width: "100%" }}>
                  <ParentCareerDropdown
                    selectedParentId={careerForm.parentCareerID || null}
                    selectedParentTitle={resolvedParentTitle}
                    onSelectParent={handleSelectParent}
                    orgID={activeOrg?._id || ""}
                    excludeCareerID={formType === "edit" ? careerId : undefined}
                    hasError={validationErrors.sourcePool}
                  />
                  {validationErrors.sourcePool && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "#EF4444",
                        fontWeight: 400,
                        marginTop: 4,
                        display: "block",
                      }}
                    >
                      Please select a parent post.
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {shouldShowChildConnectionBanner && (
        <div className={styles.childConnectionBanner}>
          <img src="/icons/info-2.svg" alt="Info" className={styles.childConnectionBannerIcon} />
          <span className={styles.childConnectionBannerText}>
            This is a child post connected to <strong>{resolvedParentTitle}</strong>.
          </span>
        </div>
      )}

      <PostingTypeHelpModal
        open={showPostingTypeHelpModal}
        onClose={() => setShowPostingTypeHelpModal(false)}
      />
    </div>
  );
}
