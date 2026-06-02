"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "@/lib/styles/shareable-assessment.module.scss";
import ModalHeader from "./ModalHeader";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "@/lib/context/AppContext";
import { toast } from "react-toastify";
import { useHumanInterviewStageAvailability, useShareableAssessmentLinks } from "@/lib/hooks/useShareAssessmentModal";
import LoadingAnimation from "../Loaders/LoadingAnimation";
import { Checkbox, Radio } from "@/lib/components/ui";
import Select from "@/lib/components/ui/select/Select";
import Tooltip from "@/lib/components/ui/tooltip/Tooltip";
import type { NameVisibility } from "../CandidateProfileComponents/candidateProfileUtils";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import buttonStyles from "@/lib/components/ui/button/button.module.scss";
import moment from "moment";

type StageState = {
  viewable: boolean;
  disabled: boolean;
  stageName: string;
};

export type ViewableStages = Record<string, StageState>;

export type ShareableAssessmentDetails = {
  dateGenerated: Date;
  nameVisibility: NameVisibility;
  viewableStages: ViewableStages;
  userNameSlug?: string;
  cvVersionLabel?: string;
  isContactVisible?: boolean;
  showContactDetails?: boolean;
  showDisplayPhoto?: boolean;
  showJiaAssessments?: boolean;
  showRecruiterAssessments?: boolean;
  password: string;
  views: number;
  active: boolean;
};

export function canViewHistoricalLinks(user: { email?: string, [key: string]: any }): boolean {
  if (!user?.email) return false;

  const activeOrg = localStorage.getItem("activeOrg");
  if (activeOrg) {
    try {
      const parsedOrg = JSON.parse(activeOrg);
      return parsedOrg.role === "admin" || parsedOrg.role === "super_admin";
    } catch (error) {
      console.error("Error parsing activeOrg:", error);
      return false;
    }
  }

  return false;
}

const NAME_VISIBILITY_OPTIONS: Array<{ value: NameVisibility; example: string }> = [
  { value: "Initials only", example: "e.g. J. S." },
  { value: "First name only", example: "e.g. John" },
  { value: "Full Name", example: "e.g. John Smith" },
];

type GenerationTab = "generate" | "activity";

const ORIGINAL_CV_LABEL = "Original CV";

export default function ShareModal({
  interview,
  setShowShareModal,
}: {
  interview: any;
  setShowShareModal(show: boolean): void;
}) {
  const { orgID, user } = useAppContext();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [generatingSuccessful, setGeneratingSuccessful] = useState(false);
  const [latestGeneratedLink, setLatestGeneratedLink] = useState<string>("");
  const [latestGeneratedPassword, setLatestGeneratedPassword] = useState<string>("");
  const [hasPermission, setHasPermission] = useState(false);
  const [activeTab, setActiveTab] = useState<GenerationTab>("generate");
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  useEffect(() => {
    setHasPermission(canViewHistoricalLinks(user));
  }, [user]);

  const [pipelineStages, setPipelineStages] = useState<any[]>([]);

  const {
    generatedLinks,
    isFetching,
    refreshLinks,
    toggleLinkActive,
    deleteLink,
  } = useShareableAssessmentLinks(
    hasPermission ? interview.interviewID : null,
    hasPermission ? orgID : null
  );

  useEffect(() => {
    const fetchCareerPipeline = async () => {
      if (!interview.id || !orgID) return;

      try {
        const response = await api.post("/api/career-data", {
          id: interview.careerID,
          orgID,
        });
        const stages = response.data.pipelineStages || DEFAULT_JOB_PIPELINE;
        setPipelineStages(stages);
      } catch (error) {
        console.error("Error fetching career pipeline:", error);
        setPipelineStages(DEFAULT_JOB_PIPELINE);
      }
    };

    fetchCareerPipeline();
  }, [interview.id, orgID]);

  const buildInitialStages = useCallback((): ViewableStages => {
    const stages: ViewableStages = {};

    const shareableStages = pipelineStages.filter((s) => s.id !== "4");

    for (const stage of shareableStages) {
      const displayName = stage.alias || stage.name;

      if (stage.id === "1") {
        const disabled = interview.cvStatus === undefined;
        stages[stage.id] = {
          viewable: !disabled,
          disabled,
          stageName: displayName,
        };
      } else if (stage.id === "2") {
        const disabled = interview.jobFit === undefined;
        stages[stage.id] = {
          viewable: false,
          disabled,
          stageName: displayName,
        };
      } else if (stage.id === "3" || stage.type === "custom") {
        stages[stage.id] = {
          viewable: false,
          disabled: true,
          stageName: displayName,
        };
      }
    }

    return stages;
  }, [pipelineStages, interview]);

  const [viewableStages, setViewableStages] = useState<ViewableStages>({});

  useEffect(() => {
    if (pipelineStages.length > 0) {
      setViewableStages(buildInitialStages());
    }
  }, [buildInitialStages, pipelineStages]);

  const stageAttachments = useMemo(() => interview.stageAttachments ?? [], [interview.stageAttachments]);

  const { disabledStages } = useHumanInterviewStageAvailability({
    interviewId: interview._id,
    pipelineStages,
    stageAttachments,
    enabled: pipelineStages.length > 0,
  });

  useEffect(() => {
    if (Object.keys(disabledStages).length === 0) return;

    setViewableStages((prev) => {
      let hasChanges = false;
      const updated = { ...prev };

      for (const [stageId, isDisabled] of Object.entries(disabledStages)) {
        if (updated[stageId] && updated[stageId].disabled !== isDisabled) {
          updated[stageId] = { ...updated[stageId], disabled: isDisabled };

          if (isDisabled && updated[stageId].viewable) {
            updated[stageId] = { ...updated[stageId], viewable: false };
          }

          hasChanges = true;
        }
      }

      return hasChanges ? updated : prev;
    });
  }, [disabledStages]);

  const [cvVersionOptions, setCvVersionOptions] = useState<Array<{ value: string; label: string }>>([
    { value: ORIGINAL_CV_LABEL, label: ORIGINAL_CV_LABEL },
  ]);
  const [isCvVersionsLoading, setIsCvVersionsLoading] = useState(false);
  const [cvVersionLabel, setCvVersionLabel] = useState<string>(ORIGINAL_CV_LABEL);
  const [nameVisibility, setNameVisibility] = useState<NameVisibility>("Initials only");
  const [showJiaAssessments, setShowJiaAssessments] = useState<boolean>(true);
  const [showRecruiterAssessments, setShowRecruiterAssessments] = useState<boolean>(true);
  const [showContactDetails, setShowContactDetails] = useState<boolean>(false);
  const [showDisplayPhoto, setShowDisplayPhoto] = useState<boolean>(true);

  useEffect(() => {
    if (!hasPermission && activeTab === "activity") {
      setActiveTab("generate");
    }
  }, [activeTab, hasPermission]);

  useEffect(() => {
    if (!orgID || !interview?.email) {
      setCvVersionOptions([{ value: ORIGINAL_CV_LABEL, label: ORIGINAL_CV_LABEL }]);
      return;
    }

    let isMounted = true;

    const fetchCvVersions = async () => {
      setIsCvVersionsLoading(true);

      try {
        const response = await api.post("/api/whitecloak/cv-version/list", {
          orgID,
          candidateEmail: interview.email,
        });
        const items = Array.isArray(response?.data?.items) ? response.data.items : [];
        const seenLabels = new Set<string>([ORIGINAL_CV_LABEL.toLowerCase()]);
        const nextOptions = [{ value: ORIGINAL_CV_LABEL, label: ORIGINAL_CV_LABEL }];

        for (const item of items) {
          const label = typeof item?.label === "string" ? item.label.trim() : "";
          if (!label) continue;

          const normalizedLabel = label.toLowerCase();
          if (seenLabels.has(normalizedLabel)) continue;

          seenLabels.add(normalizedLabel);
          nextOptions.push({ value: label, label });
        }

        if (isMounted) {
          setCvVersionOptions(nextOptions);
        }
      } catch (error) {
        console.error("Failed to fetch CV versions:", error);

        if (isMounted) {
          setCvVersionOptions([{ value: ORIGINAL_CV_LABEL, label: ORIGINAL_CV_LABEL }]);
        }
      } finally {
        if (isMounted) {
          setIsCvVersionsLoading(false);
        }
      }
    };

    fetchCvVersions();

    return () => {
      isMounted = false;
    };
  }, [interview?.email, orgID]);

  useEffect(() => {
    if (cvVersionOptions.some((option) => option.value === cvVersionLabel)) {
      return;
    }

    setCvVersionLabel(cvVersionOptions[0]?.value ?? ORIGINAL_CV_LABEL);
  }, [cvVersionLabel, cvVersionOptions]);

  useEffect(() => {
    setGeneratingSuccessful(false);
  }, [
    cvVersionLabel,
    nameVisibility,
    showJiaAssessments,
    showRecruiterAssessments,
    showContactDetails,
    showDisplayPhoto,
    viewableStages,
  ]);

  const handleGenerateLink = async () => {
    if (!orgID) {
      toast.error("Organization not found", { position: "top-center" });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await api.post("/api/generate-shareable-link", {
        applicantEmail: interview.email,
        interviewId: interview.interviewID,
        interviewUID: interview._id,
        nameVisibility,
        viewableStages,
        cvVersionLabel,
        showJiaAssessments,
        showRecruiterAssessments,
        showContactDetails,
        showDisplayPhoto,
        isContactVisible: showContactDetails,
        active: true,
        orgID,
      });

      if (response.data.success) {
        setLatestGeneratedLink(response.data.link || "");
        setLatestGeneratedPassword(response.data.password || "");
        setGeneratingSuccessful(true);
        setActiveTab("generate");

        toast.success(
          "Link generated. This link is password-protected and ready to share.",
          { position: "top-center" }
        );
        await refreshLinks();
      }
    } catch (error) {
      console.error("Error generating link:", error);
      toast.error("Failed to generate shareable link", { position: "top-center" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = () => {
    const hasAtLeastOneViewableStage = Object.values(viewableStages).some(
      (stage) => !stage.disabled && stage.viewable
    );
    if (!hasAtLeastOneViewableStage) {
      toast.info("Select at least one stage to preview the shared view.", { position: "top-center" });
      return;
    }

    if (!orgID) {
      toast.error("Organization not found", { position: "top-center" });
      return;
    }

    setIsPreviewing(true);
    api
      .post("/api/create-shareable-preview-link", {
        applicantEmail: interview.email,
        interviewId: interview.interviewID,
        interviewUID: interview._id,
        nameVisibility,
        viewableStages,
        cvVersionLabel,
        showJiaAssessments,
        showRecruiterAssessments,
        showContactDetails,
        showDisplayPhoto,
        isContactVisible: showContactDetails,
        orgID,
      })
      .then((response) => {
        if (!response.data?.success || !response.data?.link) {
          throw new Error("Failed to create preview link");
        }

        window.open(response.data.link, "_blank", "noopener,noreferrer");
      })
      .catch((error) => {
        console.error("Error creating preview link:", error);
        toast.error("Failed to create preview link", { position: "top-center" });
      })
      .finally(() => {
        setIsPreviewing(false);
      });
  };

  const handleCopyValue = async (value: string, successMessage = "Copied to clipboard.") => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage, { position: "top-center" });
    } catch (error) {
      console.error("Failed to copy text:", error);
      toast.error("Failed to copy", { position: "top-center" });
    }
  };

  const getSharedStageLabels = useCallback((assessment: any): string[] => {
    const stageOrder =
      pipelineStages.length > 0
        ? pipelineStages.filter((stage) => stage.id !== "4").map((stage) => stage.id)
        : Object.keys(assessment.viewableStages || {});

    return stageOrder
      .filter((stageId) => assessment.viewableStages?.[stageId]?.viewable)
      .map((stageId) => {
        const stage = pipelineStages.find((item) => item.id === stageId);
        const baseName =
          stage?.alias ||
          stage?.name ||
          assessment.viewableStages?.[stageId]?.stageName ||
          `Stage ${stageId}`;

        if (stageId === "1" && assessment.cvVersionLabel) {
          return `${baseName} (Version: ${assessment.cvVersionLabel})`;
        }

        return baseName;
      });
  }, [pipelineStages]);

  const formatGeneratedLabel = (date: Date | string) => {
    const generatedMoment = moment(date);
    if (!generatedMoment.isValid()) {
      return "Generated recently";
    }

    const minutesAgo = Math.abs(moment().diff(generatedMoment, "minutes"));
    if (minutesAgo < 1) {
      return "Generated just now";
    }

    return `Generated ${generatedMoment.fromNow()}`;
  };

  const formatNameVisibilityPill = (visibility: string) => {
    switch (visibility) {
      case "Full Name":
        return "Full name";
      case "First name only":
        return "First name only";
      case "Initials only":
      default:
        return "Initials only";
    }
  };

  const shareableStageList = useMemo(
    () => pipelineStages.filter((stage) => stage.id !== "4" && viewableStages[stage.id]),
    [pipelineStages, viewableStages]
  );

  const visibleGeneratedLink = latestGeneratedLink;
  const visibleGeneratedPassword = latestGeneratedPassword;
  const hasVisibleGeneratedCredentials = Boolean(visibleGeneratedLink && visibleGeneratedPassword);

  const isGenerateBtnDisabled =
    isGenerating ||
    Object.values(viewableStages).every((stage) => stage.disabled || !stage.viewable);
  const isPreviewBtnDisabled =
    isPreviewing ||
    Object.values(viewableStages).every((stage) => stage.disabled || !stage.viewable);

  const renderGenerateTab = () => (
    <div className={styles.generateTabContent}>
      <section className={styles.configCard}>
        <div className={styles.configCardHeader}>
          <h4>Content</h4>
          <p>Stages that are turned off won&apos;t appear at all in the shared view.</p>
        </div>

        <div className={styles.configCardBody}>
          <div className={styles.groupTitle}>Stages available:</div>
          <div className={styles.optionStack}>
            {shareableStageList.map((stage) => (
              <div key={stage.id}>
                <div className={styles.optionRow}>
                  <div style={{ opacity: viewableStages[stage.id].disabled ? 0.6 : 1 }}>
                    <Checkbox
                      checked={viewableStages[stage.id].viewable}
                      disabled={viewableStages[stage.id].disabled}
                      onCheckedChange={(checked) =>
                        setViewableStages({
                          ...viewableStages,
                          [stage.id]: {
                            ...viewableStages[stage.id],
                            viewable: checked,
                          },
                        })
                      }
                      className={styles.checkboxField}
                      label={<span className={styles.fieldLabel}>{viewableStages[stage.id].stageName}</span>}
                    />
                  </div>
                </div>

                {stage.id === "1" && viewableStages["1"]?.viewable && (
                  <div className={styles.inlineField}>
                    <Select
                      size="sm"
                      className={styles.cvVersionSelect}
                      label={<span style={{fontWeight: 400}}>CV Version</span>}
                      data={cvVersionOptions}
                      value={cvVersionLabel}
                      disabled={isCvVersionsLoading}
                      placeholder={isCvVersionsLoading ? "Loading CV versions..." : "Select a CV version"}
                      onChange={(value) => setCvVersionLabel(value ?? ORIGINAL_CV_LABEL)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={styles.groupTitle}>Assessment settings:</div>
          <Checkbox.Group
            value={[
              ...(showJiaAssessments ? ["show-jia-assessments"] : []),
              ...(showRecruiterAssessments ? ["show-recruiter-assessments"] : []),
            ]}
            onValueChange={(values) => {
              setShowJiaAssessments(values.includes("show-jia-assessments"));
              setShowRecruiterAssessments(values.includes("show-recruiter-assessments"));
            }}
            className={styles.optionStack}
          >
            <Checkbox
              value="show-jia-assessments"
              className={styles.optionWithDescription}
              label={<span className={styles.optionTitle}>Show Jia assessments</span>}
              description="Includes Jia&apos;s AI-generated analysis and assessments alongside visible stages."
            />

            <Checkbox
              value="show-recruiter-assessments"
              className={styles.optionWithDescription}
              label={<span className={styles.optionTitle}>Show recruiter assessments</span>}
              description="Includes evaluations and assessments by recruiters alongside visible stages."
            />
          </Checkbox.Group>
        </div>
      </section>

      <section className={styles.configCard}>
        <div className={styles.configCardHeader}>
          <h4>Identity</h4>
          <p>Controls how the candidate&apos;s name appears throughout the shared profile.</p>
        </div>
        <Radio.Group
          value={nameVisibility}
          onValueChange={(val: string) => setNameVisibility(val as NameVisibility)} 
          className={`${styles.configCardBody} ${styles.identityGrid}`}
        >
          {NAME_VISIBILITY_OPTIONS.map((option) => (
            <Radio
              key={option.value}
              value={option.value}
              className={styles.identityOption}
              label={<span className={styles.optionTitle}>{option.value}</span>}
              description={option.example}
            />
          ))}
        </Radio.Group>
      </section>

      <section className={styles.configCard}>
        <div className={styles.configCardHeader}>
          <h4>Privacy & Visibility</h4>
          <p>Controls what personal information external viewers can see.</p>
        </div>
        <div className={styles.configCardBody}>
          <Checkbox.Group
            value={[
              ...(showContactDetails ? ["show-contact-details"] : []),
              ...(showDisplayPhoto ? ["show-display-photo"] : []),
            ]}
            onValueChange={(values) => {
              setShowContactDetails(values.includes("show-contact-details"));
              setShowDisplayPhoto(values.includes("show-display-photo"));
            }}
            className={styles.optionStack}
          >
            <Checkbox
              value="show-contact-details"
              className={styles.optionWithDescription}
              label={<span className={styles.optionTitle}>Show contact details</span>}
              description="Show the candidate&apos;s contact details, such as email and phone number."
            />

            <Checkbox
              value="show-display-photo"
              className={styles.optionWithDescription}
              label={<span className={styles.optionTitle}>Show display photo</span>}
              description="Show the candidate&apos;s profile photo. When hidden, a placeholder will be shown."
            />
          </Checkbox.Group>
        </div>
      </section>

      {hasVisibleGeneratedCredentials && (
        <section className={styles.generatedLinkCard}>
          <div className={styles.generatedLinkValue}>
            <span className={styles.fieldLabel}>Generated link</span>
            <div className={styles.textBox}>
              {visibleGeneratedLink}
            </div>
          </div>

          <button
            type="button"
            className={styles.copyButton}
            onClick={() => handleCopyValue(visibleGeneratedLink, "Link copied to clipboard.")}
            aria-label="Copy generated link"
          >
            <img src="/iconsV3/copy.svg" alt="Copy link" />
          </button>

          <div className={styles.generatedPasswordValue}>
            <span className={styles.fieldLabel}>Password</span>
            <div className={`${styles.textBox} ${styles.passwordBox}`}>
              {visibleGeneratedPassword}
            </div>
          </div>

          <button
            type="button"
            className={styles.copyButton}
            onClick={() => handleCopyValue(visibleGeneratedPassword, "Password copied to clipboard.")}
            aria-label="Copy generated password"
          >
            <img src="/iconsV3/copy.svg" alt="Copy password" />
          </button>
        </section>
      )}

      <p className={styles.generationHelper}>
        Once generated, this link&apos;s settings won&apos;t change. Updating settings later will create a new link.
      </p>

      <div className={styles.actionsRow}>
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewBtnDisabled}
          className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.default} ${isPreviewBtnDisabled ? buttonStyles.disabled : ""}`}
        >
          <i className="la la-external-link-alt" style={{ fontSize: 16 }} />
          <span>{isPreviewing ? "Preparing preview..." : "Preview shared view"}</span>
          <Tooltip
            message="Previews current settings. Expires in 10 minutes."
            width={220}
            position="top"
          />
        </button>

        <button
          type="button"
          onClick={handleGenerateLink}
          disabled={isGenerateBtnDisabled}
          className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.default} ${isGenerateBtnDisabled ? buttonStyles.disabled : ""}`}
        >
          <i className={`la ${generatingSuccessful ? "la-check" : "la-link"}`} style={{ fontSize: 18, color: "white" }} />
          <span>{isGenerating ? "Generating..." : "Generate secure link"}</span>
        </button>
      </div>

      <p className={styles.generationFootnote}>
        This will generate a password-protected link using the settings above.
      </p>
    </div>
  );

  const renderActivityTab = () => {
    if (isFetching) {
      return <LoadingAnimation text={"Loading"} subtext={"Fetching all generated links"} />;
    }

    if (!generatedLinks.length) {
      return (
        <div className={styles.emptyActivityState}>
          No shareable links generated yet
        </div>
      );
    }

    return (
      <div className={styles.activityList}>
        {generatedLinks.map((assessment) => {
          const sharedStages = getSharedStageLabels(assessment);
          const showContactDetails =
            typeof assessment.showContactDetails === "boolean"
              ? assessment.showContactDetails
              : Boolean(assessment.isContactVisible);
          const showDisplayPhoto =
            typeof assessment.showDisplayPhoto === "boolean"
              ? assessment.showDisplayPhoto
              : true;
          const showJiaAssessments =
            typeof assessment.showJiaAssessments === "boolean"
              ? assessment.showJiaAssessments
              : true;
          const showRecruiterAssessments =
            typeof assessment.showRecruiterAssessments === "boolean"
              ? assessment.showRecruiterAssessments
              : true;

          return (
            <section key={assessment._id} className={styles.activityCard}>
              <div className={styles.activityCardTop}>
                <div>
                  <p className={styles.activityGeneratedAt}>{formatGeneratedLabel(assessment.dateGenerated)}</p>
                  <p className={styles.activityCreator}>by {assessment.createdBy?.name || assessment.createdBy?.email || "Unknown user"}</p>
                </div>

                <div className={styles.activityActions}>
                  <button
                    type="button"
                    className={styles.activityActionButton}
                    onClick={() => window.open(assessment.link, "_blank", "noopener,noreferrer")}
                  >
                    <i className="la la-eye" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    className={styles.activityActionButton}
                    onClick={() => handleCopyValue(assessment.link, "Link copied to clipboard.")}
                  >
                    <i className="la la-link" />
                    <span>Copy link</span>
                  </button>
                </div>
              </div>

              <div className={styles.activitySection}>
                <h5>Shared Stages</h5>
                <div className={styles.pillWrap}>
                  {sharedStages.length > 0 ? (
                    sharedStages.map((stageLabel) => (
                      <span key={stageLabel} className={styles.pillNeutral}>{stageLabel}</span>
                    ))
                  ) : (
                    <span className={styles.pillNeutral}>No visible stages</span>
                  )}
                  <span className={showJiaAssessments ? styles.pillSuccess : styles.pillMuted}>
                    <i className={`la ${showJiaAssessments ? "la-check" : "la-times"}`} />
                    {showJiaAssessments ? "Jia assessments included" : "Jia assessments excluded"}
                  </span>
                  <span className={showRecruiterAssessments ? styles.pillSuccess : styles.pillMuted}>
                    <i className={`la ${showRecruiterAssessments ? "la-check" : "la-times"}`} />
                    {showRecruiterAssessments ? "Recruiter assessments included" : "Recruiter assessments excluded"}
                  </span>
                </div>
              </div>

              <div className={styles.activitySection}>
                <h5>Identity Visibility</h5>
                <div className={styles.pillWrap}>
                  <span className={styles.pillNeutral}>
                    <i className="la la-user" />
                    {formatNameVisibilityPill(assessment.nameVisibility)}
                  </span>
                  <span className={showContactDetails ? styles.pillSuccess : styles.pillMuted}>
                    <i className={`la ${showContactDetails ? "la-check" : "la-times"}`} />
                    {showContactDetails ? "Contact details shown" : "Contact details hidden"}
                  </span>
                  <span className={showDisplayPhoto ? styles.pillSuccess : styles.pillMuted}>
                    <i className={`la ${showDisplayPhoto ? "la-check" : "la-times"}`} />
                    {showDisplayPhoto ? "Photo shown" : "Photo hidden"}
                  </span>
                </div>
              </div>

              <div className={styles.activityCardBottom}>
                <div className={styles.activityStats}>
                  <span><i className="la la-eye" /> {assessment.views || 0} views</span>
                  <span>
                    Password: {assessment.password}
                    <button
                      type="button"
                      className={styles.inlineCopyIcon}
                      onClick={() => handleCopyValue(assessment.password, "Password copied to clipboard.")}
                      aria-label="Copy password"
                    >
                      <img src="/iconsV3/copy.svg" alt="Copy password" />
                    </button>
                  </span>
                </div>

                <div className={styles.activityControls}>
                  <div className={styles.activeToggle}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={assessment.active}
                        onChange={() => toggleLinkActive(assessment._id, !assessment.active)}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span>{assessment.active ? "Active" : "Disabled"}</span>
                  </div>

                  <button
                    type="button"
                    className={styles.activityDeleteButton}
                    onClick={() => setDeletingLinkId(assessment._id)}
                    aria-label="Delete shareable link"
                  >
                    <i className="la la-trash" />
                  </button>
                </div>
              </div>

              {deletingLinkId === assessment._id && (
                <div className={styles.deleteConfirmationBanner}>
                  <div>
                    <h5 className={styles.deleteTitle}>Delete this link?</h5>
                    <p className={styles.deleteSubtitle}>External access will be revoked immediately.</p>
                  </div>
                  <div className={styles.deleteActions}>
                    <button
                      type="button"
                      className={styles.cancelDeleteBtnText}
                      onClick={() => setDeletingLinkId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.confirmDeleteBtnText}
                      onClick={() => {
                        deleteLink(assessment._id);
                        setDeletingLinkId(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <div className="modal-background">
      <div className="modal-container">
        <div className={styles.modalContent}>
          <ModalHeader
            title={`Share Profile "${interview.name}" for ${interview.jobTitle}`}
            subtitle="Generate a secure, password-protected link for external viewers."
            iconSrc="/iconsV3/shareV2.svg"
            iconAlt="Share profile"
            setShowModal={setShowShareModal}
          />

          <div className={styles.modalBody}>
            <div className={styles.tabSwitcher}>
              <button
                type="button"
                onClick={() => setActiveTab("generate")}
                className={`${styles.tabButton} ${activeTab === "generate" ? styles.tabButtonActive : ""}`}
              >
                Generate Link
              </button>

              {hasPermission && (
                <button
                  type="button"
                  onClick={() => setActiveTab("activity")}
                  className={`${styles.tabButton} ${activeTab === "activity" ? styles.tabButtonActive : ""}`}
                >
                  Shared Links & Activity
                  {generatedLinks.length > 0 && (
                    <span className={styles.tabBadge}>{generatedLinks.length}</span>
                  )}
                </button>
              )}
            </div>

            {activeTab === "generate" ? (
              renderGenerateTab()
            ) : (
              <div className={styles.activityPanel}>
                {renderActivityTab()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
