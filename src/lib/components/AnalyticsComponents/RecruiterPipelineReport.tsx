"use client";
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import TableMetric from "./TableMetric";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import CareerStatusBadges from "../CareerComponents/CareerStatusBadge";
import { JobOwner } from "../DataTables/CareersTableV2";
import { Button } from "../ui";
import { errorToast, successToast } from "@/lib/Utils";
import TableLoader from "@/lib/Loader/TableLoader";
import NoDataAvailable from "./NoDataAvailable";
import styles from "@/lib/styles/analytics/graphs.module.scss";
import MultiFilterDropdown from "../Dropdown/MultiFilterDropdown";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import CustomDropdown from "../Dropdown/CustomDropdown";
import FullScreenLoadingAnimation from "../CareerComponents/FullScreenLoadingAnimation";
import { usePipelineReportViewPreferences } from "@/lib/hooks/filterSortDefaults/usePipelineReportViewPreferences";
import { getReportStages, getFormattedStages, getStageCounts, getExtraColumnValue, groupByParentChild, combineTimelineStages, buildPipelineReportParams, csvEscape, isoDateOnly, type ColumnVisibility } from "@/lib/utils/pipelineReport";

// Display-only header rename (the underlying stage key stays "Human Interview" so
// stage matching, exports, and the API contract are unaffected); sortable header set.
const DISPLAY_LABEL: Record<string, string> = { "Human Interview": "HR Interview" };
const SORTABLE_COLUMNS = ["Job Title", "Project", "Job Owner", "AI Interview", "Human Interview"];

export default function RecruiterPipelineReport({ projectId }: { projectId?: string }) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [activeOrg] = useLocalStorage("activeOrg", null);
    const [pipelineReport, setPipelineReport] = useState<any>(null);
    const [totalCareers, setTotalCareers] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [isLoading, setIsLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState({
        jobOwners: [],
        projects: [],
        "Published Status": [],
        "Activity Status": [],
        "Subscription Plan": [],
        contributors: [],
        careers: [],
        hiringManagers: [],
        // TODO: Add deal status filter
      });
    const [isCustomizeColumnModalOpen, setIsCustomizeColumnModalOpen] = useState(false);
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
        type: "Show per stage",
        includeDroppedCandidates: false,
        stages: [],
        offerStages: [],
        otherColumns: { "Created Date": false, "Headcount": false, "Notes": false },
    });
    // Server-side sort default. The "Sort by" dropdown was removed in the Figma fidelity
    // pass (column-header sorting replaced it), so this is a constant, not state.
    const sortBy = "Position Name (A-Z)";
    const [isLoadingFullReport, setIsLoadingFullReport] = useState(false);
    const [isFullscreenView, setIsFullscreenView] = useState(false);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
    const onSort = (column: string) => {
        if (sortColumn !== column) { setSortColumn(column); setSortDir("asc"); }
        else if (sortDir === "asc") setSortDir("desc");
        else { setSortColumn(null); setSortDir(null); }
    };
    const [noteModalCareer, setNoteModalCareer] = useState<any>(null);
    const openNoteModal = (career: any) => setNoteModalCareer(career);
    const saveNote = async (career: any, note: string) => {
        try {
            await api.post("/api/update-career-note", { _id: career._id, orgID, note });
            setPipelineReport((prev: any) => Array.isArray(prev) ? prev.map((c: any) => c._id === career._id ? { ...c, notes: note } : c) : prev);
            setNoteModalCareer(null);
            successToast("Note saved", 1300);
        } catch (e) {
            console.error(e);
            errorToast("Failed to save note", 1300);
        }
    };
    const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

    const columnsKey = `pipelineReport:columns:${projectId ? `project:${projectId}` : "dashboard"}`;
    const [columnOrder, setColumnOrder] = useLocalStorage<string[]>(columnsKey, []);

    const {
        isViewStateReady,
        isSetAsDefault,
        isSetAsDefaultLoading,
        handleSetAsDefaultChange,
    } = usePipelineReportViewPreferences({
        orgID,
        projectId,
        page,
        limit,
        filterStatus,
        setPage,
        setLimit,
        setFilterStatus,
    });
    const shouldShowPipelineLoading = (Boolean(orgID) && !isViewStateReady) || isLoading;

    useEffect(() => {
        if (!isViewStateReady) {
            return;
        }
        const fetchPipelineReport = async () => {
            try {
                setIsLoading(true);
                const response = await api.get("/api/get-pipeline-report", {
                    // All five ticket filters (project, job title=careers, job owner,
                    // status, hiring manager) compose server-side via these params.
                    params: buildPipelineReportParams(filterStatus, { orgID, projectId, page, limit, sortBy }),
                });
                setPipelineReport(response.data.careers)
                setTotalCareers(response.data.totalCareers);
                const { stages, offerStages } = getReportStages(response.data.careers);
                // NOTE: every fetch (page/filter change) rebuilds stage columns from the new
                // result set and resets type/dropped/otherColumns to defaults — pre-T3 behavior,
                // kept intact (see recommendations: persisting customizations across fetches).
                setColumnVisibility({
                    type: "Show per stage",
                    includeDroppedCandidates: false,
                    stages: stages,
                    offerStages: offerStages,
                    otherColumns: { "Created Date": false, "Headcount": false, "Notes": false },
                });
            } catch (error) {
                console.error(error);
                errorToast("Error fetching pipeline report", 1300);
            } finally {
                setIsLoading(false);
            }
        }
        if (orgID) {
            fetchPipelineReport()
        }
    }, [isViewStateReady, orgID, page, limit, filterStatus, projectId, sortBy]);

    const handleDownloadCSV = async () => {
        const formattedData = await getFullPipelineReport();
        if (!formattedData) return;
        const newHeaders = [...formattedData.columnHeaders];
        const statusIdx = newHeaders.indexOf("Status");
        if (statusIdx !== -1) newHeaders.splice(statusIdx, 1, "Published Status", "Activity Status", "Job Post Type");
        // Every cell (headers too — custom stage names may contain commas) goes through
        // RFC-4180 csvEscape, so values keep their real bytes (titles keep their commas,
        // notes keep commas/newlines) and columns can never shift.
        const cellValue = (row: any, header: string) => {
            if (header === "Job Owner") {
                // Optional-chained: a career with neither a Job Owner member nor createdBy
                // must not crash the whole export. "-" matches the XLSX export convention.
                return row.metadata.jobOwner?.name ?? "-";
            }
            if (header === "Published Status") {
                return row.metadata.publishedStatus;
            }
            if (header === "Activity Status") {
                return row.metadata.activityStatus;
            }
            if (header === "Job Post Type") {
                return row.metadata.jobPostType;
            }
            if (header === "Job Title") {
                return typeof row[header] === "string" ? row[header] : (row.metadata?.jobTitle ?? "-");
            }
            if (header === "Notes") {
                return row.metadata?.notes ?? "-";
            }
            if (header === "Created Date") {
                // Exports get an absolute ISO date; the table keeps the relative string.
                return isoDateOnly(row.metadata?.createdAt);
            }
            return row[header];
        };
        const csvContent = newHeaders.map(csvEscape).join(",") + "\n" + formattedData.rows.map((row: any) =>
            newHeaders.map((header: string) => csvEscape(cellValue(row, header))).join(",")
        ).join("\n");
        const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${activeOrg?.name ? `${activeOrg.name}-` : ""}Pipeline-Report-${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const handleDownloadXLSX = async () => {
        const formattedData = await getFullPipelineReport();
        if (!formattedData) return;
        const headers = [...formattedData.columnHeaders];
        const statusIdx = headers.indexOf("Status");
        if (statusIdx !== -1) headers.splice(statusIdx, 1, "Published Status", "Activity Status", "Job Post Type");
        const aoa = [
            headers,
            ...formattedData.rows.map((row: any) => headers.map((header: string) => {
                if (header === "Job Owner") return row.metadata.jobOwner?.name ?? "-";
                if (header === "Published Status") return row.metadata.publishedStatus;
                if (header === "Activity Status") return row.metadata.activityStatus;
                if (header === "Job Post Type") return row.metadata.jobPostType;
                if (header === "Job Title") return typeof row[header] === "string" ? row[header] : (row.metadata?.jobTitle ?? "-");
                if (header === "Notes") return row.metadata?.notes ?? "-";
                // Exports get an absolute ISO date; the table keeps the relative string.
                if (header === "Created Date") return isoDateOnly(row.metadata?.createdAt);
                return row[header];
            })),
        ];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pipeline Report");
        XLSX.writeFile(wb, `${activeOrg?.name ? `${activeOrg.name}-` : ""}Pipeline-Report-${new Date().toLocaleDateString()}.xlsx`);
    };

    const getFullPipelineReport = async () => {
        // Fetch the full pipeline report from the API
        try {
            setIsLoadingFullReport(true);
            const response = await api.get("/api/get-pipeline-report", {
                // Same tested builder as the table fetch, so the export query can never
                // diverge from the visible rows (the inline copy it replaces skipped
                // .filter(Boolean) on the email lists — a selected filter member without
                // an email produced "a@x.com," here vs "a@x.com" in the table query).
                params: buildPipelineReportParams(filterStatus, { orgID, projectId, page, limit, sortBy, fullReport: true }),
            });
            const { stages, offerStages } = getReportStages(response.data.careers);
            // Re-apply the user's Customize Columns selections (label-matched) onto the
            // freshly fetched stage list so the export honors what the table shows.
            // Stages absent from the current view keep their fetched default (enabled).
            const mergeEnabledState = (fresh: any[], existing: any[]) => fresh.map((stage: any) => {
                const existingStage = existing.find((s: any) => s.label === stage.label);
                return {
                    ...stage,
                    enabled: existingStage ? existingStage.enabled : stage.enabled,
                    substages: stage.substages.map((substage: any) => {
                        const existingSubstage = existingStage?.substages.find((s: any) => s.label === substage.label);
                        return {
                            ...substage,
                            enabled: existingSubstage ? existingSubstage.enabled : substage.enabled,
                        }
                    }),
                }
            });
            const updatedStages = mergeEnabledState(stages, columnVisibility.stages);
            const updatedOfferStages = mergeEnabledState(offerStages, columnVisibility.offerStages);
            const formattedData = getTableData({
                ...columnVisibility,
                stages: updatedStages,
                offerStages: updatedOfferStages,
            }, response.data.careers, { allRows: true });
            return formattedData;
        } catch (error) {
            console.error(error);
            errorToast("Error fetching full pipeline report", 1300);
        } finally {
            setIsLoadingFullReport(false);
        }
    }

    const getTableData = (columnVisibility: ColumnVisibility, pipelineReport: any[], opts?: { allRows?: boolean }) => {
        const formattedStages = getFormattedStages(columnVisibility);
        const enabledOthers = Object.keys(columnVisibility.otherColumns || {})
            .filter((k) => columnVisibility.otherColumns?.[k]);
        const headers = ["#", "Job Title", "Project", "Job Owner", "Status",
            ...formattedStages.map((stage) => stage.label), ...enabledOthers];
        const grouped = groupByParentChild(pipelineReport);
        // Group into top-level units (parent + its children) so sorting keeps children nested.
        const units: { parent: any; children: any[] }[] = [];
        for (const r of grouped) {
            if (r.depth === 0) units.push({ parent: r, children: [] });
            else units[units.length - 1]?.children.push(r);
        }
        if (sortColumn && sortDir) {
            const ownerName = (it: any) => ((it.teamMembers?.find((m: any) => m.role === "Job Owner") || it.createdBy)?.name || "").toLowerCase();
            const stageTotal = (u: any) => {
                const it = u.parent.career;
                const tl = u.parent.childCount > 0 ? combineTimelineStages([it, ...(u.parent.childCareers || [])]) : it.timelineStages;
                const st = (tl || []).find((s: any) => s.name === sortColumn);
                return st ? st.substages.reduce((a: number, s: any) => a + (s.candidates?.length || 0), 0) : 0;
            };
            const keyOf = (u: any) => {
                const it = u.parent.career;
                if (sortColumn === "Job Title") return (it.jobTitle || "").toLowerCase();
                if (sortColumn === "Project") return (it.projectName || "").toLowerCase();
                if (sortColumn === "Job Owner") return ownerName(it);
                return stageTotal(u);
            };
            units.sort((a, b) => {
                const ka: any = keyOf(a), kb: any = keyOf(b);
                const cmp = typeof ka === "number" ? ka - kb : String(ka).localeCompare(String(kb));
                return sortDir === "asc" ? cmp : -cmp;
            });
        }
        const visible: any[] = [];
        let topCounter = 0;
        for (const u of units) {
            topCounter++;
            u.parent.displayIndex = String(topCounter);
            visible.push(u.parent);
            if (opts?.allRows || expandedParents[String(u.parent.career.id)]) {
                u.children.forEach((c: any, ci: number) => { c.displayIndex = `${topCounter}.${ci + 1}`; visible.push(c); });
            }
        }
        const isPerStage = columnVisibility.type === "Show per stage";
        const cellTooltips: Record<number, Record<string, React.ReactNode>> = {};
        return {
            columnHeaders: headers,
            rows: visible.map((r, i) => {
                const item = r.career;
                const isParent = r.depth === 0 && r.childCount > 0;
                // JIA-431 "Combine data from Child and Parent Post": a parent row shows the
                // full funnel merged across itself + all its child posts.
                const countsCareer = isParent
                    ? { ...item, timelineStages: combineTimelineStages([item, ...(r.childCareers || [])]) }
                    : item;
                const titleCell = (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, paddingLeft: r.depth === 1 ? 24 : 0 }}>
                        {r.depth === 1 && <span style={{ color: "#717680", fontSize: 14 }} aria-hidden>↳</span>}
                        {isParent && (
                            <img
                                src="/iconsV3/chevron-down.svg"
                                alt={expandedParents[String(item.id)] ? "Collapse child posts" : "Expand child posts"}
                                onClick={(e) => {
                                    // The title cell is wrapped in an <a> (row navigates to the career);
                                    // the chevron alone must toggle expansion without navigating.
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExpandedParents((p) => ({ ...p, [String(item.id)]: !p[String(item.id)] }));
                                }}
                                style={{
                                    width: 12,
                                    height: 7,
                                    cursor: "pointer",
                                    transform: expandedParents[String(item.id)] ? "none" : "rotate(-90deg)",
                                    transition: "transform 0.2s ease",
                                }}
                            />
                        )}
                        <span>{item.jobTitle || "-"}</span>
                        {isParent && (
                            <span style={{ fontSize: 12, color: "#717680" }}>
                                {r.childCount} child post{r.childCount > 1 ? "s" : ""}
                            </span>
                        )}
                    </span>
                );
                // JIA-431: hovering a stage NUMBER shows its sub-stage breakdown for this row.
                if (isPerStage) {
                    const tips: Record<string, React.ReactNode> = {};
                    for (const fs of formattedStages) {
                        if ((fs as any).isDropped) continue;
                        const st = (countsCareer.timelineStages || []).find((s: any) => s.name === fs.label);
                        if (!st) continue;
                        tips[fs.label] = (
                            <div style={{ fontSize: 12, lineHeight: "18px" }}>
                                <div style={{ fontWeight: 700, color: "#181D27", marginBottom: 2 }}>{DISPLAY_LABEL[fs.label] ?? fs.label}</div>
                                {(st.substages || []).map((sub: any) => (
                                    <div key={sub.name} style={{ color: "#414651" }}>{sub.name}: {sub.candidates?.length || 0}</div>
                                ))}
                            </div>
                        );
                    }
                    cellTooltips[i] = tips;
                }
                const hasNote = item.notes && String(item.notes).trim();
                const notesCell = (
                    <span
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openNoteModal(item); }}
                        style={{ cursor: "pointer", color: hasNote ? "#181D27" : "#6941C6", fontWeight: hasNote ? 400 : 500 }}
                    >
                        {hasNote ? (String(item.notes).length > 40 ? String(item.notes).slice(0, 40) + "…" : String(item.notes)) : "Add note"}
                    </span>
                );
                return {
                    "#": (r as any).displayIndex || String(i + 1),
                    "Project": item.projectName || "-",
                    "Job Title": titleCell,
                    "Job Owner": <JobOwner career={item} />,
                    "Status": <CareerStatusBadges career={item} />,
                    ...getStageCounts(formattedStages, countsCareer, columnVisibility.type),
                    ...Object.fromEntries(enabledOthers.map((k) =>
                        k === "Notes" ? [k, notesCell] : [k, getExtraColumnValue(item, k as any)]
                    )),
                    metadata: {
                        _id: item._id,
                        jobTitle: item.jobTitle || "-",
                        createdAt: item.createdAt,
                        notes: hasNote ? String(item.notes) : "-",
                        jobOwner: item.teamMembers?.find((member: any) => member.role === "Job Owner") || item.createdBy,
                        publishedStatus: item.status === "active" ? "Published" : "Unpublished",
                        activityStatus: item.activityStatus,
                        jobPostType: item.jobPostType ? item.jobPostType?.charAt(0)?.toUpperCase() + item.jobPostType?.slice(1) : "-",
                    },
                };
            }),
            cellTooltips,
        };
    }

    // Memoized: getTableData builds row JSX + per-cell tooltips for every visible row, so
    // unrelated state changes (modals, fullscreen flag, export spinner) must not recompute it.
    // Deps = everything getTableData closes over that can change between renders.
    const tableData = useMemo(
        () => pipelineReport ? getTableData(columnVisibility, pipelineReport) : { columnHeaders: [] as string[], rows: [] as any[], cellTooltips: {} as Record<number, Record<string, React.ReactNode>> },
        // eslint-disable-next-line react-hooks/exhaustive-deps -- getTableData is render-scoped; its mutable inputs are listed
        [pipelineReport, columnVisibility, sortColumn, sortDir, expandedParents]
    );
    const orderedData = useMemo(() => {
        // Apply the persisted drag-reorder. Columns not yet in the saved order (e.g. a stage
        // or "Others" column enabled after saving) sort to the END via the 999 sentinel,
        // keeping their relative order (Array.sort is stable).
        const orderedHeaders = columnOrder.length
            ? [...tableData.columnHeaders].sort((a, b) => {
                const ia = columnOrder.indexOf(a);
                const ib = columnOrder.indexOf(b);
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            })
            : tableData.columnHeaders;
        return { ...tableData, columnHeaders: orderedHeaders };
    }, [tableData, columnOrder]);

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 24 }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span>Pipeline Reports</span>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#414651", border: "1px solid #D5D7DA", borderRadius: 6, padding: "2px 6px", backgroundColor: "#FFFFFF" }}>{totalCareers}</div>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <MultiFilterDropdown
                        filterTypes={["careerStatuses", "jobOwners", "projects", "contributors", "careers", "hiringManagers"]}
                        setOptions={(value) => {
                            setFilterStatus(value);
                            setPage(1);
                        }}
                        options={filterStatus}
                        showSetAsDefaultToggle
                        iconJsx={<img src="/iconsV3/filter.svg" alt="Filter" style={{ width: 16, height: 16 }} />}
                        iconPosition="left"
                        valuePrefix="Filters"
                        projectId={projectId}
                        isSetAsDefault={isSetAsDefault}
                        isSetAsDefaultLoading={isSetAsDefaultLoading}
                        onSetAsDefaultChange={handleSetAsDefaultChange}
                    />
                    <Button variant="secondary" disabled={!pipelineReport || isLoading || totalCareers === 0} onClick={() => setIsCustomizeColumnModalOpen(true)} label="Customize Columns" icon="/icons/pipeline-report-column.svg" />
                    <Button variant="secondary" disabled={!pipelineReport || isLoading || totalCareers === 0} onClick={() => setIsFullscreenView(true)} label="View fullscreen" icon="/iconsV3/fullscreen.svg" />
                    <CustomDropdown
                        value="Export"
                        setValue={(v) => { if (v === "Export as CSV") handleDownloadCSV(); if (v === "Export as XLSX") handleDownloadXLSX(); }}
                        options={["Export as CSV", "Export as XLSX"]}
                        iconJsx={<img src="/icons/download-cloud.svg" alt="Export" style={{ width: 16, height: 16 }} />}
                        suffixIconJsx={<img src="/iconsV3/chevron-down.svg" alt="" style={{ width: 12, height: 7 }} />}
                        buttonStyle={{ backgroundColor: "#181D27", color: "#FFFFFF", border: "1px solid #181D27", borderRadius: 8 }}
                        disabled={!pipelineReport || isLoading || totalCareers === 0}
                    />
                {/* Pagination */}
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <span>{limit * (page - 1) + 1} - {limit * page > totalCareers ? totalCareers : limit * page} of {totalCareers}</span>
                    <Button variant="secondary" disabled={page <= 1} onClick={() => { if (page > 1) setPage(page - 1); }} label="" icon="/icons/arrow.svg" />
                    <Button variant="secondary" disabled={page >= Math.ceil(totalCareers / limit)} onClick={() => { if (page < Math.ceil(totalCareers / limit)) setPage(page + 1); }} label="" icon="/icons/arrow.svg" iconStyle={{ transform: "rotate(180deg)" }} />
                </div>
                </div>
            </div>

            {/* Table */}
            {
                shouldShowPipelineLoading ? 
                <div className="table-responsive">
                <table className="table align-items-center table-flush">
                <thead>
                  <tr>
                    <th scope="col" className={styles.tableHeaderCell}>#</th>
                    <th scope="col" className={styles.tableHeaderCell}>Project</th>
                    <th scope="col" className={styles.tableHeaderCell}>Job Title</th>
                    <th scope="col" className={styles.tableHeaderCell}>Job Owner</th>
                    <th scope="col" className={styles.tableHeaderCell}>Status</th>
                    <th scope="col" className={styles.tableHeaderCell}>CV Screening</th>
                    <th scope="col" className={styles.tableHeaderCell}>AI Interview</th>
                    <th scope="col" className={styles.tableHeaderCell}>Human Interview</th>
                    <th scope="col" className={styles.tableHeaderCell}>Job Offer</th>
                  </tr>
                </thead>
                <tbody className="list">
                  <TableLoader type="careers-v2" />
                </tbody>
              </table>
              </div> : pipelineReport ? <TableMetric
                    data={orderedData}
                    enableColumnReorder
                    onColumnReorder={(o) => setColumnOrder(o)}
                    fixedColumns={["#", "Project", "Job Title", "Job Owner", "Status"]}
                    getCellTooltip={(col: string, ri: number) => orderedData.cellTooltips?.[ri]?.[col]}
                    columnLabels={DISPLAY_LABEL}
                    sortableColumns={SORTABLE_COLUMNS}
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={onSort}
                    instanceId="main"
                /> : <NoDataAvailable />
            }
            {isCustomizeColumnModalOpen && <CustomizeColumnModal columnVisibility={columnVisibility} setColumnVisibility={setColumnVisibility} setIsCustomizeColumnModalOpen={setIsCustomizeColumnModalOpen} />}
            {noteModalCareer && <AddNoteModal career={noteModalCareer} onClose={() => setNoteModalCareer(null)} onSave={(note) => saveNote(noteModalCareer, note)} />}
            {isLoadingFullReport && <FullScreenLoadingAnimation title="Exporting Full Pipeline Report" subtext="Please wait while we export the full pipeline report" />}
            {isFullscreenView && <TableMetric
                data={orderedData}
                isFullscreenView={true}
                onCloseFullscreenView={() => setIsFullscreenView(false)}
                enableColumnReorder
                onColumnReorder={(o) => setColumnOrder(o)}
                fixedColumns={["#", "Project", "Job Title", "Job Owner", "Status"]}
                getCellTooltip={(col: string, ri: number) => orderedData.cellTooltips?.[ri]?.[col]}
                columnLabels={DISPLAY_LABEL}
                sortableColumns={SORTABLE_COLUMNS}
                sortColumn={sortColumn}
                sortDir={sortDir}
                onSort={onSort}
                instanceId="fullscreen"
            />}
        </div>
    )
}

// JIA-431: "Add a note" modal — recruiter-only note on a career, shown in the Notes column.
function AddNoteModal({ career, onClose, onSave }: { career: any; onClose: () => void; onSave: (note: string) => void }) {
    const [note, setNote] = useState<string>(career?.notes || "");
    return (
        <div className="modal-background fade-in-bottom">
            <div className="modal-container">
                <div className="modal-content" style={{ width: "100%", maxWidth: 640, background: "#fff", border: "1.5px solid #E9EAEB", borderRadius: 14, boxShadow: "0 8px 32px rgba(30,32,60,0.18)", padding: 24, position: "relative" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 500, color: "#181D27" }}>Add a note</span>
                        <span style={{ fontSize: 14, fontWeight: 400, color: "#717680" }}>{career?.jobTitle || ""}</span>
                    </div>
                    <div style={{ position: "absolute", top: 16, right: 16, cursor: "pointer" }} onClick={onClose}>
                        <img src="/icons/close.svg" alt="Close" style={{ width: 28, height: 28 }} />
                    </div>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Enter note"
                        style={{ width: "100%", minHeight: 160, marginTop: 16, padding: 12, border: "1px solid #D5D7DA", borderRadius: 8, fontSize: 14, color: "#181D27", resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
                        <Button variant="secondary" label="Cancel" onClick={onClose} />
                        <Button variant="primary" label="Save" onClick={() => onSave(note)} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function CustomizeColumnModal({ columnVisibility, setColumnVisibility, setIsCustomizeColumnModalOpen }: { columnVisibility: any, setColumnVisibility: (value: any) => void, setIsCustomizeColumnModalOpen: (value: boolean) => void }) {
    const [activeTab, setActiveTab] = useState(columnVisibility.type);
    const [includeDroppedCandidates, setIncludeDroppedCandidates] = useState(columnVisibility.includeDroppedCandidates);
    const tabOptions = ["Show per stage", "Show per sub-stage"];
    const [careerPipelineStages, setCareerPipelineStages] = useState<any>([]);
    const [otherColumns, setOtherColumns] = useState<Record<string, boolean>>(
        columnVisibility.otherColumns || { "Created Date": false, "Headcount": false, "Notes": false }
    );

    useEffect(() => {
        if (columnVisibility) {
            const allStages = [...columnVisibility.stages, ...columnVisibility.offerStages];
            setCareerPipelineStages(allStages);
        }
    }, [columnVisibility])
    return (
        <div className="modal-background fade-in-bottom">
            <div className="modal-container">
                <div className="modal-content" style={{ overflowY: "auto", height: "100%", maxHeight: "90vh", width: "100%", maxWidth: "400px", background: "#fff", border: `1.5px solid #E9EAEB`, borderRadius: 14, boxShadow: "0 8px 32px rgba(30,32,60,0.18)", padding: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 16, width: "100%" }}>
                        <div style={{ width: 48, height: 48, borderRadius: "10px", border: "1px solid #D5D7DA", backgroundColor: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <img src="/icons/pipeline-report-column.svg" alt="Customize Columns" style={{ width: 24, height: 24 }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                            <span style={{ fontSize: 16, fontWeight: 500, color: "#181D27" }}>Customize Columns</span>
                            <span style={{ fontSize: 14, fontWeight: 400, color: "#717680" }}>Show or hide columns in this table</span>
                        </div>
                    </div>

                    <div style={{ position: "absolute", top: 16, right: 16, cursor: "pointer" }} onClick={() => setIsCustomizeColumnModalOpen(false)}>
                        <img src="/icons/close.svg" alt="Close" style={{ width: 32, height: 32 }} />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", flexDirection: "row", height: "44px", maxWidth: "460px", width: "100%", backgroundColor: "#EAECF5", borderRadius: "10px", border: "1px solid #D5D7DA"}}>
                        {tabOptions.map((option, index) => (
                            <div 
                            key={index}
                        style={{ 
                            display:"flex",
                            flexDirection: "row", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            gap: 8, 
                            width: "50%", 
                            height: "100%", 
                            backgroundColor: activeTab === option ? "#FFFFFF" : "#EAECF5", 
                            color: activeTab === option ? "#414651" : "#717680",
                            borderRadius: "10px",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                            border: activeTab === option ? "1px solid #D5D7DA" : "none",
                            }}
                            onClick={() => {
                                setActiveTab(option);
                                // Update the enabled state of all stages to be compatible with the new tab
                                if (option === "Show per stage") {
                                // If ALL substages are disabled, then the stage should be disabled. Else enabled and the substages should be enabled
                                setCareerPipelineStages((prev: any) => prev.map((stage: any) => {
                                    const allSubstagesDisabled = stage.substages.every((substage: any) => !substage.enabled);
                                    return {
                                        ...stage,
                                        enabled: allSubstagesDisabled ? false : true,
                                        substages: stage.substages.map((substage: any) => ({
                                            ...substage,
                                            enabled: allSubstagesDisabled ? false : true,
                                        }))
                                    };
                                }));
                                } else {
                                    // If the stage is disabled, then all the substages should be disabled. Else enabled and the substages should be enabled
                                    setCareerPipelineStages((prev: any) => prev.map((stage: any) => {
                                        return {
                                            ...stage,
                                            enabled: stage.enabled,
                                            substages: stage.substages.map((substage: any) => ({
                                                ...substage,
                                                enabled: stage.enabled ? true : false,
                                            })),
                                        };
                                    }));
                                }
                            }}
                        >
                            <span style={{ fontSize: 14, color: "#414651", fontWeight: 500 }}>{option}</span>
                        </div>))}
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 16, width: "100%", border: "1px solid #E9EAEB", borderRadius: 10, padding: 16 }}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={includeDroppedCandidates}
                        onChange={() => {
                            setIncludeDroppedCandidates(!includeDroppedCandidates);
                        }}
                      />
                      <span className="slider round"></span>
                    </label>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", width: "100%" }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>Show dropped per stage</span>
                            <span style={{ fontSize: 12, fontWeight: 400, color: "#717680" }}>Enables metrics on dropped candidates per stage</span>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", width: "100%", height: "350px", overflowY: "auto", gap: 8 }}>
                    {activeTab === "Show per stage" ? (
                    careerPipelineStages.map((stage: any, index: number) => (
                        <div 
                        key={index}
                        style={{
                            width: "100%",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "flex-start",
                            justifyContent: "flex-start",
                            gap: "8px",
                          }}
                        >
                        <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={stage.enabled}
                        onChange={(e) => {
                            setCareerPipelineStages((prev: any) => prev.map((s: any) => s.label === stage.label ? { ...s, enabled: !s.enabled, substages: s.substages.map((substage: any) => ({ ...substage, enabled: !substage.enabled })) } : s));
                        }}
                      />
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", textAlign: "left", width: "100%" }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>{stage.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 400, color: "#717680" }}>{stage.substages.map((substage: any) => substage.label?.split(" - ")?.[1]).join(" + ")}</span>
                        </div>
                        </div>
                    ))
                    ) : (
                        careerPipelineStages.map((stage: any) => (
                            stage.substages.map((substage: any, index: number) => (
                                <div 
                                key={substage.label}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "flex-start",
                                    justifyContent: "flex-start",
                                    gap: "8px",
                                    borderBottom: index === stage.substages.length - 1 ? "1px solid #E9EAEB" : "none",
                                    paddingBottom: "8px",
                                }}
                                >
                                <input
                                type="checkbox"
                                className="custom-checkbox"
                                checked={substage.enabled}
                                onChange={(e) => {
                                    setCareerPipelineStages((prev: any) => prev.map((s: any) => s.label === stage.label ? { ...s, substages: s.substages.map((sub: any) => sub.label === substage.label ? { ...sub, enabled: !sub.enabled } : sub) } : s));
                                }}
                            />
                                <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", textAlign: "left", width: "100%" }}>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>{stage.label}</span>
                                    <span style={{ fontSize: 14, fontWeight: 400, color: "#717680" }}>{substage.label?.split(" - ")?.[1]}</span>
                                </div>
                            </div>
                            ))
                        ))
                    )}
                    </div>
                    
                    <div style={{ width: "100%", textAlign: "left" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#181D27" }}>Others</span>
                        {Object.keys(otherColumns).map((key) => (
                            <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                                <input type="checkbox" className="custom-checkbox" checked={otherColumns[key]}
                                    onChange={() => setOtherColumns((p) => ({ ...p, [key]: !p[key] }))} />
                                <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>{key}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 16 }}>
                        <Button variant="secondary" style={{ width: "50%" }} onClick={() => setIsCustomizeColumnModalOpen(false)} label="Cancel" />
                        <Button variant="primary" style={{ width: "50%" }} onClick={() => {
                            setIsCustomizeColumnModalOpen(false);
                            setColumnVisibility((prev: any) => ({
                                ...prev,
                                type: activeTab,
                                includeDroppedCandidates: includeDroppedCandidates,
                                otherColumns,
                                stages: prev.stages.map((stage: any) => ({
                                    ...stage,
                                    enabled: careerPipelineStages.find((s: any) => s.label === stage.label)?.enabled,
                                    substages: stage.substages.map((substage: any) => ({
                                        ...substage,
                                        enabled: careerPipelineStages.find((s: any) => s.label === stage.label)?.substages.find((sub: any) => sub.label === substage.label)?.enabled,
                                    })),
                                })),
                                offerStages: prev.offerStages.map((stage: any) => ({
                                    ...stage,
                                    enabled: careerPipelineStages.find((s: any) => s.stageId === stage.stageId)?.enabled,
                                    substages: stage.substages.map((substage: any) => ({
                                        ...substage,
                                        enabled: careerPipelineStages.find((s: any) => s.stageId === stage.stageId)?.substages.find((s: any) => s.substageId === substage.substageId)?.enabled,
                                    })),
                                })),

                            }));
                        }} label="Apply" />
                    </div>
                </div>
                </div>
            </div>
        </div>
    )
}
