"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "@/lib/styles/shareable-assessment.module.scss";
import ModalHeader from "./ModalHeader";
import CustomDropdownV2 from "@/lib/components/Dropdown/CustomDropdownV2";
import GeneratedLinksTable from "./GeneratedLinksTable";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "@/lib/context/AppContext";
import { toast } from "react-toastify";
import StageCheckbox from "./StageCheckbox";
import { useHumanInterviewStageAvailability, useShareableAssessmentLinks } from "@/lib/hooks/useShareAssessmentModal";
import LoadingAnimation from "../Loaders/LoadingAnimation";
import type { NameVisibility } from "../CandidateProfileComponents/candidateProfileUtils";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import buttonStyles from "@/lib/components/ui/button/button.module.scss";

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
  userNameSlug: string;
  isContactVisible: boolean;
  password: string;
  views: number;
  active: boolean;
};

export function canViewHistoricalLinks(user: { email?: string, [key: string]: any }): boolean {
  if (!user?.email) return false;
  
  const activeOrg = localStorage.getItem('activeOrg');
  if (activeOrg) {
    try {
      const parsedOrg = JSON.parse(activeOrg);
      return parsedOrg.role === 'admin' || parsedOrg.role === 'super_admin';
    } catch (error) {
      console.error('Error parsing activeOrg:', error);
      return false;
    }
  }
  
  return false;
}

export default function ShareModal({
  interview,
  setShowShareModal
} : {
  interview: any;
  setShowShareModal(show: boolean): void;
}) {
  const { orgID, user } = useAppContext();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingSuccessful, setGeneratingSuccessful] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string>("");
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  const [hasPermission, setHasPermission] = useState(false);

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
          orgID: orgID
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

  const nameVisibilityOptions = [
    { name: "Full Name" },
    { name: "Initials only" },
    { name: "First name only" }
  ];

  const buildInitialStages = useCallback((): ViewableStages => {
    const stages: ViewableStages = {};
    
    const shareableStages = pipelineStages.filter(s => s.id !== "4");
    
    for (const stage of shareableStages) {
      const displayName = stage.alias || stage.name;
      
      if (stage.id === "1") {
        stages[stage.id] = {
          viewable: false,
          disabled: interview.cvStatus === undefined,
          stageName: displayName
        };
      } else if (stage.id === "2") {
        stages[stage.id] = {
          viewable: false,
          disabled: interview.jobFit === undefined,
          stageName: displayName
        };
      } else if (stage.id === "3" || stage.type === "custom") {
        stages[stage.id] = {
          viewable: false,
          disabled: true,
          stageName: displayName
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
    enabled: pipelineStages.length > 0
  });

  useEffect(() => {
    if (Object.keys(disabledStages).length === 0) return;
    
    setViewableStages(prev => {
      let hasChanges = false;
      const updated = { ...prev };
      
      for (const [stageId, isDisabled] of Object.entries(disabledStages)) {
        if (updated[stageId] && updated[stageId].disabled !== isDisabled) {
          updated[stageId] = { ...updated[stageId], disabled: isDisabled };
          hasChanges = true;
        }
      }
      
      return hasChanges ? updated : prev;
    });
  }, [disabledStages]);

  const [nameVisibility, setNameVisibility] = useState(nameVisibilityOptions.at(0).name);
  const [isContactVisible, setIsContactVisible] = useState<boolean>(false);

  useEffect(() => {
    if (nameVisibility !== "Full Name") {
      setIsContactVisible(false);
    }
    setGeneratingSuccessful(false);
  }, [nameVisibility]);

  useEffect(() => {
    setGeneratingSuccessful(false);
  }, [viewableStages, isContactVisible]);

  const handleGenerateLink = async () => {
    if (!orgID) {
      toast.error("Organization not found");
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
        isContactVisible,
        active: true,
        orgID
      });

      if (response.data.success) {
        setGeneratingSuccessful(true);
        setGeneratedLink(response.data.link);
        setGeneratedPassword(response.data.password);

        toast.success("Successfully generated link!");
        await refreshLinks();
      }
    } catch (error) {
      console.error("Error generating link:", error);
      toast.error("Failed to generate shareable link");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast.success("Link copied to clipboard.");
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast.error("Failed to copy link");
    }
  };

  const isGenerateBtnDisabled =
    generatingSuccessful ||
      isGenerating ||
      Object.values(viewableStages).every(stage => stage.disabled || !stage.viewable);

  return (
    <div className="modal-background">
      <div className="modal-container">
        <div className={styles.modalContent}>
          <ModalHeader
            title={`Share "${interview.name}" for ${interview.jobTitle}`}
            subtitle="Sharing this profile will generate a password-protected link for viewing."
            setShowModal={setShowShareModal}
          />

          <div className={styles.modalBody}>
            <div className={styles.subcontentWrapper}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4>Share Settings</h4>
                <button
                  onClick={handleGenerateLink}
                  disabled={isGenerateBtnDisabled}
                  style={{ color: "white" }}
                  className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.default} ${isGenerateBtnDisabled ? buttonStyles.disabled : ""}`}
                >
                  <i
                    className={`la ${generatingSuccessful ? "la-check" : "la-link"}`}
                    style={{ fontSize: 20 }}
                  />{" "}
                  <span>{isGenerating ? "Generating..." : "Generate Link"}</span>
                </button>
              </div>

              <div className={styles.settingFields}>
                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>
                    Candidate name visibility
                  </span>
                  <CustomDropdownV2
                    value={nameVisibility}
                    placeholder="Select visibility option"
                    options={nameVisibilityOptions}
                    onValueChange={(value: string) => {
                      setNameVisibility(value as NameVisibility)
                      toast.success("Name visibility updated.")
                    }}
                  />
                </div>

                <div className={styles.fieldSeparator} />

                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>
                    Viewable stages
                  </span>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-start", maxWidth: "700px" }}>
                    {pipelineStages
                      .filter(s => s.id !== "4" && viewableStages[s.id])
                      .map((stage) => (
                        <StageCheckbox
                          key={stage.id}
                          stageId={stage.id}
                          stageName={viewableStages[stage.id].stageName}
                          viewableStages={viewableStages}
                          setViewableStages={setViewableStages}
                        />
                      ))}
                  </div>
                </div>

                <div className={styles.fieldSeparator} />

                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>
                    Contact Details
                  </span>

                  <div style={{ display: "flex", gap: "12px" }}>
                    <div className={styles.checkboxField}>
                      <input
                        type="checkbox"
                        className={styles.customCheckbox}
                        checked={isContactVisible}
                        disabled={nameVisibility !== "Full Name"}
                        onChange={() => setIsContactVisible(!isContactVisible)}
                      />
                      <span className={styles.fieldLabel}>Show Contact Details</span>
                    </div>
                  </div>
                </div>
              </div>

              {generatedLink && generatedPassword && (
                <div className={styles.settingsFields} style={{ display: "flex", gap: "12px", width: "100%" }}>
                  <div className={styles.fieldGroup} style={{ display: "flex", flexDirection: "column", gap: "6px", width: "0", flex: "1" }}>
                    <span className={styles.fieldLabel}>Share link</span>
                    <div className={styles.textBox} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {generatedLink}
                    </div>
                  </div>

                   <div className={styles.copyButton} onClick={handleCopy} style={{ cursor: "pointer" }}>
                     <img src="/iconsV3/copy.svg" alt="Copy" />
                   </div>

                  <div className={styles.fieldGroup} style={{ display: "flex", flexDirection: "column", gap: "6px", width: "10%" }}>
                    <span className={styles.fieldLabel}>Password</span>
                    <div className={`${styles.textBox} ${styles.passwordBox}`}>{generatedPassword}</div>
                  </div>
                </div>
              )}
            </div>

            {hasPermission && (
              <>
                <hr style={{ backgroundColor: "#E9EAEB", margin: "0" }} />

                <div className={styles.subcontentWrapper}>
                  <h4>All Generated Links</h4>

                  {isFetching ? (
                    <LoadingAnimation text={"Loading"} subtext={"Fetching all generated links"} />
                  ) : (
                    <GeneratedLinksTable
                      generatedLinks={generatedLinks}
                      pipelineStages={pipelineStages}
                      onToggleActive={toggleLinkActive}
                      onDelete={deleteLink}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
