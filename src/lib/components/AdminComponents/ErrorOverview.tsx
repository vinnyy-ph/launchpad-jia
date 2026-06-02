"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useErrorData } from "./ErrorDataProvider";

const BarChart = dynamic(() => import("reaviz").then((mod) => mod.BarChart), {
  ssr: false,
});

interface ErrorOverviewProps {
  onErrorTypeClick: (errorName: string) => void;
}

export default function ErrorOverview({
  onErrorTypeClick,
}: ErrorOverviewProps) {
  const { filteredStats, statsLoading } = useErrorData();

  if (statsLoading) {
    return (
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">Loading...</span>
              </div>
              <p className="text-muted mt-2 mb-0">
                Loading error statistics...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!filteredStats) {
    return (
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body text-center">
              <p className="text-muted">Failed to load error statistics</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Prepare data for bar chart
  const barChartData = (filteredStats.errorTypeStats || [])
    .filter((stat) => stat && stat.name) // Filter out invalid entries
    .map((stat) => {
      console.log("Processing stat:", stat);
      const percentage = stat.percentage || "0";
      const parsedPercentage = parseFloat(percentage);
      console.log("Parsed percentage:", parsedPercentage);

      // Ensure we have valid numeric data
      const validData =
        typeof parsedPercentage === "number" && !isNaN(parsedPercentage)
          ? parsedPercentage
          : 0;

      return {
        key: stat.name || "Unknown",
        data: validData,
      };
    })
    .filter((item) => {
      // Filter out items with invalid data
      return (
        item.key &&
        typeof item.data === "number" &&
        !isNaN(item.data) &&
        item.data >= 0
      );
    });

  return (
    <div className="row mb-4">
      {/* Overview Cards */}
      <div className="col-md-4 mb-3">
        <div className="card border-left-primary">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-xs font-weight-bold text-primary text-uppercase mb-1">
                  Total Error Logs
                </div>
                <div className="h5 mb-0 font-weight-bold text-gray-800">
                  {(filteredStats.totalErrors || 0).toLocaleString()}
                </div>
              </div>
              <div className="col-auto">
                <i className="fas fa-exclamation-triangle fa-2x text-primary"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-4 mb-3">
        <div className="card border-left-warning">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-xs font-weight-bold text-warning text-uppercase mb-1">
                  Unique Error Types
                </div>
                <div className="h5 mb-0 font-weight-bold text-gray-800">
                  {filteredStats.uniqueErrorTypes || 0}
                </div>
              </div>
              <div className="col-auto">
                <i className="fas fa-bug fa-2x text-warning"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-4 mb-3">
        <div className="card border-left-info">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <div className="flex-grow-1">
                <div className="text-xs font-weight-bold text-info text-uppercase mb-1">
                  Most Common Error
                </div>
                <div
                  className="h6 mb-0 font-weight-bold text-gray-800 text-truncate"
                  style={{ fontSize: "0.9rem" }}
                >
                  {filteredStats.errorTypeStats &&
                  filteredStats.errorTypeStats.length > 0
                    ? filteredStats.errorTypeStats[0].name
                    : "N/A"}
                </div>
              </div>
              <div className="col-auto">
                <i className="fas fa-chart-line fa-2x text-info"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="col-12 mt-4">
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">Error Types Distribution</h5>
            <small className="text-muted">
              Click on bars to filter by error type
            </small>
          </div>
          <div className="card-body">
            {barChartData.length > 0 ? (
              <div style={{ height: "300px", overflow: "hidden" }}>
                {(() => {
                  try {
                    // Final validation before passing to BarChart
                    const validatedData = barChartData
                      .map((item) => ({
                        key: String(item.key || ""),
                        data: Number(item.data) || 0,
                      }))
                      .filter(
                        (item) =>
                          item.key && !isNaN(item.data) && item.data >= 0
                      );

                    console.log("Validated bar chart data:", validatedData);

                    if (validatedData.length === 0) {
                      return (
                        <div className="text-center text-muted">
                          <p>No valid data points for chart</p>
                        </div>
                      );
                    }

                    return <BarChart data={validatedData} height={350} />;
                  } catch (error) {
                    console.error("Error rendering bar chart:", error);
                    return (
                      <div className="text-center text-danger">
                        <p>
                          Error rendering chart:{" "}
                          {error instanceof Error
                            ? error.message
                            : "Unknown error"}
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            ) : (
              <p className="text-muted text-center">No error data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
