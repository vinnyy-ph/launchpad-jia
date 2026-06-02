import React, { RefObject } from "react";

interface SkeletonLoadingProps {
    count?: number;
    skeletonTriggerRef?: RefObject<HTMLTableRowElement>;
    isInfiniteScroll?: boolean;
}

const SkeletonRow = React.memo(({ 
    index, 
    skeletonTriggerRef 
}: { 
    index: number; 
    skeletonTriggerRef?: RefObject<HTMLTableRowElement>;
}) => (
    <tr 
        key={`skeleton-${index}`} 
        ref={index === 0 ? skeletonTriggerRef : null}
        style={{ border: "1px solid #E9EAEB", height: "64px" }}
    >
        {/* Candidates column */}
        <td style={{ paddingTop: "16px", paddingRight: "var(--Padding-padding-md, 16px)", paddingBottom: "16px", paddingLeft: "var(--Padding-padding-md, 16px)", width: "192px" }}>
            <div className="d-flex align-items-center" style={{ gap: "10px", minWidth: 0, width: "100%", maxWidth: "100%" }}>
                <div className="skeleton-bar blink-2" style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0 }}></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, flex: 1, overflow: "hidden" }}>
                    <div className="skeleton-bar blink-2" style={{ width: "120px", height: "14px" }}></div>
                    <div className="skeleton-bar blink-2" style={{ width: "100px", height: "12px" }}></div>
                </div>
            </div>
        </td>
        {/* Skills column */}
        <td style={{ paddingTop: "16px", paddingRight: "var(--Padding-padding-md, 16px)", paddingBottom: "16px", paddingLeft: "var(--Padding-padding-md, 16px)", minWidth: "0", width: "100%" }}>
            <div className="skeleton-bar blink-2" style={{ width: "100%", height: "14px", borderRadius: "16px", minWidth: 0 }}></div> 
        </td>
        {/* Experience column */}
        <td style={{ paddingTop: "16px", paddingRight: "var(--Padding-padding-md, 16px)", paddingBottom: "16px", paddingLeft: "var(--Padding-padding-md, 16px)", width: "120px" }}>
            <div className="skeleton-bar blink-2" style={{ width: "80px", height: "14px" }}></div>
        </td>
        {/* Current Position column */}
        <td style={{ paddingTop: "16px", paddingRight: "var(--Padding-padding-md, 16px)", paddingBottom: "16px", paddingLeft: "var(--Padding-padding-md, 16px)", width: "170px" }}>
            <div className="skeleton-bar blink-2" style={{ width: "90px", height: "14px" }}></div>
        </td>
        {/* Location column */}
        <td style={{ paddingTop: "16px", paddingRight: "var(--Padding-padding-md, 16px)", paddingBottom: "16px", paddingLeft: "var(--Padding-padding-md, 16px)", width: "120px" }}>
            <div className="skeleton-bar blink-2" style={{ width: "100px", height: "14px" }}></div>
        </td>
        {/* Last Active column */}
        <td style={{ paddingTop: "16px", paddingRight: "var(--Padding-padding-md, 16px)", paddingBottom: "16px", paddingLeft: "var(--Padding-padding-md, 16px)", width: "120px" }}>
            <div className="skeleton-bar blink-2" style={{ width: "70px", height: "14px" }}></div>
        </td>
        {/* Application column */}
        <td style={{ paddingTop: "16px", paddingRight: "var(--Padding-padding-md, 16px)", paddingBottom: "16px", paddingLeft: "var(--Padding-padding-md, 16px)", width: "120px" }}>
            <div className="skeleton-bar blink-2" style={{ width: "80px", height: "14px", borderRadius: "16px", margin: "0 auto" }}></div>
        </td>
        {/* Actions column */}
        <td style={{ paddingTop: "16px", paddingRight: "var(--Padding-padding-md, 16px)", paddingBottom: "16px", paddingLeft: "var(--Padding-padding-md, 16px)", width: "fit-content" }}>
            <div className="skeleton-bar blink-2" style={{ width: "20px", height: "14px", borderRadius: "4px", margin: "0 auto" }}></div>
        </td>
    </tr>
));

SkeletonRow.displayName = "SkeletonRow";

const SkeletonLoading: React.FC<SkeletonLoadingProps> = ({ 
    count = 10, 
    skeletonTriggerRef,
    isInfiniteScroll = false 
}) => {
    return (
        <>
            {Array.from({ length: count }).map((_, index) => (
                <SkeletonRow 
                    key={`skeleton-${isInfiniteScroll ? 'infinite' : 'initial'}-${index}`}
                    index={isInfiniteScroll && index === 0 ? 0 : index}
                    skeletonTriggerRef={isInfiniteScroll && index === 0 ? skeletonTriggerRef : undefined}
                />
            ))}
        </>
    );
};

export default SkeletonLoading;

