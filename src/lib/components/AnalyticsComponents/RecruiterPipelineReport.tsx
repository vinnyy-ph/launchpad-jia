"use client";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import TableMetric from "./TableMetric";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import CareerStatusBadges from "../CareerComponents/CareerStatusBadge";
import { JobOwner } from "../DataTables/CareersTableV2";
import { Button } from "../ui";
import { errorToast } from "@/lib/Utils";
import TableLoader from "@/lib/Loader/TableLoader";
import NoDataAvailable from "./NoDataAvailable";
import styles from "@/lib/styles/analytics/graphs.module.scss";
import MultiFilterDropdown from "../Dropdown/MultiFilterDropdown";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import CustomDropdown from "../Dropdown/CustomDropdown";
import FullScreenLoadingAnimation from "../CareerComponents/FullScreenLoadingAnimation";
import { usePipelineReportViewPreferences } from "@/lib/hooks/filterSortDefaults/usePipelineReportViewPreferences";
import { getReportStages, getFormattedStages, getStageCounts } from "@/lib/utils/pipelineReport";

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
    const [columnVisibility, setColumnVisibility] = useState({
        type: "Show per stage",
        includeDroppedCandidates: false,
        stages: [],
        offerStages: [],
    });
    const [sortBy, setSortBy] = useState<string>("Position Name (A-Z)");
    const sortByOptions = ["Position Name (A-Z)", "Position Name (Z-A)", "Project Name (A-Z)", "Project Name (Z-A)"];
    const [isLoadingFullReport, setIsLoadingFullReport] = useState(false);
    const [isFullscreenView, setIsFullscreenView] = useState(false);

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
                    params: { 
                        orgID: orgID, 
                        limit: limit, 
                        page: page,
                        status: filterStatus["Published Status"].join(","),
                        projectIds: projectId ? projectId : filterStatus.projects.map((p) => p._id).join(","),
                        activityStatus: filterStatus["Activity Status"].join(","),
                        jobPostType: filterStatus["Subscription Plan"].join(","),
                        careers: filterStatus.careers.map((c) => c.id).join(","),
                        sortBy: sortBy,
                        jobOwners: filterStatus.jobOwners.map((j) => j.email).filter(Boolean).join(","),
                        contributors: filterStatus.contributors.map((c) => c.email).filter(Boolean).join(","),
                        hiringManagers: filterStatus.hiringManagers.map((h) => h.email).filter(Boolean).join(","),
                    } 
                });
                setPipelineReport(response.data.careers)
                setTotalCareers(response.data.totalCareers);
                const { stages, offerStages } = getReportStages(response.data.careers);
                setColumnVisibility({
                    type: "Show per stage",
                    includeDroppedCandidates: false,
                    stages: stages,
                    offerStages: offerStages,
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
        let newHeaders = formattedData.columnHeaders;
        newHeaders.splice(3, 1, "Published Status", "Activity Status", "Job Post Type");
        const csvContent = `${newHeaders.join(",")}` + "\n" + formattedData.rows.map((row: any) => newHeaders.map((header: any) => {
            if (header === "Job Owner") {
                return row.metadata.jobOwner.name;
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
                return row[header]?.replace(/,/g, "");
            }
            return row[header];
        }).join(",")).join("\n");
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
        headers.splice(3, 1, "Published Status", "Activity Status", "Job Post Type");
        const aoa = [
            headers,
            ...formattedData.rows.map((row: any) => headers.map((header: string) => {
                if (header === "Job Owner") return row.metadata.jobOwner?.name ?? "-";
                if (header === "Published Status") return row.metadata.publishedStatus;
                if (header === "Activity Status") return row.metadata.activityStatus;
                if (header === "Job Post Type") return row.metadata.jobPostType;
                if (header === "Job Title") return typeof row[header] === "string" ? row[header] : (row.metadata?.jobTitle ?? "-");
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
                params: { 
                    orgID: orgID, 
                    limit: limit, 
                    page: page,
                    status: filterStatus["Published Status"].join(","),
                    jobOwners: filterStatus.jobOwners.map((j) => j.email).join(","),
                    projectIds: projectId ? projectId : filterStatus.projects.map((p) => p._id).join(","),
                    contributors: filterStatus.contributors.map((c) => c.email).join(","),
                    activityStatus: filterStatus["Activity Status"].join(","),
                    jobPostType: filterStatus["Subscription Plan"].join(","),
                    careers: filterStatus.careers.map((c) => c.id).join(","),
                    sortBy: sortBy,
                    fullReport: true,
                    hiringManagers: filterStatus.hiringManagers.map((h) => h.email).join(","),
                } 
            });
            const { stages, offerStages } = getReportStages(response.data.careers);
            // Match enabled state with the stages and offerStages
            const updatedStages = stages.map((stage: any) => {
                const existingStage = columnVisibility.stages.find((s: any) => s.label === stage.label);
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
            const updatedOfferStages = offerStages.map((stage: any) => {
                const existingStage = columnVisibility.offerStages.find((s: any) => s.label === stage.label);
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
            })
            const formattedData = getTableData({
                ...columnVisibility,
                stages: updatedStages,
                offerStages: updatedOfferStages,
            }, response.data.careers);
            return formattedData;
        } catch (error) {
            console.error(error);
            errorToast("Error fetching full pipeline report", 1300);
        } finally {
            setIsLoadingFullReport(false);
        }
    }

    const getTableData = (columnVisibility: any, pipelineReport: any[]) => {
        const formattedStages = getFormattedStages(columnVisibility);
        const headers = ["Project", "Job Title", "Job Owner", "Status", ...formattedStages.map((stage) => stage.label)];
        return {
            columnHeaders: headers,
            rows: pipelineReport.map((item: any) => {
                return {
                    "Project": item.projectName || "-",
                    "Job Title": item.jobTitle || "-",
                    "Job Owner": <JobOwner career={item} />,
                    "Status": <CareerStatusBadges career={item} />,
                    ...getStageCounts(formattedStages, item, columnVisibility.type),
                    metadata: {
                        _id: item._id,
                        jobOwner: item.teamMembers?.find((member: any) => member.role === "Job Owner") || item.createdBy,
                        publishedStatus: item.status === "active" ? "Published" : "Unpublished",
                        activityStatus: item.activityStatus,
                        jobPostType: item.jobPostType ? item.jobPostType?.charAt(0)?.toUpperCase() + item.jobPostType?.slice(1) : "-",
                    }
                }
            }),
        }
    }
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 24 }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span>Pipeline Reports</span>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#414651", border: "1px solid #D5D7DA", borderRadius: 6, padding: "2px 6px", backgroundColor: "#FFFFFF" }}>{totalCareers}</div>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <CustomDropdown 
                        value={sortBy} 
                        setValue={(value) => setSortBy(value)} 
                        options={sortByOptions}
                        suffixIconJsx={<img src="/iconsV3/chevron-down.svg" alt="Chevron down" style={{ width: 12, height: 7 }} />}
                        iconJsx={<img src="/iconsV3/sortV2.svg" alt="Sort" style={{ width: 16, height: 16 }} />} valuePrefix="Sort by:" 
                    />
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
                        disabled={!pipelineReport || isLoading || totalCareers === 0}
                    />
                {/* Pagination */}
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <span>{limit * (page - 1) + 1} - {limit * page > totalCareers ? totalCareers : limit * page} of {totalCareers}</span>
                    {page > 1 && <Button variant="secondary" onClick={() => setPage(page - 1)} label="" icon="/icons/arrow.svg" />}
                    {page < Math.ceil(totalCareers / limit) && <Button variant="secondary" onClick={() => setPage(page + 1)} label="" icon="/icons/arrow.svg" iconStyle={{ transform: "rotate(180deg)" }} />}
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
                    <th scope="col" className={styles.tableHeaderCell}>
                      Job Title
                    </th>
                    <th scope="col" className={styles.tableHeaderCell}>Job Owner</th>
                    <th scope="col" className={styles.tableHeaderCell}>Project</th>
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
              </div> : pipelineReport ? <TableMetric data={getTableData(columnVisibility, pipelineReport)} /> : <NoDataAvailable />
            }
            {isCustomizeColumnModalOpen && <CustomizeColumnModal columnVisibility={columnVisibility} setColumnVisibility={setColumnVisibility} setIsCustomizeColumnModalOpen={setIsCustomizeColumnModalOpen} />}
            {isLoadingFullReport && <FullScreenLoadingAnimation title="Exporting Full Pipeline Report" subtext="Please wait while we export the full pipeline report" />}
            {isFullscreenView && <TableMetric data={getTableData(columnVisibility, pipelineReport)} isFullscreenView={true} onCloseFullscreenView={() => setIsFullscreenView(false)} />}
        </div>
    )
}

function CustomizeColumnModal({ columnVisibility, setColumnVisibility, setIsCustomizeColumnModalOpen }: { columnVisibility: any, setColumnVisibility: (value: any) => void, setIsCustomizeColumnModalOpen: (value: boolean) => void }) {
    const [activeTab, setActiveTab] = useState(columnVisibility.type);
    const [includeDroppedCandidates, setIncludeDroppedCandidates] = useState(columnVisibility.includeDroppedCandidates);
    const tabOptions = ["Show per stage", "Show per substage"];
    const [careerPipelineStages, setCareerPipelineStages] = useState<any>([]);

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
                    
                    <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 16 }}>
                        <Button variant="secondary" style={{ width: "50%" }} onClick={() => setIsCustomizeColumnModalOpen(false)} label="Cancel" />
                        <Button variant="primary" style={{ width: "50%" }} onClick={() => {
                            setIsCustomizeColumnModalOpen(false);
                            setColumnVisibility((prev: any) => ({
                                ...prev,
                                type: activeTab,
                                includeDroppedCandidates: includeDroppedCandidates,
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
