"use client"
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useAppContext } from "../../context/AppContext";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import TableLoader from "../../Loader/TableLoader";
import useDebounce from "@/lib/hooks/useDebounceHook";
import ApplicantStatusBadge from "../CareerComponents/ApplicantStatusBadge";
import CandidateModal from "../CandidateComponents/CandidateModal";
import CandidateTooltip from "../CandidateComponents/CandidateTooltip";
import CustomDropdown from "../Dropdown/CustomDropdown";
import { errorToast, successToast } from "../../Utils";
import { handleEmailClick } from "@/lib/hooks/useHandleEmailClick";
import { Button } from "../ui";
import TablePagination from "../ui/pagination/TablePagination";
import InviteCandidatesToJobModal from "../CandidateComponents/InviteCandidatesToJobModal";
import BulkEmailPanel from "../CandidatesTableComponents/BulkEmailPanel";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

const tableHeaderStyle: any = {
  textTransform: "none",
  fontWeight: 550
}

export default function CareerApplicantsTable({ slug, pipelineStages, career }: {slug: string, pipelineStages: any[], career: any}) {
    const { orgID, user } = useAppContext();
    const [activeOrg] = useLocalStorage("activeOrg", null);
    const currentOrgRole =
        activeOrg && orgID != null && String(activeOrg._id) === String(orgID)
            ? activeOrg.role
            : null;
    const canShowBulkEmail =
        currentOrgRole === "admin" || currentOrgRole === "super_admin";

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 500);
    const [filterStatus, setFilterStatus] = useState("All Statuses");
    const [filterStage, setFilterStage] = useState<{label: string, stageId: string | null, substageId: string | null}>({ label: "All Stages", stageId: null, substageId: null });
    const filterStatusOptions = ["All Statuses", "Ongoing", "Dropped", "Cancelled", "Hired", "Invited"];
    const [filterStageOptions, setFilterStageOptions] = useState<Array<{label: string, stageId: string | null, substageId: string | null}>>([]);
    const [loading, setLoading] = useState(true);
    const [applicants, setApplicants] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalApplicants, setTotalApplicants] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [candidateDetailsOpen, setCandidateDetailsOpen] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [hoveredCandidateId, setHoveredCandidateId] = useState<string | null>(null);
    const [hoveredAnchorRect, setHoveredAnchorRect] = useState<DOMRect | null>(null);
    const tooltipTimeoutRef = useRef<number | null>(null);
    const limit = 10;
    const [sortBy, setSortBy] = useState("Recent Activity");
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Array<{ id: string; candidate: any }>>([]);
    const [showBulkEmailPanel, setShowBulkEmailPanel] = useState(false);

    const getRowId = (applicant: any, index: number) =>
        `${(applicant?._id || applicant?.id || applicant?.email) ?? "row"}-${index}`;
    const selectedCount = selectedRows.length;
    const selectedIdsOnPage = useMemo(
        () => new Set(applicants.map((a: any, i: number) => getRowId(a, i))),
        [applicants]
    );
    const isAllOnPageSelected =
        applicants.length > 0 &&
        applicants.every((a: any, i: number) =>
            selectedRows.some((r) => r.id === getRowId(a, i))
        );
    const isSomeOnPageSelected =
        applicants.some((a: any, i: number) =>
            selectedRows.some((r) => r.id === getRowId(a, i))
        ) && !isAllOnPageSelected;

    // Prevent setState-after-unmount if a tooltip hide timeout is pending
    useEffect(() => {
      return () => {
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }
      };
    }, []);

    const sortByOptions = [
        "Recent Activity", 
        "Oldest Activity", 
        "Date Applied (Newest First)",
        "Date Applied (Oldest First)",
        "Alphabetical (A-Z)", 
        "Alphabetical (Z-A)"
    ];

    const fetchApplicants = async () => {
        try {
            if (!slug) return;
            setLoading(true);
            const response = await api.get("/api/get-career-applicants", {
                params: {
                    careerID: slug,
                    page: currentPage,
                    limit: limit,
                    search: debouncedSearch,
                    filterStatus: filterStatus,
                    filterStageId: filterStage.stageId,
                    filterSubstageId: filterStage.substageId,
                    sortBy: sortBy
                }
            });
            setApplicants(response.data.applicants);
            setTotalPages(response.data.totalPages);
            setTotalApplicants(response.data.totalApplicants);
        } catch (error) {
          console.error("Error fetching applicants:", error);
          errorToast("Error fetching applicants", 1300);
        } finally {
          setLoading(false);
        }
      };
    
      useEffect(() => {
        if (orgID) {
            fetchApplicants();
        }
      }, [orgID, currentPage, slug, debouncedSearch, filterStatus, filterStage, sortBy]);

      useEffect(() => {
        if (pipelineStages) {
          const enabledStages = pipelineStages.filter((stage: any) => stage.enabled !== false);
          const newFilterStageOptions = enabledStages.flatMap((stage: any) => 
            stage.substages.map((substage: any) => ({
              label: `${stage.alias || stage.name} - ${substage.name}`,
              stageId: stage.id,
              substageId: substage.id,
            }))
          );
          setFilterStageOptions([{ label: "All Stages", stageId: null, substageId: null }, ...newFilterStageOptions]);
        }
      }, [pipelineStages]);

      const handleTooltipMouseEnter = (candidateId: string, rect?: DOMRect | null) => {
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }
        setHoveredCandidateId(candidateId);
        if (rect) {
          setHoveredAnchorRect(rect);
        }
      };

      const handleTooltipMouseLeave = () => {
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
        }
        tooltipTimeoutRef.current = window.setTimeout(() => {
          setHoveredCandidateId(null);
          setHoveredAnchorRect(null);
          tooltipTimeoutRef.current = null;
        }, 200);
      };
      
    return (
        <>
                    {/* Search Bar and Filter */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <Button
                            icon="/icons/plus.svg"
                            label="Invite Candidate(s)"
                            onClick={() => setInviteModalOpen(true)}
                            variant="primary"
                          />
                          <CustomDropdown value={sortBy} setValue={(value) => {
                            setSortBy(value);
                            setCurrentPage(1);
                          }} options={sortByOptions} icon="la-sort-amount-down" />
                          <CustomDropdown value={filterStatus} setValue={(value) => {
                            setFilterStatus(value);
                            setCurrentPage(1);
                          }} options={filterStatusOptions} icon="la-filter" />
                           <CustomDropdown value={filterStage.label} setValue={(value) => {
                            const selected = filterStageOptions.find((opt) => opt.label === value);
                            if (selected) setFilterStage(selected);
                            setCurrentPage(1);
                          }} options={filterStageOptions.map((opt) => opt.label)} icon="la-filter" />
                        </div>
                        <div className="table-search-bar">
                        <div className="icon mr-2">
                            <i className="la la-search"></i>
                        </div>
                        <input
                            type="search"
                            className="form-control ml-auto search-input"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => {
                              setSearch(e.target.value?.trim());
                              setCurrentPage(1);
                            }}
                        />
                    </div>
                    </div>
        <div className="layered-card-outer">
          {/* Card header */}
          <div className="layered-card-content" style={{ padding: 0 }}>
          <div style={{ margin: "15px 20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h3 className="mb-0 mr-auto d-flex align-items-center" style={{ fontSize: "18px", fontWeight: 550, color: "#111827" }}>
              Applicants <div style={{ borderRadius: "20px", border: "1px solid #D5D9EB", backgroundColor: "#F8F9FC", color: "#363F72", fontSize: "12px", padding: "0 10px", marginLeft: "10px" }}> {totalApplicants}</div>
            </h3>
            {canShowBulkEmail && selectedCount > 0 && (
              <Button
                variant="primary"
                label="Send Email to All"
                icon="/iconsV3/mail.svg"
                onClick={() => {
                  if (selectedCount > 100) {
                    errorToast("You can only send email to a maximum of 100 candidates at a time.", 3000);
                    return;
                  }
                  setShowBulkEmailPanel(true);
                }}
              />
            )}
          </div>
            {/* Table */}
            <div className="table-responsive">
                {loading ? (
              <table className="table align-items-center table-flush">
              <thead>
                <tr>
                  {canShowBulkEmail && (
                    <th scope="col" style={{ width: 40, ...tableHeaderStyle }} />
                  )}
                  <th scope="col" className="sort" data-sort="name" style={tableHeaderStyle}>
                  Candidates
                  </th>
                  <th scope="col" className="sort" data-sort="status" style={tableHeaderStyle}>
                  Application Status
                  </th>
                  <th scope="col" style={tableHeaderStyle}>Stage</th>
                  <th scope="col" className="sort" data-sort="status" style={tableHeaderStyle}>
                    Date Applied
                  </th>
                  <th scope="col" className="sort" data-sort="status" style={tableHeaderStyle}>
                    Stage Updated
                  </th>
                </tr>
              </thead>
              <tbody className="list">
                <TableLoader type="career-applicants" />
              </tbody>
            </table>
                ) :
            (<table className="table align-items-center table-flush">
              <thead>
                <tr>
                  {canShowBulkEmail && (
                    <th scope="col" style={{ width: 40, ...tableHeaderStyle }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <input
                          type="checkbox"
                          aria-label="Select all on page"
                          checked={isAllOnPageSelected}
                          ref={(el) => {
                            if (!el) return;
                            (el as HTMLInputElement).indeterminate = isSomeOnPageSelected;
                          }}
                          onChange={() => {
                            if (isAllOnPageSelected) {
                              setSelectedRows((prev) =>
                                prev.filter((r) => !selectedIdsOnPage.has(r.id))
                              );
                            } else {
                              const toAdd = applicants
                                .map((a: any, i: number) => ({ id: getRowId(a, i), candidate: a }))
                                .filter((r) => !selectedRows.some((s) => s.id === r.id));
                              setSelectedRows((prev) => [...prev, ...toAdd]);
                            }
                          }}
                        />
                      </div>
                    </th>
                  )}
                  <th scope="col" className="sort" data-sort="name" style={tableHeaderStyle}>
                    Candidates
                  </th>
                  <th scope="col" className="sort" data-sort="status" style={tableHeaderStyle}>
                    Application Status
                  </th>

                  <th scope="col" style={tableHeaderStyle}>Stage</th>

                  <th scope="col" style={tableHeaderStyle}>Date Applied</th>

                  <th scope="col" className="sort" data-sort="status" style={tableHeaderStyle}>
                    Stage Updated
                  </th>
                </tr>
              </thead>
                <tbody className="list">
                    {/* Table Body */}
                    {applicants.length === 0 ? (
                    <tr style={{ cursor: "default", pointerEvents: "none" }}>
                      <td colSpan={canShowBulkEmail ? 6 : 5} className="text-center py-4" style={{ verticalAlign: "middle", height: "200px" }}>
                        <div className="d-flex justify-content-center align-items-center w-100 h-100" style={{ minHeight: "100px" }}>
                          No applicants found
                        </div>
                      </td>
                    </tr>
                  ) : (
                    applicants.map((applicant: any, idx: number) => {
                      const id = (applicant?._id || applicant?.id)?.toString?.() || "";
                      const isHovered = !!hoveredCandidateId && hoveredCandidateId === id;
                      const rowId = getRowId(applicant, idx);
                      const isRowSelected = selectedRows.some((r) => r.id === rowId);

                      let stageLabel = applicant.stage;
                      if (applicant.stageId && pipelineStages) {
                        const stage = pipelineStages.find((s: any) => s.id === applicant.stageId);
                        if (stage) {
                          const substage = stage.substages?.find((ss: any) => ss.id === applicant.substageId);
                          if (substage) {
                            stageLabel = `${stage.alias || stage.name} - ${substage.name}`;
                          }
                        }
                      }

                      return (
                        <tr key={applicant._id} style={{ cursor: "auto" }}>
                          {canShowBulkEmail && (
                            <td style={{ width: 40, verticalAlign: "middle" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <input
                                  type="checkbox"
                                  aria-label="Select candidate"
                                  checked={isRowSelected}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => {
                                    if (isRowSelected) {
                                      setSelectedRows((prev) => prev.filter((r) => r.id !== rowId));
                                    } else {
                                      setSelectedRows((prev) => [...prev, { id: rowId, candidate: applicant }]);
                                    }
                                  }}
                                />
                              </div>
                            </td>
                          )}
                          <td>
                            <div
                              onClick={() => {
                                setSelectedCandidate(applicant);
                                setCandidateDetailsOpen(true);
                              }}
                              className="candidate-card-section"
                              style={{ position: "relative" }}
                              onMouseEnter={(e) => {
                                if (id) handleTooltipMouseEnter(id, e.currentTarget.getBoundingClientRect());
                              }}
                              onMouseLeave={handleTooltipMouseLeave}
                            >
                              <img
                                src={applicant?.image}
                                alt={applicant?.name}
                                style={{ width: 32, height: 32, borderRadius: "50%", background: "#E0E0E0" }}
                              />
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 14 }}>{applicant?.name || ""}</div>
                                <div style={{ fontSize: 12, color: "#787486" }}>{applicant?.email || ""}</div>
                              </div>
                              {isHovered && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <CandidateTooltip
                                    candidateInfo={{
                                      image: applicant?.image,
                                      name: applicant?.name,
                                      email: applicant?.email,
                                    }}
                                    candidate={applicant}
                                    orgID={(orgID as any) || ""}
                                    onMouseEnter={() => {
                                      if (id) handleTooltipMouseEnter(id);
                                    }}
                                    onMouseLeave={handleTooltipMouseLeave}
                                    onEmailClick={() => handleEmailClick(applicant, orgID, slug)}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <ApplicantStatusBadge status={applicant?.applicationStatus || "Ongoing"} />
                          </td>
                          <td>{stageLabel}</td>
                          <td>
                            {applicant.createdAt
                              ? new Date(applicant.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </td>
                          <td>
                            {applicant.updatedAt
                              ? new Date(applicant.updatedAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
            </table>)}
            <div className="d-flex justify-content-between align-items-center border-top" style={{ padding: "15px 20px" }}>
              <Button 
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                }
              }}
              label="Previous"
              icon="/icons/arrow.svg"
              >
              </Button>

              <TablePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
  
              <Button 
              variant="secondary"
              disabled={currentPage >= totalPages}
              onClick={() => {
                if (currentPage < totalPages) {
                  setCurrentPage(currentPage + 1);
                }
              }}
              label="Next"
              icon="/icons/arrow.svg"
              iconStyle={{ transform: "rotate(180deg)" }}
              iconPosition="right"
              >
              </Button>
            </div>
            </div>
            </div>
        </div>
        {candidateDetailsOpen && <CandidateModal candidate={selectedCandidate} setShowCandidateModal={setCandidateDetailsOpen} />}
        {inviteModalOpen && career && (
          <InviteCandidatesToJobModal
            isOpen={inviteModalOpen}
            onClose={() => setInviteModalOpen(false)}
            career={{
              _id: career._id,
              id: career.id || slug,
              jobTitle: career.jobTitle
            }}
            onInviteComplete={async (selectedCandidates, automationIdsToUse) => {
              // Handle bulk invite with progress
              const results = { success: 0, failed: 0 };
              
              for (const candidate of selectedCandidates) {
                try {
                  await api.post("/api/invite-candidate-to-career", {
                    targetCareerIds: [career._id],
                    candidateEmail: candidate.email,
                    invitedBy: {
                      name: user?.name,
                      email: user?.email,
                      image: user?.image,
                    },
                    orgID: orgID,
                    automationIdsToUse,
                  });
                  results.success++;
                } catch (error) {
                  console.error(`Failed to invite ${candidate.email}:`, error);
                  results.failed++;
                }
              }
              
              // Show results toast
              if (results.success > 0) {
                successToast(`${results.success} candidate${results.success > 1 ? 's' : ''} invited successfully`, 2000);
              }
              if (results.failed > 0) {
                errorToast(`${results.failed} invite${results.failed > 1 ? 's' : ''} failed`, 2000);
              }
              
              fetchApplicants();
              setInviteModalOpen(false);
            }}
          />
        )}
        <BulkEmailPanel
          isOpen={showBulkEmailPanel}
          onClose={() => setShowBulkEmailPanel(false)}
          selectedRows={selectedRows}
          onRemoveCandidate={(rowId) =>
            setSelectedRows((prev) => prev.filter((r) => r.id !== rowId))
          }
        />
        </>
    )
}