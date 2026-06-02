"use client"
import React,{ useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/utils/apiClient";
import { useSearchParams, useRouter } from "next/navigation";
import { errorToast } from "@/lib/Utils";
import moment from "moment";
import LoadingAnimation from "@/lib/components/Loaders/LoadingAnimation";
import MetricDateFilter, { DateFilter } from "@/lib/components/AnalyticsComponents/MetricDateFilter";
import Fuse from "fuse.js";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { MetricType, ChartTypeDisplay, metricChartSettings, chartTypes, defaultAnalyticsDashboard } from "@/lib/utils/recruiterAnalytics";
import ActiveCareersChart from "@/lib/components/AnalyticsComponents/ActiveCareers";
import NoDataAvailable from "@/lib/components/AnalyticsComponents/NoDataAvailable";
import HiresChart from "@/lib/components/AnalyticsComponents/Hires";
import NewApplicantsChart from "@/lib/components/AnalyticsComponents/NewApplicants";
import ApplicationVolumeChart from "@/lib/components/AnalyticsComponents/ApplicationVolume";
import TimeToHireChart from "@/lib/components/AnalyticsComponents/TimeToHire";
import DropOffRateChart from "@/lib/components/AnalyticsComponents/DropOff";
import StageAgingChart from "@/lib/components/AnalyticsComponents/StageAging";
import OfferAcceptanceRateChart from "@/lib/components/AnalyticsComponents/OfferAcceptanceRate";
import EndorsementEfficiencyChart from "@/lib/components/AnalyticsComponents/EndorsementEfficiency";
import MultiFilterDropdown from "../../Dropdown/MultiFilterDropdown";
import { Button } from "../../ui";
import FullScreenLoadingAnimation from "../../CareerComponents/FullScreenLoadingAnimation";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import StagePassRate from "../../AnalyticsComponents/StagePassRate";
import { useRecruiterDashboardViewPreferences } from "@/lib/hooks/filterSortDefaults/useRecruiterDashboardViewPreferences";

const SATOSHI_FONT_PATH = "/fonts/Satoshi-Regular.ttf";

/** Load Satoshi TTF from public/fonts and register it with jsPDF. Returns true if loaded. */
async function loadSatoshiFont(pdf: import("jspdf").jsPDF): Promise<boolean> {
    try {
        const res = await fetch(SATOSHI_FONT_PATH);
        if (!res.ok) return false;
        const arrayBuffer = await res.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
        }
        const fontName = "Satoshi-Regular.ttf";
        pdf.addFileToVFS(fontName, binary);
        pdf.addFont(fontName, "Satoshi", "normal");
        pdf.setFont("Satoshi", "normal");
        return true;
    } catch {
        return false;
    }
}

async function resolveOrgImageForPdf(image: string): Promise<{ data: string; format: string } | null> {
    if (!image || typeof image !== "string") return null;
    const trimmed = image.trim();
    if (!trimmed) return null;

    try {
        if (trimmed.startsWith("data:")) {
            const match = trimmed.match(/^data:image\/(\w+);base64,/i);
            const format = (match?.[1] ?? "png").toUpperCase();
            return { data: trimmed, format: format };
        }
        if (/^https?:\/\//i.test(trimmed)) {
            const res = await fetch(trimmed, { mode: "cors" });
            if (!res.ok) return null;
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            const mime = blob.type.toLowerCase();
            const format = mime.toUpperCase();
            return { data: dataUrl, format };
        }
        if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
            return { data: `data:image/png;base64,${trimmed}`, format: "PNG" };
        }
        return null;
    } catch {
        console.error("Error resolving org image for pdf", image);
        return null;
    }
}

const getDateFilterLabel = (selectedDateFilter: DateFilter) => {
    switch (selectedDateFilter.type) {
        case "Today":
            return "Today";
        case "7D":
            return "Last 7 days";
        case "30D":
            return "Last 30 days";
        case "3M":
            return "Last 3 months";
        case "6M":
            return "Last 6 months";
        case "12M":
            return "Last 12 months";
        case "All-time":
            return "All Time";
        case "Custom":
            return `${moment(selectedDateFilter.startDate).format("MMM D, YYYY")} - ${moment(selectedDateFilter.endDate).format("MMM D, YYYY")}`;
        case "Default":
            return `This month (${moment().format("MMMM YYYY")})`;
    }
}

const getMemberIdentifier = (member: any) => String(member?.id || member?.email || "");

export default function RecruiterDashboard({ setIsSavingAnalyticsDashboard }: { setIsSavingAnalyticsDashboard: (isSaving: boolean) => void }) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const [recruiterAnalytics, setRecruiterAnalytics] = useState<any>(null);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
    const router = useRouter();
    const isLoadingRecruiterAnalytics = useRef(false);
    const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilter>({
        type: "7D",
        startDate: null,
        endDate: null
    });
    const [activeGraphMenu, setActiveGraphMenu] = useState<string | null>(null);
    const [analyticsDashboard, setAnalyticsDashboard] = useState<any>([]);
    const [hoveredMetric, setHoveredMetric] = useState<MetricType | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [hoveredResizer, setHoveredResizer] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const MIN_CARD_WIDTH = 20; // Minimum width in percentage
    const MIN_CARD_HEIGHT = 174;
    const RESIZER_WIDTH_PERCENTAGE = 1.5;
    const [isLoadingAnalyticsDashboard, setIsLoadingAnalyticsDashboard] = useState(false);
    const initialDashboardLoaded = useRef(true);
    const [isMobile, setIsMobile] = useState(false);
    const [filterOptions, setFilterOptions] = useState<{jobOwners: {id?: string, email?: string, name: string}[], contributors: {id?: string, email?: string, name: string}[], projects: {_id: string, name: string}[], careers: {id: string, jobTitle: string}[], hiringManagers: {id?: string, email?: string, name: string}[]}>({
        jobOwners: [],
        contributors: [],
        projects: [],
        careers: [],
        hiringManagers: []
    });
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const dashboardPdfRef = useRef<HTMLDivElement>(null);
    const [activeOrg] = useLocalStorage("activeOrg", null);
    const {
        isViewStateReady,
        isSetAsDefault,
        isSetAsDefaultLoading,
        handleSetAsDefaultChange,
    } = useRecruiterDashboardViewPreferences({
        orgID,
        selectedDateFilter,
        filterOptions,
        setSelectedDateFilter,
        setFilterOptions,
    });
    const shouldShowMetricsLoading = (Boolean(orgID) && !isViewStateReady) || isLoadingMetrics;

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 1000);
        };
        handleResize();
        window.addEventListener("resize", handleResize);

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (
                !target.closest('[data-analytics-dropdown-menu="true"]') &&
                !target.closest('[data-analytics-dropdown-trigger="true"]')
            ) {
                setActiveGraphMenu(null);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
             window.removeEventListener("resize", handleResize);
             document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!isViewStateReady) {
            return;
        }
        const fetchRecruiterStats = async () => {
            if (selectedDateFilter.type === "Custom" && !selectedDateFilter.startDate && !selectedDateFilter.endDate) {
                return;
            }
            if (isLoadingRecruiterAnalytics.current) return;
            isLoadingRecruiterAnalytics.current = true;
            try {
                setIsLoadingMetrics(true);
                const response = await api.get("/api/get-analytics", { params: { 
                    orgID, 
                    timeFilter: selectedDateFilter.type,
                    startDate: selectedDateFilter.startDate,
                    endDate: selectedDateFilter.endDate,
                    careerFilter: filterOptions.careers.map((c) => c.id).join(","),
                    projectFilter: filterOptions.projects.map((p) => p._id).join(","),
                    jobOwnerFilter: filterOptions.jobOwners.map((j) => j.email).filter(Boolean).join(","),
                    contributorFilter: filterOptions.contributors.map((c) => c.email).filter(Boolean).join(","),
                    hiringManagerFilter: filterOptions.hiringManagers.map((h) => h.email).filter(Boolean).join(","),
                } });

                if (response.status === 200) {
                    setRecruiterAnalytics(response.data);
                }
            } catch (error) {
                console.log(error);
                errorToast("Error failed to load recruiter metrics", 1300);
            } finally {
                setIsLoadingMetrics(false);
                isLoadingRecruiterAnalytics.current = false;
            }
        }

        if (orgID) {
            fetchRecruiterStats();
        } else {
            setIsLoadingMetrics(false);
        }
    }, [isViewStateReady, orgID, selectedDateFilter, filterOptions]);


    useEffect(() => {
        const fetchAnalyticsDashboard = async () => {
            setIsLoadingAnalyticsDashboard(true);
            try {
                const response = await api.get("/api/analytics", { params: { orgID } });
                if (response.status === 200) {
                    setAnalyticsDashboard(response.data.data);
                }
            } catch (error) {
                console.log(error);
                errorToast("Error failed to load analytics dashboard", 1300);
            } finally {
                setIsLoadingAnalyticsDashboard(false);
                initialDashboardLoaded.current = false;
            }
        }
        if (orgID) {
            fetchAnalyticsDashboard();
        }
    }, [orgID]);
    
    const handleClickMetricCard = (metric: string) => {
        router.push(`/recruiter-dashboard/${metric}?orgID=${orgID}`);
    }
    
    const handleWidthResizeStart = (rowName: string, leftCardIndex: number, rightCardIndex: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        
        const startX = e.clientX;
        const container = containerRef.current;
        if (!container) return;
        
        const containerWidth = container.offsetWidth;
        const resizerWidth = 20; // Width of each resizer
        const cardMargin = 10; // Margin on right side of each card

        const rowData = analyticsDashboard.find((row: any) => row.name === rowName);
        const startLeftWidth = rowData?.metrics[leftCardIndex].width;
        const startRightWidth = rowData?.metrics[rightCardIndex].width;
        
        const totalResizerWidth = (rowData?.metrics.length - 1) * resizerWidth; // Two resizers
        const totalCardMargins = (rowData?.metrics.length - 1) * cardMargin; // Margins for first two cards
        const availableWidth = containerWidth - totalResizerWidth - totalCardMargins;
        
        
        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startX;
            const deltaPercent = (deltaX / availableWidth) * 100;
            
            const newLeftWidth = startLeftWidth + deltaPercent;
            const newRightWidth = startRightWidth - deltaPercent;
            
            // Check minimum width constraints
            if (newLeftWidth >= MIN_CARD_WIDTH && newRightWidth >= MIN_CARD_WIDTH) {
               setAnalyticsDashboard((prev) => {
                    const newAnalyticsDashboard = [...prev];
                    const rowData = newAnalyticsDashboard.find((row: any) => row.name === rowName);
                    if (rowData) {
                        rowData.metrics[leftCardIndex].width = newLeftWidth;
                        rowData.metrics[rightCardIndex].width = newRightWidth;
                    }
                    return newAnalyticsDashboard;
               });
            }
        };
        
        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    const handleHeightResizeStart = (topRowName: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);

        const startY = e.clientY;
        const container = containerRef.current;
        if (!container) return;

        const containerHeight = container.offsetHeight;
        const resizerHeight = 20; // Height of each resizer
        const cardMargin = 10; // Margin on bottom side of each card
        const totalResizerHeight = 2 * resizerHeight; // Two resizers
        const totalCardMargins = 2 * cardMargin; // Margins for first two cards
        const availableHeight = containerHeight - totalResizerHeight - totalCardMargins;

        const rowData = analyticsDashboard.find((row: any) => row.name === topRowName);
        const startTopHeight = rowData ? rowData.height : 0;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaY = e.clientY - startY;
            const deltaPercent = (deltaY / availableHeight) * 100;
            
            const newTopHeight = startTopHeight + deltaPercent;

            // Check minimum height constraints
            if (newTopHeight >= MIN_CARD_HEIGHT) {
                setAnalyticsDashboard((prev) => {
                    const newAnalyticsDashboard = [...prev];
                    const rowData = newAnalyticsDashboard.find((row: any) => row.name === topRowName);
                    if (rowData) {
                    rowData.height = newTopHeight;
                    }
                    return newAnalyticsDashboard;
                });
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    const handleDragMetric = (metricName: MetricType, targetRow: string, originRow: string, originIndex: number, index: number) => {
        if (originIndex === index && targetRow === originRow) {
            return;                            
        }

        // Only allow new cards if row contains less than 3 cards
        if (targetRow !== originRow && analyticsDashboard.find((row: any) => row.name === targetRow)?.metrics.length === 3) {
            return;
        }

        if (metricName && originRow && targetRow) {
            const originRowData = analyticsDashboard.find((row: any) => row.name === originRow);
            const targetRowData = analyticsDashboard.find((row: any) => row.name === targetRow);

            const targetUpdatedRow = targetRow === originRow ? originRowData : targetRowData;
            const metricDetails = originRowData.metrics[originIndex];
            originRowData.metrics.splice(originIndex, 1);

            for (const metric of originRowData.metrics) {
                const resizerBuffer = RESIZER_WIDTH_PERCENTAGE * (originRowData.metrics.length - 1);
                metric.width = ((100 - resizerBuffer) / originRowData.metrics.length);
            }
            
            const insertIndex = index ?? 0;
            
            targetUpdatedRow.metrics.splice(insertIndex, 0, metricDetails);
            for (const metric of targetUpdatedRow.metrics) {
                const resizerBuffer = RESIZER_WIDTH_PERCENTAGE * (targetUpdatedRow.metrics.length - 1);
                metric.width = ((100 - resizerBuffer) / targetUpdatedRow.metrics.length);
            }
            // Update widths
            setAnalyticsDashboard((prev) => {
                const updated = [...prev];
                const originRowIndex = updated.findIndex((row: any) => row.name === originRow);
                if (originRowData?.metrics.length > 0) {
                    updated[originRowIndex] = originRowData;
                } else {
                    // Remove empty row
                    updated.splice(originRowIndex, 1);
                }
                const targetRowIndex = updated.findIndex((row: any) => row.name === targetRow);
                updated[targetRowIndex] = targetUpdatedRow;
                return updated;
            });
        }
    }
    
    
    const handleSaveAnalyticsDashboard = async (updatedAnalyticsDashboard: any) => {
        try {
            setIsSavingAnalyticsDashboard(true);
            await api.post("/api/analytics", {
                orgID,
                analyticsDashboard: updatedAnalyticsDashboard,
            });
        } catch (error) {
            console.log(error);
            errorToast("Error saving analytics dashboard", 1300);
        } finally {
            setIsSavingAnalyticsDashboard(false);
        }
    }

    const computeMaxWidth = (row: any) => {
        if (row.metrics.length > 1) {
            return `${100 - ((MIN_CARD_WIDTH * (row.metrics.length - 1)))}%`
        }
        return "100%";
    }

    useEffect(() => {
        if (!isResizing && analyticsDashboard.length > 0 && !initialDashboardLoaded.current) {
            handleSaveAnalyticsDashboard(analyticsDashboard);
        }
    }, [analyticsDashboard, isResizing]);

    const handleIndividualExportPdf = async () => {
        const dashboardRef = dashboardPdfRef.current;
        if (!dashboardRef) return;
        setIsExportingPdf(true);
        try {
            const [html2canvasModule, jspdfModule] = await Promise.all([
                import("html2canvas"),
                import("jspdf"),
            ]);
            const html2canvas = html2canvasModule.default;

            const PX_TO_MM = 25.4 / 96;
            
            const el = dashboardRef as HTMLElement;
            const overFlowWidth = el.scrollWidth;

            const origOverflow = el.style.overflow;
            const origWidth = el.style.width;
            const origMinWidth = el.style.minWidth;
            const origMaxWidth = el.style.maxWidth;
            el.style.overflow = "visible";
            el.style.minWidth = `${overFlowWidth}px`;
            el.style.width = `${overFlowWidth}px`;
            el.style.maxWidth = "none";
            let canvas: HTMLCanvasElement;
            await new Promise(resolve => setTimeout(resolve, 1500));
            const boundingBox = el.getBoundingClientRect();
            const scrollW = boundingBox.width;
            const scrollH = boundingBox.height;
            
            // Reserve space for header on first page; jsPDF uses mm
            const margin = 8;
            const { jsPDF } = jspdfModule;
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: [scrollW * PX_TO_MM, scrollH * PX_TO_MM],
            });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            await loadSatoshiFont(pdf);
            pdf.setTextColor("#181D27")
            pdf.setFontSize(14);
            // Background
            pdf.setFillColor("#F8F9FC");
            pdf.rect(0, 0, pdfWidth, pdfHeight, "F");
            // Org logo + name as one block, centered at top of page
            if (activeOrg) {
                const logoSize = 10;
                const gap = 2;
                const textWidth = pdf.getTextWidth(activeOrg.name);
                const blockWidth = logoSize + gap + textWidth;
                const startX = pdfWidth / 2 - blockWidth / 2;
                const startY = (margin * 3) / 2;
                const logoResolved = activeOrg.image ? await resolveOrgImageForPdf(activeOrg.image) : null;
                if (logoResolved) {
                    pdf.addImage(logoResolved.data, logoResolved.format, startX, startY - (logoSize / 1.5), logoSize, logoSize);
                }
                pdf.text(activeOrg.name, startX + logoSize + gap, startY);
            }
            pdf.setFillColor("#FFFFFF");
            pdf.roundedRect(margin, margin * 3, pdfWidth - 2 * margin, pdfHeight - 4 * margin, 8, 8, "F");

            const headerTopMargin = margin * 3;
            // Margin inside the rect
            const innerMargin = 16;
            pdf.text("Your Hiring Analytics", innerMargin, headerTopMargin + innerMargin);
            pdf.setFontSize(8);
            pdf.setTextColor("#717680");
            let filterLabel = `From ${(!["Today", "All-time", "Custom"].includes(selectedDateFilter.type) ? "the " : "") + getDateFilterLabel(selectedDateFilter)}`;
            if (filterOptions.careers.length > 0) {
                filterLabel += ` | Career: ${filterOptions.careers.map((c) => c.jobTitle).join(", ")}`;
            }
            if (filterOptions.projects.length > 0) {
                filterLabel += ` | Project: ${filterOptions.projects.map((p) => p.name).join(", ")}`;
            }
            if (filterOptions.jobOwners.length > 0) {
                filterLabel += ` | Job Owner: ${filterOptions.jobOwners.map((j) => j.name).join(", ")}`;
            }
            if (filterOptions.contributors.length > 0) {
                filterLabel += ` | Contributor: ${filterOptions.contributors.map((c) => c.name).join(", ")}`;
            }
            if (filterOptions.hiringManagers.length > 0) {
                filterLabel += ` | Hiring Manager: ${filterOptions.hiringManagers.map((h) => h.name).join(", ")}`;
            }
            pdf.text(filterLabel, innerMargin, headerTopMargin + innerMargin + 5);
            pdf.setFontSize(8);
            const lastUpdatedText = `Last Updated: ${moment().format("h:mm A dddd, MMMM D YYYY")}`;
            const textWidth = pdf.getTextWidth(lastUpdatedText);
            pdf.text(lastUpdatedText, pdfWidth - textWidth - innerMargin, headerTopMargin + innerMargin);

            const captureScale = 1.5; // Higher res capture for sharper PDF output
            let currentY = headerTopMargin + innerMargin + 15; // below header
            // Rect is at (15, 15) with size (pdfWidth - 30, pdfHeight - 30); fit image inside it
            const maxImgWidth = pdfWidth - (2 * (margin + innerMargin));
            const maxImgHeight = pdfHeight - margin - innerMargin - currentY; // from image top to rect bottom
            try {
                canvas = await html2canvas(el, {
                    scale: captureScale,
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff",
                    width: scrollW,
                    height: scrollH,
                    windowWidth: scrollW,
                    windowHeight: scrollH,
                });
            } finally {
                el.style.overflow = origOverflow;
                el.style.width = origWidth;
                el.style.minWidth = origMinWidth;
                el.style.maxWidth = origMaxWidth;
            }
            const imgData = canvas.toDataURL("image/png", 1.0);
            const imgWmm = (canvas.width / captureScale) * PX_TO_MM;
            const imgHmm = (canvas.height / captureScale) * PX_TO_MM;
            const scale = Math.min(maxImgWidth / imgWmm, maxImgHeight / imgHmm, 1);
            const drawW = imgWmm * scale;
            const drawH = imgHmm * scale;
            const x = margin + innerMargin + ((maxImgWidth - drawW) / 2);
            pdf.addImage(imgData, "PNG", x, currentY, drawW, drawH);

            const fileName = `${activeOrg?.name?.replace(/ /g, "-")}-hiring-analytics-${moment().format("YYYY-MM-DD")}.pdf`;
            pdf.save(fileName);
        } catch (err) {
            console.error("PDF export failed:", err);
            errorToast("Failed to export PDF", 1300);
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <div className="recruiter-dashboard-container">
            <div className="filter-button-container">
                <MetricDateFilter isDisabled={isLoadingMetrics} selectedDateFilter={selectedDateFilter} setSelectedDateFilter={setSelectedDateFilter} />
                <MultiFilterDropdown
                options={filterOptions}
                setOptions={(value) => {
                    setFilterOptions(value);
                }}
                filterTypes={["careers", "jobOwners", "contributors", "projects", "hiringManagers"]}
                showSetAsDefaultToggle
                isSetAsDefault={isSetAsDefault}
                isSetAsDefaultLoading={isSetAsDefaultLoading}
                onSetAsDefaultChange={handleSetAsDefaultChange}
                icon="la-filter"
                valuePrefix="Filters"
                /> 
                <Button
                    label={isExportingPdf ? "Exporting..." : "Export PDF"}
                    iconJsx={<img src="/icons/download-cloud.svg" alt="PDF Icon" width={16} height={16} />}
                    variant="secondary"
                    onClick={handleIndividualExportPdf}
                    disabled={isExportingPdf || isLoadingAnalyticsDashboard || isLoadingMetrics}
                >
                </Button> 
            </div>
            {Object.values(filterOptions).flat().length > 0 && (
                <div className="selected-career-filter-container">
                    {Object.keys(filterOptions).flatMap((key: string) => (
                      filterOptions[key].map((filter: any, index: number) => (
                        <div key={`${key}-${index}`} className="selected-career-filter-item">
                        <span>{filter.jobTitle || filter.name}</span>
                        <i className="la la-times" onClick={() => {
                            if (key === "careers") {
                                setFilterOptions((prev) => ({ ...prev, careers: prev.careers.filter((c) => c.id !== filter.id) }))
                            } 
                            if (key === "contributors") {
                                const selectedId = getMemberIdentifier(filter);
                                setFilterOptions((prev) => ({ ...prev, contributors: prev.contributors.filter((c) => getMemberIdentifier(c) !== selectedId) }))
                            }
                            if (key === "jobOwners") {
                                const selectedId = getMemberIdentifier(filter);
                                setFilterOptions((prev) => ({ ...prev, jobOwners: prev.jobOwners.filter((j) => getMemberIdentifier(j) !== selectedId) }))
                            }
                            if (key === "projects") {
                                setFilterOptions((prev) => ({ ...prev, projects: prev.projects.filter((p) => p._id !== filter._id) }))
                            }
                            if (key === "hiringManagers") {
                                const selectedId = getMemberIdentifier(filter);
                                setFilterOptions((prev) => ({ ...prev, hiringManagers: prev.hiringManagers.filter((h) => getMemberIdentifier(h) !== selectedId) }))
                            }
                        }}></i>
                    </div>
                    ))))}
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10, height: "100%" }}>
                        <div style={{ height: "100%", width: "1px", backgroundColor: "#D5D7DA" }} />
                        <span className="clear-filters-button" onClick={() => {
                            setFilterOptions({
                                jobOwners: [],
                                contributors: [],
                                projects: [],
                                careers: [],
                                hiringManagers: []
                            })
                        }}>Clear Filters</span>
                    </div>
                </div>
            )}
            <div ref={dashboardPdfRef} className="recruiter-dashboard-pdf-export">
            {isLoadingAnalyticsDashboard ? (
                defaultAnalyticsDashboard.map((row: any, index: number) => (
                    <div 
                    key={index} 
                    className="recruiter-dashboard-metrics-container" 
                    style={{ 
                        minHeight: isMobile ? "fit-content" : `${MIN_CARD_HEIGHT}px`, 
                        maxHeight: isMobile ? "none" : `${MIN_CARD_HEIGHT}px`, 
                        height: isMobile ? "auto" : `${MIN_CARD_HEIGHT}px`, 
                        gap: isMobile ? 16 : 10 
                    }}>
                        {row.metrics.map((metric: any, metricIndex: number) => (
                            <div 
                            key={metricIndex} 
                            className="recruiter-dashboard-metric-card" 
                            style={{ 
                                flex: isMobile ? "0 0 100%" : `0 0 ${metric.width}%`, 
                                minWidth: isMobile ? "100%" : `${MIN_CARD_WIDTH}%`, 
                                maxWidth: isMobile ? "100%" : computeMaxWidth(row),
                                height: isMobile ? (metric.defaultChartType === "metric" ? "174px" : "360px") : "100%",
                                minHeight: isExportingPdf ? MIN_CARD_HEIGHT : `${row.height}px`,
                            }}>
                                <div className="metric-header">
                                    <div className="metric-header-title">
                                        <div className="skeleton-bar blink-2" style={{ width: "120px", height: "14px" }}></div>
                                    </div>
                                </div>
                                <div className="metric-content">
                                    <LoadingAnimation text={`Loading...`} subtext="Please wait while we load the data" />
                                </div>
                            </div>
                        ))}
                    </div>
                ))
            ) : analyticsDashboard.map((row: any, rowIndex: number) => (
              <React.Fragment key={rowIndex}>
                <div 
                className="recruiter-dashboard-metrics-container" 
                ref={containerRef}
                style={{
                    minHeight: isMobile || isExportingPdf ? "fit-content" : `${MIN_CARD_HEIGHT}px`,
                    maxHeight: "none",
                    height: isMobile ? "auto" : isExportingPdf ? "fit-content" : `${row.height}px`,
                    gap: isMobile ? 16 : 0,
                }}
            >
                {row.metrics.map((metric: any, metricIndex: number) => (
                    <React.Fragment key={metricIndex}>
                      <div 
                      className="recruiter-dashboard-metric-card"
                      style={{ 
                          flex: isMobile ? "0 0 100%" : isExportingPdf ? "1" : `0 0 ${metric.width}%`,
                          minWidth: isMobile ? "100%" : isExportingPdf ? "fit-content" : `${MIN_CARD_WIDTH}%`,
                          maxWidth: isMobile ? "100%" : isExportingPdf ? "none" : computeMaxWidth(row),
                          height: isMobile ? (metric.defaultChartType === "metric" ? "174px" : "360px") : "100%",
                          minHeight: isExportingPdf ? MIN_CARD_HEIGHT : "auto",
                      }}
                      draggable={!isMobile}
                      onDragStart={(e) => {
                          e.dataTransfer.setData("metricName", metric.name);
                          e.dataTransfer.setData("row", row.name);
                          e.dataTransfer.setData("index", metricIndex.toString());
                      }}
                      onDragOver={(e) => {
                          if (isMobile) return;
                          e.preventDefault();
                          const target = e.currentTarget;
  
                          const bounding = target.getBoundingClientRect();
                          const offset = bounding.y + bounding.height / 2;
  
                          if (e.clientY - offset > 0) {
                            target.style.borderBottom = "3px solid #6941C6";
                            target.style.borderTop = "none";
                          } else {
                            target.style.borderTop = "3px solid #6941C6";
                            target.style.borderBottom = "none";
                          }
                      }}
                      onDragLeave={(e) => {
                          if (isMobile) return;
                          e.currentTarget.style.borderTop = "none";
                          e.currentTarget.style.borderBottom = "none";
                      }}
                      onDrop={(e) => {
                          if (isMobile) return;
                          e.preventDefault();
                          e.currentTarget.style.borderTop = "none";
                          e.currentTarget.style.borderBottom = "none";
  
                          const metricName = e.dataTransfer.getData("metricName");
                          const originRow = e.dataTransfer.getData("row");
                          const originIndex = Number(e.dataTransfer.getData("index"));
  
                          handleDragMetric(metricName as MetricType, row.name, originRow, originIndex, metricIndex);
                      }}
                      onMouseEnter={(e) => {
                          setHoveredMetric(metric.name);
                      }}
                      onMouseLeave={(e) => {
                          setHoveredMetric(null);
                      }}
                      >
                      <div className="metric-header" onClick={() => handleClickMetricCard(metric.name)}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "auto", width: "90%" }}>
                              <div className="metric-header-title">
                                  {!isMobile && hoveredMetric === metric.name && 
                                  <i className="la la-bars" style={{ fontSize: 15, cursor: "grab" }} />
                                  }
                                  <img className="chart-icon" src="/chart-icon.png" alt="Chart Icon" width={15} height={15} />
                                  <h3>
                                  <a
                                      href={`/recruiter-dashboard/${metric.name}?orgID=${orgID}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        router.push(`/recruiter-dashboard/${metric.name}?orgID=${orgID}`);
                                      }}
                                      style={{ color: "inherit", textDecoration: "none" }}
                                    >
                                    {metricChartSettings[metric.name]?.title}
                                    </a>
                                </h3>
                                  {!isExportingPdf && <GraphInfoTooltip tooltipText={metricChartSettings[metric.name]?.tooltipText} />}
                              </div>
                              <MetricHeaderFilter selectedDateFilter={selectedDateFilter} filterOptions={filterOptions} />
                          </div>
  
                          {!isExportingPdf && <GraphMenuButton 
                              availableChartTypes={metricChartSettings[metric.name]?.availableChartTypes}
                              menuOpen={activeGraphMenu === metric.name}
                              onClick={(chartType) => {
                                  // Toggle menu
                                  if (!chartType) {
                                      setActiveGraphMenu(prev => prev === metric.name ? null : metric.name);
                                      return;
                                  }

                                  // Check chart type
                                  if (chartType) {
                                    setAnalyticsDashboard((prev) => {
                                        const newAnalyticsDashboard = [...prev];
                                        const rowData = newAnalyticsDashboard.find((rowData: any) => rowData.name === row.name);
                                        if (rowData) {
                                            rowData.metrics[metricIndex].defaultChartType = chartType;
                                        }
                                        return newAnalyticsDashboard;
                                    });
                                    setActiveGraphMenu(null);
                                  }
                              }}
                              selectedChartType={metric.defaultChartType}
                              position={isMobile ? "right" : (metricIndex === row.metrics.length - 1 ? "right" : "left")}
                          />}
                      </div>
                      <div className="metric-content" style={{ justifyContent: metric.name === "stage-aging" ? "flex-start" : "center" }}>
                          {shouldShowMetricsLoading ? (<LoadingAnimation text={`Loading ${metricChartSettings[metric.name]?.title}`} subtext="Please wait while we load the data" />) :
                          recruiterAnalytics ?
                          <MetricChart recruiterAnalytics={recruiterAnalytics} metricName={metric.name} chartType={metric.defaultChartType} />
                          : <NoDataAvailable />}
                      </div>
                      </div>
                  {!isMobile && metricIndex < row.metrics.length - 1 && <CardResizer
                      id={metric.name}
                      onMouseDown={(e) => handleWidthResizeStart(row.name, metricIndex, metricIndex + 1, e)}
                      onMouseEnter={() => setHoveredResizer(metric.name)}
                      onMouseLeave={() => setHoveredResizer(null)}
                      isHovered={hoveredResizer === metric.name}
                      isResizing={isResizing}
                      type={metric.resizeType}
                  />}
                </React.Fragment>
                ))}
            </div>
            {!isMobile && rowIndex < analyticsDashboard.length - 1 && <CardResizer
                id={row.name}
                onMouseDown={(e) => handleHeightResizeStart(row.name, e)}
                onMouseEnter={() => setHoveredResizer(row.name)}
                onMouseLeave={() => setHoveredResizer(null)}
                isHovered={hoveredResizer === row.name}
                isResizing={isResizing}
                type="horizontal"
            />}
            </React.Fragment>))}
            </div>
            <ReactTooltip className="career-fit-tooltip fade-in" id="graph-info-tooltip"/>
            {isExportingPdf && <FullScreenLoadingAnimation title="Exporting PDF" subtext="Please wait while we create the PDF" />} 
        </div>
    )
}

export const MetricHeaderFilter = ({ selectedDateFilter, filterOptions, defaultDateFilter }: { selectedDateFilter: DateFilter, filterOptions: any, defaultDateFilter?: string }) => {
    const getActiveFilters = () => {
        let defaultFilter = [];
        if (filterOptions.careers.length > 0) {
            defaultFilter.push(`Careers: ${filterOptions.careers.map((c) => c.jobTitle).join(", ")}`);
        }

        if (filterOptions.projects.length > 0) {
            defaultFilter.push(`Projects: ${filterOptions.projects.map((p) => p.name).join(", ")}`);
        }

        if (filterOptions.jobOwners.length > 0) {
            defaultFilter.push(`Careers owned by: ${filterOptions.jobOwners.map((j) => j.name).join(", ")}`);
        }

        if (filterOptions.contributors.length > 0) {
            defaultFilter.push(`Contributors: ${filterOptions.contributors.map((c) => c.name).join(", ")}`);
        }

        if (filterOptions.hiringManagers.length > 0) {
            defaultFilter.push(`Hiring Managers: ${filterOptions.hiringManagers.map((h) => h.name).join(", ")}`);
        }

        if (defaultFilter.length === 0) {
            defaultFilter.push("All Careers");
        }

        return defaultFilter;
    }
    return (
        <div style={{ width: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <span style={{ lineHeight: 1.5 }}>
            <span>{selectedDateFilter.type === "Default" && defaultDateFilter ? defaultDateFilter : getDateFilterLabel(selectedDateFilter)}</span>
            <i className="la la-circle" style={{ fontSize: 4, backgroundColor: "#717680", borderRadius: "50%", verticalAlign: "middle", margin: "0 4px" }}></i>
            {getActiveFilters().map((filter, index) => <React.Fragment key={index}>
            <span>{filter}</span>
            {index < getActiveFilters().length - 1 && <i className="la la-circle" style={{ fontSize: 4, backgroundColor: "#717680", borderRadius: "50%", verticalAlign: "middle", margin: "0 4px" }}></i>}
            </React.Fragment>)}
        </span>
        </div>
    )
}


export function CareerMultiSelectDropdown(props) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const { onApply, selectedOptions, label, error, disabled } = props;
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [careerFilters, setCareerFilters] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [searchCareer, setSearchCareer] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fuseOptions = {
      keys: ["jobTitle"],
      threshold: 0.3,
    };
  
    const filteredCareers = useMemo(() => {
      if (!searchCareer) return careerFilters;
      const fuse = new Fuse(careerFilters, fuseOptions);
      return fuse.search(searchCareer).map((result) => result.item);
    }, [searchCareer, careerFilters]);
    const isLoadingRef = useRef(null);
    
    useEffect(() => {
        const fetchCareerFilters = async () => {
            if (isLoadingRef.current) return;
            isLoadingRef.current = true;

            try {
                setIsLoading(true);
                const response = await api.post("/api/fetch-careers", { 
                    orgID,
                });
                setCareerFilters(response.data);
            } catch (error) {
                errorToast("Error fetching Careers", 1300);
            } finally {
                setIsLoading(false);
                isLoadingRef.current = false;
            }
        }
        if (orgID) {
            fetchCareerFilters();
        }
     }, [orgID]);

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

  return (
        <div ref={dropdownRef} className="dropdown w-100" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", maxWidth: "318px" }}>
          <button
            disabled={filteredCareers.length === 0 || disabled}
            className="dropdown-btn fade-in-bottom"
            style={{ width: "100%", color: "#181D27", border: error ? "1px solid #F04438" : "1px solid #D5D7DA" }}
            type="button"
            onClick={() => {
                if (disabled) return;
                setDropdownOpen((v) => !v);
            }}
          >
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <i
                className={
                    careerFilters.find(
                    (option) => option.id === selectedOptions.find((o) => o.id === option.id)
                  )?.icon
                }
              ></i>{" "}
              {label + (selectedOptions.length > 0 ? ` (${selectedOptions.length})` : "")}
            </span>
            <i className="la la-angle-down ml-10"></i>
          </button>
          {error && !dropdownOpen && <span style={{ color: "#F04438", fontSize: 14, fontWeight: 500 }}>{error}</span>}
          <div
            className={`dropdown-menu w-100 mt-1 org-dropdown-anim${
              dropdownOpen ? " show" : ""
            }`}
            style={{
              padding: "10px",
              maxHeight: 200,
              overflowY: "auto",
              width: "fit-content",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <div className="table-search-bar" style={{ width: "100%" }}>
                <div className="icon mr-2">
                    <i className="la la-search"></i>
                </div>
                <input
                    type="text"
                    className="form-control search-input"
                    placeholder="Search"
                    value={searchCareer}
                    onChange={(e) => setSearchCareer(e.target.value)}
                />
             </div>
            {filteredCareers.map((option, index) => (
              <div style={{ borderBottom: "1px solid #ddd" }} key={index}>
                <button
                  className="dropdown-item d-flex align-items-center"
                  style={{
                    width: "100%",
                    borderRadius: selectedOptions.some((c) => c.id === option.id) ? 0 : 10,
                    overflow: "hidden",
                    paddingBottom: 10,
                    paddingTop: 10,
                    color: "#181D27",
                    fontWeight: selectedOptions.some((c) => c.id === option.id) ? 700 : 500,
                    background: selectedOptions.some((c) => c.id === option.id) ? "#F8F9FC" : "transparent",
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    whiteSpace: "wrap",
                  }}
                  onClick={() => {
                    if (disabled) return;
                    onApply(option);
                    setDropdownOpen(false);
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                  {option.icon && <i className={option.icon}></i>} {option.jobTitle?.replace("_", " ")}
                  </div>
                  {selectedOptions.some((c) => c.id === option.id) && (
                            <i
                                className="la la-check"
                                style={{
                                    fontSize: "20px",
                                    background: "linear-gradient(180deg, #9FCAED 0%, #CEB6DA 33%, #EBACC9 66%, #FCCEC0 100%)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    backgroundClip: "text",
                                    color: "transparent"
                                }}
                            ></i>
                        )}
                </button>
              </div>
            ))}
            {isLoading && (
                <div style={{ display: "flex", justifyContent: "center", width: "100%", height: "100%", marginTop: "20px" }}>
                    <h1 className="fade-in">
                        <i className="la la-circle-notch spin la-2x text-primary"></i>
                    </h1>
                </div>
            )}
            {/* End of list message */}
            {!isLoading && (
                filteredCareers.length > 0 ? (
                <div style={{ display: "flex", justifyContent: "center", width: "100%", height: "100%", marginTop: "20px" }}>
                    <span style={{ color: "#717680", fontSize: 14, fontWeight: 500 }}>You've reached the end of the list</span>
                </div>) : 
                <div style={{ display: "flex", justifyContent: "center", width: "100%", height: "100%", marginTop: "20px" }}>
                    <span style={{ color: "#717680", fontSize: 14, fontWeight: 500 }}>No careers found</span>
                </div>
            )}
          </div>
        </div>
  );
}
 
const CardResizer = ({ 
    id, 
    onMouseDown, 
    onMouseEnter, 
    onMouseLeave, 
    isHovered, 
    isResizing,
    type
}: { 
    id: string;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    isHovered: boolean;
    isResizing: boolean;
    type: "vertical" | "horizontal";
}) => {
    return (
        <div
            id={id}
            className={`card-resizer ${isHovered || isResizing ? "resizer-hovered" : ""} ${type === "horizontal" ? "horizontal-resizer" : ""}`}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                cursor: isResizing ? (type === "horizontal" ? "row-resize" : "col-resize") : (type === "horizontal" ? "row-resize" : "col-resize"),
            }}
        />
    );
};

export const GraphInfoTooltip = ({ tooltipText }: { tooltipText: string }) => {
    return (
        <a
        data-tooltip-id="graph-info-tooltip"
        data-tooltip-html={tooltipText || "No information available"}
      >
        <i className="la la-question-circle" style={{ fontSize: 20, color: "#A4A7AE", cursor: "pointer" }}></i>
      </a>
    )
 }

 export const GraphMenuButton = ({ menuOpen, availableChartTypes, onClick, selectedChartType, position = "left" }: { menuOpen: boolean, availableChartTypes: ChartTypeDisplay[], onClick: (chartType?: ChartTypeDisplay) => void, selectedChartType: ChartTypeDisplay, position?: "left" | "right" }) => {
    const [chartTypeOpen, setChartTypeOpen] = useState(false);

    const handleClickChartType = (chartType: ChartTypeDisplay) => {
        setChartTypeOpen(false);
        onClick(chartType);
    }
    return (
        <div className="dropdown">
        <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        data-analytics-dropdown-trigger="true"
        >
            <i className="la la-ellipsis-v" style={{ fontSize: 16, color: "#787486" }}></i>
        </button>
        {menuOpen && (
          <div 
          className={`dropdown-menu ${position === "left" ? "dropdown-menu-left" : "dropdown-menu-right"} w-100 mt-1 org-dropdown-anim${
              menuOpen ? " show" : ""
              }`}
          data-analytics-dropdown-menu="true"
          style={{
              padding: "10px 0px"
          }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#414651", marginLeft: 15 }}>Report Widget</span>
            <div className="dropdown-divider"></div>
            <div className="dropdown-item" 
            onMouseOver={() => setChartTypeOpen(true)}
            onMouseOut={() => setChartTypeOpen(false)}
            onClick={(e) => {
                e.stopPropagation();
                setChartTypeOpen(!chartTypeOpen);
            }}>
                <div className="dropdown" style={{ width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>Chart Type</span>
                    <i className="la la-angle-right" style={{ fontSize: 16, color: "#787486" }}></i>
                </div>
                {chartTypeOpen && (
                    <div 
                    className={`dropdown-menu w-100 mt-1 org-dropdown-anim${chartTypeOpen ? " show" : ""}`}
                    style={{
                        left: position === "left" ? "100%" : "auto",
                        right: position === "right" ? "100%" : "auto",
                        top: 0,
                        maxHeight: "279px",
                        overflowY: "auto",
                    }}
                    >
                        {chartTypes.filter((chartType) => availableChartTypes.includes(chartType.id as ChartTypeDisplay)).map((chartType) => (
                            <div 
                            className="dropdown-item"
                            style={{
                                backgroundColor: selectedChartType === chartType.id ? "#EEF4FF" : "transparent",
                            }}
                            key={chartType.id} 
                            onClick={() => handleClickChartType(chartType.id as ChartTypeDisplay)}>
                                <img src={chartType.iconAsset} alt={chartType.label} style={{ width: 20, height: 20 }} />
                                <span style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginLeft: 10 }}>{chartType.label}</span>
                            </div>
                        ))}
                        </div>
                )}
                        </div>
                </div>
            </div>)}
        </div>
    )
}

const MetricChart = ({ recruiterAnalytics, metricName, chartType }: { recruiterAnalytics: any, metricName: MetricType, chartType: ChartTypeDisplay }) => {
    switch (metricName) {
        case "active-careers":
            return <ActiveCareersChart data={recruiterAnalytics?.activeCareers} chartTypeDisplay={chartType} />
        case "new-applicants":
            return <NewApplicantsChart data={recruiterAnalytics?.newApplicants} chartTypeDisplay={chartType} />
        case "hires":
            return <HiresChart data={recruiterAnalytics?.hires} chartTypeDisplay={chartType} />
        case "application-volume":
            return <ApplicationVolumeChart data={recruiterAnalytics?.applicationVolume?.days} chartTypeDisplay={chartType} />
        case "time-to-hire":
            return <TimeToHireChart data={recruiterAnalytics?.timeToHire} chartTypeDisplay={chartType} />
        case "drop-off-rate":
            return <DropOffRateChart data={recruiterAnalytics?.dropOffRate} chartTypeDisplay={chartType} />
        case "stage-pass-rate":
            return <StagePassRate data={recruiterAnalytics?.stagePassRate} chartTypeDisplay={chartType} />
        case "stage-aging":
            return <StageAgingChart data={recruiterAnalytics?.stageAging?.careers} chartTypeDisplay={chartType} />
        case "offer-acceptance-rate":
            return <OfferAcceptanceRateChart data={recruiterAnalytics?.offerAcceptanceRate?.data} chartTypeDisplay={chartType} />
        case "endorsement-efficiency":
            return <EndorsementEfficiencyChart data={recruiterAnalytics?.endorsementEfficiency?.data} chartTypeDisplay={chartType} />
        default:
            return <NoDataAvailable />
    }
}
