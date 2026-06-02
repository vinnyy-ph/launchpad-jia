"use client";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";

interface RelatedCareer {
  _id: string;
  id: string;
  jobTitle: string;
  childTitle?: string | null;
}

interface CareerHierarchyBadgeProps {
  career: {
    jobTitle?: string;
    careerPostType?: string | null;
    childTitle?: string | null;
    parentCareer?: RelatedCareer | null;
    childCareers?: RelatedCareer[];
  } | null;
  orgID: string;
}

export default function CareerHierarchyBadge({ career, orgID }: CareerHierarchyBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const postType = career?.careerPostType;
  const isParent = postType === "candidate_pool";
  const isChild = postType === "receiving_pool";

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!isParent && !isChild) return null;

  const childCareers = career?.childCareers ?? [];
  const parentCareer = career?.parentCareer;
  const hasLinkedCareers = isParent ? childCareers.length > 0 : !!parentCareer;

  const getCareerHref = (careerId: string) =>
    `/recruiter-dashboard/careers/manage/${careerId}?orgID=${orgID}`;

  const badgeLabel = isParent ? "Parent" : (career?.childTitle || "Child");
  const emptyStateMessage = isParent
    ? "No child posts connected yet."
    : "This child post is not connected to a parent post yet.";

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      {/* Badge */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          marginTop: "-4px",
          marginBottom: "8px",
          backgroundColor: "#FAFAFA",
          border: "1px solid #E9EAEB",
          padding: "4px 10px",
          borderRadius: "8px",
          width: "fit-content",
          fontSize: 14,
          color: "#414651",
          fontWeight: 500,
          lineHeight: "20px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {badgeLabel}
      </div>

      {/* Popup */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 50,
            display: "flex",
            padding: "12px",
            gap: "10px",
            flexDirection: "column",
            boxShadow: "0 24px 48px -12px rgba(10, 13, 18, 0.18)",
            backgroundColor: "#FFF",
            borderRadius: "8px",
            border: "1px solid #E9EAEB",
            minWidth: "340px",
          }}
        >
          {/* Header */}
          <div>
            <span style={{ fontWeight: "bold", fontSize: "16px", color: "#414651" }}>
              {isParent ? "Child" : "Parent"}
            </span>
            {isParent && (
              <>
                {" "}
                <span
                  style={{
                    border: "1px solid #D5D7DA",
                    padding: "2px 6px",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                >
                  {childCareers.length}
                </span>
              </>
            )}
          </div>

          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {hasLinkedCareers ? (
              isParent ? (
                childCareers.map((child) => (
                  <CareerListItem
                    key={child._id}
                    jobTitle={career?.jobTitle || ""}
                    subtitle={child.childTitle || child.jobTitle}
                    href={getCareerHref(child._id)}
                    onClick={() => setIsOpen(false)}
                  />
                ))
              ) : (
                parentCareer && (
                  <CareerListItem
                    jobTitle={parentCareer.jobTitle}
                    href={getCareerHref(parentCareer._id)}
                    onClick={() => setIsOpen(false)}
                  />
                )
              )
            ) : (
              <div
                style={{
                  width: "340px",
                  padding: "12px",
                  border: "1px solid #E9EAEB",
                  borderRadius: "6px",
                  backgroundColor: "#FAFAFA",
                  fontSize: "14px",
                  color: "#535862",
                  lineHeight: "20px",
                }}
              >
                {emptyStateMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CareerListItem({ jobTitle, subtitle, href, onClick }: { jobTitle: string; subtitle?: string; href: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        width: "340px",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "8px",
        padding: "12px",
        border: "1px solid #D5D7DA",
        borderRadius: "6px",
        cursor: "pointer",
        textDecoration: "none",
        backgroundColor: hovered ? "#F5F5F5" : "transparent",
        transition: "background-color 0.15s",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "14px", fontWeight: 500, color: "#181D27" }}>{jobTitle}</div>
        {subtitle && (
          <div style={{ fontSize: "14px", fontWeight: 500, color: "#717680" }}>{subtitle}</div>
        )}
      </div>
      <img
        style={{ width: "20px", height: "20px", flexShrink: 0, alignSelf: "center" }}
        src="/icons/chevron-right.svg"
        alt="chevron-right"
      />
    </Link>
  );
}
