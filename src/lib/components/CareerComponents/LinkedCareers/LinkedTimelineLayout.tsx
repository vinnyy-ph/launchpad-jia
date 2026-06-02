"use client";
import React, { useState, useEffect, useRef } from "react";
import { useLinkedCareerTimeline } from "@/lib/hooks/useLinkedCareerTimeline";
import LinkedCareerExpander from "./LinkedCareerExpander";
import ChildSelectionModal from "./ChildSelectionModal";
import ExpandedBoardPanel from "./ExpandedBoardPanel";
import { EmailAutomation } from "../../features";
import { Button } from "@/lib/components/ui";
import linkedStyles from "./linked-careers.module.scss";

type BoardKey = "parent" | "child";

interface BoardContextData {
  timelineStages: any[];
  setCandidates: any;
  careerId: string | undefined;
  careerRouteId: string | undefined;
  orgID: string;
  jobPostType: string;
  parentCareerID: string | null;
  handlers: any;
}

interface LinkedTimelineLayoutProps {
  // Handler factory from page.tsx
  createCandidateHandlers: (config: {
    board: string;
    careerId: string;
    orgID: string;
    jobPostType: string;
    timelineStages: any[];
    setAndSortCandidates: any;
  }) => any;
  
  // Parent career data from page.tsx
  parentCareerID: string | null;
  parentTitle: string;
  orgID: string | null;
  mainCareerId: string;
  
  // Child careers list
  childCareers: any[];
  
  // Conditional rendering flags
  careerPostType: string;
  
  // Main board timeline stages (for email automation)
  mainTimelineStages: any[];
  
  // Center column component (CareerStageColumn for main board)
  centerColumn: (props: {
    activeDragBoardRef: React.MutableRefObject<string | null>;
    onEmailAutomationOpen: (board: "main" | "parent" | "child") => void;
  }) => React.ReactNode;
  
  // Callback handlers from page.tsx
  handleCandidateMenuOpen: (candidate: any, board: BoardKey) => void;
  handleCandidateCVOpen: (candidate: any) => void;
  handleDroppedCandidatesOpen: (stage: any, board: BoardKey) => void;
  handleCandidateHistoryOpen: (candidate: any) => void;
  handleRetakeInterview: (candidate: any, board: BoardKey) => void;
  handleInviteToJob: (candidate: any, board: BoardKey) => void;
  handleCrossBoardInvite: (
    candidate: any,
    targetCareer: any,
    sourceCareerId: string,
    targetStageId?: string,
    targetSubstageId?: string
  ) => void;
  canManageCandidates: boolean;
  activeDropdown: string | null;
  setActiveDropdown: (key: string | null) => void;
  
  // Board context ready callback to page.tsx
  onBoardContextsReady: (contexts: {
    parent: BoardContextData | null;
    child: BoardContextData | null;
  }) => void;
}

export default function LinkedTimelineLayout({
  createCandidateHandlers,
  parentCareerID,
  parentTitle,
  orgID,
  mainCareerId,
  childCareers,
  careerPostType,
  mainTimelineStages,
  centerColumn,
  handleCandidateMenuOpen,
  handleCandidateCVOpen,
  handleDroppedCandidatesOpen,
  handleCandidateHistoryOpen,
  handleRetakeInterview,
  handleInviteToJob,
  handleCrossBoardInvite,
  canManageCandidates,
  activeDropdown,
  setActiveDropdown,
  onBoardContextsReady,
}: LinkedTimelineLayoutProps) {
  // Timeline hooks
  const parentTimeline = useLinkedCareerTimeline();
  const childTimeline = useLinkedCareerTimeline();

  // Local state
  const [showChildModal, setShowChildModal] = useState<boolean>(false);
  const [emailAutomation, setEmailAutomation] = useState<
    "parent" | "child" | "main" | false
  >(false);

  // Shared drag ref across all boards
  const activeDragBoardRef = useRef<string | null>(null);

  // Create handlers for parent and child
  const parentHandlers = React.useMemo(() => {
    if (!parentTimeline.career) return null;
    return createCandidateHandlers({
      board: "parent",
      careerId: parentTimeline.career._id,
      orgID: parentTimeline.career.orgID,
      jobPostType: parentTimeline.career.jobPostType,
      timelineStages: parentTimeline.stages,
      setAndSortCandidates: parentTimeline.setStages,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parentTimeline.career,
    parentTimeline.stages,
    parentTimeline.setStages,
  ]);

  const childHandlers = React.useMemo(() => {
    if (!childTimeline.career) return null;
    return createCandidateHandlers({
      board: "child",
      careerId: childTimeline.career._id,
      orgID: childTimeline.career.orgID,
      jobPostType: childTimeline.career.jobPostType,
      timelineStages: childTimeline.stages,
      setAndSortCandidates: childTimeline.setStages,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    childTimeline.career,
    childTimeline.stages,
    childTimeline.setStages,
  ]);

  // Notify page.tsx when board contexts change
  useEffect(() => {
    onBoardContextsReady({
      parent:
        parentTimeline.career && parentHandlers
          ? {
              timelineStages: parentTimeline.stages,
              setCandidates: parentTimeline.setStages,
              careerId: parentTimeline.career._id?.toString(),
              careerRouteId:
                parentTimeline.career.id || parentTimeline.career._id?.toString(),
              orgID: parentTimeline.career.orgID,
              jobPostType: parentTimeline.career.jobPostType,
              parentCareerID: parentTimeline.career.parentCareerID || null,
              handlers: parentHandlers,
            }
          : null,
      child:
        childTimeline.career && childHandlers
          ? {
              timelineStages: childTimeline.stages,
              setCandidates: childTimeline.setStages,
              careerId: childTimeline.career._id?.toString(),
              careerRouteId:
                childTimeline.career.id || childTimeline.career._id?.toString(),
              orgID: childTimeline.career.orgID,
              jobPostType: childTimeline.career.jobPostType,
              parentCareerID: childTimeline.career.parentCareerID || null,
              handlers: childHandlers,
            }
          : null,
    });
  }, [
    parentTimeline.career,
    parentTimeline.stages,
    parentTimeline.setStages,
    parentHandlers,
    childTimeline.career,
    childTimeline.stages,
    childTimeline.setStages,
    childHandlers,
  ]);

  // Cleanup on unmount: reset contexts to null
  useEffect(() => {
    return () => {
      onBoardContextsReady({ parent: null, child: null });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: process stages for EmailAutomation component
  const processTimelineStages = (stages: any[]) =>
    stages.map((stage) => ({
      stage_id: stage.id,
      stage_name: stage.name,
      substages: stage.substages.map((substage: any) => ({
        substage_id: substage.id,
        substage_name: substage.name,
        automations: [],
      })),
    }));

  // Handler: child selection
  const handleSelectChild = (childId: string, _childTitle: string) => {
    if (orgID) {
      childTimeline.expand(childId, orgID);
    }
  };

  const isParentExpanded = careerPostType === "receiving_pool" && parentTimeline.isExpanded && parentTimeline.stages.length > 0;
  const isChildExpanded = careerPostType === "candidate_pool" && childTimeline.isExpanded && childTimeline.stages.length > 0;

  return (
    <div className="career-stage-layout">
      {/* Email Automation Header (shared across all boards) */}
      {emailAutomation && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 0" }}>
          <span style={{ fontWeight: 700, fontSize: 16, lineHeight: "24px" }}>Manage Email Automation</span>
          <Button
            icon="/icons/check.svg"
            label="Done"
            onClick={() => setEmailAutomation(false)}
          />
        </div>
      )}

      <div className="career-stage-container">
      {emailAutomation ? (
        <>
          {/* Parent automation stages */}
          {isParentExpanded && (
            <>
              <EmailAutomation
                embedded
                timelineStages={processTimelineStages(parentTimeline.stages)}
                setEmailAutomation={() => setEmailAutomation(false)}
                careerId={parentTimeline.career?.id || parentTimeline.career?._id?.toString()}
              />
              <div className={linkedStyles.separatorColumn}>
                <div className={linkedStyles.separatorLine} />
              </div>
            </>
          )}

          {/* Main automation stages */}
          <EmailAutomation
            embedded
            timelineStages={processTimelineStages(mainTimelineStages || [])}
            setEmailAutomation={() => setEmailAutomation(false)}
          />

          {/* Child automation stages */}
          {isChildExpanded && (
            <>
              <div className={linkedStyles.separatorColumn}>
                <div className={linkedStyles.separatorLine} />
              </div>
              <EmailAutomation
                embedded
                timelineStages={processTimelineStages(childTimeline.stages)}
                setEmailAutomation={() => setEmailAutomation(false)}
                careerId={childTimeline.career?.id || childTimeline.career?._id?.toString()}
              />
            </>
          )}
        </>
      ) : (
        <>
          {/* Parent Expander (collapsed state) */}
          {careerPostType === "receiving_pool" && !parentTimeline.isExpanded && (
            <LinkedCareerExpander
              direction="left"
              expanded={false}
              loading={parentTimeline.isLoading}
              onClick={() => {
                if (parentCareerID && orgID) {
                  parentTimeline.expand(parentCareerID, orgID);
                }
              }}
            />
          )}

          {/* Parent Expanded Board */}
          {isParentExpanded && parentHandlers && (
            <ExpandedBoardPanel
              direction="left"
              boardKey="parent"
              stages={parentTimeline.stages}
              handlers={parentHandlers}
              handleCandidateMenuOpen={handleCandidateMenuOpen}
              handleCandidateCVOpen={handleCandidateCVOpen}
              handleDroppedCandidatesOpen={handleDroppedCandidatesOpen}
              handleCandidateHistoryOpen={handleCandidateHistoryOpen}
              handleRetakeInterview={handleRetakeInterview}
              handleInviteToJob={handleInviteToJob}
              canManageCandidates={canManageCandidates}
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
              onEmailAutomationOpen={(boardKey) => setEmailAutomation(boardKey)}
              activeDragBoardRef={activeDragBoardRef}
            />
          )}

          {/* Parent Expander (expanded state) */}
          {isParentExpanded && (
            <div className={linkedStyles.separatorColumn}>
              <LinkedCareerExpander
                direction="left"
                expanded={true}
                onClick={() => parentTimeline.collapse()}
              />
              <div className={linkedStyles.separatorLine} />
            </div>
          )}

          {/* Center Column (Main Board) */}
          {centerColumn({ activeDragBoardRef, onEmailAutomationOpen: setEmailAutomation })}

          {/* Child Expander (expanded state) */}
          {isChildExpanded && (
            <div className={linkedStyles.separatorColumn}>
              <LinkedCareerExpander
                direction="right"
                expanded={true}
                onClick={() => childTimeline.collapse()}
                childTitle={childTimeline.career?.childTitle}
              />
              <div className={linkedStyles.separatorLine} />
            </div>
          )}

          {/* Child Expanded Board */}
          {isChildExpanded && childHandlers && (
            <ExpandedBoardPanel
              direction="right"
              boardKey="child"
              stages={childTimeline.stages}
              handlers={childHandlers}
              handleCandidateMenuOpen={handleCandidateMenuOpen}
              handleCandidateCVOpen={handleCandidateCVOpen}
              handleDroppedCandidatesOpen={handleDroppedCandidatesOpen}
              handleCandidateHistoryOpen={handleCandidateHistoryOpen}
              handleRetakeInterview={handleRetakeInterview}
              handleInviteToJob={handleInviteToJob}
              canManageCandidates={canManageCandidates}
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
              onEmailAutomationOpen={(boardKey) => setEmailAutomation(boardKey)}
              activeDragBoardRef={activeDragBoardRef}
              onCrossBoardDrop={(candidateId, srcStage, srcSubstage, tgtStageName, tgtSubstageName) => {
                const candidate = mainTimelineStages
                  ?.flatMap((s: any) => s.substages?.flatMap((sub: any) =>
                    sub.candidates?.map((c: any) => ({ ...c, stage: s.name, substage: sub.name }))
                  ))
                  ?.find((c: any) => c?._id === candidateId);
                if (!candidate) return;

                const tgtStage = childTimeline.stages.find((s: any) => s.name === tgtStageName);
                const tgtSubstage = tgtStage?.substages?.find((sub: any) => sub.name === tgtSubstageName);

                handleCrossBoardInvite(
                  candidate,
                  childTimeline.career,
                  mainCareerId,
                  tgtStage?.id,
                  tgtSubstage?.id,
                );
              }}
            />
          )}

          {/* Child Expander (collapsed state) */}
          {careerPostType === "candidate_pool" && !childTimeline.isExpanded && (
            <LinkedCareerExpander
              direction="right"
              expanded={false}
              loading={childTimeline.isLoading}
              onClick={() => setShowChildModal(true)}
            />
          )}
        </>
      )}
      </div>

      {/* Child Selection Modal */}
      <ChildSelectionModal
        open={showChildModal}
        onClose={() => setShowChildModal(false)}
        parentTitle={parentTitle}
        childCareers={childCareers}
        onSelectChild={handleSelectChild}
      />
    </div>
  );
}
