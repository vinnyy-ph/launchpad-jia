import React from "react";

type TableHeaderProps = {
  columns: string[];
  gridTemplateColumns: string;
};

const TableHeader: React.FC<TableHeaderProps> = ({ columns, gridTemplateColumns }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns,
        padding: "18px 24px",
        color: "#475467",
        fontSize: 12,
        fontWeight: 600,
        background: "#F9FAFB",
        borderBottom: "1px solid #EAECF0",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
      }}
    >
      {columns.map((column, index) => (
        <div key={`${column}-${index}`} style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
          {column}
        </div>
      ))}
    </div>
  );
};

export default TableHeader;
