"use client";

import { useEffect, useMemo, useState } from "react";
import MetricDateFilter, { type DateFilter } from "@/lib/components/AnalyticsComponents/MetricDateFilter";
import { Button } from "@/lib/components/ui";
import type { ChartTypeDisplay } from "@/lib/utils/recruiterAnalytics";
import SelectDropdown, { type SelectOption } from "@/lib/components/ui/select-dropdown/SelectDropdown";
import { api } from "@/lib/utils/apiClient";
import { chartTypes } from "@/lib/utils/recruiterAnalytics";
import { Tooltip as ReactTooltip } from "react-tooltip";
import LoadingAnimation from "@/lib/components/Loaders/LoadingAnimation";
import TalentVaultMetricChart from "./TalentVaultMetricChart";

// Local metric IDs for Talent Vault
export type TalentVaultMetricId = "registered" | "completed" | "invited" | "hired" | "talent-vault-volume" | "invite-acceptance-rate";

// Local metric configuration (no recruiter MetricType coupling)
interface MetricConfig {
  title: string;
  description: string;
  availableChartTypes: ChartTypeDisplay[];
  defaultChartType: ChartTypeDisplay;
  defaultDateFilter: string;
}

const talentVaultMetricConfig: Record<TalentVaultMetricId, MetricConfig> = {
  registered: {
    title: "Registered",
    description: "Total number of registered candidates in the talent vault.",
    availableChartTypes: ["line", "column", "metric", "table"],
    defaultChartType: "metric",
    defaultDateFilter: "7D",
  },
  completed: {
    title: "Completed",
    description: "Number of candidates who completed their profile.",
    availableChartTypes: ["line", "column", "metric", "table"],
    defaultChartType: "metric",
    defaultDateFilter: "7D",
  },
  invited: {
    title: "Invited",
    description: "Total number of candidates invited to interviews.",
    availableChartTypes: ["line", "column", "metric", "table"],
    defaultChartType: "metric",
    defaultDateFilter: "7D",
  },
  hired: {
    title: "Hired",
    description: "Number of candidates successfully hired.",
    availableChartTypes: ["line", "column", "metric", "table"],
    defaultChartType: "metric",
    defaultDateFilter: "7D",
  },
  "talent-vault-volume": {
    title: "Talent Vault Volume",
    description: "Overall volume metrics for the talent vault.",
    availableChartTypes: ["column", "stacked-column", "stacked-line", "metric", "pie", "table"],
    defaultChartType: "column",
    defaultDateFilter: "7D",
  },
  "invite-acceptance-rate": {
    title: "Invite Acceptance Rate",
    description: "Percentage of invited candidates who accepted the invite.",
    availableChartTypes: ["line", "metric", "retention-curve", "table"],
    defaultChartType: "line",
    defaultDateFilter: "7D",
  },
};

// Row and card layout model
interface CardLayout {
  metricId: TalentVaultMetricId;
  width: number; // percentage
}

interface RowLayout {
  name: string;
  cards: CardLayout[];
  height: number; // pixels
}

const dashboardLayout: RowLayout[] = [
  {
    name: "row-1",
    cards: [
      { metricId: "registered", width: 25 },
      { metricId: "completed", width: 25 },
      { metricId: "invited", width: 25 },
      { metricId: "hired", width: 25 },
    ],
    height: 174,
  },
  {
    name: "row-2",
    cards: [
      { metricId: "talent-vault-volume", width: 50 },
      { metricId: "invite-acceptance-rate", width: 50 },
    ],
    height: 360,
  },
];

type MetricTotals = {
  registered: number;
  completed: number;
  invited: number;
  hired: number;
};

type SubprogramMetricEntry = {
  id: string;
  totals: MetricTotals;
};


const EMPTY_METRIC_TOTALS: MetricTotals = {
  registered: 0,
  completed: 0,
  invited: 0,
  hired: 0,
};


function computeDateRange(filter: DateFilter): { dateFrom: Date | null; dateTo: Date | null } {
  const now = new Date();

  switch (filter.type) {
    case "Today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { dateFrom: start, dateTo: null };
    }
    case "7D":
      return { dateFrom: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), dateTo: null };
    case "30D":
      return { dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), dateTo: null };
    case "3M":
      return { dateFrom: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), dateTo: null };
    case "6M":
      return { dateFrom: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), dateTo: null };
    case "12M":
      return { dateFrom: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), dateTo: null };
    case "All-time":
      return { dateFrom: null, dateTo: null };
    case "Default": {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: firstOfMonth, dateTo: null };
    }
    case "Custom":
      return {
        dateFrom: filter.startDate || null,
        dateTo: filter.endDate || null,
      };
    default:
      return { dateFrom: null, dateTo: null };
  }
}

function sumMetricTotals(entries: SubprogramMetricEntry[]) {
  return entries.reduce(
    (accumulator, entry) => ({
      registered: accumulator.registered + entry.totals.registered,
      completed: accumulator.completed + entry.totals.completed,
      invited: accumulator.invited + entry.totals.invited,
      hired: accumulator.hired + entry.totals.hired,
    }),
    { ...EMPTY_METRIC_TOTALS }
  );
}



function getComparedToLabel(filterType: DateFilter["type"]): string {
  switch (filterType) {
    case "Today": return "compared to yesterday";
    case "7D": return "compared to the previous 7 days";
    case "30D": return "compared to the previous 30 days";
    case "3M": return "compared to the previous 3 months";
    case "6M": return "compared to the previous 6 months";
    case "12M": return "compared to the previous 12 months";
    case "Custom": return "compared to the previous period";
    default: return "";
  }
}

function computePercentChange(current: number, previous: number): string {
  if (previous === 0) return "0.00";
  return (((current - previous) / previous) * 100).toFixed(2);
}
function getDateFilterLabel(selectedDateFilter: DateFilter) {
  if (selectedDateFilter.type === "Today") {
    return "Today";
  }

  if (selectedDateFilter.type === "7D") {
    return "Last 7 days";
  }

  if (selectedDateFilter.type === "30D") {
    return "Last 30 days";
  }

  if (selectedDateFilter.type === "3M") {
    return "Last 3 months";
  }

  if (selectedDateFilter.type === "6M") {
    return "Last 6 months";
  }

  if (selectedDateFilter.type === "12M") {
    return "Last 12 months";
  }

  if (selectedDateFilter.type === "All-time") {
    return "All Time";
  }

  if (selectedDateFilter.type === "Default") {
    return "This month";
  }

  return "Custom";
}

export function MetricDashboard() {
  // Date filter state
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilter>({
    type: "7D",
  });

  // Selected program state
  const [selectedProgram, setSelectedProgram] = useState<string | null>("all");

  // Program options state
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [programOptions, setProgramOptions] = useState<SelectOption[]>([
    { value: "all", label: "All Programs" }
  ]);
  const [subprogramMetrics, setSubprogramMetrics] = useState<SubprogramMetricEntry[]>([]);
  const [timeSeriesRaw, setTimeSeriesRaw] = useState<Array<{
    subprogramId: string;
    date: string;
    registered: number;
    completed: number;
  }>>([]);
  const [comparisonMetricsRaw, setComparisonMetricsRaw] = useState<
    Array<{ subprogramId: string; registered: number; completed: number }>
  >([]);

  // Active graph menu state (for per-card chart type selector)
  const [activeGraphMenu, setActiveGraphMenu] = useState<TalentVaultMetricId | null>(null);

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1000);
    };
    
    // Initial check
    if (typeof window !== "undefined") {
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Per-card selected chart types
  const [selectedChartTypes, setSelectedChartTypes] = useState<Record<TalentVaultMetricId, ChartTypeDisplay>>(
    Object.entries(talentVaultMetricConfig).reduce(
      (acc, [metricId, config]) => {
        acc[metricId as TalentVaultMetricId] = config.defaultChartType;
        return acc;
      },
      {} as Record<TalentVaultMetricId, ChartTypeDisplay>
    )
  );

  // Fetch program options from API
  useEffect(() => {
    let isMounted = true;

    const fetchPrograms = async () => {
      setIsLoadingPrograms(true);

      try {
        const { dateFrom, dateTo } = computeDateRange(selectedDateFilter);
        const params = new URLSearchParams();
        if (dateFrom) params.set("dateFrom", dateFrom.toISOString());
        if (dateTo) params.set("dateTo", dateTo.toISOString());
        params.set("timeSeries", "daily");
        const url = `/api/talent-vault/subprograms?${params.toString()}`;
        const response = await api.get(url);

        if (!isMounted) {
          return;
        }

        const subprograms = Array.isArray(response?.data?.subprograms)
          ? response.data.subprograms
          : [];

        const nextSubprogramMetrics: SubprogramMetricEntry[] = subprograms
          .map((subprogram: any) => ({
            id: String(subprogram?._id || ""),
            totals: {
              registered: typeof subprogram?.registered === "number" ? subprogram.registered : 0,
              completed: typeof subprogram?.completed === "number" ? subprogram.completed : 0,
              invited: typeof subprogram?.invited === "number" ? subprogram.invited : 0,
              hired: typeof subprogram?.hired === "number" ? subprogram.hired : 0,
            },
          }))
          .filter((entry) => entry.id);

        const options: SelectOption[] = [
          { value: "all", label: "All Programs" },
          ...subprograms
            .map((subprogram: any) => ({
              value: String(subprogram?._id || ""),
              label: String(subprogram?.title || "").trim(),
            }))
            .filter((option) => option.value && option.label)
        ];

        setSubprogramMetrics(nextSubprogramMetrics);
        setProgramOptions(options);
        const rawTimeSeries = Array.isArray(response?.data?.timeSeriesMetrics)
          ? response.data.timeSeriesMetrics
          : [];
        setTimeSeriesRaw(rawTimeSeries);
        const rawComparison = Array.isArray(response?.data?.comparisonMetrics)
          ? response.data.comparisonMetrics
          : [];
        setComparisonMetricsRaw(rawComparison);
      } catch (error) {
        console.error("Error fetching talent vault subprograms for filter:", error);

        if (!isMounted) {
          return;
        }

        // Keep fallback option on error
        setSubprogramMetrics([]);
        setTimeSeriesRaw([]);
        setComparisonMetricsRaw([]);
        setProgramOptions([{ value: "all", label: "All Programs" }]);
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
  }, [selectedDateFilter]);

  // Handle outside click to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeGraphMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-analytics-dropdown-trigger="true"]') && 
            !target.closest('[data-analytics-dropdown-menu="true"]')) {
          setActiveGraphMenu(null);
        }
      }
    };

    if (activeGraphMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [activeGraphMenu]);

  const filteredMetricEntries = useMemo(() => {
    if (!selectedProgram || selectedProgram === "all") {
      return subprogramMetrics;
    }

    return subprogramMetrics.filter((entry) => entry.id === selectedProgram);
  }, [selectedProgram, subprogramMetrics]);

  const metricTotals = useMemo(
    () => sumMetricTotals(filteredMetricEntries),
    [filteredMetricEntries]
  );

  const filteredTimeSeries = useMemo(() => {
    const entries =
      selectedProgram && selectedProgram !== "all"
        ? timeSeriesRaw.filter((e) => e.subprogramId === selectedProgram)
        : timeSeriesRaw;

    const byDate = new Map<string, { registered: number; completed: number }>();
    for (const entry of entries) {
      const existing = byDate.get(entry.date);
      if (existing) {
        existing.registered += entry.registered;
        existing.completed += entry.completed;
      } else {
        byDate.set(entry.date, { registered: entry.registered, completed: entry.completed });
      }
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));
  }, [timeSeriesRaw, selectedProgram]);

  const comparisonTotals = useMemo(() => {
    const entries =
      selectedProgram && selectedProgram !== "all"
        ? comparisonMetricsRaw.filter((e) => e.subprogramId === selectedProgram)
        : comparisonMetricsRaw;
    return entries.reduce(
      (acc, e) => ({
        registered: acc.registered + e.registered,
        completed: acc.completed + e.completed,
      }),
      { registered: 0, completed: 0 }
    );
  }, [comparisonMetricsRaw, selectedProgram]);

  const comparedTo = getComparedToLabel(selectedDateFilter.type);
  const hasComparison = comparedTo !== "" && comparisonMetricsRaw.length > 0;
  const comparison = hasComparison
    ? {
        percentageChange: {
          registered: computePercentChange(metricTotals.registered, comparisonTotals.registered),
          completed: computePercentChange(metricTotals.completed, comparisonTotals.completed),
        },
        comparedTo,
      }
    : null;
  return (
    <div className="metric-dashboard recruiter-dashboard-container">
      <div className="filter-button-container">
        <MetricDateFilter 
          isDisabled={false} 
          selectedDateFilter={selectedDateFilter} 
          setSelectedDateFilter={setSelectedDateFilter} 
        />
        <div style={{ minWidth: "220px" }}>
          <SelectDropdown
            options={programOptions}
            value={selectedProgram}
            onSelect={(value) => setSelectedProgram(value)}
            placeholder="Filter by Program"
            size="small"
          />
        </div>
        <Button
          label="View More Data"
          variant="secondary"
          onClick={() => {}}
        />
      </div>
      {/* Current task: metric headers with tooltip and chart type menu */}
      <div className="recruiter-dashboard-pdf-export" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
        {dashboardLayout.map((row) => (
          <div 
            key={row.name} 
            className="recruiter-dashboard-metrics-container" 
            style={{ 
              height: isMobile ? "auto" : `${row.height}px`,
              minHeight: isMobile ? "fit-content" : `${row.height}px`,
              maxHeight: isMobile ? "none" : `${row.height}px`,
              gap: isMobile ? 16 : 8,
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              width: '100%'
            }}
          >
            {row.cards.map((card) => {
              const metricConfig = talentVaultMetricConfig[card.metricId];
              const selectedChartType = selectedChartTypes[card.metricId];
              const isMenuOpen = activeGraphMenu === card.metricId;
              const selectedProgramLabel =
                selectedProgram && selectedProgram !== "all"
                  ? (programOptions.find((option) => option.value === selectedProgram)?.label || "Selected Program")
                  : "All Programs";

              return (
                <div
                  key={card.metricId}
                  className="recruiter-dashboard-metric-card"
                  style={{ 
                    flex: isMobile ? '0 0 100%' : '1 1 0',
                    minWidth: isMobile ? '100%' : 0,
                    maxWidth: isMobile ? '100%' : 'none',
                    height: isMobile ? (metricConfig.defaultChartType === "metric" ? "174px" : "360px") : "100%",
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div className="metric-header">
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      <div className="metric-header-title">
                        <img className="chart-icon" src="/chart-icon.png" alt="Chart Icon" width={15} height={15} />
                        <h3>{metricConfig.title}</h3>
                        <GraphInfoTooltip tooltipText={metricConfig.description} />
                      </div>
                      <MetricHeaderFilter
                        selectedDateFilter={selectedDateFilter}
                        selectedProgramLabel={selectedProgramLabel}
                      />
                    </div>
                    <GraphMenuButton
                      availableChartTypes={metricConfig.availableChartTypes}
                      menuOpen={isMenuOpen}
                      onClick={(chartType) => {
                        if (!chartType) {
                          setActiveGraphMenu((previous) =>
                            previous === card.metricId ? null : card.metricId
                          );
                          return;
                        }

                        setSelectedChartTypes((previous) => ({
                          ...previous,
                          [card.metricId]: chartType,
                        }));
                        setActiveGraphMenu(null);
                      }}
                      selectedChartType={selectedChartType}
                      position={
                        isMobile
                          ? "right"
                          : row.cards[row.cards.length - 1]?.metricId === card.metricId
                            ? "right"
                            : "left"
                      }
                    />
                  </div>

                  <div
                    className="metric-content"
                    style={{ justifyContent: "center", alignItems: "center" }}
                  >
                    {isLoadingPrograms ? (
                      <LoadingAnimation
                        text={`Loading ${metricConfig.title}`}
                        subtext="Please wait while we load the data"
                      />
                    ) : (
                      <TalentVaultMetricChart
                        metricId={card.metricId}
                        chartType={selectedChartType}
                        timeSeries={filteredTimeSeries}
                        totals={metricTotals}
                        comparison={comparison}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Tooltip Host */}
      <ReactTooltip className="career-fit-tooltip" id="graph-info-tooltip" offset={8} noArrow place="bottom" />
    </div>
  );
}

/**
 * GraphInfoTooltip - Displays information icon with tooltip
 */
const GraphInfoTooltip = ({ tooltipText }: { tooltipText: string }) => {
  return (
    <a
      data-tooltip-id="graph-info-tooltip"
      data-tooltip-html={tooltipText || "No information available"}
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      aria-label="Metric information"
    >
      <i
        className="la la-question-circle"
        style={{ fontSize: 20, color: "#A4A7AE", cursor: "pointer" }}
      />
    </a>
  );
};

const MetricHeaderFilter = ({
  selectedDateFilter,
  selectedProgramLabel,
}: {
  selectedDateFilter: DateFilter;
  selectedProgramLabel: string;
}) => {
  return (
    <span style={{ lineHeight: 1 }}>
      {getDateFilterLabel(selectedDateFilter)}
      <i
        className="la la-circle"
        style={{
          fontSize: 4,
          backgroundColor: "#717680",
          borderRadius: "50%",
          verticalAlign: "middle",
          margin: "0 4px",
        }}
      ></i>
      {selectedProgramLabel}
    </span>
  );
};

const GraphMenuButton = ({
  menuOpen,
  availableChartTypes,
  onClick,
  selectedChartType,
  position = "left",
}: {
  menuOpen: boolean;
  availableChartTypes: ChartTypeDisplay[];
  onClick: (chartType?: ChartTypeDisplay) => void;
  selectedChartType: ChartTypeDisplay;
  position?: "left" | "right";
}) => {
  const [chartTypeOpen, setChartTypeOpen] = useState(false);

  const handleClickChartType = (chartType: ChartTypeDisplay) => {
    setChartTypeOpen(false);
    onClick(chartType);
  };

  return (
    <div className="dropdown">
      <button
        style={{ background: "none", border: "none", cursor: "pointer" }}
        onClick={(event) => {
          event.stopPropagation();
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
          style={{ padding: "10px 0px" }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "#414651", marginLeft: 15 }}>
            Report Widget
          </span>
          <div className="dropdown-divider"></div>
          <div
            className="dropdown-item"
            onMouseOver={() => setChartTypeOpen(true)}
            onMouseOut={() => setChartTypeOpen(false)}
            onClick={(event) => {
              event.stopPropagation();
              setChartTypeOpen(!chartTypeOpen);
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
                  Chart Type
                </span>
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
                  {chartTypes
                    .filter((chartType) =>
                      availableChartTypes.includes(chartType.id as ChartTypeDisplay)
                    )
                    .map((chartType) => (
                      <div
                        className="dropdown-item"
                        style={{
                          backgroundColor:
                            selectedChartType === chartType.id ? "#EEF4FF" : "transparent",
                        }}
                        key={chartType.id}
                        onClick={() => handleClickChartType(chartType.id as ChartTypeDisplay)}
                      >
                        <img
                          src={chartType.iconAsset}
                          alt={chartType.label}
                          style={{ width: 20, height: 20 }}
                        />
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#414651",
                            marginLeft: 10,
                          }}
                        >
                          {chartType.label}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
