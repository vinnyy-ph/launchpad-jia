import React, { useMemo } from "react";
import Button from "../ui/button/Button";
import CandidateCard from "./CandidateCard";
import { EmailAutomationV2 as EmailAutomation } from "../features";

export default function CareerStageColumn({
  careerName,
  careerId,
  emailAutomation,
  setEmailAutomation,
  timelineStages,
  invitedCandidates = [],
  handleCandidateMenuOpen,
  handleCandidateCVOpen,
  handleDroppedCandidatesOpen,
  handleEndorseCandidate,
  handleDropCandidate,
  dragEndorsedCandidate,
  handleCandidateHistoryOpen,
  handleRetakeInterview,
  handleInviteToJob,
  canManageCandidates = true,
  activeDropdown,
  setActiveDropdown,
  activeDragBoardRef,
  onCrossBoardDrop,
}: any) {
  // const [dropdownOpen, setDropdownOpen] = useState<Record<string, boolean>>({});

  const processedTimelineStages = useMemo(() => [
    {
      stage_id: "invited",
      stage_name: "Invited",
      substages: [
        {
          substage_id: "invited",
          substage_name: "Invited",
          automations: [],
        },
      ],
    },
    ...timelineStages.map((stage) => {
      return {
        stage_id: stage.id,
        stage_name: stage.name,
        substages: stage.substages.map((substage) => {
          return {
            substage_id: substage.id,
            substage_name: substage.name,
            automations: [],
          };
        }),
      };
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [JSON.stringify(timelineStages)]);

  if (emailAutomation) {
    return (
      <div style={{ minWidth: 0, overflow: "hidden", width: "100%" }}>
        <EmailAutomation
          careerName={careerName}
          careerId={careerId}
          timelineStages={processedTimelineStages}
          setEmailAutomation={setEmailAutomation}
        />
      </div>
    );
  }

  const stageColumns = (
    <>
      {/* Invited column - only visible when there are invited candidates */}
      {invitedCandidates?.length > 0 && (
        <div className="career-stage-column">
          <div className="career-stage-header">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "9px 0",
                width: "100%",
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1E1F3B",
                  textWrap: "nowrap",
                }}
              >
                Invited
              </span>
              {/* Count in a circle */}
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
                <span
                  style={{ fontSize: 12, color: "#363F72", fontWeight: 700 }}
                >
                  {invitedCandidates?.length || 0}
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
                    const dropdownKey = "stage-Invited-Invited";
                    if (activeDropdown === dropdownKey) {
                      setActiveDropdown(null);
                    } else {
                      setActiveDropdown(dropdownKey);
                    }
                  }}
                />

                {activeDropdown === "stage-Invited-Invited" && (
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
                        setEmailAutomation(true);
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
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 10,
              height: "100%",
            }}
          >
            <div className="career-substage-container">
              {invitedCandidates.map((c: any, idx: number) => (
                <CandidateCard
                  key={idx}
                  candidate={c}
                  stage="Invited"
                  substage="Invited"
                  simplified={true}
                  handleCandidateMenuOpen={handleCandidateMenuOpen}
                  handleCandidateCVOpen={handleCandidateCVOpen}
                  handleEndorseCandidate={handleEndorseCandidate}
                  handleDropCandidate={handleDropCandidate}
                  handleCandidateHistoryOpen={handleCandidateHistoryOpen}
                  handleRetakeInterview={handleRetakeInterview}
                  handleInviteToJob={handleInviteToJob}
                  canManageCandidates={canManageCandidates}
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {timelineStages.map(
        (
          stage: {
            name: string;
            alias?: string;
            substages: any[];
            droppedCandidates: any[];
          },
          idx: number,
        ) => (
          <div className="career-stage-column" key={idx}>
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
                {/* Count in a circle */}
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
                  <span
                    style={{ fontSize: 12, color: "#363F72", fontWeight: 700 }}
                  >
                    {timelineStages?.[idx]?.substages.reduce(
                      (acc: number, substage: any) =>
                        acc + substage?.candidates?.length,
                      0,
                    ) || 0}
                  </span>
                </div>
              </div>
              <Button
                variant="secondary"
                label={`${
                  timelineStages[idx]?.droppedCandidates?.length || 0
                } Dropped Candidates`}
                icon="/user-times.svg"
                onClick={() => handleDroppedCandidatesOpen(stage)}
              />
            </div>
            {timelineStages[idx]?.substages?.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: 10,
                  height: "100%",
                }}
              >
                {timelineStages[idx]?.substages.map(
                  (substage: any, idx: number) => (
                    <div
                      key={idx}
                      className="career-substage-container"
                      onDragStartCapture={() => {
                        if (activeDragBoardRef) activeDragBoardRef.current = "main";
                      }}
                      onDragOver={(e) => {
                        if (activeDragBoardRef) {
                          const isSameBoard = activeDragBoardRef.current === "main";
                          const isCrossBoardDrop = activeDragBoardRef.current !== "main" && !!onCrossBoardDrop;
                          if (!isSameBoard && !isCrossBoardDrop) return;
                        }
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

                        const boardId =
                          e.dataTransfer.getData("boardId");
                        const candidateId =
                          e.dataTransfer.getData("candidateId");
                        const originStageKey =
                          e.dataTransfer.getData("stageKey");
                        const originSubstageKey =
                          e.dataTransfer.getData("substageKey");

                        // Cross-board drop: candidate from expanded board → main board
                        if (boardId && boardId !== "main") {
                          if (onCrossBoardDrop && candidateId) {
                            onCrossBoardDrop(candidateId, originStageKey, originSubstageKey, stage.name, substage.name, boardId);
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
                          dragEndorsedCandidate(
                            candidateId,
                            originStageKey,
                            originSubstageKey,
                            stage.name,
                            substage.name,
                          );
                        }
                      }}
                    >
                      <div className="career-substage-header">
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
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
                              <i
                                className="la la-bolt"
                                style={{ fontSize: 16, color: "#027948" }}
                              ></i>
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
                            <span
                              style={{
                                fontSize: 12,
                                color: "#363F72",
                                fontWeight: 700,
                              }}
                            >
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
                                e.stopPropagation(); // Stop propagation to prevent immediate close by document listener
                                const dropdownKey = `stage-${stage.name}-${substage.name}`;
                                if (activeDropdown === dropdownKey) {
                                  setActiveDropdown(null);
                                } else {
                                  setActiveDropdown(dropdownKey);
                                }
                              }}
                            />

                            {activeDropdown ===
                              `stage-${stage.name}-${substage.name}` && (
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
                                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside menu
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
                                    setEmailAutomation(true);
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
                        substage?.candidates.map((c: any, idx: number) => (
                          <CandidateCard
                            key={idx}
                            candidate={c}
                            stage={stage.name}
                            substage={substage.name}
                            handleCandidateMenuOpen={handleCandidateMenuOpen}
                            handleCandidateCVOpen={handleCandidateCVOpen}
                            handleEndorseCandidate={handleEndorseCandidate}
                            handleDropCandidate={handleDropCandidate}
                            handleCandidateHistoryOpen={
                              handleCandidateHistoryOpen
                            }
                            handleRetakeInterview={handleRetakeInterview}
                            handleInviteToJob={handleInviteToJob}
                            canManageCandidates={canManageCandidates}
                            activeDropdown={activeDropdown}
                            setActiveDropdown={setActiveDropdown}
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
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 500,
                              color: "#787486",
                            }}
                          >
                            Currently no candidates in this stage
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        ),
      )}
    </>
  );

  return (
    <div className="career-stage-container">
      {stageColumns}
    </div>
  );
}
