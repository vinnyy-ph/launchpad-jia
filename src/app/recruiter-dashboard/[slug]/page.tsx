"use client";
import { useParams, useSearchParams } from "next/navigation";
import HeaderBar from "../../../lib/PageComponent/HeaderBar";
import { api } from "../../../lib/utils/apiClient";
import { useEffect, useRef, useState, useMemo } from "react";
import Fuse from "fuse.js";
import { errorToast } from "../../../lib/Utils";
import DropOffRateChart from "../../../lib/components/AnalyticsComponents/DropOff";
import MetricDateFilter, {
  DateFilter,
} from "@/lib/components/AnalyticsComponents/MetricDateFilter";
import LoadingAnimation from "@/lib/components/Loaders/LoadingAnimation";
import moment from "moment";
import NoDataAvailable from "@/lib/components/AnalyticsComponents/NoDataAvailable";
import { ChartTypeDisplay, chartTypes, metricChartSettings, MetricType } from "@/lib/utils/recruiterAnalytics";
import ApplicationVolumeChart from "@/lib/components/AnalyticsComponents/ApplicationVolume";
import StageAgingChart from "@/lib/components/AnalyticsComponents/StageAging";
import EndorsementEfficiencyChart from "@/lib/components/AnalyticsComponents/EndorsementEfficiency";
import OfferAcceptanceRateChart from "@/lib/components/AnalyticsComponents/OfferAcceptanceRate";
import TimeToHireChart from "@/lib/components/AnalyticsComponents/TimeToHire";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import ActiveCareersChart from "@/lib/components/AnalyticsComponents/ActiveCareers";
import NewApplicantsChart from "@/lib/components/AnalyticsComponents/NewApplicants";
import HiresChart from "@/lib/components/AnalyticsComponents/Hires";
import StagePassRate from "@/lib/components/AnalyticsComponents/StagePassRate";

const metricMetadata = {
  "active-careers": {
    description: "Shows the total number of active careers.",
    defaultDateFilter: "7D",
    hasTable: true,
  },
  "new-applicants": {
    description: "Shows the total number of new applicants.",
    defaultDateFilter: "7D",
    hasTable: true,
  },
  hires: {
    description: "Shows the total number of hires.",
    defaultDateFilter: "7D",
    hasTable: true,
  },
  "application-volume": {
    description:
      "Shows the total number of applications received within a given period.",
    defaultDateFilter: "7D",
    hasTable: true,
  },
  "time-to-hire": {
    description: "Shows the average time taken to hire a candidate.",
    defaultDateFilter: "7D",
    hasTable: false,
  },
  "drop-off-rate": {
    description:
      "Displays the dropout rate of candidates in the hiring process, pinpointing friction points in your funnel.",
    defaultDateFilter: "7D",
    hasTable: true,
  },
  "stage-aging": {
    description:
      "Displays the average number of days candidates spend in each hiring stage.",
    defaultDateFilter: "7D",
    hasTable: false,
  },
  "offer-acceptance-rate": {
    description:
      "Shows the percentage of candidates who accepted the job offer.",
    defaultDateFilter: "7D",
    hasTable: false,
  },
  "endorsement-efficiency": {
    description:
      "Shows the percentage of candidates who were endorsed for the final interview and hired.",
    defaultDateFilter: "7D",
    hasTable: false,
  },
  "stage-pass-rate": {
    description:
      "Shows the percentage of candidates who passed each stage of the hiring process.",
    defaultDateFilter: "7D",
    hasTable: true,
  },
};

const tableHeaderStyle: any = {
  textTransform: "none",
  fontWeight: 700,
  fontSize: 12,
  color: "#717680",
  backgroundColor: "#F8F9FC",
};

export default function DashboardAnalyticsPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const orgID = searchParams.get("orgID");
  const [metricData, setMetricData] = useState<any>(null);
  const isLoadingRef = useRef(false);
  const [selectedDateFilter, setSelectedDateFilter] =
    useState<DateFilter>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [selectedCareers, setSelectedCareers] = useState<string[] | null>(null);

  const [careers, setCareers] = useState<any[]>([]);
  const [isLoadingCareers, setIsLoadingCareers] = useState(false);
  const [totalCareers, setTotalCareers] = useState(0);
  const [chartTypeDisplay, setChartTypeDisplay] = useState<Record<any, ChartTypeDisplay>>(null)

  const toProperCase = (str: string) => {
    // Proper case the string
    return str
      ?.toString()
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  useEffect(() => {
    const fetchMetricData = async () => {
      if (
        selectedDateFilter.type === "Custom" &&
        !selectedDateFilter.startDate &&
        !selectedDateFilter.endDate
      ) {
        return;
      }
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setIsLoadingMetrics(true);
      try {
        if (selectedCareers?.length === 0 && slug === "stage-aging") {
          setMetricData(null);
        } else {
          const response = await api.get(`/api/get-analytics`, {
            params: {
              metricType: slug,
              orgID,
              timeFilter: selectedDateFilter.type,
              startDate: selectedDateFilter.startDate,
              endDate: selectedDateFilter.endDate,
              careerFilter:
                selectedCareers?.length > 0
                  ? selectedCareers.map((c) => c).join(",")
                  : [],
            },
          });
          setMetricData(response.data);
        }
      } catch (error) {
        console.error(error);
        errorToast("Error fetching metric data", 1300);
        setMetricData(null);
      } finally {
        isLoadingRef.current = false;
        setIsLoadingMetrics(false);
      }
    };
    if (slug && orgID && selectedDateFilter) {
      fetchMetricData();
    }
  }, [slug, orgID, selectedDateFilter, selectedCareers]);

  useEffect(() => {
    const fetchCareers = async () => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setIsLoadingCareers(true);
      try {
        const response = await api.post(`/api/fetch-careers`, {
          orgID,
        });
        setCareers(response.data);
        setTotalCareers(response.data.length);
        setSelectedCareers(response.data.map((career: any) => career.id));
      } catch (error) {
        errorToast("Error fetching careers", 1300);
      } finally {
        setIsLoadingCareers(false);
        isLoadingRef.current = false;
      }
    };
    if (slug === "stage-aging" && orgID) {
      fetchCareers();
    }
  }, [slug, orgID]);

  useEffect(() => {
    if (slug) {
      setSelectedDateFilter({
        type: metricMetadata[slug as string].defaultDateFilter,
        startDate: null,
        endDate: null,
      });
      setChartTypeDisplay({
        [slug as string]: metricChartSettings[slug as string].defaultChartType,
      });
    }
  }, [slug]);

  return (
    <>
      {slug && (
        <HeaderBar
          activeLink="Dashboard"
          currentPage={toProperCase(slug as string)}
          icon="la la-chart-area"
        />
      )}
      <div
        className="container-fluid mt--7"
        style={{ padding: "6rem 0 4rem 0" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <h1>{toProperCase(slug as string)}</h1>
          <span>{metricMetadata[slug as string].description}</span>

          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <MetricDateFilter
            isDisabled={isLoadingMetrics}
            selectedDateFilter={selectedDateFilter}
            setSelectedDateFilter={setSelectedDateFilter}
            showDefaultDateFilter={false}
          />
          {metricChartSettings[slug as string].availableChartTypes.length > 0 && <div style={{ width: "318px" }}>
              <CustomDropdown 
              onSelectSetting={(setting: ChartTypeDisplay) => setChartTypeDisplay({ ...chartTypeDisplay, [slug as string]: setting?.replace(" ", "-").toLowerCase() as ChartTypeDisplay })}
              screeningSetting={(chartTypeDisplay?.[slug as string] || "")?.replace("-", " ")?.replace(/\b\w/g, char => char.toUpperCase())}
              settingList={chartTypes.filter((chartType) => {
                if (chartType.id === "table") {
                  return !metricMetadata[slug as string].hasTable;
                }
                return metricChartSettings[slug as string].availableChartTypes.includes(chartType.id as ChartTypeDisplay)
              }).map((chartType) => ({
                name: chartType.label,
                image: chartType.iconAsset,
              }))}
              placeholder="Select Chart Type"
              />
            </div>}
          </div>
          {slug === "application-volume" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              <div
                className="full-metric-content"
                style={{
                  alignItems:
                    !isLoadingMetrics &&
                    !isLoadingCareers &&
                    metricData?.applicationVolume?.days?.length > 0
                      ? "flex-start"
                      : "center",
                }}
              >
                {isLoadingMetrics || isLoadingCareers ? (
                  <LoadingAnimation
                    text={`Loading Application Volume`}
                    subtext="Please wait while we load the data"
                  />
                ) : metricData?.applicationVolume?.days?.length > 0 ? (
                  <ApplicationVolumeChart chartTypeDisplay={chartTypeDisplay?.[slug as string] || metricChartSettings[slug as string].defaultChartType} data={metricData?.applicationVolume?.days} />
                ) : (
                  <NoDataAvailable />
                )}
              </div>

              <div
                className="table-responsive"
                style={{
                  height: "100%",
                  background: "#FFFFFF",
                  borderRadius: "20px",
                }}
              >
                <table
                  className="table align-items-center table-flush"
                  style={{ border: "1px solid #E9EAEB" }}
                >
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="name"
                        style={tableHeaderStyle}
                      >
                        Metric
                      </th>
                      {metricData?.applicationVolume &&
                        metricData?.applicationVolume?.days?.map((day: any) => (
                          <th
                            key={day.date}
                            scope="col"
                            className="sort"
                            data-sort="assessment"
                            style={tableHeaderStyle}
                          >
                            {moment(day.date).format("MMM D")}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingMetrics || isLoadingCareers ? (
                      <>
                        {Array.from({ length: 2 }).map((_, idx) => (
                          <tr key={idx}>
                            <td colSpan={7}>
                              <div
                                className="bg-gray-300 rounded blink-2"
                                style={{ width: "100%", height: "16px" }}
                              >
                                <div
                                  className="skeleton-bar blink-2"
                                  style={{ width: "100%" }}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    ) : (
                      <>
                        <tr style={{ cursor: "default" }}>
                          <td>Automatically Endorsed by Jia</td>
                          {metricData?.applicationVolume?.days?.map(
                            (day: any) => (
                              <td key={day.date}>
                                {day.automaticallyEndorsed}
                              </td>
                            )
                          )}
                        </tr>
                        <tr style={{ cursor: "default" }}>
                          <td>Total Applicants</td>
                          {metricData?.applicationVolume?.days?.map(
                            (day: any) => (
                              <td key={day.date}>{day.applicationVolume}</td>
                            )
                          )}
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {slug === "time-to-hire" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              <div
                className="full-metric-content"
                style={{
                  alignItems: chartTypeDisplay?.[slug as string] === "metric" ? "center" : "flex-start",
                }}
              >
                {isLoadingMetrics || isLoadingCareers ? (
                  <LoadingAnimation
                    text={`Loading Time to Hire`}
                    subtext="Please wait while we load the data"
                  />
                ) : metricData?.timeToHire?.length > 0 ? (
                  <TimeToHireChart chartTypeDisplay={chartTypeDisplay?.[slug as string] || metricChartSettings[slug as string].defaultChartType} data={metricData?.timeToHire} />
                ) : (
                  <NoDataAvailable />
                )}
              </div>
            </div>
          )}

          {slug === "offer-acceptance-rate" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              <div
                className="full-metric-content"
                style={{
                  alignItems: chartTypeDisplay?.[slug as string] === "metric" ? "center" : "flex-start",
                }}
              >
                {isLoadingMetrics || isLoadingCareers ? (
                  <LoadingAnimation
                    text={`Loading Offer Acceptance Rate`}
                    subtext="Please wait while we load the data"
                  />
                ) : metricData?.offerAcceptanceRate?.length > 0 ? (
                  <OfferAcceptanceRateChart
                  chartTypeDisplay={chartTypeDisplay?.[slug as string] || metricChartSettings[slug as string].defaultChartType} 
                  data={metricData?.offerAcceptanceRate}
                  />
                ) : (
                  <NoDataAvailable />
                )}
              </div>
            </div>
          )}

          {slug === "endorsement-efficiency" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              <div
                className="full-metric-content"
                style={{
                  alignItems: chartTypeDisplay?.[slug as string] === "metric" ? "center" : "flex-start",
                }}
              >
                {isLoadingMetrics || isLoadingCareers ? (
                  <LoadingAnimation
                    text={`Loading Endorsement Efficiency`}
                    subtext="Please wait while we load the data"
                  />
                ) : metricData?.endorsementEfficiency?.length > 0 ? (
                  <EndorsementEfficiencyChart
                  chartTypeDisplay={chartTypeDisplay?.[slug as string] || metricChartSettings[slug as string].defaultChartType} data={metricData?.endorsementEfficiency}
                  />
                ) : (
                  <NoDataAvailable />
                )}
              </div>
            </div>
          )}

          {slug === "stage-aging" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "center",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <div
                style={{
                  border: "1px solid #E9EAEB",
                  borderRadius: "10px",
                  width: "75%",
                  height: "100vh",
                  minHeight: "362px",
                  maxHeight: "592px",
                  overflow: "auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "flex-start",
                }}
              >
                {isLoadingMetrics || isLoadingCareers ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <LoadingAnimation
                      text={`Loading Stage Aging`}
                      subtext="Please wait while we load the data"
                    />
                  </div>
                ) : metricData?.stageAging?.careers?.length > 0 ? (
                  <StageAgingChart chartTypeDisplay={chartTypeDisplay?.[slug as string] || metricChartSettings[slug as string].defaultChartType} data={metricData?.stageAging?.careers} />
                ) : (
                  <NoDataAvailable />
                )}
              </div>

              <CareerCheckboxFilter
                selectedCareers={selectedCareers || []}
                setSelectedCareers={setSelectedCareers}
                careers={careers}
                totalCareers={totalCareers}
                isLoadingCareers={isLoadingCareers}
              />
            </div>
          )}

          {slug === "drop-off-rate" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              <div
                className="full-metric-content"
                style={{
                }}
              >
                {isLoadingMetrics || isLoadingCareers ? (
                  <LoadingAnimation
                    text={`Loading Drop-off Rate`}
                    subtext="Please wait while we load the data"
                  />
                ) : metricData?.dropOffRate?.stages?.length > 0 ? (
                  <DropOffRateChart
                  chartTypeDisplay={chartTypeDisplay?.[slug as string] || metricChartSettings[slug as string].defaultChartType}
                    data={metricData?.dropOffRate}
                  />
                ) : (
                  <NoDataAvailable />
                )}
              </div>

              <div
                className="table-responsive"
                style={{
                  height: "100%",
                  background: "#FFFFFF",
                  borderRadius: "20px",
                }}
              >
                <table
                  className="table align-items-center table-flush"
                  style={{ border: "1px solid #E9EAEB" }}
                >
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="name"
                        style={tableHeaderStyle}
                      >
                        Stage
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Candidates
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Avg. Stage Time
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Stage Conversion
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Drop-off
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Dropped by Recruiters
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Dropped by Cancellation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingMetrics || isLoadingCareers ? (
                      <>
                        {Array.from({ length: 10 }).map((_, idx) => (
                          <tr key={idx}>
                            {Array.from({ length: 7 }).map((_, idx) => (
                              <td key={idx}>
                                <div
                                  className="bg-gray-300 rounded blink-2"
                                  style={{ width: "150px", height: "16px" }}
                                >
                                  <div
                                    className="skeleton-bar blink-2"
                                    style={{ width: "150px" }}
                                  ></div>
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ) : (
                      metricData?.dropOffRate?.stages?.flatMap((stage: any) =>
                        stage.substages.map((substage: any) => (
                          <tr key={substage.name}>
                            <td>{substage.name}</td>
                            <td>
                              {substage.remainingCandidates} /{" "}
                              {metricData?.dropOffRate?.totalApplicants}
                            </td>
                            <td>{substage.averageStageDuration} days</td>
                            <td>{substage.percentage}%</td>
                            <td>{substage.droppedPercentage}%</td>
                            <td>
                              {substage.droppedByRecruiter} /{" "}
                              {substage.remainingCandidates}
                            </td>
                            <td>
                              {substage.droppedByCancellation} /{" "}
                              {substage.remainingCandidates}
                            </td>
                          </tr>
                        ))
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {slug === "stage-pass-rate" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              <div
                className="full-metric-content"
                style={{
                }}
              >
                {isLoadingMetrics || isLoadingCareers ? (
                  <LoadingAnimation
                    text={`Loading Stage Pass Rate`}
                    subtext="Please wait while we load the data"
                  />
                ) : metricData?.stagePassRate?.stages?.length > 0 ? (
                  <StagePassRate
                  chartTypeDisplay={chartTypeDisplay?.[slug as string] || metricChartSettings[slug as string].defaultChartType}
                    data={metricData?.stagePassRate}
                  />
                ) : (
                  <NoDataAvailable />
                )}
              </div>

              <div
                className="table-responsive"
                style={{
                  height: "100%",
                  background: "#FFFFFF",
                  borderRadius: "20px",
                }}
              >
                <table
                  className="table align-items-center table-flush"
                  style={{ border: "1px solid #E9EAEB" }}
                >
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="name"
                        style={tableHeaderStyle}
                      >
                        Stage
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Candidates
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Stage Pass Rate
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Candidates Passed
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Candidates Dropped
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingMetrics || isLoadingCareers ? (
                      <>
                        {Array.from({ length: 10 }).map((_, idx) => (
                          <tr key={idx}>
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <td key={idx}>
                                <div
                                  className="bg-gray-300 rounded blink-2"
                                  style={{ width: "150px", height: "16px" }}
                                >
                                  <div
                                    className="skeleton-bar blink-2"
                                    style={{ width: "150px" }}
                                  ></div>
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ) : (
                      metricData?.stagePassRate?.stages?.map((stage: any) => (
                          <tr key={stage.group}>
                            <td>{stage.group}</td>
                            <td>
                              {stage.candidatesPassed} /{" "}
                              {stage.totalCount}
                            </td>
                            <td>{stage.passRate}%</td>
                            <td>{stage.candidatesPassed}</td>
                            <td>{stage.candidatesDropped}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {["active-careers", "new-applicants", "hires"].includes(
            slug as string
          ) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "20px",
                width: "100%",
              }}
            >
              <div
                className="full-metric-content"
                style={{
                  alignItems: chartTypeDisplay?.[slug as string] === "metric" ? "center" : "flex-start",
                }}
              >
                {isLoadingMetrics || isLoadingCareers ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: "362px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <LoadingAnimation
                      text={`Loading ${toProperCase(slug as string)}`}
                      subtext="Please wait while we load the data"
                    />
                  </div>
                ) : (
                  <MetricChart 
                  metricType={slug as MetricType} 
                  chartTypeDisplay={chartTypeDisplay?.[slug as string] || metricChartSettings[slug as string].defaultChartType}
                  data={metricData} 
                  />
                )}
              </div>
              <div
                style={{
                  width: "100%",
                  height: "1px",
                  backgroundColor: "#E9EAEB",
                }}
              />

              <div
                className="table-responsive"
                style={{
                  height: "100%",
                  background: "#FFFFFF",
                  borderRadius: "20px",
                }}
              >
                <table
                  className="table align-items-center table-flush"
                  style={{ border: "1px solid #E9EAEB" }}
                >
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="name"
                        style={tableHeaderStyle}
                      >
                        Metric
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Value
                      </th>
                      <th
                        scope="col"
                        className="sort"
                        data-sort="assessment"
                        style={tableHeaderStyle}
                      >
                        Past Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingMetrics || isLoadingCareers ? (
                      <>
                        {Array.from({ length: 1 }).map((_, idx) => (
                          <tr key={idx}>
                            <td colSpan={3}>
                              <div
                                className="bg-gray-300 rounded blink-2"
                                style={{ width: "100%", height: "16px" }}
                              >
                                <div
                                  className="skeleton-bar blink-2"
                                  style={{ width: "100%" }}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    ) : (
                      <tr style={{ cursor: "default" }}>
                        <td>{toProperCase(slug as string)}</td>
                        <td>{metricData?.metricValue}</td>
                        <td>{metricData?.pastValue}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const MetricChart = ({ metricType, chartTypeDisplay, data }: { metricType: MetricType, chartTypeDisplay: ChartTypeDisplay, data: any }) => {
  switch (metricType) {
    case "active-careers":
      return <ActiveCareersChart chartTypeDisplay={chartTypeDisplay} data={data} includeMetricTitle={true} />;
    case "new-applicants":
      return <NewApplicantsChart chartTypeDisplay={chartTypeDisplay} data={data} includeMetricTitle={true} />;
    case "hires":
      return <HiresChart chartTypeDisplay={chartTypeDisplay} data={data} includeMetricTitle={true} />;
    default:
      return null;
  }
}

const CareerCheckboxFilter = ({
  selectedCareers,
  setSelectedCareers,
  careers,
  totalCareers,
  isLoadingCareers,
}: {
  selectedCareers: string[];
  setSelectedCareers: React.Dispatch<React.SetStateAction<string[]>>;
  careers: any[];
  totalCareers: number;
  isLoadingCareers: boolean;
}) => {
  const [searchCareer, setSearchCareer] = useState("");

  const fuseOptions = {
    keys: ["jobTitle"],
    threshold: 0.3,
  };

  const filteredCareers = useMemo(() => {
    if (!searchCareer) return careers;
    const fuse = new Fuse(careers, fuseOptions);
    return fuse.search(searchCareer).map((result) => result.item);
  }, [searchCareer, careers]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        textAlign: "left",
        gap: "10px",
        border: "1px solid #E9EAEB",
        borderRadius: "10px",
        width: "25%",
        height: "592px",
        overflowY: "auto",
      }}
    >
      {/* Search box */}
      <div style={{ width: "100%", padding: "10px" }}>
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
      </div>
      {isLoadingCareers ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            marginTop: "20px",
          }}
        >
          <h1 className="fade-in">
            <i className="la la-circle-notch spin la-2x text-primary"></i>
          </h1>
        </div>
      ) : (
        <>
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "10px",
              padding: "10px",
            }}
          >
            <input
              type="checkbox"
              style={{
                accentColor: "#FFFFFF",
                borderColor: "#181D27",
                width: "18px",
                height: "18px",
              }}
              checked={selectedCareers.length === totalCareers}
              onChange={(e) =>
                setSelectedCareers(
                  selectedCareers.length === totalCareers
                    ? []
                    : careers.map((career: any) => career.id)
                )
              }
            />
            <span
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#414651",
                lineHeight: "1",
              }}
            >
              {selectedCareers.length === totalCareers
                ? "Unselect All"
                : "Select All"}
            </span>
          </div>

          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              gap: "10px",
              borderTop: "1px solid #E9EAEB",
              padding: "20px 15px",
            }}
          >
            {totalCareers > 0 && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#A4A7AE",
                  lineHeight: "1",
                }}
              >
                Careers {selectedCareers.length} of {totalCareers}
              </span>
            )}
            {filteredCareers.length > 0 ? (
              filteredCareers.map((career) => (
                <div
                  key={career._id}
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: "10px",
                  }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    style={{
                      accentColor: "#FFFFFF",
                      borderColor: "#181D27",
                      width: "18px",
                      height: "18px",
                    }}
                    checked={selectedCareers.includes(career.id)}
                    onChange={(e) =>
                      setSelectedCareers((prev) =>
                        prev.includes(career.id)
                          ? prev.filter((id) => id !== career.id)
                          : [...prev, career.id]
                      )
                    }
                  />
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#414651",
                      lineHeight: "1",
                    }}
                  >
                    {career.jobTitle}
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  width: "100%",
                  height: "100%",
                  marginTop: "20px",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#717680",
                    lineHeight: "1",
                    textAlign: "left",
                  }}
                >
                  No careers found
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
