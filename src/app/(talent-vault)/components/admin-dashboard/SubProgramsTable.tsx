"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import CareerStatusBadges from "@/lib/components/CareerComponents/CareerStatusBadge";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import FullScreenLoadingAnimation from "@/lib/components/CareerComponents/FullScreenLoadingAnimation";
import CustomDropdown from "@/lib/components/Dropdown/CustomDropdown";
import RoleTypeBadge from "./RoleTypeBadge";
import SubProgramFilterDropdown, {
  type SubProgramFilterState,
  EMPTY_SUBPROGRAM_FILTERS,
} from "./SubProgramFilterDropdown";

const tableHeaderStyle: any = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#717680",
  textTransform: "none",
  whiteSpace: "normal",
};

const metricHeaderStyle: any = {
  ...tableHeaderStyle,
  textAlign: "center",
  width: "96px",
};

const metricCellStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#717680",
  fontWeight: 500,
  whiteSpace: "normal",
};

type SubProgramTableRow = {
  _id: string;
  title: string;
  roleType: string;
  status: "active" | "inactive";
  activityStatus: "Active" | "Inactive";
  createdAt: string | null;
  registered: number | null;
  completed: number | null;
  invited: number | null;
  hired: number | null;
};

type SubProgramAction = "publish" | "unpublish" | "activate" | "deactivate";

type SortOption = {
  key: keyof SubProgramTableRow | null;
  direction: "ascending" | "descending";
};

const SORT_BY_OPTIONS: Record<string, SortOption> = {
  "Date updated": { key: null, direction: "descending" },
  "Date created": { key: "createdAt", direction: "descending" },
  "Most registered": { key: "registered", direction: "descending" },
  "Most completed": { key: "completed", direction: "descending" },
};


function formatMetricValue(value: number | null) {
  if (value === null) {
    return "-";
  }

  return value.toLocaleString();
}

function normalizeSubProgram(row: any): SubProgramTableRow {
  return {
    _id: String(row?._id || ""),
    title: String(row?.title || "").trim(),
    roleType: String(row?.roleType || "").trim(),
    status: String(row?.status || "").toLowerCase() === "inactive" ? "inactive" : "active",
    activityStatus: String(row?.activityStatus || "") === "Inactive" ? "Inactive" : "Active",
    createdAt: row?.createdAt ? String(row.createdAt) : null,
    registered: typeof row?.registered === "number" ? row.registered : null,
    completed: typeof row?.completed === "number" ? row.completed : null,
    invited: typeof row?.invited === "number" ? row.invited : null,
    hired: typeof row?.hired === "number" ? row.hired : null,
  };
}

export default function SubProgramsTable() {
  const router = useRouter();
  const [programs, setPrograms] = useState<SubProgramTableRow[]>([]);
  const [totalPrograms, setTotalPrograms] = useState(0);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);
  const [openMenuProgramId, setOpenMenuProgramId] = useState<string | null>(null);
  const [actionLoadingProgramId, setActionLoadingProgramId] = useState<string | null>(
    null
  );
  const [actionInProgress, setActionInProgress] = useState<SubProgramAction | null>(null);
  const [filters, setFilters] = useState<SubProgramFilterState>(EMPTY_SUBPROGRAM_FILTERS);
  const [sortBy, setSortBy] = useState("Date updated");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchPrograms = async () => {
      setIsLoadingPrograms(true);

      try {
        const params: Record<string, string> = {};
        if (filters["Published Status"].length > 0) {
          params.status = filters["Published Status"].join(",");
        }
        if (filters["Activity Status"].length > 0) {
          params.activityStatus = filters["Activity Status"].join(",");
        }
        if (filters.roleTypes.length > 0) {
          params.roleType = filters.roleTypes.join(",");
        }
        const response = await api.get("/api/talent-vault/subprograms", { params });

        if (!isMounted) {
          return;
        }

        const nextPrograms = Array.isArray(response?.data?.subprograms)
          ? response.data.subprograms.map(normalizeSubProgram)
          : [];

        setPrograms(nextPrograms);
        setTotalPrograms(Number(response?.data?.totalSubprograms || nextPrograms.length));
      } catch (error) {
        console.error("Error fetching talent vault subprograms:", error);

        if (!isMounted) {
          return;
        }

        setPrograms([]);
        setTotalPrograms(0);
      } finally {
        if (isMounted) {
          setIsLoadingPrograms(false);
        }
      }
    };

    fetchPrograms();

    return () => {
      isMounted = false;
    };
  }, [filters]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        openMenuProgramId &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenMenuProgramId(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [openMenuProgramId]);

  const getSuccessMessageForAction = (action: SubProgramAction) => {
    if (action === "publish") {
      return "Program published";
    }

    if (action === "unpublish") {
      return "Program unpublished";
    }

    if (action === "activate") {
      return "Program set to active";
    }

    return "Program set to inactive";
  };

  const getLoadingCopyForAction = (action: SubProgramAction) => {
    if (action === "publish") {
      return {
        title: "Publishing program...",
        subtext: "Please wait while we update the program",
      };
    }

    if (action === "unpublish") {
      return {
        title: "Unpublishing program...",
        subtext: "Please wait while we update the program",
      };
    }

    if (action === "activate") {
      return {
        title: "Activating program...",
        subtext: "Please wait while we update the program",
      };
    }

    return {
      title: "Deactivating program...",
      subtext: "Please wait while we update the program",
    };
  };

  const handleProgramAction = async (
    programId: string,
    action: SubProgramAction
  ) => {
    if (!programId || actionLoadingProgramId) {
      return;
    }

    setActionLoadingProgramId(programId);
    setActionInProgress(action);
    setOpenMenuProgramId(null);

    try {
      const response = await api.patch(`/api/talent-vault/subprograms/${programId}`, {
        action,
      });

      const updatedProgram = normalizeSubProgram(response?.data?.subprogram);

      setPrograms((previousPrograms) =>
        previousPrograms.map((program) =>
          program._id === programId ? { ...program, ...updatedProgram } : program
        )
      );

      candidateActionToast(
        getSuccessMessageForAction(action),
        1300,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 28 }}></i>
      );
    } catch (error: any) {
      console.error("Error updating subprogram status:", error);
      const errorMessage =
        error?.response?.data?.error || "Failed to update program. Please try again.";
      errorToast(errorMessage, 2200);
    } finally {
      setActionLoadingProgramId(null);
      setActionInProgress(null);
    }
  };

  const sortedPrograms = useMemo(() => {
    const option = SORT_BY_OPTIONS[sortBy];
    if (!option || !option.key) {
      return programs;
    }

    const { key, direction } = option;
    return [...programs].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (aVal < bVal) return direction === "ascending" ? -1 : 1;
      if (aVal > bVal) return direction === "ascending" ? 1 : -1;
      return 0;
    });
  }, [programs, sortBy]);

  const actionLoadingCopy = actionInProgress
    ? getLoadingCopyForAction(actionInProgress)
    : null;

  return (
    <div style={{ marginBottom: "50px", width: "100%", maxWidth: "100%" }}>
      <div className="layered-card-outer" style={{ width: "100%", maxWidth: "100%" }}>
        <div className="layered-card-content" style={{ padding: 0, maxWidth: "100%" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                padding: "15px 20px",
                width: "100%",
              }}
            >
              <div className="mb-0 d-flex align-items-center" style={{ gap: "10px" }}>
                <div style={{ fontSize: "18px", fontWeight: 550, color: "#111827" }}>
                  List of Programs
                </div>
                <div
                  style={{
                    borderRadius: "20px",
                    border: "1px solid #C7D7FE",
                    backgroundColor: "#EEF4FF",
                    color: "#3538CD",
                    fontSize: "12px",
                    fontWeight: 500,
                    padding: "0 10px",
                  }}
                >
                  {totalPrograms} programs
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
                <SubProgramFilterDropdown
                  filters={filters}
                  onChangeFilters={setFilters}
                />
                <CustomDropdown
                  value={sortBy}
                  setValue={setSortBy}
                  options={Object.keys(SORT_BY_OPTIONS)}
                  iconJsx={<img src="/iconsV3/sortV2.svg" alt="Sort" style={{ width: 16, height: 16 }} />}
                  suffixIconJsx={<img src="/iconsV3/chevron-down.svg" alt="Chevron down" style={{ width: 12, height: 7 }} />}
                  valuePrefix="Sort by:"
                />
              </div>
            </div>

            <div
              className="table-responsive"
              style={{
                minHeight: "420px",
                overflowX: openMenuProgramId ? "visible" : "auto",
                overflowY: "visible",
              }}
            >
              <table
                className="table align-items-center table-flush"
                style={{ tableLayout: "fixed", width: "100%" }}
              >
                <colgroup>
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" style={tableHeaderStyle}>Title</th>
                    <th scope="col" style={tableHeaderStyle}>Role Type</th>
                    <th scope="col" style={tableHeaderStyle}>Status</th>
                    <th scope="col" style={metricHeaderStyle}>Registered</th>
                    <th scope="col" style={metricHeaderStyle}>Completed</th>
                    <th scope="col" style={metricHeaderStyle}>Invited</th>
                    <th scope="col" style={metricHeaderStyle}>Hired</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody className="list">
                  {isLoadingPrograms ? (
                    <tr style={{ cursor: "default", pointerEvents: "none" }}>
                      <td colSpan={8} style={{ verticalAlign: "middle", height: "300px", border: "none" }}>
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", height: "100%", minHeight: "250px", gap: "4px" }}>
                          <img alt="loading" src="/gifs/analysis-loading.gif" width={100} height={90} style={{ objectFit: "cover" }} />
                          <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>Loading Programs</span>
                          <span style={{ fontSize: 12, color: "#717680" }}>Please wait while we fetch your programs</span>
                        </div>
                      </td>
                    </tr>
                  ) : programs.length === 0 ? (
                    <tr style={{ cursor: "default", pointerEvents: "none" }}>
                      <td colSpan={8} className="text-center py-4" style={{ verticalAlign: "middle", height: "200px" }}>
                        <div className="d-flex justify-content-center align-items-center w-100 h-100" style={{ minHeight: "100px" }}>
                          No programs found
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedPrograms.map((program) => (
                      <tr
                        key={program._id}
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          router.push(`/admin-portal/talent-vault/subprogram/${program._id}`)
                        }
                      >
                        <th scope="row" style={{ maxWidth: "250px", whiteSpace: "initial" }}>
                          <div className="media align-items-center">
                            <div className="media-body">
                              <h3
                                className="name mb-0 text-sm"
                                style={{
                                  fontSize: "16px",
                                  fontWeight: 550,
                                  color: "#111827",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {program.title}
                              </h3>
                            </div>
                          </div>
                        </th>
                        <td style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
                          {program.roleType ? (
                            <RoleTypeBadge roleType={program.roleType} />
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td>
                          <CareerStatusBadges
                            career={{
                              status: program.status,
                              activityStatus: program.activityStatus,
                            }}
                          />
                        </td>
                        <td style={metricCellStyle}>{formatMetricValue(program.registered)}</td>
                        <td style={metricCellStyle}>{formatMetricValue(program.completed)}</td>
                        <td style={metricCellStyle}>{formatMetricValue(program.invited)}</td>
                        <td style={metricCellStyle}>{formatMetricValue(program.hired)}</td>
                        <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <div
                            className="dropdown"
                            ref={openMenuProgramId === program._id ? dropdownRef : null}
                            style={{ display: "inline-block" }}
                          >
                            <button
                              style={{
                                background: "none",
                                border: "none",
                                cursor: actionLoadingProgramId ? "not-allowed" : "pointer",
                                opacity: actionLoadingProgramId ? 0.5 : 1,
                              }}
                              onClick={(event) => {
                                if (actionLoadingProgramId) {
                                  return;
                                }

                                event.preventDefault();
                                setOpenMenuProgramId((previousOpenProgramId) =>
                                  previousOpenProgramId === program._id
                                    ? null
                                    : program._id
                                );
                              }}
                            >
                              <i className="la la-ellipsis-h" style={{ fontSize: 18, color: "#787486" }}></i>
                            </button>

                            {openMenuProgramId === program._id && (
                              <div
                                className="dropdown-menu dropdown-menu-right show"
                                style={{
                                  padding: "10px 15px",
                                  minWidth: "210px",
                                  marginTop: "2px",
                                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)",
                                  borderRadius: "8px",
                                  border: "1px solid #E9EAEB",
                                }}
                              >
                                <div
                                  className="dropdown-item"
                                  onClick={() => {
                                    setOpenMenuProgramId(null);
                                    router.push(
                                      `/admin-portal/talent-vault/edit-program/${program._id}`
                                    );
                                  }}
                                >
                                  <span>Edit Program</span>
                                </div>

                                <div className="dropdown-divider"></div>

                                <div
                                  className="dropdown-item"
                                  style={{
                                    color: program.status === "active" ? "#B42318" : "#027948",
                                  }}
                                  onClick={() =>
                                    handleProgramAction(
                                      program._id,
                                      program.status === "active"
                                        ? "unpublish"
                                        : "publish"
                                    )
                                  }
                                >
                                  <span>
                                    {program.status === "active"
                                      ? "Unpublish Program"
                                      : "Publish Program"}
                                  </span>
                                </div>

                                <div
                                  className="dropdown-item"
                                  onClick={() =>
                                    handleProgramAction(
                                      program._id,
                                      program.activityStatus === "Active"
                                        ? "deactivate"
                                        : "activate"
                                    )
                                  }
                                >
                                  <span>
                                    {program.activityStatus === "Active"
                                      ? "Mark as Inactive"
                                      : "Mark as Active"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </div>
      </div>
      {actionLoadingCopy && (
        <FullScreenLoadingAnimation
          title={actionLoadingCopy.title}
          subtext={actionLoadingCopy.subtext}
        />
      )}
    </div>
  );
}
