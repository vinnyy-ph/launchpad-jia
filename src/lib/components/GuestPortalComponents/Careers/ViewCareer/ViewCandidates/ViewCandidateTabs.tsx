"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { Label } from "@/lib/components/GuestPortalComponents/label";

export type PipelineStage = {
  id: string;
  name: string;
  alias?: string;
  icon?: string;
  type?: string;
  enabled?: boolean;
  substages?: Array<{
    id: string;
    name: string;
    currentStep: string;
    status: string;
  }>;
};

// Tab key can be stage IDs or "comments"
export type CandidateTabKey = string;

type Props = {
  active: CandidateTabKey;
  onChange: (tab: CandidateTabKey) => void;
  stageEvaluations?: Record<string, string | undefined>; // stageId -> matchFit label
  commentsCount?: number;
  pipelineStages?: PipelineStage[];
};

// Icons for known stage names
const CvIcon = () => (
  <Image src="/iconsV3/cv-screening.svg" alt="CV screening" width={16} height={19} />
);

const MicIcon = () => (
  <Image src="/iconsV3/mic.svg" alt="AI interview" width={14} height={20} />
);

const UserIcon = () => (
  <Image src="/iconsV3/human-interview.svg" alt="Human interview" width={20} height={14} />
);

const JobOfferIcon = () => (
  <i className="la la-handshake" style={{ fontSize: 18 }} />
);

const DefaultStageIcon = ({ icon }: { icon?: string }) => (
  <i className={icon || "la la-clipboard-list"} style={{ fontSize: 18 }} />
);

// Get icon component for a stage based on its name or icon property
function getStageIcon(stage: PipelineStage): React.ReactNode {
  const stageName = stage.name.toLowerCase();
  
  if (stageName.includes("cv") && stageName.includes("screening")) {
    return <CvIcon />;
  }
  if (stageName.includes("ai") && stageName.includes("interview")) {
    return <MicIcon />;
  }
  if (stageName.includes("human") && stageName.includes("interview")) {
    return <UserIcon />;
  }
  if (stageName.includes("job") && stageName.includes("offer")) {
    return <JobOfferIcon />;
  }
  
  return <DefaultStageIcon icon={stage.icon} />;
}

type TabProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  statusLabel?: string;
  statusVariant?: "blue" | "green";
  commentsCount?: number;
};

function Tab({ label, active, onClick, icon, statusLabel, statusVariant, commentsCount }: TabProps) {
  const statusStyles =
    statusVariant === "green"
      ? { bg: "#ECFDF3", border: "#A6F4C5", color: "#027948" }
      : { bg: "#EFF8FF", border: "#B2DDFF", color: "#175CD3" };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: active ? "#101828" : "#667085",
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {icon}
      <span>{label}</span>
      {statusLabel && (
        <Label
          bgColor={statusStyles.bg}
          strokeColor={statusStyles.border}
          textColor={statusStyles.color}
          style={{ fontSize: 11, fontWeight: 600 }}
        >
          {statusLabel}
        </Label>
      )}
      {typeof commentsCount === "number" && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            borderRadius: 999,
            background: "#F8F9FC",
            border: "1px solid #D5D9EB",
            color: "#363F72",
            fontSize: 12,
            fontWeight: 550,
            lineHeight: 1,
          }}
        >
          {commentsCount}
        </span>
      )}
      {active && (
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -1,
            height: 2,
            borderRadius: 999,
            backgroundImage:
              "linear-gradient(270deg, #9fcaed -0.44%, #ceb6da 32.7%, #ebacc9 65.85%, #fccec0 100%)",
          }}
        />
      )}
    </button>
  );
}

// Helper to get status label and variant based on matchFit value
function getStatusVariant(matchFit: string | undefined): "blue" | "green" {
  if (!matchFit) return "blue";
  const lower = matchFit.toLowerCase();
  // Green for positive evaluations
  if (lower.includes("strong") || lower.includes("good")) {
    return "green";
  }
  // Blue for neutral/other evaluations
  return "blue";
}

// Helper to get status label and variant for a stage
function getStageStatusProps(
  stage: PipelineStage,
  stageEvaluations?: Record<string, string | undefined>
): { statusLabel?: string; statusVariant?: "blue" | "green" } {
  const matchFit = stageEvaluations?.[stage.id];
  if (!matchFit) return {};
  
  return {
    statusLabel: matchFit,
    statusVariant: getStatusVariant(matchFit),
  };
}

export default function ViewCandidateTabs({
  active,
  onChange,
  stageEvaluations,
  commentsCount,
  pipelineStages = [],
}: Props) {
  // Filter out disabled stages and Job Offer stage from tabs
  // BUT always keep core stages (CV Screening, AI Interview) for inherited data display
  const visibleStages = useMemo(() => {
    return pipelineStages.filter((stage) => {
      // Always show core stages (id "1" = CV Screening, id "2" = AI Interview)
      // because they contain inherited/transferred data that should be displayed
      if (stage.id === "1" || stage.id === "2") {
        // Still filter out Job Offer check for these
        const name = stage.name.toLowerCase();
        return !(name.includes("job") && name.includes("offer"));
      }
      // For other stages, filter out disabled ones
      if (stage.enabled === false) return false;
      // Also filter out Job Offer stage (it's typically an end state, not a review tab)
      const name = stage.name.toLowerCase();
      return !(name.includes("job") && name.includes("offer"));
    });
  }, [pipelineStages]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        borderBottom: "1px solid #EAECF0",
        marginTop: 8,
      }}
    >
      {/* Dynamic Stage Tabs */}
      {visibleStages.map((stage) => {
        const { statusLabel, statusVariant } = getStageStatusProps(stage, stageEvaluations);
        
        return (
          <Tab
            key={stage.id}
            label={stage.alias || stage.name}
            active={active === stage.id}
            onClick={() => onChange(stage.id)}
            icon={getStageIcon(stage)}
            statusLabel={statusLabel}
            statusVariant={statusVariant}
          />
        );
      })}

      {/* Comments Tab (always last) */}
      <Tab
        label="Comments"
        active={active === "comments"}
        onClick={() => onChange("comments")}
        commentsCount={commentsCount}
      />
    </div>
  );
}
