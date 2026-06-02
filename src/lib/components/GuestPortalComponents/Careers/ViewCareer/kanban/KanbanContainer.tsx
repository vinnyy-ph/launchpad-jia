"use client";

import React from "react";
import type { KanbanGroup, CandidateCard } from "./types";
import KanbanCard from "./KanbanCard";

function ColumnHeader({
  title,
  count,
  color,
  groupTitle,
}: {
  title: string;
  count: number;
  color: string;
  groupTitle: string;
}) {
  const showThunder = ["CV Screening", "Human Interview"].includes(groupTitle);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        fontSize: 16,
        fontWeight: 600,
        color: "#101828",
      }}
    >
      {showThunder && (
        <img
          src="/iconsV3/thunder-circle-green.svg"
          alt=""
          style={{ width: 24, height: 24, display: "block" }}
        />
      )}
      <span style={{ whiteSpace: "nowrap" }}>{title}</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 24,
          height: 22,
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
        {count}
      </span>
    </div>
  );
}

function GroupHeader({ title, droppedCount, totalCount }: { title: string; droppedCount: number; totalCount: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 8px",
        marginBottom: 8,
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#101828", whiteSpace: "nowrap", fontSize: 16 }}>{title}</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 24,
            height: 24,
            padding: "0 6px",
            borderRadius: 999,
            background: "#F8F9FC",
            border: "1px solid #D5D9EB",
            color: "#363F72",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {totalCount}
        </span>
      </div>
      <button
        type="button"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "#fff",
          border: "1px solid #EAECF0",
          borderRadius: 999,
          cursor: "pointer",
          color: "#344054",
          fontWeight: 550,
          fontSize: 14,
        }}
        aria-label="Dropped Candidates"
      >
        <img src="/iconsV3/user-x.svg" alt="" style={{ width: 18, height: 18, display: "block" }} />
        {droppedCount} Dropped Candidates
      </button>
    </div>
  );
}

export default function KanbanContainer({
  onViewAnalysis,
  data,
}: {
  onViewAnalysis?: (card: CandidateCard, context: { groupTitle: string; columnTitle: string }) => void;
  data: { groups: KanbanGroup[] };
}) {
  const groups = data.groups;
  const [openDropdownId, setOpenDropdownId] = React.useState<string | null>(null);


  const handleToggleDropdown = (cardId: string) => {
    setOpenDropdownId((prev) => (prev === cardId ? null : cardId));
  };

  const handleCloseDropdown = () => {
    setOpenDropdownId(null);
  };

  // Show empty state if no groups
  if (!groups || groups.length === 0) {
    return (
      <div style={{ 
        padding: "48px 24px", 
        textAlign: "center", 
        color: "#667085",
        background: "#F9FAFB",
        borderRadius: 12,
        border: "1px dashed #D0D5DD",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
      }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "#101828" }}>
          No pipeline stages configured
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 14 }}>
          This career doesn't have any pipeline stages set up yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 16, minWidth: 900, alignItems: "stretch", height: "100%" }}>
        {groups.map((group) => {
          const totalCount = group.columns.reduce((acc, col) => acc + col.cards.length, 0);
          return (
            <div
              key={group.id}
              style={{
                background: "#FFFFFF",
                border: "1px solid #EAECF0",
                borderRadius: 16,
                padding: 12,
                minWidth: group.columns.length === 1 ? 320 : "max-content",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <GroupHeader title={group.title} droppedCount={group.droppedCount} totalCount={totalCount} />
              <div style={{ display: "flex", gap: 12, alignItems: "stretch", flex: 1 }}>
                {group.columns.map((col) => (
                  <div
                    key={col.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      minWidth: 280,
                      background: "rgba(248, 249, 252, 1)",
                      borderRadius: 12,
                      padding: 12,
                      flex: 1,
                      minHeight: "400px",
                    }}
                  >
                    <ColumnHeader
                      title={col.title}
                      count={col.cards.length}
                      color={col.color}
                      groupTitle={group.title}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {col.cards.map((card) => (
                        <KanbanCard
                          key={card.id}
                          card={card}
                          isDropdownOpen={openDropdownId === card.id}
                          onToggleDropdown={() => handleToggleDropdown(card.id)}
                          onCloseDropdown={handleCloseDropdown}
                          onViewAnalysis={
                            onViewAnalysis
                              ? () =>
                                  onViewAnalysis(card, {
                                    groupTitle: group.title,
                                    columnTitle: col.title,
                                  })
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

