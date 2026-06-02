import React from "react";

type HeaderToolbarProps = {
  totalCount: number;
  sortLabel: string;
  sortBy: string;
  sortOptions: string[];
  onChangeSort: (value: string) => void;
};

const HeaderToolbar: React.FC<HeaderToolbarProps> = ({ totalCount, sortLabel, sortBy, sortOptions, onChangeSort }) => {
  const [isSortOpen, setIsSortOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    if (isSortOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSortOpen]);

  const handleSelectSort = (option: string) => {
    onChangeSort(option);
    setIsSortOpen(false);
  };

  const isArrowDown =
    sortBy.includes("A - Z") ||
    sortBy.toLowerCase().includes("newest to oldest");

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <p style={{ margin: 0,fontWeight:500, color: "#475467", fontSize: 14 }}>{totalCount} Requisitions</p>

      <div style={{ position: "relative" }} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsSortOpen((prev) => !prev)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 500,
            color: "#101828",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span>Sort by:</span>
            <span>{isArrowDown ? "↓" : "↑"} {sortBy}</span>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ transform: isArrowDown ? "rotate(0deg)" : "rotate(180deg)" }}
          >
            <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="#101828" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {isSortOpen && (
          <div
            className="dropdown-menu dropdown-menu-right mt-1 org-dropdown-anim show"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: 228,
              padding: "8px 0",
              borderRadius: 16,
              border: "none",
              boxShadow: "0px 18px 45px rgba(15, 23, 42, 0.12)",
              backgroundColor: "white",
              zIndex: 1000,
            }}
          >
            {sortOptions.map((option) => (
              <button
                key={option}
                type="button"
                className="dropdown-item"
                style={{
                  width: "100%",
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 400,
                  color: option === sortBy ? "#111827" : "#111827",
                  backgroundColor: option === sortBy ? "#F3F4F6" : "transparent",
                  textAlign: "left",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => handleSelectSort(option)}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HeaderToolbar;
