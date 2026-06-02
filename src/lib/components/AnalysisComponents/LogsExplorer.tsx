"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import Fuse from "fuse.js";
import { errorToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";

/**
 * LogsExplorer Component
 *
 * A searchable table component for displaying logs from the jia-error-trace MongoDB collection.
 * Features include fuzzy search, error badges, and detailed log viewing.
 *
 * Usage:
 * ```tsx
 * import LogsExplorer from "@/lib/components/AnalysisComponents/LogsExplorer";
 *
 * <LogsExplorer interviewID="your-interview-id-here" />
 * ```
 *
 * Props:
 * - interviewID: string - The interview ID to filter logs by
 */

interface LogEntry {
  _id: string;
  name: string;
  logDate: string | Date;
  createdAt: Date;
  data: any;
}

interface LogsExplorerProps {
  interviewID: string;
}

const tableHeaderStyle: any = {
  textTransform: "none",
  fontWeight: 700,
  fontSize: 12,
  color: "#717680",
};

const boldColumnStyle: any = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#181D27",
};
const regularColumnStyle: any = { color: "#717680" };

export default function LogsExplorer({ interviewID }: LogsExplorerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [fuse, setFuse] = useState<Fuse<LogEntry> | null>(null);

  // Initialize Fuse.js for fuzzy search
  useEffect(() => {
    if (logs.length > 0) {
      const fuseOptions = {
        keys: ["name"],
        threshold: 0.3, // Lower threshold means more strict matching
        includeScore: true,
      };
      setFuse(new Fuse(logs, fuseOptions));
    }
  }, [logs]);

  // Handle search with Fuse.js
  useEffect(() => {
    if (!fuse) {
      setFilteredLogs(logs);
      return;
    }

    if (searchTerm.trim() === "") {
      setFilteredLogs(logs);
    } else {
      const searchResults = fuse.search(searchTerm);
      setFilteredLogs(searchResults.map((result) => result.item));
    }
  }, [searchTerm, fuse, logs]);

  // Fetch logs from API
  useEffect(() => {
    const fetchLogs = async () => {
      if (!interviewID) return;

      setIsLoading(true);
      try {
        const response = await api.post("/api/log-trace/fetch-logs", {
          interviewID,
        });

        if (response.data.success) {
          setLogs(response.data.logs);
        } else {
          errorToast(response.data.message || "Failed to fetch logs", 3000);
        }
      } catch (error) {
        console.error("Error fetching logs:", error);
        errorToast("Failed to fetch logs", 3000);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [interviewID]);

  const formatDate = (date: string | Date) => {
    if (!date) return "N/A";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleString();
  };

  const handleViewLog = (log: LogEntry) => {
    // Open log data in a new window or modal
    const logWindow = window.open("", "_blank", "width=800,height=600");
    if (logWindow) {
      logWindow.document.write(`
        <html>
          <head>
            <title>Log Details - ${log.name}</title>
            <style>
              body { font-family: monospace; padding: 20px; background: #f5f5f5; }
              .log-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .log-header { border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
              .log-data { background: #f8f9fa; padding: 15px; border-radius: 4px; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <div class="log-container">
              <div class="log-header">
                <h2>${log.name}</h2>
                <p><strong>Date:</strong> ${formatDate(log.logDate)}</p>
                <p><strong>Created:</strong> ${formatDate(log.createdAt)}</p>
              </div>
              <div class="log-data">${JSON.stringify(log.data, null, 2)}</div>
            </div>
          </body>
        </html>
      `);
    }
  };

  const getErrorBadge = (name: string) => {
    if (name.toLowerCase().includes("error")) {
      return (
        <span
          className="badge badge-danger"
          style={{
            backgroundColor: "#dc3545",
            color: "white",
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "4px",
            marginLeft: "8px",
          }}
        >
          Error
        </span>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-white" style={{ height: "100%", overflowY: "auto" }}>
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ height: "300px" }}
        >
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="sr-only">Loading...</span>
            </div>
            <div className="mt-2" style={{ color: "#717680" }}>
              Loading logs...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white" style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "0px" }}>
        {/* Search Input */}
        <div className="mb-3">
          <div className="input-group">
            <div className="input-group-prepend">
              <span
                className="input-group-text"
                style={{
                  border: "1px solid #E9EAEB",
                  borderRight: "none",
                  borderRadius: "8px 0 0 8px",
                  backgroundColor: "#F8F9FC",
                  padding: "12px 16px",
                }}
              >
                <i
                  className="la la-search"
                  style={{ fontSize: "14px", color: "#717680" }}
                ></i>
              </span>
            </div>
            <input
              type="text"
              className="form-control"
              placeholder="Search logs by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: "1px solid #E9EAEB",
                borderLeft: "none",
                borderRadius: "0 8px 8px 0",
                padding: "12px 16px",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            />
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-3">
          <span style={{ fontSize: "14px", color: "#A4A7AE", fontWeight: 500 }}>
            Showing {filteredLogs.length} of {logs.length} logs
          </span>
        </div>

        {/* Table */}
        <div
          className="table-responsive"
          style={{
            height: "fit-content",
            background: "#FFFFFF",
            borderRadius: "20px",
            border: "1px solid #E9EAEB",
          }}
        >
          <table className="table align-items-center table-flush">
            <thead style={{ background: "#F8F9FC", borderRadius: "20px" }}>
              <tr>
                <th scope="col" style={tableHeaderStyle}>
                  Name
                </th>
                <th scope="col" style={tableHeaderStyle}>
                  Log Date
                </th>
                <th scope="col" style={tableHeaderStyle}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center py-4"
                    style={{
                      verticalAlign: "middle",
                      height: "200px",
                      color: "#6c757d",
                    }}
                  >
                    <div className="d-flex flex-column justify-content-center align-items-center w-100 h-100">
                      <span style={{ color: "#d1d5db" }}>
                        <i className="la la-inbox" style={{ fontSize: 48 }}></i>
                      </span>
                      <div className="mt-2 mb-1 font-weight-bold">
                        {searchTerm ? "No logs found" : "No logs available"}
                      </div>
                      <div className="text-muted">
                        {searchTerm
                          ? "Try adjusting your search terms"
                          : "Logs will appear here when available"}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log._id} style={{ cursor: "default" }}>
                    <td style={boldColumnStyle}>
                      <div className="d-flex align-items-center">
                        <span>{log.name}</span>
                        {getErrorBadge(log.name)}
                      </div>
                    </td>
                    <td style={regularColumnStyle}>
                      {formatDate(log.logDate)}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleViewLog(log)}
                        style={{
                          backgroundColor: "#007bff",
                          borderColor: "#007bff",
                          fontSize: "12px",
                          padding: "4px 12px",
                        }}
                      >
                        <i className="la la-eye mr-1"></i>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
