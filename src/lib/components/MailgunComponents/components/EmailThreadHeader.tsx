"use client";

import { useState } from "react";
import styles from "@/lib/components/MailgunComponents/email.module.scss";
import Button from "@/lib/components/ui/button/Button";

type CareerOption = { id: string; jobTitle: string };
type FilterOptions = {
  careers: CareerOption[];
  stages: string[];
  emailTypes: string[];
  status?: string[];
};

type CountGroup = { name: string; icon: string; count: number };

export default function EmailThreadHeader({
  activeTab,
  countGroups,
  unreadCount = 0,
  onDiscardAllDrafts,
  searchValue = "",
  onSearchChange,
  filterOptions,
  selectedFilters,
  onSelectedFiltersChange,
}: {
  activeTab: string;
  countGroups: CountGroup[];
  unreadCount?: number;
  onDiscardAllDrafts?: () => void;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filterOptions: FilterOptions;
  selectedFilters: {
    career: string[];
    stage: string[];
    emailType: string[];
    status?: string[];
  };
  onSelectedFiltersChange: (filters: {
    career: string[];
    stage: string[];
    emailType: string[];
    status?: string[];
  }) => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [filterSearchValue, setFilterSearchValue] = useState("");

  // Build filter categories from props
  const filterCategories = [
    {
      id: "career",
      label: "By career",
      options: filterOptions.careers,
    },
    // {
    //   id: "stage",
    //   label: "By stage",
    //   options: filterOptions.stages,
    // },
    {
      id: "emailType",
      label: "By email type",
      options: filterOptions.emailTypes,
    },
    {
      id: "status",
      label: "By status",
      options: filterOptions.status || ["Read", "Unread"],
    },
  ];

  const handleFilterChange = (category: string, option: string) => {
    const current = selectedFilters[category] || [];
    const updated = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    onSelectedFiltersChange({ ...selectedFilters, [category]: updated });
  };

  const handleRemoveFilter = (category: string, option: string) => {
    const current = selectedFilters[category] || [];
    onSelectedFiltersChange({
      ...selectedFilters,
      [category]: current.filter((item) => item !== option),
    });
  };

  const handleClearAllFilters = () => {
    onSelectedFiltersChange({
      career: [],
      stage: [],
      emailType: [],
      status: [],
    });
  };

  const hasActiveFilters = Object.values(selectedFilters).some(
    (arr) => arr.length > 0,
  );
  const totalFilterCount = Object.values(selectedFilters).reduce(
    (acc, arr) => acc + arr.length,
    0,
  );

  return (
    <div className={styles.threadHeader}>
      <div className={styles.headerGroup}>
        <div className={styles.threadTitle}>
          <span className={styles.title}>{activeTab}</span>
          {unreadCount > 0 && (
            <div className={styles.badge}>
              {unreadCount} {unreadCount === 1 ? "unread" : "unread"}
            </div>
          )}
        </div>
        <div className={styles.threadCount}>
          {countGroups.map((group) => (
            <div key={group.name} className={styles.countGroup}>
              <img
                className={styles.icon}
                src={`/icons/${group.icon}.svg`}
                alt={group.name}
              />
              <span className={styles.text}>
                {group.count} {group.name}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.searchGroup}>
        {/* Search Threads */}
        <div className={styles.searchInputWrapper}>
          <img
            className={styles.searchIcon}
            src="/iconsV3/search.svg"
            alt="search"
          />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search"
            value={searchValue}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          />
        </div>
        {/* Filter Threads */}
        <div style={{ position: "relative" }}>
          <Button
            label={
              totalFilterCount > 0 ? `Filter (${totalFilterCount})` : "Filter"
            }
            icon="/icons/chevron-down.svg"
            iconPosition="right"
            variant="secondary"
            onClick={() => setFilterOpen(!filterOpen)}
          />
          {filterOpen && (
            <div className={styles.filterModal}>
              <div className={styles.filterCategories}>
                {filterCategories.map((category) => (
                  <div
                    key={category.id}
                    onMouseEnter={() => setActiveFilter(category.id)}
                    onMouseLeave={() => setActiveFilter(null)}
                    style={{ position: "relative" }}
                  >
                    <div className={styles.filterCategory}>
                      <div className={styles.categoryLabel}>
                        <div className={styles.categoryLabelInner}>
                          <span>
                            {category.label}
                            {selectedFilters[category.id]?.length > 0 && (
                              <span
                                className={styles.categoryCount}
                                style={{ marginLeft: 4 }}
                              >
                                ({selectedFilters[category.id].length})
                              </span>
                            )}
                          </span>
                          <img src="/icons/chevron-right.svg" alt="arrow" />
                        </div>
                      </div>
                      {activeFilter === category.id && (
                        <div className={styles.filterOptions}>
                          <div className={styles.optionsHeader}>
                            Filter {category.label.toLowerCase()}{" "}
                            {selectedFilters[category.id]?.length > 0 && (
                              <span className={styles.categoryCount}>
                                ({selectedFilters[category.id].length})
                              </span>
                            )}
                          </div>
                          {category.id === "career" && (
                            <>
                              <div className={styles.filterSearchWrapper}>
                                <img
                                  src="/iconsV3/search.svg"
                                  alt="search"
                                  className={styles.filterSearchIcon}
                                />
                                <input
                                  type="text"
                                  placeholder="Search..."
                                  className={styles.filterSearchInput}
                                  value={filterSearchValue}
                                  onChange={(e) =>
                                    setFilterSearchValue(e.target.value)
                                  }
                                />
                              </div>
                              {selectedFilters[category.id]?.length > 0 && (
                                <div className={styles.selectedFilters}>
                                  {selectedFilters[category.id].map(
                                    (selected) => (
                                      <div
                                        key={selected}
                                        className={styles.selectedFilterTag}
                                      >
                                        <span>
                                          {category.id === "career"
                                            ? filterOptions.careers.find(
                                                (c) => c.id === selected,
                                              )?.jobTitle || selected
                                            : selected}
                                        </span>
                                        <button
                                          onClick={() =>
                                            handleRemoveFilter(
                                              category.id,
                                              selected,
                                            )
                                          }
                                          className={styles.removeFilterBtn}
                                        >
                                          <img
                                            src="/iconsV3/x.svg"
                                            alt="remove"
                                          />
                                        </button>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          <div className={styles.optionsList}>
                            {category.id === "career"
                              ? (category.options as CareerOption[])
                                  .filter((option) =>
                                    option.jobTitle
                                      .toLowerCase()
                                      .includes(
                                        filterSearchValue.toLowerCase(),
                                      ),
                                  )
                                  .map((option) => (
                                    <label
                                      key={option.id}
                                      className={styles.checkboxLabel}
                                    >
                                      <input
                                        type="checkbox"
                                        className={styles.checkbox}
                                        checked={
                                          selectedFilters[
                                            category.id
                                          ]?.includes(option.id) || false
                                        }
                                        onChange={() =>
                                          handleFilterChange(
                                            category.id,
                                            option.id,
                                          )
                                        }
                                      />
                                      <span>{option.jobTitle}</span>
                                    </label>
                                  ))
                              : (category.options as string[]).map((option) => (
                                  <label
                                    key={option}
                                    className={styles.checkboxLabel}
                                  >
                                    <input
                                      type="checkbox"
                                      className={styles.checkbox}
                                      checked={
                                        selectedFilters[category.id]?.includes(
                                          option,
                                        ) || false
                                      }
                                      onChange={() =>
                                        handleFilterChange(category.id, option)
                                      }
                                    />
                                    <span>{option}</span>
                                  </label>
                                ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <div className={styles.activeFiltersGroup}>
          {Object.entries(selectedFilters).map(([categoryId, options]) => {
            if (options.length === 0) return null;
            const category = filterCategories.find((c) => c.id === categoryId);
            const categoryLabel = category?.label
              .replace("By ", "")
              .split(" ")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

            return (
              <div key={categoryId} className={styles.filterBadge}>
                <span className={styles.badgeText}>
                  {categoryLabel}:{" "}
                  {categoryId === "career"
                    ? options
                        .map(
                          (id) =>
                            filterOptions.careers.find((c) => c.id === id)
                              ?.jobTitle || id,
                        )
                        .join(", ")
                    : options.join(", ")}
                </span>
                <img
                  className={styles.badgeCloseBtn}
                  src="/iconsV3/x.svg"
                  alt="remove"
                  onClick={() =>
                    onSelectedFiltersChange({
                      ...selectedFilters,
                      [categoryId]: [],
                    })
                  }
                />
              </div>
            );
          })}
          <button
            className={styles.clearAllBtn}
            onClick={handleClearAllFilters}
          >
            Clear Filters
          </button>
        </div>
      )}
      {/* Discard all drafts Button */}
      {activeTab === "Drafts" && (
        <div className={styles.draftAction}>
          <Button
            icon="/iconsV3/trashV2.svg"
            label="Discard all drafts"
            variant="secondary"
            onClick={() => onDiscardAllDrafts && onDiscardAllDrafts()}
          />
        </div>
      )}
    </div>
  );
}
