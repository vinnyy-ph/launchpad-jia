"use client";

import { useState } from "react";
import React from "react";
import JobPipelineModal from "@/lib/components/PipelineComponents/JobPipelineModal";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import { errorToast, getEnabledStages, guid, isStageEnabled } from "@/lib/Utils";

const cloneDefaultPipeline = () => JSON.parse(JSON.stringify(DEFAULT_JOB_PIPELINE));

export default function GlobalPipelineStageColumns({
  jobPipeline,
  setJobPipeline,
  allowDisableBoundaryCoreStages = false,
}: {
  jobPipeline: any[];
  setJobPipeline(jobPipeline: any[]): void;
  allowDisableBoundaryCoreStages?: boolean;
}) {
  const [isJobPipelineModalOpen, setIsJobPipelineModalOpen] = useState(false);
  const [isStageDropdownOpen, setIsStageDropdownOpen] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<any>(null);
  const [isSubstageDropdownOpen, setIsSubstageDropdownOpen] = useState(false);
  const [selectedSubstage, setSelectedSubstage] = useState<any>(null);

  const canDisableStage = (stageId: string, stageIndex: number): boolean => {
    if (allowDisableBoundaryCoreStages) {
      return true;
    }

    const isFirstStage = stageIndex === 0 || stageId === "1";
    const isLastStage = stageIndex === jobPipeline.length - 1 || stageId === "4";

    if (isFirstStage || isLastStage) {
      return false;
    }

    return true;
  };

  return (
    <div>
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
        {jobPipeline.length > 0 &&
          jobPipeline?.map(
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
            ) => {
              const hasRenameStageAction =
                stage.type === "custom" ||
                stage.stageEditable ||
                ["CV Screening", "AI Interview"].includes(stage.name);
              const hasDisableStageAction =
                stage.type === "core" &&
                isStageEnabled(stage) &&
                canDisableStage(stage.id, index);
              const hasEnableStageAction =
                stage.type === "core" &&
                !isStageEnabled(stage);
              const hasDeleteStageAction = stage.type !== "core";
              const hasStageMenuActions =
                hasRenameStageAction ||
                hasDisableStageAction ||
                hasEnableStageAction ||
                hasDeleteStageAction;

              return (
              <React.Fragment key={stage.id ?? `stage-${index}`}>
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
                    const insertIndex = e.clientY - offset > 0 ? index + 1 : index;

                    const stageId = e.dataTransfer.getData("stageId");

                    const stageAtCurrentIndex = jobPipeline?.[insertIndex];
                    if (
                      stageAtCurrentIndex &&
                      stageAtCurrentIndex.type === "custom" &&
                      stageAtCurrentIndex.id !== stageId
                    ) {
                      const stages = [...jobPipeline];
                      const stageToMoveIndex = stages.findIndex(
                        (pipelineStage: any) => pipelineStage.id === stageId
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
                        <i className="la la-lock" style={{ fontSize: 20, color: "#D5D7DA" }}></i>
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
                        <i className="la la-grip-vertical" style={{ fontSize: 20, color: "#535862" }}></i>
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
                  <div className="layered-card-outer" style={{ height: "100%" }}>
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
                        <>
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
                                  {stage.name === "Human Interview" ? "Final Human Interview" : stage.alias || stage.name}
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
                                    title={`${stage.name === "Human Interview" ? "Final Human Interview" : stage.name} stage`}
                                  ></i>
                                </div>
                              </div>

                              {hasStageMenuActions && (
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
                                      setSelectedStage(stage);
                                      setIsStageDropdownOpen(!isStageDropdownOpen);
                                    }}
                                  >
                                    <i className="la la-ellipsis-v" style={{ fontSize: 20, color: "#717680" }}></i>
                                  </button>
                                  {isStageDropdownOpen && stage.id === selectedStage?.id && (
                                    <div className={`dropdown-menu w-100 mt-1 org-dropdown-anim${isStageDropdownOpen ? " show" : ""}`}>
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
                                            <i className="la la-pencil" style={{ fontSize: 16, color: "#717680" }}></i> Rename Stage
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
                                            <i className="la la-pencil" style={{ fontSize: 16, color: "#717680" }}></i> Rename Stage
                                          </span>
                                        </div>
                                      )}
                                      {stage.type === "core" ? (
                                        isStageEnabled(stage) ? (
                                          canDisableStage(stage.id, index) && (
                                            <div
                                              className="dropdown-item"
                                              onClick={() => {
                                                const enabledCount = getEnabledStages(jobPipeline).length;
                                                if (enabledCount <= 1) {
                                                  setIsStageDropdownOpen(false);
                                                  errorToast("At least one stage must be enabled.", null);
                                                  return;
                                                }
                                                if (stage.id === "1") {
                                                  setSelectedStage(stage);
                                                  setModalType("disable-cv-screening");
                                                  setIsJobPipelineModalOpen(true);
                                                  setIsStageDropdownOpen(false);
                                                  return;
                                                }
                                                const stages = jobPipeline.map((pipelineStage: any) =>
                                                  pipelineStage.id === stage.id ? { ...pipelineStage, enabled: false } : pipelineStage
                                                );
                                                setJobPipeline(stages);
                                                setIsStageDropdownOpen(false);
                                              }}
                                            >
                                              <span>
                                                <i className="la la-eye-slash" style={{ fontSize: 16, color: "#717680" }}></i> Disable Stage
                                              </span>
                                            </div>
                                          )
                                        ) : (
                                          <div
                                            className="dropdown-item"
                                            onClick={() => {
                                              const stages = jobPipeline.map((pipelineStage: any) =>
                                                pipelineStage.id === stage.id ? { ...pipelineStage, enabled: true } : pipelineStage
                                              );
                                              setJobPipeline(stages);
                                              setIsStageDropdownOpen(false);
                                            }}
                                          >
                                            <span>
                                              <i className="la la-eye" style={{ fontSize: 16, color: "#717680" }}></i> Enable Stage
                                            </span>
                                          </div>
                                        )
                                      ) : (
                                        <div
                                          className="dropdown-item"
                                          onClick={() => {
                                            setModalType("delete-stage");
                                            setSelectedStage(stage);
                                            setIsJobPipelineModalOpen(true);
                                            setIsStageDropdownOpen(false);
                                          }}
                                        >
                                          <span>
                                            <i className="la la-trash" style={{ fontSize: 16, color: "#717680" }}></i> Delete Stage
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                        </>
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
                          substageIndex: number
                        ) => {
                        const isCoreSubstage = substage.core || (stage.id === "1" && ["1", "2"].includes(String(substage.id)));
                        return (
                          <div
                            key={substage.id ?? `${stage.id}-substage-${substageIndex}`}
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
                                <i className="la la-bolt" style={{ fontSize: 16, color: "#717680" }}></i>
                              </div>
                              {(stage.type === "custom" ||
                                (stage.stageEditable && stage.name !== "Human Interview") ||
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
                                      setSelectedStage(stage);
                                      setSelectedSubstage(substage);
                                      setIsSubstageDropdownOpen(!isSubstageDropdownOpen);
                                    }}
                                  >
                                    <i className="la la-ellipsis-h" style={{ fontSize: 20 }}></i>
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
                                            <i className="la la-pencil" style={{ fontSize: 16, color: "#717680" }}></i> Rename Substage
                                          </span>
                                        </div>
                                        {(stage.type === "custom" || !isCoreSubstage) && (
                                          <div
                                            className="dropdown-item"
                                            onClick={() => {
                                              if (stage.type === "custom" && selectedStage?.substages?.length === 1) {
                                                setIsSubstageDropdownOpen(false);
                                                errorToast("Substages cannot be empty.", null);
                                                return;
                                              }
                                              setModalType("delete-substage");
                                              setIsJobPipelineModalOpen(true);
                                              setIsSubstageDropdownOpen(false);
                                            }}
                                          >
                                            <span>
                                              <i className="la la-trash" style={{ fontSize: 16, color: "#717680" }}></i> Delete Substage
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
                      {(stage.type === "custom" || stage.name === "CV Screening") && (
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
                          <i className="la la-plus" style={{ fontSize: 20 }}></i>
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
                            <i className="la la-pencil" style={{ fontSize: 20 }}></i>
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
                            <i className="la la-pencil" style={{ fontSize: 20 }}></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
            }
          )}
      </div>
      {isJobPipelineModalOpen && modalType && (
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
              const index = stages.findIndex((pipelineStage: any) => pipelineStage.name === "AI Interview");
              stages.splice(index + 1, 0, newStage);
              setJobPipeline(stages);
            }

            if (modalType === "delete-stage") {
              const stages = [...jobPipeline];
              const stageIndex = stages.findIndex((pipelineStage: any) => pipelineStage.id === selectedStage.id);
              stages.splice(stageIndex, 1);
              setJobPipeline(stages);
            }

            if (modalType === "auto-endorse") {
              const stages = [...jobPipeline];
              const stage = stages.find((pipelineStage: any) => pipelineStage.id === selectedStage.id);
              stage.autoEndorse = data;
              setJobPipeline(stages);
            }

            if (modalType === "auto-drop") {
              const stages = [...jobPipeline];
              const stage = stages.find((pipelineStage: any) => pipelineStage.id === selectedStage.id);
              stage.autoDrop = data;
              setJobPipeline(stages);
            }

            if (modalType === "new-substage") {
              const stages = [...jobPipeline];
              const stage = stages.find((pipelineStage: any) => pipelineStage.id === selectedStage.id);
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
                const stage = stages.find((pipelineStage: any) => pipelineStage.id === selectedStage.id);
                stage.alias = data;
                setJobPipeline(stages);
              } else {
                const stages = [...jobPipeline];
                const stage = stages.find((pipelineStage: any) => pipelineStage.id === selectedStage.id);
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
              const stage = stages.find((pipelineStage: any) => pipelineStage.id === selectedStage.id);
              const substage = stage.substages.find((pipelineSubstage: any) => pipelineSubstage.id === selectedSubstage.id);
              substage.name = data;
              substage.status = data;
              setJobPipeline(stages);
            }

            if (modalType === "delete-substage") {
              const stages = [...jobPipeline];
              const stage = stages.find((pipelineStage: any) => pipelineStage.id === selectedStage.id);
              stage.substages = stage.substages.filter((pipelineSubstage: any) => pipelineSubstage.id !== selectedSubstage.id);
              setJobPipeline(stages);
            }

            if (modalType === "restore-default") {
              setJobPipeline(cloneDefaultPipeline());
            }

            if (modalType === "disable-cv-screening") {
              const stages = jobPipeline.map((pipelineStage: any) =>
                pipelineStage.id === "1" ? { ...pipelineStage, enabled: false } : pipelineStage
              );
              setJobPipeline(stages);
            }

            setSelectedStage(null);
            setSelectedSubstage(null);
          }}
          selectedStage={selectedStage}
          selectedSubstage={selectedSubstage}
        />
      )}
    </div>
  );
}
