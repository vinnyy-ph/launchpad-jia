"use client";

import React from "react";
import CustomDropdown from "@/lib/components/Dropdown/CustomDropdown";

type StageFilterOption = { label: string; stageId: string | null; substageId: string | null };

type Props = {
  sortBy: string;
  setSortBy: (value: string) => void;
  sortByOptions: string[];
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  filterStatusOptions: string[];
  filterStage: StageFilterOption;
  setFilterStage: (value: StageFilterOption) => void;
  filterStageOptions: StageFilterOption[];
  search: string;
  setSearch: (value: string) => void;
  onResetPage: () => void;
};

export default function ApplicantsFilters({
  sortBy,
  setSortBy,
  sortByOptions,
  filterStatus,
  setFilterStatus,
  filterStatusOptions,
  filterStage,
  setFilterStage,
  filterStageOptions,
  search,
  setSearch,
  onResetPage,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", gap: 10 }}>
        <CustomDropdown
          value={sortBy}
          setValue={(value) => {
            setSortBy(value);
            onResetPage();
          }}
          options={sortByOptions}
          icon="la-sort-amount-down"
        />
        <CustomDropdown
          value={filterStatus}
          setValue={(value) => {
            setFilterStatus(value);
            onResetPage();
          }}
          options={filterStatusOptions}
          icon="la-filter"
        />
        <CustomDropdown
          value={filterStage.label}
          setValue={(value) => {
            const selected = filterStageOptions.find((opt) => opt.label === value);
            if (selected) setFilterStage(selected);
            onResetPage();
          }}
          options={filterStageOptions.map((opt) => opt.label)}
          icon="la-filter"
        />
      </div>

      <div className="table-search-bar">
        <div className="icon mr-2">
          <i className="la la-search"></i>
        </div>
        <input
          type="search"
          className="form-control ml-auto search-input"
          placeholder="Search..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value?.trim());
            onResetPage();
          }}
        />
      </div>
    </div>
  );
}
