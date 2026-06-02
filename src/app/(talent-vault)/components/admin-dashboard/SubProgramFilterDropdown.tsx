"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  TALENT_VAULT_ROLE_TYPES,
  TALENT_VAULT_ROLE_TYPE_TOKENS,
  type TalentVaultRoleType,
} from "./roleTypePresentation";

/* ── Status options (Published + Activity) ─────────────────────────── */

type StatusCategory = "Published Status" | "Activity Status";

interface StatusOption {
  value: string;
  label: string;
  icon: string;
  backgroundColor: string;
  border: string;
}

const STATUS_CATEGORIES: {
  label: StatusCategory;
  options: StatusOption[];
}[] = [
  {
    label: "Published Status",
    options: [
      {
        value: "active",
        label: "Published",
        icon: "/careers/published.svg",
        backgroundColor: "#ECFDF3",
        border: "1px solid #ABEFC6",
      },
      {
        value: "inactive",
        label: "Unpublished",
        icon: "/careers/unpublished.svg",
        backgroundColor: "#FEF3F2",
        border: "1px solid #FECDCA",
      },
    ],
  },
  {
    label: "Activity Status",
    options: [
      {
        value: "Active",
        label: "Active",
        icon: "/careers/active.svg",
        backgroundColor: "#ECFDF3",
        border: "1px solid #ABEFC6",
      },
      {
        value: "Inactive",
        label: "Inactive",
        icon: "/careers/inactive.svg",
        backgroundColor: "#FEF3F2",
        border: "1px solid #FECDCA",
      },
    ],
  },
];

/* ── Filter state shape ────────────────────────────────────────────── */

export interface SubProgramFilterState {
  roleTypes: TalentVaultRoleType[];
  "Published Status": string[];
  "Activity Status": string[];
}

export const EMPTY_SUBPROGRAM_FILTERS: SubProgramFilterState = {
  roleTypes: [],
  "Published Status": [],
  "Activity Status": [],
};

export function getSubProgramFilterCount(filters: SubProgramFilterState) {
  let count = filters.roleTypes.length;
  if (filters["Published Status"].length > 0) count += 1;
  if (filters["Activity Status"].length > 0) count += 1;
  return count;
}

/* ── Main dropdown ─────────────────────────────────────────────────── */

type SubProgramFilterDropdownProps = {
  filters: SubProgramFilterState;
  onChangeFilters: (filters: SubProgramFilterState) => void;
};

export default function SubProgramFilterDropdown({
  filters,
  onChangeFilters,
}: SubProgramFilterDropdownProps) {
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

  const totalCount = getSubProgramFilterCount(filters);

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
        <span>Filters{totalCount > 0 ? ` (${totalCount})` : ""}</span>
        <img
          src="/iconsV3/chevron-down.svg"
          alt="Chevron down"
          style={{ width: 12, height: 7 }}
        />
      </div>

      {dropdownOpen && (
        <div className="dropdown-menu dropdown-menu-right mt-1 org-dropdown-anim show">
          <RoleTypeFilterSubmenu filters={filters} onChangeFilters={onChangeFilters} />
          <StatusFilterSubmenu filters={filters} onChangeFilters={onChangeFilters} />
        </div>
      )}
    </div>
  );
}

/* ── Role type submenu ─────────────────────────────────────────────── */

function RoleTypeFilterSubmenu({
  filters,
  onChangeFilters,
}: {
  filters: SubProgramFilterState;
  onChangeFilters: (f: SubProgramFilterState) => void;
}) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const selected = filters.roleTypes;

  return (
    <div
      className="dropdown-item"
      onMouseOver={() => setSubmenuOpen(true)}
      onMouseOut={() => setSubmenuOpen(false)}
      onClick={(e) => e.stopPropagation()}
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
            By role type{selected.length > 0 ? ` (${selected.length})` : ""}
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
                Filter by role type
              </span>
              <span
                style={{ fontSize: 14, fontWeight: 700, color: "#717680", cursor: "pointer" }}
                onClick={() => onChangeFilters({ ...filters, roleTypes: [] })}
              >
                Clear
              </span>
            </div>
            <div className="dropdown-divider" />

            {TALENT_VAULT_ROLE_TYPES.map((rt) => {
              const tokens = TALENT_VAULT_ROLE_TYPE_TOKENS[rt];
              return (
                <div
                  className="dropdown-item"
                  key={rt}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    if (selected.includes(rt)) {
                      onChangeFilters({
                        ...filters,
                        roleTypes: selected.filter((r) => r !== rt),
                      });
                    } else {
                      onChangeFilters({
                        ...filters,
                        roleTypes: [...selected, rt],
                      });
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
                        gap: "0px",
                      }}
                    >
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={selected.includes(rt)}
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
                        {rt}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 8px",
                        borderRadius: "16px",
                        fontSize: "11px",
                        fontWeight: 500,
                        backgroundColor: tokens.backgroundColor,
                        color: tokens.textColor,
                        border: `1px solid ${tokens.borderColor}`,
                      }}
                    >
                      {rt}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Status submenu ────────────────────────────────────────────────── */

function StatusFilterSubmenu({
  filters,
  onChangeFilters,
}: {
  filters: SubProgramFilterState;
  onChangeFilters: (f: SubProgramFilterState) => void;
}) {
  const [submenuOpen, setSubmenuOpen] = useState(false);

  const statusCount =
    (filters["Published Status"].length > 0 ? 1 : 0) +
    (filters["Activity Status"].length > 0 ? 1 : 0);

  return (
    <div
      className="dropdown-item"
      onMouseOver={() => setSubmenuOpen(true)}
      onMouseOut={() => setSubmenuOpen(false)}
      onClick={(e) => e.stopPropagation()}
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
            By status{statusCount > 0 ? ` (${statusCount})` : ""}
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
              maxHeight: "320px",
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
                style={{ fontSize: 14, fontWeight: 700, color: "#717680", cursor: "pointer" }}
                onClick={() =>
                  onChangeFilters({
                    ...filters,
                    "Published Status": [],
                    "Activity Status": [],
                  })
                }
              >
                Clear
              </span>
            </div>
            <div className="dropdown-divider" />

            {STATUS_CATEGORIES.map((category) => (
              <div key={category.label}>
                <div className="dropdown-item" onClick={() => {}}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#414651",
                    }}
                  >
                    {category.label}
                  </span>
                </div>

                {category.options.map((option) => (
                  <div
                    className="dropdown-item"
                    key={option.value}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      if (filters[category.label].includes(option.value)) {
                        onChangeFilters({
                          ...filters,
                          [category.label]: filters[category.label].filter(
                            (v) => v !== option.value
                          ),
                        });
                      } else {
                        onChangeFilters({
                          ...filters,
                          [category.label]: [
                            ...filters[category.label],
                            option.value,
                          ],
                        });
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
                          gap: "0px",
                        }}
                      >
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={filters[category.label].includes(option.value)}
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
                          display: "flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: "16px",
                          backgroundColor: option.backgroundColor,
                          border: option.border,
                        }}
                      >
                        <img
                          src={option.icon}
                          alt={option.value}
                          style={{ width: 13, height: 13 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
