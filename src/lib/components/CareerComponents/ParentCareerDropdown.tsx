"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { api } from "@/lib/utils/apiClient";
import { decodeHtmlEntities } from "@/lib/utils/sanitizeInput";

interface Career {
  _id: string;
  id: string;
  jobTitle: string;
  parentCareerID?: string | null;
}

interface ParentCareerDropdownProps {
  selectedParentId: string | null;
  selectedParentTitle: string | null;
  onSelectParent: (careerId: string | null, careerTitle: string | null) => void;
  orgID: string;
  excludeCareerID?: string;
  hasError?: boolean;
}

export default function ParentCareerDropdown({
  selectedParentId,
  selectedParentTitle,
  onSelectParent,
  orgID,
  excludeCareerID,
  hasError = false,
}: ParentCareerDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const decodeTitle = (value: string | null | undefined) =>
    decodeHtmlEntities(value || "");

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [careers, setCareers] = useState<Career[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCareers = async () => {
      if (!orgID) {
        setCareers([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.post("/api/get-potential-parent-careers", {
          orgID,
          excludeCareerID,
        });

        if (response.status === 200 && response.data.careers) {
          setCareers(response.data.careers || []);
        } else {
          setApiError("Failed to load job posts");
          setCareers([]);
        }
      } catch (err: any) {
        setApiError(err.message || "An error occurred");
        setCareers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCareers();
  }, [orgID, excludeCareerID]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredCareers = useMemo(() => {
    if (!searchQuery.trim()) return careers;

    return careers.filter((career) =>
      decodeTitle(career.jobTitle).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [careers, searchQuery]);

  const handleSelectParent = (careerId: string | null, careerTitle: string | null) => {
    onSelectParent(careerId, careerTitle ? decodeTitle(careerTitle) : null);
    setIsOpen(false);
    setSearchQuery("");
  };

  const resolvedSelectedParentTitle = selectedParentTitle
    ? decodeTitle(selectedParentTitle)
    : null;

  return (
    <div
      ref={dropdownRef}
      className="dropdown w-100"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        position: "relative",
      }}
    >
      <button
        className="dropdown-btn fade-in-bottom"
        style={{
          width: "100%",
          height: "48px",
          color: "#181D27",
          border: `2px solid ${hasError ? "#EF4444" : "#E9EAEB"}`,
          backgroundColor: "#FFFFFF",
          borderRadius: "8px",
          padding: "0 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
      >
        <span style={{ color: resolvedSelectedParentTitle ? "#181D27" : "#717680" }}>
          {resolvedSelectedParentTitle || "Select a parent post"}
        </span>
        <i className="la la-angle-down ml-10"></i>
      </button>

      {isOpen && (
        <div
          className="org-dropdown-anim show"
          style={{
            width: "100%",
            position: "absolute",
            top: "calc(48px + 4px)",
            left: "0",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E9EAEB",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            maxHeight: "350px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{ padding: "8px 12px", borderBottom: "1px solid #E9EAEB" }}
          >
            <div style={{ position: "relative" }}>
              <i
                className="la la-search"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#717680",
                  fontSize: "16px",
                }}
              />
              <input
                type="text"
                placeholder="Search job posts"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 36px",
                  border: "1px solid #E9EAEB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {isLoading ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#717680",
                }}
              >
                <i
                  className="la la-spinner la-spin"
                  style={{ fontSize: "20px" }}
                />
                <div style={{ marginTop: "8px", fontSize: "14px" }}>
                  Loading job posts...
                </div>
              </div>
            ) : apiError ? (
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "6px",
                  margin: "8px 12px",
                  color: "#B42318",
                  fontSize: "14px",
                }}
              >
                <i
                  className="la la-exclamation-circle"
                  style={{ marginRight: "8px" }}
                />
                {apiError}
              </div>
            ) : filteredCareers.length > 0 ? (
              filteredCareers.map((career) => {
                const displayTitle = decodeTitle(career.jobTitle);

                return (
                  <div
                    key={career._id}
                    onClick={() => handleSelectParent(career.id, displayTitle)}
                    style={{
                      padding: "10px 12px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor:
                        selectedParentId === career.id ? "#F8F9FC" : "transparent",
                      fontWeight: selectedParentId === career.id ? 700 : 500,
                    }}
                  >
                    <span style={{ color: "#414651", fontSize: "14px" }}>
                      {displayTitle}
                    </span>
                    {selectedParentId === career.id && (
                      <i className="la la-check" style={{ color: "#2563EB" }} />
                    )}
                  </div>
                );
              })
            ) : searchQuery ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#717680",
                  fontSize: "14px",
                }}
              >
                No job posts match "{searchQuery}"
              </div>
            ) : (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#717680",
                  fontSize: "14px",
                }}
              >
                No available parent job posts
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
