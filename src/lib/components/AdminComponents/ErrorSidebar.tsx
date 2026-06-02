"use client";

import React from "react";
import { useErrorData } from "./ErrorDataProvider";

interface ErrorSidebarProps {
  onErrorTypeClick: (errorName: string) => void;
  selectedErrorType?: string;
}

export default function ErrorSidebar({
  onErrorTypeClick,
  selectedErrorType,
}: ErrorSidebarProps) {
  const { filteredStats, statsLoading } = useErrorData();

  if (statsLoading) {
    return (
      <div className="col-md-3">
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">Error Summary</h5>
          </div>
          <div className="card-body text-center">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!filteredStats) {
    return (
      <div className="col-md-3">
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">Error Summary</h5>
          </div>
          <div className="card-body text-center">
            <p className="text-muted">Failed to load error summary</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="col-md-3">
      <div
        className="card"
        style={{
          position: "sticky",
          top: "30px",
          zIndex: "1000",
        }}
      >
        <div className="card-header">
          <h5 className="card-title mb-0">Error Summary</h5>
        </div>
        <div className="card-body">
          {/* Total Errors */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h6 className="mb-1">Total Errors</h6>
                <h4 className="text-primary mb-0">
                  {filteredStats.totalErrors.toLocaleString()}
                </h4>
              </div>
              <div className="text-primary">
                <i className="fas fa-exclamation-triangle fa-2x"></i>
              </div>
            </div>
          </div>

          {/* Unique Error Types */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h6 className="mb-1">Error Types</h6>
                <h4 className="text-warning mb-0">
                  {filteredStats.uniqueErrorTypes}
                </h4>
              </div>
              <div className="text-warning">
                <i className="fas fa-bug fa-2x"></i>
              </div>
            </div>
          </div>

          {/* Error Types List */}
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Error Types</h6>
              <small
                className={`percentage-total ${
                  Math.abs(
                    filteredStats.errorTypeStats.reduce(
                      (sum, stat) => sum + parseFloat(stat.percentage),
                      0
                    ) - 100
                  ) < 0.1
                    ? "valid"
                    : "invalid"
                }`}
              >
                Total:{" "}
                {filteredStats.errorTypeStats
                  .reduce((sum, stat) => sum + parseFloat(stat.percentage), 0)
                  .toFixed(1)}
                %
              </small>
            </div>
            <div className="list-group list-group-flush">
              {filteredStats.errorTypeStats
                .slice(0, 10)
                .map((errorType, index) => (
                  <button
                    key={index}
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                      selectedErrorType === errorType.name
                        ? "selected-error-type"
                        : ""
                    }`}
                    onClick={() => onErrorTypeClick(errorType.name)}
                    style={{
                      border: "none",
                      padding: "10px 10px",
                      flexWrap: "wrap",
                      borderRadius: "10px",
                    }}
                  >
                    <div className="flex-grow-1">
                      <div
                        className="font-weight-bold"
                        style={{ fontSize: "0.9rem" }}
                      >
                        {errorType.name}
                      </div>
                      <small className="text-muted">
                        {errorType.uniqueOccurrences} occurrence
                        {errorType.uniqueOccurrences !== 1 ? "s" : ""}
                      </small>
                    </div>
                    <div className="text-right">
                      <span className="badge badge-primary badge-pill">
                        {errorType.count}
                      </span>
                      <div className="small text-muted">
                        {errorType.percentage}%
                      </div>
                    </div>
                  </button>
                ))}
              {filteredStats.errorTypeStats.length > 10 && (
                <div className="text-center mt-2">
                  <small className="text-muted">
                    +{filteredStats.errorTypeStats.length - 10} more error types
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
