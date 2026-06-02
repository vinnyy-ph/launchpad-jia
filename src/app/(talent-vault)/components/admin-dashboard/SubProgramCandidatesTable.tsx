"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/lib/components/ui";
import TablePagination from "@/lib/components/ui/pagination/TablePagination";
import CustomDropdown from "@/lib/components/Dropdown/CustomDropdown";
import SubProgramCandidate, { type CandidateRowData, type CandidateStatus } from "./SubProgramCandidate";
import SubProgramCandidateFilterDropdown from "./SubProgramCandidateFilterDropdown";
import styles from "@/app/(talent-vault)/styles/modules/subprograms.module.scss";
import { api } from "@/lib/utils/apiClient";

type SortConfig = { field: string; order: "asc" | "desc" };

const SORT_BY_OPTIONS: Record<string, SortConfig> = {
  "Recent Activity": { field: "updatedAt", order: "desc" },
  "Date Created": { field: "createdAt", order: "desc" },
  "Recently Completed": { field: "completedAt", order: "desc" },
};

type SubProgramCandidatesTableProps = {
  subprogramId: string;
};


export default function SubProgramCandidatesTable({
  subprogramId,
}: SubProgramCandidatesTableProps) {
  const PAGE_SIZE = 10;

  const [candidates, setCandidates] = useState<CandidateRowData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<CandidateStatus[]>([]);
  const [sortBy, setSortBy] = useState("Recent Activity");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCandidates = useCallback(
    async (page: number, searchQuery: string, statuses: CandidateStatus[], sort: string) => {
      setIsLoading(true);
      try {
        const sortConfig = SORT_BY_OPTIONS[sort] || SORT_BY_OPTIONS["Recent Activity"];
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          sort: sortConfig.field,
          order: sortConfig.order,
        });
        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }
        if (statuses.length > 0) {
          params.set("status", statuses.join(","));
        }
        const response = await api.get(
          `/api/talent-vault/subprograms/${subprogramId}/candidates?${params}`
        );
        const data = response?.data;
        setCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
        setTotalCount(data?.totalCount ?? 0);
        setTotalPages(data?.totalPages ?? 1);
      } catch (error) {
        console.error("Error fetching candidates:", error);
        setCandidates([]);
        setTotalCount(0);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    },
    [subprogramId, PAGE_SIZE]
  );

  useEffect(() => {
    fetchCandidates(currentPage, search, filterStatuses, sortBy);
  }, [currentPage, search, filterStatuses, sortBy, fetchCandidates]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleSearchInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchInput(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      setSearch(value);
    }, 300);
  }
  return (
    <div className={styles.candidatesTableWrapper}>
      {/* Search + Filters row (above the table card) */}
      <div className={styles.searchToolbar}>
        <div className="table-search-bar" style={{ minWidth: "300px" }}>
          <div className="icon mr-2">
            <i className="la la-search"></i>
          </div>
          <input
            type="search"
            className="form-control ml-auto search-input"
            placeholder="Search candidates..."
            value={searchInput}
            onChange={handleSearchInputChange}
          />
        </div>

        <div className={styles.toolbarActions}>
          <SubProgramCandidateFilterDropdown
            selectedStatuses={filterStatuses}
            onChangeStatuses={(statuses) => {
              setFilterStatuses(statuses);
              setCurrentPage(1);
            }}
          />
          <CustomDropdown
            value={sortBy}
            setValue={(value) => {
              setSortBy(value);
              setCurrentPage(1);
            }}
            options={Object.keys(SORT_BY_OPTIONS)}
            iconJsx={<img src="/iconsV3/sortV2.svg" alt="Sort" style={{ width: 16, height: 16 }} />}
            suffixIconJsx={<img src="/iconsV3/chevron-down.svg" alt="Chevron down" style={{ width: 12, height: 7 }} />}
            valuePrefix="Sort by:"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="layered-card-outer" style={{ width: "100%", maxWidth: "100%" }}>
        <div className="layered-card-content" style={{ padding: 0, maxWidth: "100%" }}>
          {/* Header */}
          <div className={styles.tableHeader}>
            <div className="mb-0 d-flex align-items-center" style={{ gap: "10px" }}>
              <div className={styles.tableTitle}>Candidates</div>
              <div className={styles.tableCounter}>
                {isLoading ? "\u2026" : totalCount}{" "}
                {totalCount === 1 ? "candidate" : "candidates"}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className={styles.tableContainer}>
            <table
              className="table align-items-center table-flush"
              style={{ tableLayout: "fixed", width: "100%" }}
            >
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "30%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className={styles.tableHeaderCell}>Candidate</th>
                  <th scope="col" className={styles.tableHeaderCell}>Status</th>
                  <th scope="col" className={styles.tableHeaderCell}>Date Updated</th>
                  <th scope="col" className={styles.tableHeaderCell}>Date Created</th>
                </tr>
              </thead>
              <tbody className="list">
                {isLoading ? (
                  <tr style={{ cursor: "default", pointerEvents: "none" }}>
                    <td colSpan={4} style={{ verticalAlign: "middle", height: "300px", border: "none" }}>
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", height: "100%", minHeight: "250px", gap: "4px" }}>
                        <img alt="loading" src="/gifs/analysis-loading.gif" width={100} height={90} style={{ objectFit: "cover" }} />
                        <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>Loading Candidates</span>
                        <span style={{ fontSize: 12, color: "#717680" }}>Please wait while we fetch the candidates</span>
                      </div>
                    </td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr style={{ cursor: "default", pointerEvents: "none" }}>
                    <td colSpan={4} style={{ verticalAlign: "middle", height: "200px" }}>
                      <div className="d-flex justify-content-center align-items-center w-100 h-100" style={{ minHeight: "100px" }}>
                        {search
                          ? "No candidates match your search."
                          : "No candidates enrolled in this subprogram yet."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  candidates.map((candidate) => (
                    <SubProgramCandidate key={candidate._id} candidate={candidate} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && candidates.length > 0 && (
            <div
              className={`d-flex justify-content-between align-items-center border-top ${styles.pagination}`}
            >
              <Button
                variant="secondary"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                label="Previous"
                icon="/icons/arrow.svg"
              />

              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setCurrentPage(page)}
              />

              <Button
                variant="secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                label="Next"
                icon="/icons/arrow.svg"
                iconStyle={{ transform: "rotate(180deg)" }}
                iconPosition="right"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
