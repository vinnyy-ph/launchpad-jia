"use client";

import React from "react";
import { createPortal } from "react-dom";
import type { CandidateCard } from "./types";
import { Label } from "@/lib/components/GuestPortalComponents/label";
import { FIT_STATUS_MAP, getBaseFitStatus } from "@/lib/components/GuestPortalComponents/Careers/ViewCareer/types";
import { api } from "@/lib/utils/apiClient";

function CandidateHoverCard({
  card,
  guestOrgId,
  onMouseEnter,
  onMouseLeave,
  anchorRect,
  usePortal,
}: {
  card: CandidateCard;
  guestOrgId: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  anchorRect?: DOMRect | null;
  usePortal?: boolean;
}) {
  const baseFitStatus = getBaseFitStatus(card.fit);
  const [isLoading, setIsLoading] = React.useState(false);
  const [phone, setPhone] = React.useState<string | null>(null);
  const [location, setLocation] = React.useState<string | null>(null);
  const [orgSkills, setOrgSkills] = React.useState<string[] | null>(null);
  const [cvSkills, setCvSkills] = React.useState<string[] | null>(null);

  const extractSkillsFromCv = React.useCallback((cvData: any): string[] => {
    try {
      const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];
      const skillsSection = digitalCV.find((section: any) => section?.name === "Skills");
      if (!skillsSection?.content) return [];

      const cleaned = String(skillsSection.content)
        .replace(/^[-*+]\s+/gm, "")
        .replace(/^\d+\.\s+/gm, "")
        .replace(/[#*_~`]/g, "")
        .replace(/^>\s+/gm, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

      const skills = cleaned
        .split(/[\n,]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 1 && !/^[^a-zA-Z0-9]+$/.test(s));

      return skills;
    } catch {
      return [];
    }
  }, []);

  const sanitizeLocation = React.useCallback((value: any): string | null => {
    const raw = value ? String(value) : "";
    if (!raw) return null;
    if (/linkedin|http[s]?:\/\/|www\./i.test(raw)) return null;
    return raw;
  }, []);

  React.useEffect(() => {
    let mounted = true;
    if (!card?.email) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setIsLoading(true);

        const candidateEmail = card.email;

        const orgSkillsPromise = guestOrgId
          ? api
              .get(
                `/api/get-org-candidate-skills?candidateEmail=${encodeURIComponent(candidateEmail)}&orgID=${encodeURIComponent(
                  guestOrgId,
                )}`,
                { signal: controller.signal },
              )
              .then((r) => r?.data)
              .catch(() => null)
          : Promise.resolve(null);

        const cvPromise = api
          .post(
            `/api/load-user-cv`,
            { email: candidateEmail },
            {
              signal: controller.signal,
            },
          )
          .then((r) => r?.data)
          .catch(() => null);

        const [orgRes, cvRes] = await Promise.all([orgSkillsPromise, cvPromise]);
        if (!mounted) return;

        const orgItems = orgRes?.items || [];
        const orgSkillNames = (Array.isArray(orgItems) ? orgItems : [])
          .map((it: any) => it?.skillName)
          .filter((s: any) => !!s);

        setOrgSkills(orgSkillNames);

        const cvPhone = cvRes?.phone ? String(cvRes.phone) : null;
        const cvLocation = sanitizeLocation(cvRes?.location);
        setPhone(cvPhone);
        setLocation(cvLocation);

        setCvSkills(extractSkillsFromCv(cvRes));
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [card?.email, guestOrgId, extractSkillsFromCv, sanitizeLocation]);

  const resolvedSkills =
    Array.isArray(orgSkills) && orgSkills.length > 0
      ? orgSkills
      : Array.isArray(cvSkills) && cvSkills.length > 0
        ? cvSkills
        : [];

  const phoneLabel = phone ? phone : "No phone";
  const locationLabel = location ? location : "No location";

  const isClient = typeof window !== "undefined";
  const shouldPortal = !!(isClient && usePortal && anchorRect);
  const willFlipUp = shouldPortal && anchorRect ? window.innerHeight - anchorRect.bottom < 420 : false;

  const hoverNode = (
    <div
      style={{
        position: shouldPortal ? "fixed" : "absolute",
        top: shouldPortal && anchorRect
          ? willFlipUp
            ? Math.max(8, anchorRect.top - 8)
            : Math.min(window.innerHeight - 8, anchorRect.bottom + 8)
          : 58,
        left: shouldPortal && anchorRect
          ? Math.min(window.innerWidth - 8, Math.max(8, anchorRect.left))
          : 12,
        transform: shouldPortal && anchorRect
          ? willFlipUp
            ? "translateY(-100%)"
            : "translateY(0)"
          : "translateY(0)",
        width: "clamp(260px, 40vw, 380px)",
        background: "#fff",
        border: "1px solid #EAECF0",
        borderRadius: 12,
        boxShadow: "0px 12px 16px -4px rgba(16, 24, 40, 0.08)",
        zIndex: 1000,
        padding: 12,
        pointerEvents: "auto",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img
          src={card.avatar}
          alt=""
          style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#101828",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={card.name}
          >
            {card.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#667085",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={card.email}
          >
            {card.email}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "#EAECF0", margin: "10px 0" }} />

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#344054", marginBottom: 8 }}>Endorsed by</div>
        {card.endorsedBy ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img
              src={card.endorsedByAvatar || "/maybe-fit-avatar.png"}
              alt=""
              style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: "#667085" }}>
              Endorsed by <span style={{ fontWeight: 600, color: "#344054" }}>{card.endorsedBy}</span>
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#6B7280" }}>Not endorsed yet</span>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#344054", marginBottom: 8 }}>Contact Details</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: "999px",
              backgroundColor: "#F3F4F6",
              border: "1px solid #E5E7EB",
              maxWidth: "100%",
            }}
          >
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
              {card.email}
            </span>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: "999px",
              backgroundColor: "#F3F4F6",
              border: "1px solid #E5E7EB",
              maxWidth: "100%",
            }}
          >
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{isLoading ? "Loading…" : phoneLabel}</span>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: "999px",
              backgroundColor: "#F3F4F6",
              border: "1px solid #E5E7EB",
              maxWidth: "100%",
            }}
          >
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{isLoading ? "Loading…" : locationLabel}</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#344054", marginBottom: 8 }}>Skills</div>
        {isLoading ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                style={{
                  minWidth: 80,
                  height: 24,
                  borderRadius: "999px",
                  backgroundColor: "#E5E7EB",
                }}
              />
            ))}
          </div>
        ) : resolvedSkills.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {resolvedSkills.slice(0, 24).map((skill: string, idx: number) => (
              <span
                key={`${skill}-${idx}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  backgroundColor: "#F3F4F6",
                  border: "1px solid #E5E7EB",
                  fontSize: 12,
                  color: "#374151",
                  fontWeight: 500,
                }}
              >
                {skill}
              </span>
            ))}
            {resolvedSkills.length > 24 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  border: "1px dashed #E5E7EB",
                  backgroundColor: "#F9FAFB",
                  fontSize: 12,
                  color: "#6B7280",
                  fontWeight: 500,
                }}
              >
                {resolvedSkills.length - 24} more
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#6B7280" }}>No skills listed.</span>
        )}
      </div>

      {(card.fit || card.timeAgo) && <div style={{ height: 1, background: "#EAECF0", margin: "10px 0" }} />}

      {card.fit ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {(() => {
            if (baseFitStatus) {
              const { bgColor, borderColor, textColor } = FIT_STATUS_MAP[baseFitStatus];
              return (
                <Label bgColor={bgColor} textColor={textColor} strokeColor={borderColor}>
                  {card.fit}
                </Label>
              );
            }

            return (
              <Label bgColor="#F2F4F7" textColor="#344054" strokeColor="#E4E7EC">
                {card.fit}
              </Label>
            );
          })()}
          {card.timeAgo ? <span style={{ fontSize: 12, color: "#98A2B3" }}>{card.timeAgo}</span> : null}
        </div>
      ) : card.timeAgo ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 12, color: "#98A2B3" }}>{card.timeAgo}</span>
        </div>
      ) : null}
    </div>
  );

  if (shouldPortal) {
    return createPortal(hoverNode, document.body);
  }

  return hoverNode;
}

export default function KanbanCard({
  card,
  isDropdownOpen,
  onToggleDropdown,
  onCloseDropdown,
  onViewAnalysis,
  onViewCV,
}: {
  card: CandidateCard;
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
  onViewAnalysis?: () => void;
  onViewCV?: () => void;
}) {
  const baseFitStatus = getBaseFitStatus(card.fit);
  const hasFit = Boolean(card.fit);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [showHoverCard, setShowHoverCard] = React.useState(false);
  const hoverTimeoutRef = React.useRef<number | null>(null);
  const [hoveredAnchorRect, setHoveredAnchorRect] = React.useState<DOMRect | null>(null);

  // Prevent setState-after-unmount if a hover timeout is pending (e.g. navigate away quickly)
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };
  }, []);

  const guestOrgId = React.useMemo(() => {
    try {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem("guestOrg");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?._id || null;
    } catch {
      return null;
    }
  }, []);

  const handleHoverEnter = React.useCallback((rect?: DOMRect | null) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowHoverCard(true);
    if (rect) {
      setHoveredAnchorRect(rect);
    }
  }, []);

  const handleHoverLeave = React.useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setShowHoverCard(false);
      setHoveredAnchorRect(null);
      hoverTimeoutRef.current = null;
    }, 200);
  }, []);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onCloseDropdown();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isDropdownOpen, onCloseDropdown]);

  const canViewAnalysis = typeof onViewAnalysis === "function";

  return (
    <div
      onClick={() => {
        if (canViewAnalysis) onViewAnalysis?.();
      }}
      style={{
        background: baseFitStatus === "Retake" ? "#FFFCF5" : "#fff",
        border: baseFitStatus === "Retake" ? "1px solid #FEEFC7" : "1px solid #EAECF0",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        position: "relative",
        cursor: canViewAnalysis ? "pointer" : "default",
      }}
    >
      {hasFit && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {(() => {
            if (baseFitStatus) {
              const { bgColor, borderColor, textColor } = FIT_STATUS_MAP[baseFitStatus];

              return (
                <Label bgColor={bgColor} textColor={textColor} strokeColor={borderColor}>
                  {baseFitStatus === "Strong fit" && (
                    <img
                      src="/iconsV3/star-green.svg"
                      alt="Strong fit"
                      style={{ width: 12, height: 12, display: "block" }}
                    />
                  )}
                  {card.fit}
                </Label>
              );
            }

            return (
              <Label bgColor="#F2F4F7" textColor="#344054" strokeColor="#E4E7EC">
                {card.fit}
              </Label>
            );
          })()}
          <div
            style={{ position: "relative" }}
            ref={dropdownRef}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <button
              aria-label="More"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDropdown();
              }}
              style={{
                border: 0,
                background: "transparent",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <img src="/iconsV3/more-horizontal.svg" alt="" style={{ width: 20, height: 20, display: "block" }} />
            </button>
            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  background: "#fff",
                  border: "1px solid #EAECF0",
                  borderRadius: 12,
                  boxShadow: "0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08)",
                  width: 200,
                  zIndex: 1000,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "8px 20px" }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 550, color: "#101828" }}>Candidate Menu</h3>
                </div>
                <div style={{ height: 1, background: "#EAECF0", width: "100%" }} />
                <div style={{ padding: "8px 0" }}>
                  <button
                    style={{
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "#344054",
                      textAlign: "left",
                    }}
                    onClick={() => {
                      if (onViewAnalysis) {
                        onViewAnalysis();
                      }
                      onCloseDropdown();
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <img
                      src="/iconsV3/zap-dark.svg"
                      alt="View Analysis by Jia icon"
                      style={{ width: 16, height: 16, display: "block" }}
                    />
                    View Analysis by Jia
                  </button>
                  <button
                    style={{
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "#344054",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    onClick={() => {
                      if (onViewCV) {
                        onViewCV();
                      }
                      onCloseDropdown();
                    }}
                  >
                    <img
                      src="/iconsV3/docs-dark.svg"
                      alt="View CV icon"
                      style={{ width: 16, height: 16, display: "block" }}
                    />
                    View CV
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Middle: Avatar + info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: hasFit ? "flex-start" : "space-between",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}
          onMouseEnter={(e) => {
            handleHoverEnter(e.currentTarget.getBoundingClientRect());
          }}
          onMouseLeave={handleHoverLeave}
        >
          <img
            src={card.avatar}
            alt=""
            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
          />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#414651",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
                display: "block",
              }}
              title={card.name}
            >
              {card.name}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#717680",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
                display: "block",
              }}
              title={card.email}
            >
              {card.email}
            </span>
          </div>

          {showHoverCard && (
            <CandidateHoverCard
              card={card}
              guestOrgId={guestOrgId}
              onMouseEnter={() => {
                handleHoverEnter();
              }}
              onMouseLeave={handleHoverLeave}
              usePortal={true}
              anchorRect={hoveredAnchorRect}
            />
          )}
        </div>
        {!hasFit && (
          <div
            style={{ position: "relative" }}
            ref={dropdownRef}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <button
              aria-label="More"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDropdown();
              }}
              style={{
                border: 0,
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                marginLeft: 8,
              }}
            >
              <img src="/iconsV3/more-horizontal.svg" alt="" style={{ width: 20, height: 20, display: "block" }} />
            </button>
            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 8,
                  background: "#fff",
                  border: "1px solid #EAECF0",
                  borderRadius: 12,
                  boxShadow: "0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08)",
                  width: 200,
                  zIndex: 1000,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "16px 20px" }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 550, color: "#101828" }}>Candidate Menu</h3>
                </div>
                <div style={{ height: 1, background: "#EAECF0", width: "100%" }} />
                <div style={{ padding: "8px 0" }}>
                  <button
                    style={{
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "#344054",
                      textAlign: "left",
                    }}
                    onClick={() => {
                      if (onViewAnalysis) {
                        onViewAnalysis();
                      }
                      onCloseDropdown();
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <img
                      src="/iconsV3/zap-dark.svg"
                      alt="View Analysis by Jia icon"
                      style={{ width: 16, height: 16, display: "block" }}
                    />
                    View Analysis by Jia
                  </button>
                  <button
                    style={{
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      padding: "12px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "#344054",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    onClick={() => {
                      if (onViewCV) {
                        onViewCV();
                      }
                      onCloseDropdown();
                    }}
                  >
                    <img
                      src="/iconsV3/docs-dark.svg"
                      alt="View CV icon"
                      style={{ width: 16, height: 16, display: "block" }}
                    />
                    View CV
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: time + endorsed/assessed */}
      <div style={{ borderTop: "1px solid #EAECF0", marginTop: 8, paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#98A2B3" }}>{card.timeAgo}</span>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, justifyContent: "flex-end" }}>
            {/* Endorsed by */}
            {card.endorsedBy ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <img
                  src={card.endorsedByAvatar || "/maybe-fit-avatar.png"}
                  alt=""
                  style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
                <span 
                  style={{ 
                    fontSize: 12, 
                    color: "#717680",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0
                  }}
                >
                  Endorsed by <span style={{ fontWeight: 550 }}>{card.endorsedBy}</span>
                </span>
              </div>
            ) : null}
            
            {/* Assessed by */}
            {card.assessedBy ? (
              <span 
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: 6, 
                  fontSize: 12, 
                  color: "#98A2B3",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0
                }}
              >
                <img src="/iconsV3/star-gradient- new.png" alt="" style={{ width: 17, height: 17, flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Assessed by {card.assessedBy}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
