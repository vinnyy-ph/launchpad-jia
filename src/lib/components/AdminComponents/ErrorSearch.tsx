"use client";

import React, { useState, useEffect } from "react";

interface ErrorSearchProps {
  onSearch: (query: string) => void;
  onErrorTypeFilter: (errorName: string) => void;
  onClearFilters: () => void;
  errorNameFilter: string;
}

export default function ErrorSearch({
  onSearch,
  onErrorTypeFilter,
  onClearFilters,
  errorNameFilter,
}: ErrorSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  const handleClearFilters = () => {
    setSearchQuery("");
    onClearFilters();
  };

  const hasActiveFilters = searchQuery || errorNameFilter;

  return (
    <div className="card mb-4">
      <div className="card-body">
        <div className="row align-items-end">
          <div className="col-md-8">
            <div className="form-group mb-0">
              <label
                htmlFor="searchInput"
                className="form-label font-weight-bold"
              >
                Filter Errors
              </label>
              <div className="input-group">
                <button className="input-group-text bg-light border-right-0 mr-2 pr-3">
                  <i className="la la-search text-default"></i>
                </button>

                <input
                  type="text"
                  id="searchInput"
                  className="form-control pl-3"
                  placeholder="Search by error name, interview ID, or log date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: "0" }}
                />
              </div>
              <small className="form-text text-muted mt-1">
                Search across error names, interview IDs, and log dates
              </small>
            </div>
          </div>
          <div className="my-auto">
            <div className="d-flex mt-2">
              <button
                className="btn btn-default "
                onClick={() => onErrorTypeFilter("")}
                disabled={!errorNameFilter}
              >
                <i className="fas fa-filter mr-1"></i> Clear Filters
              </button>
              <button
                className="btn btn-default"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
              >
                <i className="fas fa-times mr-1"></i> Reset View
              </button>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="row mt-3">
            <div className="col-12">
              <div className="alert alert-light border">
                <strong>Active Filters:</strong>
                {searchQuery && (
                  <span className="badge badge-primary ml-2">
                    Search: "{searchQuery}"
                  </span>
                )}
                {errorNameFilter && (
                  <span className="badge badge-warning ml-2">
                    Error Type: "{errorNameFilter}"
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
