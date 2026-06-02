"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useErrorData } from "./ErrorDataProvider";

const LineChart = dynamic(() => import("reaviz").then((mod) => mod.LineChart), {
  ssr: false,
});

export default function ErrorLineChart() {
  const { filteredStats, statsLoading } = useErrorData();

  if (statsLoading) {
    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Error Trends (Last 30 Days)</h5>
        </div>
        <div className="card-body text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="text-muted mt-2 mb-0">Loading error trends...</p>
        </div>
      </div>
    );
  }

  // Helper function to parse logDate string to proper date
  const parseLogDate = (logDateString: string): any => {
    try {
      // Parse the format "Sep 22 2025 17:59:40" to a proper date
      const date = new Date(logDateString);
      if (isNaN(date.getTime())) {
        // If parsing fails, return the original string
        return logDateString;
      }
      // Return formatted date as YYYY-MM-DD
      return date;
    } catch (error) {
      console.warn("Failed to parse logDate:", logDateString, error);
      return logDateString;
    }
  };

  // Prepare data for line chart
  const lineChartData = (filteredStats?.errorCountByDate || [])
    .filter((item) => item && (item._id || item.logDate)) // Filter out invalid entries
    .map((item) => {
      let dateKey = parseLogDate(item.logDate);

      // Ensure count is a valid number
      const count =
        typeof item.count === "number" && !isNaN(item.count) ? item.count : 0;

      return {
        key: new Date(dateKey),
        data: count,
      };
    })
    .filter((item) => {
      // Filter out items with invalid keys or data
      return (
        item.key &&
        typeof item.data === "number" &&
        !isNaN(item.data) &&
        item.data >= 0
      );
    });

  console.log("Line chart data:", lineChartData);

  // Sort by date to ensure proper line chart rendering
  // lineChartData.sort((a: any, b: any) => {
  //   return a.getTime() - b.getTime();
  // });

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="card-title mb-0">Error Trends (Last 30 Days)</h5>
        <small className="text-muted">Total error count per day</small>
      </div>
      <div className="card-body">
        {lineChartData.length > 0 ? (
          <div style={{ height: "220px" }}>
            {(() => {
              try {
                // Final validation before passing to LineChart
                const validatedData = lineChartData
                  .map((item) => ({
                    key: item.key,
                    data: Number(item.data) || 0,
                  }))
                  .filter(
                    (item) => item.key && !isNaN(item.data) && item.data >= 0
                  );

                console.log("Validated line chart data:", validatedData);

                if (validatedData.length === 0) {
                  return (
                    <div className="text-center text-muted">
                      <p>No valid data points for chart</p>
                    </div>
                  );
                }

                return <LineChart data={lineChartData} height={230} />;
              } catch (error) {
                console.error("Error rendering line chart:", error);
                return (
                  <div className="text-center text-danger">
                    <p>
                      Error rendering chart:{" "}
                      {error instanceof Error ? error.message : "Unknown error"}
                    </p>
                  </div>
                );
              }
            })()}
          </div>
        ) : (
          <div className="text-center text-muted">
            <i className="fas fa-chart-line fa-3x mb-3"></i>
            <p>No error data available for the last 30 days</p>
          </div>
        )}
      </div>
    </div>
  );
}
