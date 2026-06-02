import React, { useRef, useState, useCallback, useEffect } from "react";

interface CandidatesTableTooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    title?: string;
}

export default function CandidatesTableTooltip({ content, children, title = "Assessment" }: CandidatesTableTooltipProps) {
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

    const updateTooltipPosition = useCallback(() => {
        if (!triggerRef.current) return;
        
        const rect = triggerRef.current.getBoundingClientRect();
        setTooltipPosition({
            top: rect.bottom + 8,
            left: rect.left
        });
    }, []);

    const showTooltip = useCallback(() => {
        // Clear any pending hide timeout
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setIsVisible(true);
        updateTooltipPosition();
    }, [updateTooltipPosition]);

    const hideTooltip = useCallback(() => {
        // Delay hiding to allow mouse to move to tooltip
        hideTimeoutRef.current = setTimeout(() => {
            setIsVisible(false);
        }, 150);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
                ref={triggerRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                style={{
                    display: "inline-block",
                    cursor: "pointer"
                }}
            >
                {children}
            </div>
            
            {/* Custom tooltip */}
            {isVisible && (
                <div
                    ref={tooltipRef}
                    style={{
                        position: "fixed",
                        top: `${tooltipPosition.top}px`,
                        left: `${tooltipPosition.left}px`,
                        width: "226px",
                        borderRadius: "8px",
                        border: "1px solid var(--Border-primary, #E9EAEB)",
                        padding: "12px",
                        background: "var(--Surface-white, #FFFFFF)",
                        boxShadow: "0px 32px 64px -12px #0A0D1224",
                        zIndex: 1000,
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                    }}
                    onMouseEnter={showTooltip}
                    onMouseLeave={hideTooltip}
                >
                    {/* Title header */}
                    <div
                        style={{
                            textAlign: "left",
                        }}
                    >
                        <span
                            style={{
                                fontWeight: 700,
                                fontStyle: "normal",
                                fontSize: "12px",
                                lineHeight: "18px",
                                letterSpacing: "0%",
                                color: "var(--Text-text-secondary, #414651)",
                            }}
                        >
                            {title}:
                        </span>
                    </div>
                    {/* Content */}
                    <div
                        style={{
                            fontSize: "14px",
                            fontWeight: 400,
                            lineHeight: "1.4",
                            color: "var(--Text-text-secondary, #414651)",
                            textAlign: "left",
                            wordWrap: "break-word",
                            whiteSpace: "normal",
                        }}
                    >
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
}
