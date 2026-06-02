"use client";

import React, { useEffect, useState } from "react";
import AvatarImage from "../AvatarImage/AvatarImage";
import CustomDropdown from "@/lib/components/Dropdown/CustomDropdown";
import { api } from "@/lib/utils/apiClient";

interface GmailEmailsModuleProps {
  orgId: string;
  careerId?: string;
}

// Return a short absolute date string like "Mon, Jul 22, 2025, 10:53 AM".
const formatDate = (date: any) => {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch (e) {
    return "";
  }
};

// Return a human-friendly relative time string like "2 hours ago".
const timeAgo = (date: any) => {
  try {
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    if (isNaN(diff)) return "";
    if (diff < 0) return "just now";
    const sec = Math.round(diff / 1000);
    if (sec < 60) return `${sec} second${sec === 1 ? "" : "s"} ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
    const days = Math.round(hr / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const weeks = Math.round(days / 7);
    if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
    const years = Math.round(days / 365);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  } catch (e) {
    return "";
  }
};

// Parse email address with optional display name: "DisplayName <email@domain>" or "email@domain"
const parseEmailAddress = (
  address: string | null | undefined
): { displayName: string | null; email: string } => {
  if (!address) return { displayName: null, email: "" };
  const str = String(address).trim();
  // Match pattern: "DisplayName <email@domain>"
  const match = str.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const displayName = match[1].trim();
    const email = match[2].trim();
    return { displayName: displayName || null, email };
  }
  // Otherwise treat the whole string as email
  return { displayName: null, email: str };
};

export default function GmailEmailsModule({ orgId, careerId }: GmailEmailsModuleProps) {
  const [gmailEmails, setGmailEmails] = useState<any[]>([]);
  const [gmailThreads, setGmailThreads] = useState<any[]>([]);
  const [isLoadingGmail, setIsLoadingGmail] = useState(false);
  const [selectedGmailThreadId, setSelectedGmailThreadId] = useState<string | null>(null);
  const [gmailCategoryFilter, setGmailCategoryFilter] = useState<string>("All Gmail");
  const [pageIndex, setPageIndex] = useState<number>(0);
  const PAGE_SIZE = 10;
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Fetch Gmail emails for all users in the organization
  const fetchGmailEmails = async () => {
    if (!orgId) return;
    setIsLoadingGmail(true);
    try {
      const response = await api.get("/api/gmail/emails", {
        params: { 
          orgID: orgId,
          ...(careerId && { careerId }),
        },
      });
      if (response.data?.data && Array.isArray(response.data.data)) {
        setGmailEmails(response.data.data);
      } else {
        setGmailEmails([]);
      }
      // Set threads if available
      if (response.data?.threads && Array.isArray(response.data.threads)) {
        setGmailThreads(response.data.threads);
      } else {
        setGmailThreads([]);
      }
      setLastSync(new Date());
    } catch (err) {
      console.error("Error fetching Gmail emails:", err);
      setGmailEmails([]);
      setGmailThreads([]);
    } finally {
      setIsLoadingGmail(false);
    }
  };

  // Filter Gmail threads by category filter
  const getFilteredGmailThreads = () => {
    if (!gmailThreads || gmailThreads.length === 0) return [];
    
    let filtered = gmailThreads;
    
    if (gmailCategoryFilter === "Inbox") {
      filtered = gmailThreads.filter((thread) => {
        const hasInbox = thread.isInbox || (thread.labelIds && thread.labelIds.includes("INBOX"));
        const isSentOnly = (thread.isSent || (thread.labelIds && thread.labelIds.includes("SENT"))) && !hasInbox;
        return hasInbox && !isSentOnly;
      });
    } else if (gmailCategoryFilter === "Sent") {
      filtered = gmailThreads.filter((thread) => {
        const isSent = thread.isSent || (thread.labelIds && thread.labelIds.includes("SENT"));
        const isDraft = thread.isDraft || (thread.labelIds && thread.labelIds.includes("DRAFT"));
        return isSent && !isDraft;
      });
    } else if (gmailCategoryFilter === "Drafts") {
      filtered = gmailThreads.filter((thread) => {
        return thread.isDraft || (thread.labelIds && thread.labelIds.includes("DRAFT"));
      });
    }
    // "All Gmail" shows all threads (no filtering)
    
    return filtered;
  };

  // Fetch Gmail emails when component mounts or orgId changes
  useEffect(() => {
    if (orgId) {
      fetchGmailEmails();
    }
  }, [orgId]);

  // Gmail thread counts by category
  const gmailInboxCount = gmailThreads.filter((thread) => {
    const hasInbox = thread.isInbox || (thread.labelIds && thread.labelIds.includes("INBOX"));
    const isSentOnly = (thread.isSent || (thread.labelIds && thread.labelIds.includes("SENT"))) && !hasInbox;
    return hasInbox && !isSentOnly;
  }).length;
  const gmailSentCount = gmailThreads.filter((thread) => {
    const isSent = thread.isSent || (thread.labelIds && thread.labelIds.includes("SENT"));
    const isDraft = thread.isDraft || (thread.labelIds && thread.labelIds.includes("DRAFT"));
    return isSent && !isDraft;
  }).length;
  const gmailDraftsCount = gmailThreads.filter((thread) => {
    return thread.isDraft || (thread.labelIds && thread.labelIds.includes("DRAFT"));
  }).length;

  const filteredGmailThreads = getFilteredGmailThreads();
  const totalGmailThreads = filteredGmailThreads.length;
  const lastPageIndex = Math.max(0, Math.ceil(totalGmailThreads / PAGE_SIZE) - 1);
  const startThreadIndex = totalGmailThreads === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const endThreadIndex = Math.min(totalGmailThreads, (pageIndex + 1) * PAGE_SIZE);
  const pagedGmailThreads = filteredGmailThreads.slice(
    pageIndex * PAGE_SIZE,
    (pageIndex + 1) * PAGE_SIZE
  );

  // Ensure pageIndex is valid when threads change
  useEffect(() => {
    if (pageIndex > lastPageIndex) setPageIndex(lastPageIndex);
    if (pageIndex < 0) setPageIndex(0);
  }, [gmailThreads.length, lastPageIndex]);

  const selectedThread = selectedGmailThreadId
    ? gmailThreads.find((t) => String(t.id) === String(selectedGmailThreadId))
    : null;

  return (
    <div id="gmail-emails-module" className="email-container">
      {/* Left Sidebar - Gmail Threads List */}
      <div className="sidebar">
        {/* Search Bar */}
        <div className="sidebar-header">
          <div className="search-container">
            <div style={{ position: "relative" }}>
              <svg
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "16px",
                  height: "16px",
                  color: "#6c757d",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search Gmail emails"
                className="search-input"
                disabled
                style={{ opacity: 0.5 }}
              />
            </div>
          </div>

          {/* Filter Dropdown */}
          <div className="filter-container">
            <CustomDropdown
              options={["All Gmail", "Inbox", "Sent", "Drafts"]}
              icon="la-filter"
              valuePrefix="Category:"
              value={gmailCategoryFilter}
              setValue={(value) => {
                setGmailCategoryFilter(value);
                setPageIndex(0); // Reset to first page when filter changes
              }}
              maxContent={true}
            />
          </div>
        </div>

        {/* Gmail Threads List */}
        <div className="email-list">
          {isLoadingGmail ? (
            <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
              <i className="la la-spinner la-spin" style={{ fontSize: "24px" }}></i>
              <p>Loading Gmail emails...</p>
            </div>
          ) : filteredGmailThreads.length === 0 ? (
            <div style={{ padding: 24, color: "#666" }}>No Gmail emails</div>
          ) : (
            pagedGmailThreads.map((thread) => {
              const last = thread.lastMessage;
              const parsedFrom = parseEmailAddress(last?.from);
              const isSelected = selectedGmailThreadId === String(thread.id);
              const snippet = last?.snippet || last?.text?.slice(0, 140) || last?.html?.replace(/<[^>]*>/g, "").slice(0, 140) || "";
              return (
                <div
                  key={thread.id}
                  onClick={() => {
                    setSelectedGmailThreadId(String(thread.id));
                  }}
                  className={`email-item ${isSelected ? "selected" : ""}`}
                  style={{
                    backgroundColor: isSelected ? "#F0F4FF" : "#fff",
                    border: isSelected ? "2px solid #6172F3" : "1px solid #e0e0e0",
                    padding: "12px",
                    marginBottom: "8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = "#f8f9fa";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = "#fff";
                    }
                  }}
                >
                  <div className="email-content">
                    <AvatarImage
                      src={`https://api.dicebear.com/9.x/glass/svg?seed=${parsedFrom.email}`}
                      className="rounded-circle"
                      alt={parsedFrom.email}
                      style={{ width: "32px", height: "32px" }}
                    />
                    <div className="email-info">
                      <div className="email-header">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span className="email-name">
                            {parsedFrom.displayName || parsedFrom.email}
                          </span>
                          <span className="new-badge" style={{ fontSize: 10 }}>
                            Gmail
                          </span>
                          {thread.messageCount > 1 && (
                            <span className="tag message" style={{ fontSize: 10 }}>
                              {thread.messageCount}
                            </span>
                          )}
                        </div>
                        <span className="time-text">
                          {timeAgo(last?.date) || formatDate(last?.date)}
                        </span>
                      </div>
                      <div className="subject-text" style={{ color: "#6172F3", fontWeight: "600" }}>
                        {thread.subject || "(no subject)"}
                      </div>
                      {snippet && (
                        <div className="snippet-text" style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                          {snippet}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="pagination-container">
          <button
            className="page-button"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex <= 0}
            aria-disabled={pageIndex <= 0}
          >
            Previous
          </button>
          <span>
            {totalGmailThreads === 0
              ? "0 of 0"
              : `${startThreadIndex}-${endThreadIndex} of ${totalGmailThreads}`}
          </span>
          <button
            className="page-button"
            onClick={() =>
              setPageIndex((p) => Math.min(lastPageIndex, p + 1))
            }
            disabled={pageIndex >= lastPageIndex}
            aria-disabled={pageIndex >= lastPageIndex}
          >
            Next
          </button>
        </div>
      </div>

      {/* Right Content Area - Gmail Thread Viewer */}
      <div className="content-area">
        {/* Header */}
        <div className="header">
          <div className="header-content">
            <div
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <button
                className="sync-button"
                onClick={() => fetchGmailEmails()}
                disabled={isLoadingGmail}
                aria-disabled={isLoadingGmail}
                title={isLoadingGmail ? "Syncing messages..." : "Sync messages"}
              >
                {isLoadingGmail ? (
                  <i className="la la-spinner la-spin"></i>
                ) : (
                  <i className="las la-cog la-lg"></i>
                )}
              </button>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "16px" }}
            >
              <div className="user-info">
                <div className="user-text">
                  <div className="user-email">Gmail Integration</div>
                  <div className="user-status">
                    Connected Gmail |{" "}
                    <span>
                      Last sync:{" "}
                      {lastSync ? timeAgo(lastSync) : "Not synced yet"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gmail Thread Content Area */}
        {selectedThread ? (
          <>
            {/* Gmail Thread Content Header */}
            <div className="email-content-header">
              <div className="email-subject">
                {selectedThread.subject || "(no subject)"}
              </div>
            </div>

            {/* Gmail Thread - Show all messages */}
            <div className="email-thread">
              {selectedThread.messages.map((email: any, idx: number) => {
                const parsedFrom = parseEmailAddress(email.from);
                return (
                  <div key={email.id || idx} className="email-message external" style={{ marginBottom: 18 }}>
                    <div className="message-header">
                      <AvatarImage
                        src={`https://api.dicebear.com/9.x/glass/svg?seed=${parsedFrom.email}`}
                        className="rounded-circle"
                        alt={parsedFrom.email}
                        style={{ width: "40px", height: "40px" }}
                      />
                      <div className="message-info">
                        <div className="participants">
                          <div className="sender-info">
                            <span className="sender-name">
                              {parsedFrom.displayName || parsedFrom.email || "Unknown"}
                            </span>
                            <span className="sender-email">
                              &lt;{parsedFrom.email || "unknown@example.com"}&gt;
                            </span>
                          </div>
                          <div className="recipient-info">
                            {"to " + (email.to || email.recipient || "recipient")}
                          </div>
                        </div>
                        <div className="email-timestamp">
                          <span style={{ marginBottom: 0 }}>
                            {formatDate(email.date)} ({timeAgo(email.date)})
                          </span>
                          <div className="type-tag manual">
                            <i className="las la-envelope" style={{ color: "#6172F3" }}></i>
                            Gmail
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="message-content" style={{ marginTop: 8 }}>
                      {/* Email Body */}
                      {email.html ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: email.html,
                          }}
                          style={{ marginBottom: 16 }}
                        />
                      ) : email.text ? (
                        <pre style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}>
                          {email.text}
                        </pre>
                      ) : email.body ? (
                        <div style={{ marginBottom: 16 }}>
                          {email.body}
                        </div>
                      ) : email.snippet ? (
                        <div style={{ color: "#666", marginBottom: 16 }}>
                          {email.snippet}
                        </div>
                      ) : (
                        <div style={{ color: "#999", marginBottom: 16 }}>
                          No content available
                        </div>
                      )}

                      {/* Attachments */}
                      {email.attachments &&
                        Array.isArray(email.attachments) &&
                        email.attachments.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <span className="attachment-count">
                              <i className="las la-paperclip"></i>
                              {email.attachments.length}{" "}
                              {email.attachments.length === 1
                                ? "attachment"
                                : "attachments"}
                            </span>
                            <div className="attachment-list" style={{ marginTop: 8 }}>
                              {email.attachments.map((att: any, i: number) => (
                                <div className="attachment-item" key={i}>
                                  <i className="las la-file la-lg"></i>
                                  <div className="attachment-details">
                                    <span className="attachment-name">
                                      {att.filename || `attachment-${i}`}
                                    </span>
                                    <span className="attachment-size">
                                      {att.size
                                        ? `${Math.round(att.size / 1024)} KB`
                                        : ""}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      color: "#666",
                                      marginLeft: "8px",
                                    }}
                                  >
                                    {att.mimeType || ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Empty State for Gmail */}
            <div className="empty-state">
              <div className="empty-state-content">
                <img
                  src="/images/email-pulse-icon.png"
                  alt="Email Icon"
                  className="empty-state-icon"
                />
                <h3 className="empty-state-title">
                  Select a Gmail email to view details
                </h3>
                <p className="empty-state-text">
                  Choose an email from the Gmail inbox to read the full details
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
