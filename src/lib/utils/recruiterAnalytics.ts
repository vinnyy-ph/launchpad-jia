

export type MetricType = "active-careers" | "new-applicants" | "hires" | "application-volume" | "time-to-hire" | "drop-off-rate" | "stage-aging" | "offer-acceptance-rate" | "endorsement-efficiency" | "stage-pass-rate";
export type ChartTypeDisplay = "metric" | "stacked-column" | "line" | "stacked-line" | "column" | "stacked-bar" | "retention-curve" | "pie" | "table" | "bar-chart";

export const metricChartSettings: Record<MetricType, { title: string, availableChartTypes: ChartTypeDisplay[], defaultChartType: ChartTypeDisplay, description: string, defaultDateFilter: string, tooltipText: string }> = {
    "active-careers": {
        title: "Active Careers",
        availableChartTypes: ["line", "column", "metric", "table"],
        defaultChartType: "metric",
        description: "Shows the total number of active careers.",
        defaultDateFilter: "7D",
        tooltipText: "Shows how many roles are currently open and being actively recruited."
    },
    "new-applicants": {
        title: "New Applicants",
        availableChartTypes: ["line", "column", "metric", "table"],
        defaultChartType: "metric",
        description: "Shows the total number of new applicants.",
        defaultDateFilter: "7D",
        tooltipText: "Shows the total number of active applicants with ongoing applications."
    },
    "hires": {
        title: "Hires Completed",
        availableChartTypes: ["line", "column", "metric", "table"],
        defaultChartType: "metric",
        description: "Shows the total number of hires.",
        defaultDateFilter: "7D",
        tooltipText: "Shows the total number of roles successfully filled within the selected period."
    },
    "application-volume": {
        title: "Application Volume",
        availableChartTypes: ["stacked-column", "stacked-line", "metric", "pie", "table"],
        defaultChartType: "stacked-column",
        description: "Shows the total number of applications received within a given period.",
        defaultDateFilter: "7D",
        tooltipText: "Shows the total number of applications received within a given period."
    },
    "time-to-hire": {
        title: "Time to Hire",
        availableChartTypes: ["line", "column", "metric", "table"],
        defaultChartType: "line",
        description: "Shows the average time taken to hire a candidate.",
        defaultDateFilter: "7D",
        tooltipText: "Average number of days it takes to hire a candidate from posting to acceptance."
    },
    "drop-off-rate": {
        title: "Drop-off Rate",
        availableChartTypes: ["line", "metric", "retention-curve", "table"],
        defaultChartType: "retention-curve",
        description: "Displays the dropout rate of candidates in the hiring process, pinpointing friction points in your funnel.",
        defaultDateFilter: "7D",
        tooltipText: "Shows the percentage of candidates who remain at each stage after drop-offs are removed."
    },
    "stage-aging": {
        title: "Stage Aging",
        availableChartTypes: ["stacked-bar", "table"],
        defaultChartType: "stacked-bar",
        description: "Displays the average number of days candidates spend in each hiring stage.",
        defaultDateFilter: "7D",
        tooltipText: "Displays the average number of days candidates spend in each hiring stage."
    },
    "offer-acceptance-rate": {
        title: "Offer Acceptance Rate",
        availableChartTypes: ["line", "column", "metric", "table"],
        defaultChartType: "line",
        description: "Shows the percentage of candidates who accepted the job offer.",
        defaultDateFilter: "7D",
        tooltipText: "Shows the percentage of extended offers that candidates accept."
    },
    "endorsement-efficiency": {
        title: "Endorsement Efficiency",
        availableChartTypes: ["column", "bar-chart", "table"],
        defaultChartType: "bar-chart",
        description: "Shows the percentage of candidates who were endorsed for the final interview and hired.",
        defaultDateFilter: "7D",
        tooltipText: "Shows the percentage of candidates to clients who successfully move forward or get hired."
    },
    "stage-pass-rate": {
        title: "Stage Pass Rate",
        availableChartTypes: ["line", "metric", "retention-curve", "table"],
        defaultChartType: "retention-curve",
        description: "Shows the percentage of candidates who passed each stage of the hiring process.",
        defaultDateFilter: "7D",
        tooltipText: "Shows the percentage of candidates who passed each stage of the hiring process."
    },
  }

export const chartTypes = [
    {
        id: "line",
        label: "Line",
        iconAsset: "/analytics/line_chart.svg"
    },
    {
        id: "stacked-line",
        label: "Stacked Line",
        iconAsset: "/analytics/stacked_line_chart.svg"
    },
    {
        id: "column",
        label: "Column",
        iconAsset: "/analytics/column.svg"
    },
    {
        id: "stacked-column",
        label: "Stacked Column",
        iconAsset: "/analytics/stacked_column_chart.svg"
    },
    {
        id: "bar-chart",
        label: "Bar Chart",
        iconAsset: "/analytics/bar_chart.svg"
    },
    {
        id: "stacked-bar",
        label: "Stacked Bar",
        iconAsset: "/analytics/stacked_bar_chart.svg"
    },
    {
        id: "metric",
        label: "Metric",
        iconAsset: "/analytics/numbers.svg"
    },
    {
        id: "retention-curve",
        label: "Retention Curve",
        iconAsset: "/analytics/line_curve.svg"
    },
    {
        id: "pie",
        label: "Pie",
        iconAsset: "/analytics/pie_chart.svg"
    },
    {
        id: "table",
        label: "Table",
        iconAsset: "/analytics/table.svg"
    },
];

export const defaultAnalyticsDashboard = [
    {  
     name: "row-1",
      metrics: [
        {
          name: "active-careers",
          width: 32.33,
          defaultChartType: "metric",
        },
        {
          name: "new-applicants",
          width: 32.33,
          defaultChartType: "metric",
        },
        {
          name: "hires",
          width: 32.33,
          defaultChartType: "metric",
        },
      ],
      height: 174,
    },
    {  
      name: "row-2",
        metrics: [
          {
            name: "application-volume",
            width: 49.25,
            defaultChartType: "stacked-column",
          }, 
          {
            name: "time-to-hire",
            width: 49.25,
            defaultChartType: "line",
          },
        ],
        height: 360,
    },
    {  
      name: "row-3",
      metrics: [
          {
            name: "drop-off-rate",
            width: 49.25,
            defaultChartType: "retention-curve",
          },
          {
            name: "stage-pass-rate",
            width: 49.25,
            defaultChartType: "retention-curve",
        },
      ],
      height: 360,
    },
    {  
      name: "row-4",
      metrics: [
      {
          name: "stage-aging",
          width: 100,
          defaultChartType: "stacked-bar",
      },
      ],
      height: 360,
    },
    {  
      name: "row-5",
        metrics: [
          {
            name: "offer-acceptance-rate",
            width: 49.25,
            defaultChartType: "line",
          }, 
          {
            name: "endorsement-efficiency",
            width: 49.25,
            defaultChartType: "bar-chart",
          },
        ],
        height: 360,
    },
];

export const pipelineStageColors = {
  "CV Screening": {
      colors: [ "#F5F8FF","#F5F8FF"]
  },
  "AI Interview": {
      colors: ["#E0EAFF","#E0EAFF"]
  },
  "Human Interview": {
      colors: ["#A4BCFD","#8098F9","#444CE7"]
  },
  "Job Offer": {
      colors: ["#444CE7","#3538CD","#2D31A6","#2D31A6"]
  }
}