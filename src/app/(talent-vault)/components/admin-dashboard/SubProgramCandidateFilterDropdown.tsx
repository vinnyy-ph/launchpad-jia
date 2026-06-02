"use client";

import React, { useState, useRef, useEffect } from "react";
import { type CandidateStatus } from "./SubProgramCandidate";

const CANDIDATE_STATUS_OPTIONS: {
  value: CandidateStatus;
  label: string;
  backgroundColor: string;
  color: string;
  dotColor: string;
}[] = [
  {
    value: "active",
    label: "Active",
    backgroundColor: "#ECFDF3",
    color: "#067647",
    dotColor: "#067647",
  },
  {
    value: "inactive",
    label: "Inactive",
    backgroundColor: "#F2F4F7",
    color: "#344054",
    dotColor: "#344054",
  },
];

type SubProgramCandidateFilterDropdownProps = {
  selectedStatuses: CandidateStatus[];
  onChangeStatuses: (statuses: CandidateStatus[]) => void;
};

export default function SubProgramCandidateFilterDropdown({
  selectedStatuses,
  onChangeStatuses,
}: SubProgramCandidateFilterDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filterCount = selectedStatuses.length;

  return (
    <div ref={dropdownRef} className="dropdown">
      <div
        className="button-v2 secondary"
        style={{
          minWidth: "180px",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          flexDirection: "row",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
        }}
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        <img src="/iconsV3/filter.svg" alt="Filter" style={{ width: 16, height: 16 }} />
        <span>
          Filters{filterCount > 0 ? ` (${filterCount})` : ""}
        </span>
        <img
          src="/iconsV3/chevron-down.svg"
          alt="Chevron down"
          style={{ width: 12, height: 7 }}
        />
      </div>

      {dropdownOpen && (
        <div
          className={`dropdown-menu dropdown-menu-right mt-1 org-dropdown-anim show`}
        >
          <StatusFilterSubmenu
            selectedStatuses={selectedStatuses}
            onChangeStatuses={onChangeStatuses}
          />
        </div>
      )}
    </div>
  );
}

function StatusFilterSubmenu({
  selectedStatuses,
  onChangeStatuses,
}: {
  selectedStatuses: CandidateStatus[];
  onChangeStatuses: (statuses: CandidateStatus[]) => void;
}) {
  const [submenuOpen, setSubmenuOpen] = useState(false);

  return (
    <div
      className="dropdown-item"
      onMouseOver={() => setSubmenuOpen(true)}
      onMouseOut={() => setSubmenuOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="dropdown" style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>
            By status{selectedStatuses.length > 0 ? ` (${selectedStatuses.length})` : ""}
          </span>
          <i className="la la-angle-right" style={{ fontSize: 16, color: "#787486" }} />
        </div>
        {submenuOpen && (
          <div
            className="dropdown-menu mt-1 org-dropdown-anim show"
            style={{
              left: "110%",
              right: "auto",
              top: "-20px",
              maxHeight: "279px",
              overflowY: "auto",
              width: "248px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0px 10px",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>
                Filter by status
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#717680",
                  cursor: "pointer",
                }}
                onClick={() => onChangeStatuses([])}
              >
                Clear
              </span>
            </div>
            <div className="dropdown-divider" />
            <div className="dropdown-item" onClick={() => {}}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#717680", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Application Status
              </span>
            </div>
            {CANDIDATE_STATUS_OPTIONS.map((option) => (
              <div
                className="dropdown-item"
                key={option.value}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  if (selectedStatuses.includes(option.value)) {
                    onChangeStatuses(selectedStatuses.filter((s) => s !== option.value));
                  } else {
                    onChangeStatuses([...selectedStatuses, option.value]);
                  }
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: "0px",
                    }}
                  >
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={selectedStatuses.includes(option.value)}
                      onChange={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#414651",
                        marginLeft: 10,
                      }}
                    >
                      {option.label}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 500,
                      backgroundColor: option.backgroundColor,
                      color: option.color,
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: option.dotColor,
                      }}
                    />
                    {option.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
