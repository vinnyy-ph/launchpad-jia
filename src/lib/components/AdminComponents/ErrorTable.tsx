"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useErrorData } from "./ErrorDataProvider";

interface ErrorEntry {
  _id: string;
  name: string;
  interviewID: string;
  logDate: string;
  createdAt: string;
  count: number;
  err?: any;
  errCode?: string;
  errTrace?: string;
  [key: string]: any;
}

export default function ErrorTable() {
  const { filteredErrors, loading } = useErrorData();
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();

  const itemsPerPage = 20;

  // Calculate pagination for filtered data
  const paginatedErrors = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredErrors.slice(startIndex, endIndex);
  }, [filteredErrors, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredErrors.length / itemsPerPage);
  const totalCount = filteredErrors.length;

  const handleViewInfo = (error: ErrorEntry) => {
    setSelectedError(error);
    setShowModal(true);
  };

  const handleInterviewClick = (interviewID: string) => {
    // Since we don't have careerID in error data, we'll need to fetch it
    // For now, we'll use a placeholder that needs to be resolved
    // TODO: Implement proper career ID lookup from interview ID
    const careerID = "e1db4def-e01b-48ac-ae5a-e8b31108ada9"; // Fallback value
    router.push(
      `/recruiter-dashboard/careers/manage/${careerID}/interview-analysis/${interviewID}`
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <li
          key={i}
          className={`page-item ${i === currentPage ? "active" : ""}`}
        >
          <button
            className="page-link"
            onClick={() => setCurrentPage(i)}
            disabled={loading}
          >
            {i}
          </button>
        </li>
      );
    }

    return (
      <nav aria-label="Error table pagination">
        <ul className="pagination justify-content-center">
          <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
            <button
              className="page-link"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1 || loading}
            >
              <i className="la la-arrow-left"></i>
            </button>
          </li>
          {pages}
          <li
            className={`page-item ${
              currentPage === totalPages ? "disabled" : ""
            }`}
          >
            <button
              className="page-link"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
            >
              <i className="la la-arrow-right"></i>
            </button>
          </li>
        </ul>
      </nav>
    );
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">Error Logs</h5>
          <small className="text-muted">
            Showing {paginatedErrors.length} of {totalCount.toLocaleString()}{" "}
            errors
          </small>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">Loading...</span>
              </div>
              <p className="text-muted mt-2 mb-0">Loading error logs...</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="thead-light">
                    <tr>
                      <th>Error Name</th>
                      <th>Interview ID</th>
                      <th>Log Date</th>
                      <th>Count</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedErrors.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-4">
                          No errors found
                        </td>
                      </tr>
                    ) : (
                      paginatedErrors.map((error) => (
                        <tr key={error._id}>
                          <td>
                            <strong
                              style={{ fontSize: "1rem" }}
                              className="text-dark"
                            >
                              {error.name}
                            </strong>
                          </td>
                          <td>
                            {error.interviewID ? (
                              <button
                                className="btn btn-link p-0 text-primary"
                                onClick={() =>
                                  handleInterviewClick(error.interviewID)
                                }
                                title="View interview analysis"
                                style={{ fontSize: "0.9rem" }}
                              >
                                {error.interviewID}
                              </button>
                            ) : (
                              <span className="text-muted">N/A</span>
                            )}
                          </td>
                          <td style={{ fontSize: "0.9rem" }}>
                            {formatDate(error.logDate)}
                          </td>
                          <td>
                            <span
                              className="badge badge-info"
                              style={{ fontSize: "0.8rem" }}
                            >
                              {error.count}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-default btn-sm"
                              onClick={() => handleViewInfo(error)}
                            >
                              View Info
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="card-footer">{renderPagination()}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal for error details */}
      {showModal && selectedError && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Error Details</h5>
                <button
                  type="button"
                  className="close"
                  onClick={() => setShowModal(false)}
                  aria-label="Close"
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6>Basic Information</h6>
                    <table className="table table-sm">
                      <tbody>
                        <tr>
                          <td>
                            <strong>Error Name:</strong>
                          </td>
                          <td>{selectedError.name}</td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Interview ID:</strong>
                          </td>
                          <td>{selectedError.interviewID || "N/A"}</td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Log Date:</strong>
                          </td>
                          <td>{formatDate(selectedError.logDate)}</td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Count:</strong>
                          </td>
                          <td>{selectedError.count}</td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Created At:</strong>
                          </td>
                          <td>{formatDate(selectedError.createdAt)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="col-md-6">
                    <h6>Error Details</h6>
                    <div
                      className="border rounded p-3"
                      style={{ maxHeight: "300px", overflowY: "auto" }}
                    >
                      <pre className="mb-0" style={{ fontSize: "12px" }}>
                        {JSON.stringify(selectedError, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
                {selectedError.interviewID && (
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={() => {
                      setShowModal(false);
                      handleInterviewClick(selectedError.interviewID);
                    }}
                  >
                    View Interview Analysis
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
