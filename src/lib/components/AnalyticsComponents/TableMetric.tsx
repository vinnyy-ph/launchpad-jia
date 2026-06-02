"use client";
import styles from "@/lib/styles/analytics/graphs.module.scss";
import NoDataAvailable from "./NoDataAvailable";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import CustomDropdown from "../Dropdown/CustomDropdown";
import React from "react";

const FALLBACK_PINNED_WIDTH = 140;
const HIDDEN_COLUMN_PLACEHOLDER_WIDTH = 24;

interface TableMetricProps {
    data: {
        columnHeaders: string[];
        rows: any[];
    }
    isFullscreenView?: boolean;
    onCloseFullscreenView?: () => void;
}
export default function TableMetric({ data, isFullscreenView, onCloseFullscreenView }: TableMetricProps) {
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const router = useRouter();
    const [displayMenuButton, setDisplayMenuButton] = useState("");
    const [pinnedColumns, setPinnedColumns] = useState<string[]>([]);
    const [pinnedColumnWidths, setPinnedColumnWidths] = useState<number[]>([]);
    const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
    const tableRef = useRef<HTMLTableElement>(null);
    const dropdownOptions = ["Pin", "Hide Column"];
    const [displayFullScreenReminder, setDisplayFullScreenReminder] = useState(true);

    const isPinned = (column: string) => pinnedColumns.includes(column);
    const getPinnedStyle = (column: string): { left: number; width: number; position: "sticky" | "static"; zIndex: number } | undefined => {
        if (!isPinned(column)) return undefined;
        const pinnedIndex = pinnedColumns.indexOf(column);
        const isHidden = hiddenColumns.includes(column);
        // Use placeholder width for hidden pinned columns, otherwise stored width
        const width = isHidden
            ? HIDDEN_COLUMN_PLACEHOLDER_WIDTH
            : (pinnedColumnWidths[pinnedIndex] ?? FALLBACK_PINNED_WIDTH);
        // Sum widths of preceding pinned columns, using placeholder width for any that are hidden
        const left = pinnedColumns.slice(0, pinnedIndex).reduce((sum, col, i) => {
            const w = hiddenColumns.includes(col) ? HIDDEN_COLUMN_PLACEHOLDER_WIDTH : (pinnedColumnWidths[i] ?? FALLBACK_PINNED_WIDTH);
            return sum + w;
        }, 0);
        const position = pinnedIndex !== -1 ? "sticky" : "static";
        const zIndex = pinnedIndex !== -1 ? 2 : 1;
        return { left, width, position, zIndex };
    };

    const handlePin = (upToIndex: number) => {
        const columnsToPin = data.columnHeaders.slice(0, upToIndex + 1);
        setPinnedColumns(columnsToPin);
    };

    const handleUnpin = () => {
        setPinnedColumns([]);
    };

    const handleUnhide = (column: string) => {
        setHiddenColumns((prev) => prev.filter((c) => c !== column));
    };

    // Escape key to close fullscreen view
    useEffect(() => {
        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onCloseFullscreenView?.();
            }
        };
        window.addEventListener("keydown", handleEscapeKey);
        return () => window.removeEventListener("keydown", handleEscapeKey);
    }, [onCloseFullscreenView]);

    useEffect(() => {
        // Get all column widths
        const getColumnWidths = () => {
            const allColumns = data.columnHeaders.slice(0, data.columnHeaders.length - 1);
            const widths: number[] = [];
            if (tableRef.current) {
                const headerCells = tableRef.current.querySelectorAll("thead th");
                for (let i = 0; i < allColumns.length && i < headerCells.length; i++) {
                    const cellWidth = (headerCells[i] as HTMLElement).offsetWidth;
                    const menuButtonBuffer = 30;
                    widths.push(cellWidth + menuButtonBuffer);
                }
            }
            while (widths.length < allColumns.length) {
                widths.push(FALLBACK_PINNED_WIDTH);
            }
            setPinnedColumnWidths(widths);
        }
        if (data?.columnHeaders?.length > 0) {
            getColumnWidths();
        }
    }, [data.columnHeaders]);

    return (
        <div id="table-metric-container" className={isFullscreenView ? styles.fullscreenTableMetricContainer : styles.tableMetricContainer}>
        <div className="table-responsive">
            <table ref={tableRef} className="table align-items-center table-flush">
                <thead>
                    <tr>
                        {data.columnHeaders.map((column, index) => {
                            const hidden = hiddenColumns.includes(column);
                            const pinned = isPinned(column);
                            const isLastPinnedColumn = pinnedColumns.length - 1 === index;
                            const pinnedStyle = getPinnedStyle(column);
                            let cellStyle: React.CSSProperties = {};
                            if ((pinned || hidden) && pinnedStyle) {
                                cellStyle.left = pinnedStyle.left;
                                cellStyle.width = pinnedStyle.width;
                                cellStyle.minWidth = pinnedStyle.width;
                                cellStyle.maxWidth = pinnedStyle.width;
                                cellStyle.zIndex = pinnedStyle.zIndex;
                                cellStyle.position = pinnedStyle.position;
                            }
                            return (
                            <th
                            key={index}
                            className={
                                hidden
                                    ? styles.hiddenColumnPlaceholder
                                    : pinned
                                        ? isLastPinnedColumn
                                            ? `${styles.tableHeaderCellPinned} ${styles.tableHeaderCellPinnedLast}`
                                            : styles.tableHeaderCellPinned
                                        : styles.tableHeaderCell
                            }
                            style={cellStyle}
                            onMouseEnter={() => !hidden && setDisplayMenuButton(column)}
                            onMouseLeave={() => !hidden && setDisplayMenuButton("")}
                            >
                                {hidden ? (
                                    <button
                                        type="button"
                                        className={styles.unhideColumnButton}
                                        onClick={() => handleUnhide(column)}
                                        title={`Show ${column}`}
                                        aria-label={`Show ${column} column`}
                                    >
                                        <img src="/iconsV3/arrow-right-gray.svg" alt="" />
                                    </button>
                                ) : (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", gap: "8px" }}>
                                {column}
                                {displayMenuButton === column && (
                                    <CustomDropdown
                                    value=""
                                    setValue={(value) => {
                                        if (value === "Pin") {
                                            handlePin(index);
                                        }

                                        if (value === "Unpin") {
                                            handleUnpin();
                                        }

                                        if (value === "Hide Column") {
                                            setHiddenColumns([...hiddenColumns, column]);
                                        }
                                    }}
                                    options={dropdownOptions.map((option) => {
                                        if (pinnedColumns.includes(column) && option === "Pin") {
                                            return "Unpin"
                                        }
                                        return option;
                                    })}
                                    icon="la la-ellipsis-v"
                                    iconMap={{
                                        "Pin": "/iconsV3/pin.svg",
                                        "Unpin": "/iconsV3/pin.svg",
                                        "Hide Column": "/iconsV3/hide.svg",
                                    }}
                                    buttonStyle={{
                                        border: "none",
                                        background: "none",
                                        padding: "0px",
                                        borderRadius: "0px",
                                    }}
                                    defaultMenuPosition="left"
                                    parentContainer={tableRef.current}
                                    />
                                )}
                                </div>
                                )}
                            </th>
                        );})}
                    </tr>
                </thead>
                <tbody className="list">
                    {data.rows?.length > 0 ? data.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {data.columnHeaders.map((column, colIndex) => {
                                const hidden = hiddenColumns.includes(column);
                                const pinned = isPinned(column);
                                const isLastPinnedColumn = pinnedColumns.length - 1 === colIndex;
                                const pinnedStyle = getPinnedStyle(column);
                                const cellStyle: React.CSSProperties = {};
                                if ((pinned || hidden) && pinnedStyle) {
                                    cellStyle.left = pinnedStyle.left;
                                    cellStyle.width = pinnedStyle.width;
                                    cellStyle.minWidth = pinnedStyle.width;
                                    cellStyle.maxWidth = pinnedStyle.width;
                                    cellStyle.zIndex = pinnedStyle.zIndex;
                                    cellStyle.position = pinnedStyle.position;
                                }
                                const cellContent = hidden
                                    ? null
                                    : ["Job Title", "Career"].includes(column) && row.metadata?._id
                                        ? (
                                            <a
                                                href={`/recruiter-dashboard/careers/manage/${row.metadata?._id}?orgID=${orgID}`}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    router.push(`/recruiter-dashboard/careers/manage/${row.metadata._id}?orgID=${orgID}`);
                                                }}
                                                style={{ color: "inherit", textDecoration: "none" }}
                                            >
                                                {row[column] !== undefined && row[column] !== null ? row[column] : "N/A"}
                                            </a>
                                        )
                                        : (row[column] !== undefined && row[column] !== null ? row[column] : "N/A");
                                return (
                                    <td
                                        key={colIndex}
                                        className={
                                            hidden
                                                ? styles.hiddenColumnPlaceholderCell
                                                : pinned
                                                    ? isLastPinnedColumn
                                                        ? `${styles.tableCellPinned} ${styles.tableCellPinnedLast}`
                                                        : styles.tableCellPinned
                                                    : undefined
                                        }
                                        style={cellStyle}
                                    >
                                        {cellContent}
                                    </td>
                                );
                            })}
                        </tr>
                    )) : <tr style={{ cursor: "default", pointerEvents: "none" }}>
                        <td colSpan={6} className="text-center py-4" style={{ verticalAlign: "middle", height: "200px" }}>
                        <div className="d-flex justify-content-center align-items-center w-100 h-100" style={{ minHeight: "100px" }}>
                            No data available
                        </div>
                    </td>
                </tr>}
                </tbody>
            </table>
        </div>
        {isFullscreenView && <button 
        className={styles.closeFullscreenButton} 
        onClick={onCloseFullscreenView}
        >
            <img src="/icons/close.svg" alt="Close" />
        </button>}
        {isFullscreenView && displayFullScreenReminder && <div className={styles.fullScreenReminder}>
            <div className={styles.fullScreenReminderHeader}>
                <span>Controls Hidden</span>
                <button className={styles.fullScreenReminderCloseButton} onClick={() => setDisplayFullScreenReminder(false)}>
                    <img src="/icons/close.svg" alt="Close" />
                </button>
            </div>
            <span>Press <b>ESC</b> to exit fullscreen and show controls.</span>
        </div>}
        </div>
    )
}
