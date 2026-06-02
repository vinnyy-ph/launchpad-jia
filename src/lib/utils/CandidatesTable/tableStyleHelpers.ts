/**
 * Helper functions for computing table cell and header styles
 */

interface ColumnMeta {
  width?: number;
  weight?: number;
  flexible?: boolean;
  fitContent?: boolean;
}

interface ColumnStyleParams {
  columnMeta: ColumnMeta | undefined;
  columnId: string;
  isHeader?: boolean;
  widthPercent?: number;
}

/**
 * Computes the style object for table headers or cells based on column metadata
 */
export function getColumnStyle({
  columnMeta,
  columnId,
  isHeader = false,
  widthPercent,
}: ColumnStyleParams): React.CSSProperties {
  const columnWidth = columnMeta?.width;
  const isFlexible = columnMeta?.flexible;
  const isFitContent = columnMeta?.fitContent;
  const isSkillsColumn = columnId === "skills";
  const isSelectColumn = columnId === "select";
  const hasFixedWidth = columnWidth !== undefined;
  const usePercent = widthPercent != null && widthPercent > 0;

  const basePadding = isSelectColumn
    ? isHeader
      ? {
          paddingTop: "12px",
          paddingRight: "0",
          paddingBottom: "12px",
          paddingLeft: "0",
        }
      : {
          paddingTop: "16px",
          paddingRight: "0",
          paddingBottom: "16px",
          paddingLeft: "0",
        }
    : isHeader
      ? {
          paddingTop: "12px",
          paddingRight: "var(--Padding-padding-md, 16px)",
          paddingBottom: "12px",
          paddingLeft: "var(--Padding-padding-md, 16px)",
        }
      : {
          paddingTop: "16px",
          paddingRight: "var(--Padding-padding-md, 16px)",
          paddingBottom: "16px",
          paddingLeft: "var(--Padding-padding-md, 16px)",
        };

  return {
    ...basePadding,
    width: usePercent
      ? `${widthPercent}%`
      : columnWidth
        ? `${columnWidth}px`
        : isFlexible
          ? "100%"
          : isFitContent
            ? "fit-content"
            : undefined,
    minWidth: usePercent
      ? `${widthPercent}%`
      : isSkillsColumn
        ? isHeader
          ? undefined
          : "0"
        : columnWidth
          ? `${columnWidth}px`
          : isFlexible
            ? "200px"
            : isFitContent
              ? "fit-content"
              : undefined,
    maxWidth: usePercent
      ? `${widthPercent}%`
      : columnWidth
        ? `${columnWidth}px`
        : undefined,
    overflow: hasFixedWidth || usePercent ? "hidden" : undefined,
    textTransform: isHeader ? "none" : undefined,
  };
}
