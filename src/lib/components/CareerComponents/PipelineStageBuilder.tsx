"use client";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "@/lib/context/AppContext";
import { errorToast, guid, isStageEnabled, getEnabledStages, normalizePipeline } from "@/lib/Utils";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import React from "react";
import JobPipelineModal from "@/lib/components/PipelineComponents/JobPipelineModal";
import Fuse from "fuse.js";
import { Button } from "../ui";
import {
  buildCandidatePoolPipeline,
  buildReceivingPoolPipeline,
  buildStandalonePipeline,
} from "@/lib/utils/careerPostType";

import { TERMINAL_APPLICATION_STATUSES } from "@/lib/utils/constants";

const clonePipeline = (pipeline: any[]) =>
  normalizePipeline(JSON.parse(JSON.stringify(pipeline || [])));

const hasActiveApplicants = (applicants: any[]) =>
  applicants.some((a: any) => !TERMINAL_APPLICATION_STATUSES.includes(a.applicationStatus));

const ORG_SETTINGS_SCOPE_VALUE = "org";
const PROJECT_SETTINGS_SCOPE_PREFIX = "project:";

type SettingsScopeOption = {
  value: string;
  label: string;
  projectID?: string;
};

export default function PipelineStageBuilder({
  careerForm,
  jobPipeline,
  setJobPipeline,
  careerPostType,
  standaloneDefaultPipeline,
  formType,
  onPipelineCopied,
}: {
  careerForm: any;
  jobPipeline: any[];
  setJobPipeline: (jobPipeline: any[]) => void;
  careerPostType?: "standalone" | "candidate_pool" | "receiving_pool" | null;
  standaloneDefaultPipeline?: any[];
  formType?: "add" | "edit";
  onPipelineCopied?: (sourceId: string) => void;
}) {
  const { orgID, user } = useAppContext();
  const linkedProjectID = careerForm?.projectId?.trim() || "";
  const linkedSettingsScope = linkedProjectID
    ? `${PROJECT_SETTINGS_SCOPE_PREFIX}${linkedProjectID}`
    : ORG_SETTINGS_SCOPE_VALUE;
  const [isJobPipelineModalOpen, setIsJobPipelineModalOpen] = useState(false);
  const [isCopyPipelineDropdownOpen, setIsCopyPipelineDropdownOpen] =
    useState(false);
  const [isSettingsScopeDropdownOpen, setIsSettingsScopeDropdownOpen] =
    useState(false);
  const [isStageDropdownOpen, setIsStageDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pipelines, setPipelines] = useState([]);
  const [selectedSettingsScope, setSelectedSettingsScope] =
    useState(linkedSettingsScope);
  const [isApplyingSettingsScope, setIsApplyingSettingsScope] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const autoAppliedLinkedScopeRef = useRef<string | null>(null);

  const [isSubstageDropdownOpen, setIsSubstageDropdownOpen] = useState(false);
  const [selectedSubstage, setSelectedSubstage] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [hasResolvedApplicants, setHasResolvedApplicants] = useState(false);
  const applicantsRequestRef = useRef(0);
  const lastResolvedApplicantsCareerIdRef = useRef<string | null>(null);

  // Helper functions to check if a stage can be disabled/enabled based on careerPostType
  // Returns true if the stage CAN be disabled (i.e., should show "Disable Stage" option)
  const canDisableStage = (stageId: string): boolean => {
    if (careerPostType === "standalone" || careerPostType === "candidate_pool") {
      // CV Screening (id="1") cannot be disabled for End-to-End or Parent Post
      if (stageId === "1") return false;
    }
    return true;
  };

  // Returns true if the stage CAN be enabled (i.e., should show "Enable Stage" option)
  const canEnableStage = (stageId: string): boolean => {
    return true;
  };

  const hasOngoingApplicants = (stageId: string, substageId: any = null): boolean => {
    const hasApplicants = applicants.some((applicant: any) => {
      if (TERMINAL_APPLICATION_STATUSES.includes(applicant.applicationStatus)) return false;
      if (substageId) {
        return (
          applicant.stageId === stageId && applicant.substageId === substageId
        );
      }
      return applicant.stageId === stageId;
    });

    if (hasApplicants) {
      const entity = substageId ? "substage" : "stage";
      errorToast(
        `Cannot disable/delete ${entity} with ongoing applicants.`,
        null
      );
      return true;
    }
    return false;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".dropdown")) {
        setIsCopyPipelineDropdownOpen(false);
        setIsSettingsScopeDropdownOpen(false);
        setIsStageDropdownOpen(false);
        setIsSubstageDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchPipelines = async () => {
      try {
        const params: any = { orgID };
        if (careerForm?._id) {
          params.excludedIDs = careerForm._id;
        }
        const response = await api.get("/api/get-job-pipelines", {
          params,
        });

        if (response.status === 200) {
          setPipelines(response.data);
        }
      } catch (error) {
        console.error("Error fetching pipelines:", error);
      }
    };

    const fetchApplicants = async () => {
      if (!careerForm?._id) {
        setApplicants([]);
        setHasResolvedApplicants(true);
        lastResolvedApplicantsCareerIdRef.current = null;
        return;
      }

      const requestId = applicantsRequestRef.current + 1;
      applicantsRequestRef.current = requestId;
      const targetCareerID = careerForm._id;

      setHasResolvedApplicants(false);
      lastResolvedApplicantsCareerIdRef.current = null;

      try {
        const response = await api.get(
          `/api/get-career-interviews?careerID=${careerForm.id}`
        );
        if (requestId !== applicantsRequestRef.current) {
          return;
        }

        if (response.status === 200) {
          setApplicants(response.data);
        }
      } catch (error) {
        console.error("Error fetching applicants:", error);
      } finally {
        if (requestId !== applicantsRequestRef.current) {
          return;
        }

        lastResolvedApplicantsCareerIdRef.current = targetCareerID;
        setHasResolvedApplicants(true);
      }
    };
    if (orgID && careerForm) {
      fetchPipelines();
      fetchApplicants();
    }
  }, [orgID, careerForm]);



  // Fuse.js options for searching pipelines
  const fuseOptions = {
    keys: ["name"],
    threshold: 0.3,
  };

  // Filtered pipelines based on search
  const filteredPipelines = React.useMemo(() => {
    if (!search) return pipelines;
    const fuse = new Fuse(pipelines, fuseOptions);
    return fuse.search(search).map((result) => result.item);
  }, [search, pipelines]);

  // All stages are shown, but disabled ones are greyed out
  const visiblePipeline = useMemo(() => {
    return jobPipeline;
  }, [jobPipeline]);

  const settingsScopeOptions = useMemo<SettingsScopeOption[]>(() => {
    const options: SettingsScopeOption[] = [
      { value: ORG_SETTINGS_SCOPE_VALUE, label: "Use Org Settings" },
    ];

    if (linkedProjectID) {
      options.push({
        value: `${PROJECT_SETTINGS_SCOPE_PREFIX}${linkedProjectID}`,
        label: careerForm?.project?.trim() || "Linked Project",
        projectID: linkedProjectID,
      });
    }

    return options;
  }, [linkedProjectID, careerForm?.project]);

  const selectedSettingsScopeLabel = useMemo(() => {
    const selectedOption = settingsScopeOptions.find(
      (option) => option.value === selectedSettingsScope
    );

    if (selectedOption?.label) {
      return selectedOption.label;
    }

    if (
      selectedSettingsScope.startsWith(PROJECT_SETTINGS_SCOPE_PREFIX) &&
      selectedSettingsScope === linkedSettingsScope
    ) {
      return careerForm?.project?.trim() || "Linked Project";
    }

    return "Use Org Settings";
  }, [
    settingsScopeOptions,
    selectedSettingsScope,
    linkedSettingsScope,
    careerForm?.project,
  ]);

  const applyPipelineFromSettingsScope = useCallback(async (
    option: SettingsScopeOption,
    {
      silentIfBlocked = false,
    }: {
      silentIfBlocked?: boolean;
    } = {}
  ) => {
    if (!orgID) {
      errorToast("Org ID is required", null);
      return false;
    }

    if (hasActiveApplicants(applicants)) {
      if (!silentIfBlocked) {
        errorToast(
          "Cannot change the current pipeline with ongoing applicants.",
          null
        );
      }

      return false;
    }

    setIsApplyingSettingsScope(true);

    try {
      const response = await api.get("/api/career-settings/default-pipeline", {
        params: {
          orgID,
          ...(option.projectID ? { projectID: option.projectID } : {}),
        },
      });

      const fetchedPipeline = response?.data?.defaultPipelineStages;
      const resolvedPipeline = Array.isArray(fetchedPipeline)
        ? clonePipeline(fetchedPipeline)
        : buildStandalonePipeline();

      setJobPipeline(resolvedPipeline);
      return true;
    } catch (error: any) {
      errorToast(
        error?.response?.data?.error || "Failed to apply pipeline settings.",
        null
      );
      return false;
    } finally {
      setIsApplyingSettingsScope(false);
    }
  }, [applicants.length, orgID, setJobPipeline]);

  const handleSelectSettingsScope = async (option: SettingsScopeOption) => {
    setIsSettingsScopeDropdownOpen(false);
    const didApply = await applyPipelineFromSettingsScope(option);

    if (didApply) {
      setSelectedSettingsScope(option.value);
    }
  };

  useEffect(() => {
    setSelectedSettingsScope(linkedSettingsScope);
  }, [linkedSettingsScope]);

  useEffect(() => {
    if (formType !== "add") {
      autoAppliedLinkedScopeRef.current = null;
      return;
    }

    if (!orgID || !linkedProjectID) {
      autoAppliedLinkedScopeRef.current = null;
      return;
    }

    const applicantsResolvedForCurrentCareer =
      !careerForm?._id ||
      (hasResolvedApplicants &&
        lastResolvedApplicantsCareerIdRef.current === careerForm._id);

    if (!applicantsResolvedForCurrentCareer) {
      return;
    }

    if (autoAppliedLinkedScopeRef.current === linkedSettingsScope) {
      return;
    }

    const linkedOption = settingsScopeOptions.find(
      (option) => option.value === linkedSettingsScope
    ) || {
      value: linkedSettingsScope,
      label: careerForm?.project?.trim() || "Linked Project",
      projectID: linkedProjectID,
    };

    autoAppliedLinkedScopeRef.current = linkedSettingsScope;
    void applyPipelineFromSettingsScope(linkedOption, {
      silentIfBlocked: true,
    });
  }, [
    applyPipelineFromSettingsScope,
    careerForm?._id,
    careerForm?.project,
    linkedProjectID,
    linkedSettingsScope,
    hasResolvedApplicants,
    formType,
    orgID,
    settingsScopeOptions,
  ]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginTop: 16,
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", maxWidth: "70%" }}
        >
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#181D27" }}>
            Customize pipeline stages
          </h1>
          <span style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}>
            Create, modify, reorder, and delete stages and sub-stages. Core
            stages are fixed and can't be moved or edited as they are essential
            to Jia's system logic.
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button
            style={{
              whiteSpace: "nowrap",
            }}
            variant="secondary"
            label="Restore to default"
            icon="/redo.svg"
            onClick={() => {
              setModalType("restore-default");
              setIsJobPipelineModalOpen(true);
            }}
          >
          </Button>
          <div className="dropdown">
            <Button
            variant="secondary"
              style={{
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                setIsCopyPipelineDropdownOpen(!isCopyPipelineDropdownOpen);
                setIsSettingsScopeDropdownOpen(false);
                setIsStageDropdownOpen(false);
                setIsSubstageDropdownOpen(false);
              }}
              label="Copy pipeline from existing job"
              icon="/iconsV2/chevron.svg"
              iconPosition="right"
            >
              
              {/* <i className="la la-angle-down" style={{ fontSize: 16 }}></i> */}
            </Button>
            {isCopyPipelineDropdownOpen && (
              <div
                className={`dropdown-menu w-100 mt-1 org-dropdown-anim${
                  isCopyPipelineDropdownOpen ? " show" : ""
                }`}
                style={{
                  padding: "10px",
                  maxHeight: "300px",
                  overflowY: "scroll",
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid #E9EAEB",
                    paddingBottom: 10,
                  }}
                >
                  <div className="table-search-bar" style={{ width: "100%" }}>
                    <div className="icon mr-2">
                      <i className="la la-search"></i>
                    </div>
                    <input
                      type="search"
                      className="form-control ml-auto search-input"
                      placeholder="Search pipelines..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                      }}
                    />
                  </div>
                </div>
                {filteredPipelines.length > 0 ? (
                  <div>
                    {filteredPipelines.map((pipeline: any) => (
                      <div
                        key={pipeline.id}
                        className="dropdown-item"
                        onClick={() => {
                          setModalType("copy");
                          setSelectedPipeline(pipeline);
                          setIsJobPipelineModalOpen(true);
                          setIsCopyPipelineDropdownOpen(false);
                        }}
                      >
                        <span>{pipeline.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                    }}
                  >
                    <span>No pipelines found</span>
                  </div>
                )}
              </div>
            )}
          </div>
          {settingsScopeOptions.length > 1 && (
            <div className="dropdown">
              <Button
                variant="secondary"
                style={{
                  whiteSpace: "nowrap",
                }}
                onClick={() => {
                  if (isApplyingSettingsScope) {
                    return;
                  }

                  setIsSettingsScopeDropdownOpen(!isSettingsScopeDropdownOpen);
                  setIsCopyPipelineDropdownOpen(false);
                  setIsStageDropdownOpen(false);
                  setIsSubstageDropdownOpen(false);
                }}
                label={
                  isApplyingSettingsScope
                    ? "Applying settings..."
                    : selectedSettingsScopeLabel
                }
                icon="/iconsV2/chevron.svg"
                iconPosition="right"
              >
              </Button>
              {isSettingsScopeDropdownOpen && (
                <div
                  className={`dropdown-menu w-100 mt-1 org-dropdown-anim${
                    isSettingsScopeDropdownOpen ? " show" : ""
                  }`}
                  style={{
                    minWidth: "260px",
                    maxHeight: "280px",
                    overflowY: "auto",
                  }}
                >
                  {settingsScopeOptions.map((option) => (
                    <div
                      key={option.value}
                      className="dropdown-item"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                      onClick={() => {
                        handleSelectSettingsScope(option);
                      }}
                    >
                      <span>{option.label}</span>
                      {selectedSettingsScope === option.value && (
                        <i
                          className="la la-check"
                          style={{ fontSize: 16, color: "#181D27" }}
                        ></i>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Stages */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 16,
          marginTop: 24,
          marginBottom: 16,
          width: "100%",
          overflowX: "auto",
        }}
      >
        {visiblePipeline.length > 0 &&
          visiblePipeline?.map(
            (
              stage: {
                name: string;
                icon: string;
                type: string;
                id: string;
                stageEditable: boolean;
                substages: any[];
                autoEndorse: string;
                autoDrop: string;
                enabled?: boolean;
                alias?: string;
              },
              index: number
            ) => (
              <React.Fragment key={index}>
                {/* Add custom stage button before Human Interview */}
                {stage?.type === "core" && stage?.id === "3" && (
                  <div
                    style={{
                      border: "1px dashed #E9EAEB",
                      padding: 8,
                      borderRadius: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setModalType("new");
                      setIsJobPipelineModalOpen(true);
                    }}
                  >
                    <i className="la la-plus" style={{ fontSize: 20 }}></i>
                  </div>
                )}
                <div
                  draggable={stage?.type === "custom"}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("stageId", stage.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const target = e.currentTarget;
                    const bounding = target.getBoundingClientRect();
                    const offset = bounding.y + bounding.height / 2;

                    if (e.clientY - offset > 0) {
                      target.style.borderBottom = "3px solid #4CAF50";
                      target.style.borderTop = "none";
                    } else {
                      target.style.borderTop = "3px solid #4CAF50";
                      target.style.borderBottom = "none";
                    }
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.borderTop = "1px solid #E9EAEB";
                    e.currentTarget.style.borderBottom = "1px solid #E9EAEB";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const bounding = e.currentTarget.getBoundingClientRect();
                    const offset = bounding.y + bounding.height / 2;
                    const insertIndex =
                      e.clientY - offset > 0 ? index + 1 : index;

                    const stageId = e.dataTransfer.getData("stageId");

                    const stageAtCurrentIndex = jobPipeline?.[insertIndex];
                    if (
                      stageAtCurrentIndex &&
                      stageAtCurrentIndex.type === "custom" &&
                      stageAtCurrentIndex.id !== stageId
                    ) {
                      const stages = [...jobPipeline];
                      const stageToMoveIndex = stages.findIndex(
                        (stage: any) => stage.id === stageId
                      );
                      const stageToMove = stages[stageToMoveIndex];
                      stages.splice(stageToMoveIndex, 1);
                      stages.splice(insertIndex, 0, stageToMove);
                      setJobPipeline(stages);
                    }
                  }}
                  style={{
                    minHeight: "478px",
                    minWidth: "252px",
                    flex: "1 1 252px",
                    border: isStageEnabled(stage) ? "1px dashed #E9EAEB" : "1px dashed #D5D7DA",
                    borderRadius: 16,
                    backgroundColor: isStageEnabled(stage) ? "#FFFFFF" : "#F9FAFB",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 16,
                      width: "100%",
                      justifyContent: "center",
                      cursor: stage.type === "custom" ? "grab" : "default",
                    }}
                  >
                    {stage.type === "core" && (
                      <>
                        <i
                          className="la la-lock"
                          style={{ fontSize: 20, color: "#D5D7DA" }}
                        ></i>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#D5D7DA",
                          }}
                        >
                          Core Stage, cannot move
                        </span>
                      </>
                    )}
                    {stage.type === "custom" && (
                      <>
                        <i
                          className="la la-grip-vertical"
                          style={{ fontSize: 20, color: "#535862" }}
                        ></i>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#535862",
                          }}
                        >
                          Drag to reorder stage
                        </span>
                      </>
                    )}
                  </div>
                  <div
                    className="layered-card-outer"
                    style={{ height: "100%" }}
                  >
                    <div
                      className="layered-card-content"
                      style={{
                        padding: 16,
                        backgroundColor: isStageEnabled(stage) ? "#F8F9FC" : "#F3F4F6",
                        height: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
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
                          <i
                            className={stage.icon}
                            style={{ fontSize: 20, color: isStageEnabled(stage) ? "#1E1F3B" : "#9CA3AF" }}
                          ></i>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: isStageEnabled(stage) ? "#1E1F3B" : "#9CA3AF",
                            }}
                          >
                            {stage.name === "Human Interview"
                              ? "Final Human Interview"
                              : stage.alias || stage.name}
                          </span>
                          {!isStageEnabled(stage) && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#717680",
                                backgroundColor: "#E5E7EB",
                                padding: "2px 8px",
                                borderRadius: 12,
                              }}
                            >
                              Disabled
                            </span>
                          )}
                          <div
                            style={{
                              position: "relative",
                              display: "inline-block",
                            }}
                          >
                            <i
                              className="la la-question-circle"
                              style={{
                                fontSize: 18,
                                color: "#9CA3AF",
                                cursor: "pointer",
                              }}
                              title={`${
                                stage.name === "Human Interview"
                                  ? "Final Human Interview"
                                  : stage.name
                              } stage`}
                            ></i>
                          </div>
                        </div>
                        <div className="dropdown">
                          <button
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onClick={() => {
                              const openingSame = isStageDropdownOpen && selectedStage?.id === stage.id;
                              setIsStageDropdownOpen(!openingSame);
                              setSelectedStage(stage);
                              setIsCopyPipelineDropdownOpen(false);
                              setIsSettingsScopeDropdownOpen(false);
                              setIsSubstageDropdownOpen(false);
                            }}
                          >
                            <i
                              className="la la-ellipsis-v"
                              style={{ fontSize: 20, color: "#717680" }}
                            ></i>
                          </button>
                          {isStageDropdownOpen &&
                            stage.id === selectedStage?.id && (
                              <div
                                className={`dropdown-menu w-100 mt-1 org-dropdown-anim${
                                  isStageDropdownOpen ? " show" : ""
                                }`}
                              >
                                {(stage.type === "custom" || stage.stageEditable) && (
                                  <div
                                    className="dropdown-item"
                                    onClick={() => {
                                      setModalType("rename-stage");
                                      setSelectedStage(stage);
                                      setIsJobPipelineModalOpen(true);
                                      setIsStageDropdownOpen(false);
                                    }}
                                  >
                                    <span>
                                      {" "}
                                      <i
                                        className="la la-pencil"
                                        style={{
                                          fontSize: 16,
                                          color: "#717680",
                                        }}
                                      ></i>{" "}
                                      Rename Stage
                                    </span>
                                  </div>
                                )}
                                {["CV Screening", "AI Interview"].includes(stage.name) && (
                                  <div
                                    className="dropdown-item"
                                    onClick={() => {
                                      setModalType("rename-stage");
                                      setSelectedStage(stage);
                                      setIsJobPipelineModalOpen(true);
                                      setIsStageDropdownOpen(false);
                                    }}
                                  >
                                    <span>
                                      {" "}
                                      <i
                                        className="la la-pencil"
                                        style={{ fontSize: 16, color: "#717680" }}
                                      ></i>{" "}
                                      Rename Stage
                                    </span>
                                  </div>
                                )}
                                {stage.type === "core" ? (
                                  isStageEnabled(stage) ? (
                                    canDisableStage(stage.id) && (
                                      <div
                                        className="dropdown-item"
                                         onClick={() => {
                                            if (hasOngoingApplicants(stage.id)) {
                                              setIsStageDropdownOpen(false);
                                              return;
                                            }
                                          const enabledCount = getEnabledStages(jobPipeline).length;
                                          if (enabledCount <= 1) {
                                            setIsStageDropdownOpen(false);
                                            errorToast(
                                              "At least one stage must be enabled.",
                                              null
                                            );
                                            return;
                                          }
                                          // CV Screening requires confirmation modal
                                          if (stage.id === "1") {
                                            setSelectedStage(stage);
                                            setModalType("disable-cv-screening");
                                            setIsJobPipelineModalOpen(true);
                                            setIsStageDropdownOpen(false);
                                            return;
                                          }
                                          const stages = jobPipeline.map((s: any) =>
                                            s.id === stage.id ? { ...s, enabled: false } : s
                                          );
                                          setJobPipeline(stages);
                                          setIsStageDropdownOpen(false);
                                        }}
                                      >
                                        <span>
                                          {" "}
                                          <i
                                            className="la la-eye-slash"
                                            style={{
                                              fontSize: 16,
                                              color: "#717680",
                                            }}
                                          ></i>{" "}
                                          Disable Stage
                                        </span>
                                      </div>
                                    )
                                  ) : (
                                    canEnableStage(stage.id) && (
                                      <div
                                        className="dropdown-item"
                                        onClick={() => {
                                          const stages = jobPipeline.map((s: any) =>
                                            s.id === stage.id ? { ...s, enabled: true } : s
                                          );
                                          setJobPipeline(stages);
                                          setIsStageDropdownOpen(false);
                                        }}
                                      >
                                        <span>
                                          {" "}
                                          <i
                                            className="la la-eye"
                                            style={{
                                              fontSize: 16,
                                              color: "#717680",
                                            }}
                                          ></i>{" "}
                                          Enable Stage
                                        </span>
                                      </div>
                                    )
                                  )
                                ) : (
                                  <div
                                    className="dropdown-item"
                                    onClick={() => {
                                      if (hasOngoingApplicants(stage.id)) {
                                        setIsStageDropdownOpen(false);
                                        return;
                                      }
                                      setModalType("delete-stage");
                                      setSelectedStage(stage);
                                      setIsJobPipelineModalOpen(true);
                                      setIsStageDropdownOpen(false);
                                    }}
                                  >
                                    <span>
                                      {" "}
                                      <i
                                        className="la la-trash"
                                        style={{
                                          fontSize: 16,
                                          color: "#717680",
                                        }}
                                      ></i>{" "}
                                      Delete Stage
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#717680",
                        }}
                      >
                        Substages
                      </span>
                      {stage?.substages?.map(
                        (
                          substage: {
                            id: number;
                            name: string;
                            currentStep: string;
                            status: string;
                            core?: boolean;
                          },
                          index: number
                        ) => {
                        const isCoreSubstage = substage.core || (stage.id === "1" && ["1", "2"].includes(String(substage.id)));
                        return (
                          <div
                            key={index}
                            style={{
                              display: "flex",
                              height: 52,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              border: "1px solid #E9EAEB",
                              padding: 8,
                              borderRadius: 12,
                              backgroundColor: "#FFFFFF",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: "#414651",
                              }}
                            >
                              {substage.name}
                            </span>
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
                                  borderRadius: "50%",
                                  height: 28,
                                  width: 28,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: "#FFFFFF",
                                  padding: 4,
                                  border: "1px solid #D5D7DA",
                                }}
                              >
                                <i
                                  className="la la-bolt"
                                  style={{ fontSize: 16, color: "#717680" }}
                                ></i>
                              </div>
                              {(stage.type === "custom" ||
                                (stage.stageEditable &&
                                  stage.name !== "Human Interview") ||
                                (!isCoreSubstage && stage.name === "CV Screening")) && (
                                <div className="dropdown">
                                  <button
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                    onClick={() => {
                                      const openingSame =
                                        isSubstageDropdownOpen &&
                                        selectedStage?.id === stage.id &&
                                        selectedSubstage?.id === substage.id;
                                      setIsSubstageDropdownOpen(!openingSame);
                                      setSelectedStage(stage);
                                      setSelectedSubstage(substage);
                                      setIsStageDropdownOpen(false);
                                      setIsCopyPipelineDropdownOpen(false);
                                      setIsSettingsScopeDropdownOpen(false);
                                    }}
                                  >
                                    <i
                                      className="la la-ellipsis-h"
                                      style={{ fontSize: 20 }}
                                    ></i>
                                  </button>
                                  {isSubstageDropdownOpen &&
                                    stage.id === selectedStage?.id &&
                                    selectedSubstage?.id === substage.id && (
                                      <div
                                        className={`dropdown-menu w-100 mt-1 org-dropdown-anim${
                                          isSubstageDropdownOpen ? " show" : ""
                                        }`}
                                      >
                                        <div
                                          className="dropdown-item"
                                          onClick={() => {
                                            setModalType("rename-substage");
                                            setIsJobPipelineModalOpen(true);
                                            setIsSubstageDropdownOpen(false);
                                          }}
                                        >
                                          <span>
                                            {" "}
                                            <i
                                              className="la la-pencil"
                                              style={{
                                                fontSize: 16,
                                                color: "#717680",
                                              }}
                                            ></i>{" "}
                                            Rename Substage
                                          </span>
                                        </div>
                                        {(stage.type === "custom" || !isCoreSubstage) && (
                                          <div
                                            className="dropdown-item"
                                            onClick={() => {
                                              if (
                                                stage.type === "custom" &&
                                                selectedStage?.substages
                                                  ?.length === 1
                                              ) {
                                                setIsSubstageDropdownOpen(
                                                  false
                                                );
                                                errorToast(
                                                  "Substages cannot be empty.",
                                                  null
                                                );
                                                return;
                                              }
                                              // Validation if there are applicants in the substage
                                              if (hasOngoingApplicants(selectedStage.id, selectedSubstage.id)) {
                                                setIsSubstageDropdownOpen(false);
                                                return;
                                              }
                                              setModalType("delete-substage");
                                              setIsJobPipelineModalOpen(true);
                                              setIsSubstageDropdownOpen(false);
                                            }}
                                          >
                                            <span>
                                              {" "}
                                              <i
                                                className="la la-trash"
                                                style={{
                                                  fontSize: 16,
                                                  color: "#717680",
                                                }}
                                              ></i>{" "}
                                              Delete Substage
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                        }
                      )}
                      {(stage.type === "custom" || (stage.name === "CV Screening" && isStageEnabled(stage))) && (
                        <div
                          style={{
                            display: "flex",
                            backgroundColor: "#FFFFFF",
                            padding: 8,
                            borderRadius: 12,
                            border: "1px solid #D5D7DA",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setModalType("new-substage");
                            setSelectedStage(stage);
                            setIsJobPipelineModalOpen(true);
                          }}
                        >
                          <i
                            className="la la-plus"
                            style={{ fontSize: 20 }}
                          ></i>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#414651",
                            }}
                          >
                            Add sub-stage
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {["AI Interview", "CV Screening"].includes(stage.name) && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        padding: "16px",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          width: "100%",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#414651",
                          }}
                        >
                          Auto Endorse
                        </span>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            width: "50%",
                            justifyContent: "flex-end",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#717680",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {stage.autoEndorse || "None"}
                          </span>
                          <button
                            style={{
                              background: "#fff",
                              border: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onClick={() => {
                              setModalType("auto-endorse");
                              setSelectedStage(stage);
                              setIsJobPipelineModalOpen(true);
                            }}
                          >
                            <i
                              className="la la-pencil"
                              style={{ fontSize: 20 }}
                            ></i>
                          </button>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          width: "100%",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#414651",
                          }}
                        >
                          Auto Drop
                        </span>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            width: "50%",
                            justifyContent: "flex-end",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#717680",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {stage.autoDrop || "None"}
                          </span>
                          <button
                            style={{
                              background: "#fff",
                              border: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onClick={() => {
                              setModalType("auto-drop");
                              setSelectedStage(stage);
                              setIsJobPipelineModalOpen(true);
                            }}
                          >
                            <i
                              className="la la-pencil"
                              style={{ fontSize: 20 }}
                            ></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            )
          )}
      </div>
      {isJobPipelineModalOpen && (
        <JobPipelineModal
          pipelineStages={jobPipeline}
          modalType={modalType}
          onClose={() => setIsJobPipelineModalOpen(false)}
          onContinue={(data) => {
            setIsJobPipelineModalOpen(false);
            if (modalType === "new") {
              const stages = [...jobPipeline];
              const newStage = {
                id: guid(),
                name: data,
                type: "custom",
                substages: [
                  {
                    id: guid(),
                    name: "Waiting Submission",
                    currentStep: data,
                    status: "Waiting Submission",
                  },
                  {
                    id: guid(),
                    name: "For Review",
                    currentStep: data,
                    status: "For Review",
                  },
                ],
                autoEndorse: "None",
                autoDrop: "None",
              };
              const index = stages.findIndex(
                (stage: any) => stage.name === "AI Interview"
              );
              stages.splice(index + 1, 0, newStage);
              setJobPipeline(stages);
            }

            if (modalType === "delete-stage") {
              const stages = [...jobPipeline];
              const stageIndex = stages.findIndex(
                (stage: any) => stage.id === selectedStage.id
              );
              stages.splice(stageIndex, 1);
              setJobPipeline(stages);
            }

            if (modalType === "copy") {
              // Check for ongoing applicants before replacing pipeline
              if (hasActiveApplicants(applicants)) {
                errorToast("Copying Failed: Cannot change the current pipeline with ongoing applicants.", null);
                return;
              }
              const { pipeline, includeAutomations } = data;
              setJobPipeline([...pipeline.stages]);
              if (onPipelineCopied && includeAutomations) {
                onPipelineCopied(pipeline._id);
              }
            }

            if (modalType === "auto-endorse") {
              const stages = [...jobPipeline];
              const stage = stages.find(
                (stage: any) => stage.id === selectedStage.id
              );
              stage.autoEndorse = data;
              setJobPipeline(stages);
            }

            if (modalType === "auto-drop") {
              const stages = [...jobPipeline];
              const stage = stages.find(
                (stage: any) => stage.id === selectedStage.id
              );
              stage.autoDrop = data;
              setJobPipeline(stages);
            }

            if (modalType === "new-substage") {
              const stages = [...jobPipeline];
              const stage = stages.find(
                (stage: any) => stage.id === selectedStage.id
              );
              stage.substages.push({
                id: guid(),
                name: data,
                currentStep: stage.name,
                status: data,
              });
              setJobPipeline(stages);
            }

            if (modalType === "rename-stage") {
              if (selectedStage.id === "1" || selectedStage.id === "2") {
                const stages = [...jobPipeline];
                const stage = stages.find(
                  (stage: any) => stage.id === selectedStage.id
                );
                stage.alias = data;
                setJobPipeline(stages);
              } else {
                const stages = [...jobPipeline];
                const stage = stages.find(
                  (stage: any) => stage.id === selectedStage.id
                );
                stage.name = data;
                stage.substages = stage.substages.map((substage: any) => ({
                  ...substage,
                  currentStep: data,
                }));
                setJobPipeline(stages);
              }
            }

            if (modalType === "rename-substage") {
              const stages = [...jobPipeline];
              const stage = stages.find(
                (stage: any) => stage.id === selectedStage.id
              );
              const substage = stage.substages.find(
                (substage: any) => substage.id === selectedSubstage.id
              );
              substage.name = data;
              substage.status = data;
              setJobPipeline(stages);
            }

            if (modalType === "delete-substage") {
              const stages = [...jobPipeline];
              const stage = stages.find(
                (stage: any) => stage.id === selectedStage.id
              );
              stage.substages = stage.substages.filter(
                (substage: any) => substage.id !== selectedSubstage.id
              );
              setJobPipeline(stages);
            }

            if (modalType === "restore-default") {
              // Check for ongoing applicants before restoring
              if (hasActiveApplicants(applicants)) {
                errorToast("Restore failed: Cannot change the current pipeline with ongoing applicants.", null);
                return;
              }
              
              // Restore based on careerPostType to maintain required configuration
              let restoredPipeline;
              if (careerPostType === "candidate_pool") {
                restoredPipeline = buildCandidatePoolPipeline();
              } else if (careerPostType === "receiving_pool") {
                restoredPipeline = buildReceivingPoolPipeline();
              } else {
                restoredPipeline =
                  Array.isArray(standaloneDefaultPipeline) && standaloneDefaultPipeline.length > 0
                    ? JSON.parse(JSON.stringify(standaloneDefaultPipeline))
                    : buildStandalonePipeline();
              }
              setJobPipeline(restoredPipeline);
            }

            if (modalType === "disable-cv-screening") {
              const stages = jobPipeline.map((s: any) =>
                s.id === "1" ? { ...s, enabled: false } : s
              );
              setJobPipeline(stages);
            }

            setSelectedStage(null);

          }}
          selectedPipeline={selectedPipeline}
          selectedStage={selectedStage}
          selectedSubstage={selectedSubstage}
        />
      )}
    </div>
  );
}
