import React from "react";
import HeaderToolbar from "./HeaderToolbar";
import { Button } from "../ui";

type HeaderProps = {
  totalCount: number;
  sortLabel: string;
  sortBy: string;
  sortOptions: string[];
  onChangeSort: (value: string) => void;
  onCreateRequisition?: () => void;
  requisitionsDisabled?: boolean;
};

const Header: React.FC<HeaderProps> = ({
  totalCount,
  sortLabel,
  sortBy,
  sortOptions,
  onChangeSort,
  onCreateRequisition,
  requisitionsDisabled = false
}) => {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#181D27", margin: 0 }}>
          Job Requisitions
        </h1>

        {onCreateRequisition && (
          <Button
            onClick={onCreateRequisition}
            disabled={requisitionsDisabled}
            variant="primary"
            label="Create a requisition"
            icon="/icons/plus.svg"
          >
          </Button>
        )}
      </div>

      <hr style={{ margin: 0 }} />

      <HeaderToolbar
        totalCount={totalCount}
        sortLabel={sortLabel}
        sortBy={sortBy}
        sortOptions={sortOptions}
        onChangeSort={onChangeSort}
      />
    </>
  );
};

export default Header;
