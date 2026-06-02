"use client";

import React, { useState, useRef, useCallback, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import CandidateTooltip from "./CandidateTooltip";
import { fetchTooltipData, TooltipData } from "./candidateTooltipDataCache";
import { handleEmailClick } from "@/lib/hooks/useHandleEmailClick";

interface CandidateAvatarWithTooltipProps {
    candidate: any;
    orgID: string;
    children: React.ReactNode;
    onClick?: () => void;
    showDelay?: number;
    hideDelay?: number;
    onLockChange?: (locked: boolean) => void;
    tooltipPosition?: 'centered' | 'below';
}

export default function CandidateAvatarWithTooltip({
    candidate,
    orgID,
    children,
    onClick,
    showDelay = 100,
    hideDelay = 150,
    onLockChange,
    tooltipPosition = 'centered',
}: CandidateAvatarWithTooltipProps) {
    const router = useRouter();
    const [showTooltip, setShowTooltip] = useState(false);
    const [portalPosition, setPortalPosition] = useState<{ top: number; left: number; visible: boolean }>({
        top: 0,
        left: 0,
        visible: false,
    });
    const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
    const [isHoverIntent, setIsHoverIntent] = useState(false);
    const [isLocked, setIsLocked] = useState(false); // Lock tooltip open when comments are shown
    
    // Notify parent when lock state changes
    useEffect(() => {
        onLockChange?.(isLocked);
    }, [isLocked, onLockChange]);
    
    const showTimeoutRef = useRef<number | null>(null);
    const hideTimeoutRef = useRef<number | null>(null);
    const anchorRef = useRef<HTMLDivElement | null>(null);
    const portalRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const clearTimers = useCallback(() => {
        if (showTimeoutRef.current) {
            clearTimeout(showTimeoutRef.current);
            showTimeoutRef.current = null;
        }
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
    }, []);

    const cancelFetch = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    // Ensure timeouts/raf/fetch are cleaned up on unmount (avoids setState-after-unmount)
    useEffect(() => {
        return () => {
            clearTimers();
            cancelFetch();
            if (rafRef.current) {
                window.cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [clearTimers, cancelFetch]);

    // Start fetching data when hover intent is detected
    useEffect(() => {
        if (!isHoverIntent) {
            return;
        }

        const candidateEmail = candidate?.email;
        if (!candidateEmail || !orgID) {
            return;
        }

        // Cancel any previous fetch
        cancelFetch();

        const controller = new AbortController();
        abortControllerRef.current = controller;

        fetchTooltipData(candidateEmail, orgID, candidate, controller.signal)
            .then((data) => {
                if (!controller.signal.aborted) {
                    setTooltipData(data);
                }
            })
            .catch((err) => {
                if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
                    console.error("Error fetching tooltip data:", err);
                }
            });

        return () => {
            controller.abort();
        };
    }, [isHoverIntent, candidate?.email, orgID, candidate, cancelFetch]);

    // Show tooltip immediately when hover intent is detected (with skeleton loading)
    useEffect(() => {
        if (isHoverIntent) {
            setShowTooltip(true);
        }
    }, [isHoverIntent]);

    const handleMouseEnter = useCallback(() => {
        clearTimers();
        showTimeoutRef.current = window.setTimeout(() => {
            setIsHoverIntent(true);
            showTimeoutRef.current = null;
        }, showDelay);
    }, [showDelay, clearTimers]);

    const handleMouseLeave = useCallback(() => {
        if (isLocked) return; // Don't hide when locked (e.g., comments open)
        clearTimers();
        hideTimeoutRef.current = window.setTimeout(() => {
            setShowTooltip(false);
            setIsHoverIntent(false);
            cancelFetch();
            hideTimeoutRef.current = null;
        }, hideDelay);
    }, [hideDelay, clearTimers, cancelFetch, isLocked]);

    const handleTooltipMouseEnter = useCallback(() => {
        clearTimers();
        setShowTooltip(true);
    }, [clearTimers]);

    const handleTooltipClose = useCallback(() => {
        setShowTooltip(false);
        setIsHoverIntent(false);
        setTooltipData(null);
        setIsLocked(false);
        cancelFetch();
        clearTimers();
    }, [clearTimers, cancelFetch]);

    const handleEmailClickWrapper = useCallback(() => {
        setShowTooltip(false);
        setIsHoverIntent(false);
        setTooltipData(null);
        setIsLocked(false);
        cancelFetch();
        clearTimers();
        handleEmailClick(candidate, orgID);
    }, [candidate, orgID, cancelFetch, clearTimers]);

    const handleTooltipMouseLeave = useCallback(() => {
        if (isLocked) return; // Don't hide when locked (e.g., comments open)
        clearTimers();
        hideTimeoutRef.current = window.setTimeout(() => {
            setShowTooltip(false);
            setIsHoverIntent(false);
            cancelFetch();
            hideTimeoutRef.current = null;
        }, hideDelay);
    }, [hideDelay, clearTimers, cancelFetch, isLocked]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (onClick) {
            onClick();
        }
        setShowTooltip(false);
        setIsHoverIntent(false);
        cancelFetch();
        clearTimers();
    }, [onClick, clearTimers, cancelFetch]);

    const candidateInfo = {
        name: candidate?.name || "",
        email: candidate?.email || "",
        image: candidate?.image || "",
    };

    const updatePortalPosition = useCallback(() => {
        const anchorEl = anchorRef.current;
        if (!anchorEl || typeof window === "undefined") return;

        const anchorRect = anchorEl.getBoundingClientRect();
        const portalEl = portalRef.current;
        const tooltipEl = portalEl?.querySelector(".candidate-tooltip") as HTMLElement | null;
        if (!tooltipEl) return;

        const padding = 8;
        const verticalGap = 8;
        const horizontalGap = 48;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const maxAllowedHeight = Math.max(120, viewportHeight - padding * 2);

        // If the tooltip is taller than the viewport, make it scrollable instead of clipping.
        // (This can happen as async sections load.)
        tooltipEl.style.maxHeight = "";
        tooltipEl.style.overflowY = "";
        tooltipEl.style.overflowX = "";

        let tooltipRect = tooltipEl.getBoundingClientRect();
        if (tooltipRect.height > maxAllowedHeight) {
            tooltipEl.style.maxHeight = `${maxAllowedHeight}px`;
            tooltipEl.style.overflowY = "auto";
            tooltipEl.style.overflowX = "hidden";
            tooltipRect = tooltipEl.getBoundingClientRect();
        }

        const tooltipWidth = tooltipRect.width;
        const tooltipHeight = tooltipRect.height;

        const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

        const preferredLeft = anchorRect.right + horizontalGap;
        const preferredRight = preferredLeft + tooltipWidth;
        const centeredLeft = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
        const leftSideLeft = anchorRect.left - horizontalGap - tooltipWidth;

        let desiredLeft = preferredLeft;
        if (preferredRight > viewportWidth - padding) {
            // Prefer left-side fallback over centering (centering tends to cover the hovered avatar)
            if (leftSideLeft >= padding) {
                desiredLeft = leftSideLeft;
            } else {
                desiredLeft = centeredLeft;
            }
        }

        desiredLeft = clamp(desiredLeft, padding, Math.max(padding, viewportWidth - padding - tooltipWidth));

        // If clamping pulled a "right-side" tooltip back over the anchor, try left-side placement.
        const minNonOverlappingLeft = anchorRect.right + horizontalGap;
        if (desiredLeft < minNonOverlappingLeft && leftSideLeft >= padding) {
            desiredLeft = clamp(leftSideLeft, padding, Math.max(padding, viewportWidth - padding - tooltipWidth));
        }

        // Position tooltip based on tooltipPosition prop
        const centeredTop = anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2;
        const belowTop = anchorRect.bottom + verticalGap;
        const targetTop = tooltipPosition === 'below' ? belowTop : centeredTop;
        let desiredTop = clamp(targetTop, padding, Math.max(padding, viewportHeight - padding - tooltipHeight));

        // CandidateTooltip is absolute with top: 55px. Offset our fixed container so the tooltip's
        // own internal top lands at desiredTop.
        const containerTop = desiredTop - 55;
        const containerLeft = desiredLeft;

        setPortalPosition({ top: containerTop, left: containerLeft, visible: true });
    }, []);

    const scheduleUpdate = useCallback(() => {
        if (typeof window === "undefined") return;
        if (rafRef.current) {
            window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        rafRef.current = window.requestAnimationFrame(() => {
            rafRef.current = null;
            updatePortalPosition();
        });
    }, [updatePortalPosition]);

    useLayoutEffect(() => {
        if (!showTooltip) return;
        // First render hidden so we can measure size, then position.
        setPortalPosition({ top: 0, left: 0, visible: false });
        scheduleUpdate();

        const onAnyScroll = () => scheduleUpdate();
        const onResize = () => scheduleUpdate();

        window.addEventListener("scroll", onAnyScroll, true);
        window.addEventListener("resize", onResize);

        let resizeObserver: ResizeObserver | null = null;
        const portalEl = portalRef.current;
        const tooltipEl = portalEl?.querySelector(".candidate-tooltip") as HTMLElement | null;
        if (tooltipEl && typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(() => {
                scheduleUpdate();
            });
            resizeObserver.observe(tooltipEl);
        }

        return () => {
            window.removeEventListener("scroll", onAnyScroll, true);
            window.removeEventListener("resize", onResize);
            if (resizeObserver) resizeObserver.disconnect();
        };
    }, [showTooltip, scheduleUpdate]);

    return (
        <div
            ref={anchorRef}
            style={{ position: "relative", display: "inline-block" }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            {children}
            {showTooltip &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={portalRef}
                        style={{
                            position: "fixed",
                            top: portalPosition.top,
                            left: portalPosition.left,
                            zIndex: 2000,
                            visibility: portalPosition.visible ? "visible" : "hidden",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ position: "relative" }}>
                            <CandidateTooltip
                                candidateInfo={candidateInfo}
                                candidate={candidate}
                                orgID={orgID}
                                onMouseEnter={handleTooltipMouseEnter}
                                onMouseLeave={handleTooltipMouseLeave}
                                onEmailClick={handleEmailClickWrapper}
                                prefetchedData={tooltipData}
                                onLockChange={setIsLocked}
                                onClose={handleTooltipClose}
                            />
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
}
