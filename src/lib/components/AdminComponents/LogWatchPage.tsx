"use client";

import React from "react";
import ErrorOverview from "./ErrorOverview";
import ErrorLineChart from "./ErrorLineChart";
import ErrorTable from "./ErrorTable";
import ErrorSearch from "./ErrorSearch";
import ErrorSidebar from "./ErrorSidebar";
import ErrorDataProvider, { useErrorData } from "./ErrorDataProvider";
import "./ErrorDashboard.css";

function LogWatchPageContent() {
  const {
    searchQuery,
    errorNameFilter,
    setSearchQuery,
    setErrorNameFilter,
    clearFilters,
    refreshData,
  } = useErrorData();

  return (
    <div
      className="container-fluid py-5"
      style={{
        backgroundColor: "#f8f9fc",
        width: "100%",
        maxWidth: "1500px",
      }}
    >
      {/* Page Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src="/jia-logo-white-bg.svg"
                alt="Logo"
                style={{
                  width: 60,
                  height: 60,
                  objectFit: "contain",
                  borderRadius: "50%",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <h1 className="h3 mb-0 font-weight-bold">JIA Logs Dashboard</h1>
                <p className="text-muted mb-0">
                  Monitor and analyze system errors
                </p>
              </div>
            </div>
            <button
              className="btn btn-default"
              onClick={refreshData}
              title="Refresh data"
            >
              <i className="fas fa-sync-alt mr-1"></i> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Search Component */}
      <div className="row">
        <div className="col-12">
          <ErrorSearch
            onSearch={setSearchQuery}
            onErrorTypeFilter={setErrorNameFilter}
            onClearFilters={clearFilters}
            errorNameFilter={errorNameFilter}
          />
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="row">
        {/* Sidebar */}
        <ErrorSidebar
          onErrorTypeClick={setErrorNameFilter}
          selectedErrorType={errorNameFilter}
        />

        {/* Main Content */}
        <div className="col-md-9">
          {/* Overview Statistics */}
          <div className="row">
            <div className="col-12">
              <ErrorOverview onErrorTypeClick={setErrorNameFilter} />
            </div>
          </div>

          {/* Line Chart */}
          <div className="row">
            <div className="col-12">
              <ErrorLineChart />
            </div>
          </div>

          {/* Error Table */}
          <div className="row">
            <div className="col-12">
              <ErrorTable />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogWatchPage() {
  return (
    <ErrorDataProvider>
      <LogWatchPageContent />
    </ErrorDataProvider>
  );
}
