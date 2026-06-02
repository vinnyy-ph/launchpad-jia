"use client";
import React from "react";
import Button from "../../ui/button/Button";
import CandidateCard from "../CandidateCard";
import linkedStyles from "./linked-careers.module.scss";

type BoardKey = "parent" | "child";

interface CandidateHandlers {
  handleEndorseCandidate: (candidate: any) => void;
  handleDropCandidate: (candidate: any) => void;
  dragEndorsedCandidate: (
    candidateId: string,
    fromStage: string,
    fromSubstage: string,
    toStage: string,
    toSubstage: string
  ) => void;
}

interface ExpandedBoardPanelProps {
  direction: "left" | "right";
  boardKey: BoardKey;
  stages: any[];
  handlers: CandidateHandlers;
  handleCandidateMenuOpen: (candidate: any, board: BoardKey) => void;
  handleCandidateCVOpen: (candidate: any) => void;
  handleDroppedCandidatesOpen: (stage: any, board: BoardKey) => void;
  handleCandidateHistoryOpen: (candidate: any) => void;
  handleRetakeInterview: (candidate: any, board: BoardKey) => void;
  handleInviteToJob: (candidate: any, board: BoardKey) => void;
  canManageCandidates: boolean;
  activeDropdown: string | null;
  setActiveDropdown: (key: string | null) => void;
  onEmailAutomationOpen: (boardKey: BoardKey) => void;
  activeDragBoardRef: React.MutableRefObject<string | null>;
  onCrossBoardDrop?: (candidateId: string, sourceStage: string, sourceSubstage: string, targetStage: string, targetSubstage: string) => void;
}

export default function ExpandedBoardPanel({
  boardKey,
  stages,
  handlers,
  handleCandidateMenuOpen,
  handleCandidateCVOpen,
  handleDroppedCandidatesOpen,
  handleCandidateHistoryOpen,
  handleRetakeInterview,
  handleInviteToJob,
  canManageCandidates,
  activeDropdown,
  setActiveDropdown,
  onEmailAutomationOpen,
  activeDragBoardRef,
  onCrossBoardDrop,
}: ExpandedBoardPanelProps) {
  if (!stages || stages.length === 0) {
    return null;
  }

  return (
    <>
      {stages.map((stage: any, idx: number) => (
        <div
          className={`career-stage-column ${linkedStyles.expandedStageColumn}`}
          key={`${boardKey}-${idx}`}
        >
          <div className="career-stage-header">
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1E1F3B",
                  textWrap: "nowrap",
                }}
              >
                {stage.alias || stage.name}
              </span>
              {/* Count */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#F8F9FC",
                  border: "1px solid #D5D9EB",
                }}
              >
                <span style={{ fontSize: 12, color: "#363F72", fontWeight: 700 }}>
                  {stage.substages?.reduce(
                    (acc: number, sub: any) => acc + (sub?.candidates?.length || 0),
                    0
                  )}
                </span>
              </div>
            </div>
            <Button
              variant="secondary"
              label={`${
                stage.droppedCandidates?.length || 0
              } Dropped Candidates`}
              icon="/user-times.svg"
              onClick={() => handleDroppedCandidatesOpen(stage, boardKey)}
            />
          </div>
          {stage.substages?.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 10,
                height: "100%",
              }}
            >
              {stage.substages.map((substage: any, subIdx: number) => (
                <div
                  key={subIdx}
                  className="career-substage-container"
                  onDragStartCapture={() => {
                    activeDragBoardRef.current = boardKey;
                  }}
                  onDragOver={(e) => {
                    const isSameBoard = activeDragBoardRef.current === boardKey;
                    const isCrossBoardDrop = activeDragBoardRef.current !== boardKey && !!onCrossBoardDrop;
                    if (!isSameBoard && !isCrossBoardDrop) return;
                    e.preventDefault();
                    const target = e.currentTarget;

                    const bounding = target.getBoundingClientRect();
                    const offset = bounding.y + bounding.height / 2;

                    if (e.clientY - offset > 0) {
                      target.style.borderBottom = "3px solid #6941C6";
                      target.style.borderTop = "none";
                    } else {
                      target.style.borderTop = "3px solid #6941C6";
                      target.style.borderBottom = "none";
                    }
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.borderTop = "none";
                    e.currentTarget.style.borderBottom = "none";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderTop = "none";
                    e.currentTarget.style.borderBottom = "none";

                    const boardId = e.dataTransfer.getData("boardId");
                    const candidateId =
                      e.dataTransfer.getData("candidateId");
                    const originStageKey =
                      e.dataTransfer.getData("stageKey");
                    const originSubstageKey =
                      e.dataTransfer.getData("substageKey");

                    if (boardId !== boardKey) {
                      if (onCrossBoardDrop && candidateId) {
                        onCrossBoardDrop(candidateId, originStageKey, originSubstageKey, stage.name, substage.name);
                      }
                      return;
                    }

                    if (
                      originSubstageKey === substage.name &&
                      stage.name === originStageKey
                    ) {
                      return;
                    }
                    if (
                      candidateId &&
                      originStageKey &&
                      originSubstageKey
                    ) {
                      handlers.dragEndorsedCandidate(
                        candidateId,
                        originStageKey,
                        originSubstageKey,
                        stage.name,
                        substage.name
                      );
                    }
                  }}
                >
                  <div className="career-substage-header">
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {substage?.candidates?.length > 0 && (
                        <div
                          style={{
                            borderRadius: "50%",
                            height: 28,
                            width: 28,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#D1FADF",
                            padding: 4,
                            border: "none",
                          }}
                        >
                          <i className="la la-bolt" style={{ fontSize: 16, color: "#027948" }}></i>
                        </div>
                      )}
                      <span>{substage.name}</span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#F8F9FC",
                          border: "1px solid #D5D9EB",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#363F72", fontWeight: 700 }}>
                          {substage?.candidates?.length || 0}
                        </span>
                      </div>
                      <div
                        style={{
                          position: "relative",
                          margin: "0 0 0 auto",
                        }}
                      >
                        <img
                          alt=""
                          style={{
                            cursor: "pointer",
                            transform: "rotate(0deg)",
                          }}
                          className="safe-dropdown-toggle"
                          src="/icons/ellipsis.svg"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dropdownKey = `${boardKey}-stage-${stage.name}-${substage.name}`;
                            if (activeDropdown === dropdownKey) {
                              setActiveDropdown(null);
                            } else {
                              setActiveDropdown(dropdownKey);
                            }
                          }}
                        />

                        {activeDropdown === `${boardKey}-stage-${stage.name}-${substage.name}` && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              right: 0,
                              marginTop: 8,
                              backgroundColor: "#FFFFFF",
                              borderRadius: 8,
                              boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                              minWidth: 200,
                              zIndex: 1000,
                              overflow: "hidden",
                            }}
                            className="safe-dropdown-menu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Stage Menu Header */}
                            <div
                              style={{
                                paddingTop: 16,
                                paddingLeft: 16,
                                paddingRight: 16,
                                paddingBottom: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: "#1E1F3B",
                                }}
                              >
                                Stage Menu
                              </span>
                            </div>

                            {/* Separator */}
                            <div
                              style={{
                                height: 1,
                                backgroundColor: "#E0E2EE",
                                marginLeft: 12,
                                marginRight: 12,
                              }}
                            />

                            {/* OPTIONS Label */}
                            <div
                              style={{
                                paddingTop: 12,
                                paddingLeft: 16,
                                paddingRight: 16,
                                paddingBottom: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: "#787486",
                                  textTransform: "uppercase",
                                }}
                              >
                                OPTIONS
                              </span>
                            </div>

                            {/* Email Automations Menu Item */}
                            <div
                              onClick={() => {
                                onEmailAutomationOpen(boardKey);
                                setActiveDropdown(null);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 16px",
                                cursor: "pointer",
                              }}
                            >
                              <img
                                src="/icons/zap.svg"
                                alt=""
                                style={{
                                  width: 16,
                                  height: 16,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: 14,
                                  fontWeight: 400,
                                  color: "#1E1F3B",
                                }}
                              >
                                Email Automations
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {substage?.candidates?.length > 0 ? (
                    substage.candidates.map((c: any, cIdx: number) => (
                      <CandidateCard
                        key={cIdx}
                        candidate={c}
                        stage={stage.name}
                        substage={substage.name}
                        handleCandidateMenuOpen={(candidate: any) =>
                          handleCandidateMenuOpen(candidate, boardKey)
                        }
                        handleCandidateCVOpen={handleCandidateCVOpen}
                        handleEndorseCandidate={handlers.handleEndorseCandidate}
                        handleDropCandidate={handlers.handleDropCandidate}
                        handleCandidateHistoryOpen={handleCandidateHistoryOpen}
                        handleRetakeInterview={(candidate: any) =>
                          handleRetakeInterview(candidate, boardKey)
                        }
                        handleInviteToJob={(candidate: any) =>
                          handleInviteToJob(candidate, boardKey)
                        }
                        canManageCandidates={canManageCandidates}
                        activeDropdown={activeDropdown}
                        setActiveDropdown={setActiveDropdown}
                        boardId={boardKey}
                      />
                    ))
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        width: "100%",
                        height: "100%",
                        alignItems: "flex-start",
                        padding: "50px 0",
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 500, color: "#787486" }}>
                        Currently no candidates in this stage
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
