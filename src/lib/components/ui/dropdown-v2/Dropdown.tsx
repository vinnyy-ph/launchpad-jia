"use client";

import styles from "./dropdown.module.scss";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface DropdownItem {
  value: string;
  icon?: string;
  reverse?: boolean;
  label?: string;
  description?: string;
  tag?: string;
  tagTone?: "blue" | "pink" | "gray";
  avatarImage?: string;
  avatarText?: string;
  avatarTone?: "blue" | "pink" | "green" | "orange" | "purple" | "gray";
  group?: string;
  searchText?: string;
}

interface DropdownTab {
  label: string;
  value: string;
}

interface DropdownFooterAction {
  icon?: string;
  label: string;
  onClick: () => void;
}

function AvatarVisual({
  avatarImage,
  avatarText,
  avatarTone,
}: {
  avatarImage?: string;
  avatarText?: string;
  avatarTone?: DropdownItem["avatarTone"];
}) {
  const [hasImageError, setHasImageError] = useState(false);

  if (avatarImage && !hasImageError) {
    return (
      <img
        alt=""
        className={styles.avatarImage}
        src={avatarImage}
        onError={() => setHasImageError(true)}
      />
    );
  }

  if (!avatarText) {
    return null;
  }

  return (
    <span
      className={`${styles.avatar} ${
        avatarTone ? styles[`avatar-${avatarTone}`] : ""
      }`}
    >
      {avatarText}
    </span>
  );
}

interface DropdownProps extends InitProps {
  dropdown: DropdownItem[];
  errordata?: Record<string, string>;
  formdata: Record<string, string>;
  isDisabled?: boolean;
  isLoading?: boolean;
  label: string;
  loadingText?: string;
  menuTitle?: string;
  placeholder?: string;
  selectedLabelOverride?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showSelectedIcon?: boolean;
  selectedDisplay?: "default" | "avatar";
  avatarMetaLayout?: "stacked" | "inline";
  filterTabs?: DropdownTab[];
  footerAction?: DropdownFooterAction;
  handleInit?: ({ id, isOptional }: InitProps) => void;
  handleOnChange: ({ value, id }: OnChangeProps) => void;
}

interface InitProps {
  id: string;
  isOptional?: boolean;
}

interface OnChangeProps {
  id: string;
  value: string;
}

export default memo(
  ({
    dropdown,
    errordata,
    formdata,
    id,
    isDisabled = false,
    isOptional = false,
    isLoading = false,
    label,
    loadingText = "Loading...",
    menuTitle,
    placeholder,
    selectedLabelOverride,
    searchPlaceholder = "Search",
    showSearch = false,
    showSelectedIcon = true,
    selectedDisplay = "default",
    avatarMetaLayout = "stacked",
    filterTabs,
    footerAction,
    handleInit,
    handleOnChange,
  }: DropdownProps) => {
    const fieldRef = useRef<HTMLDivElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const [activeDropdown, setActiveDropdown] = useState(false);
    const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
    const [menuStyle, setMenuStyle] = useState<{
      left: number;
      width: number;
      top: number;
    } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState(
      filterTabs?.[0]?.value.toLowerCase() || "all",
    );
    const selectedItem = dropdown.find((item) => item.value == formdata?.[id]);
    const fallbackSelectedLabel =
      selectedItem?.label || selectedLabelOverride || formdata?.[id];
    const filteredDropdown = useMemo(() => {
      const normalizedSearch = searchTerm.trim().toLowerCase();

      return dropdown.filter((item) => {
        const matchesTab =
          !filterTabs ||
          activeTab === "all" ||
          item.group?.toLowerCase() === activeTab;
        const haystack = [
          item.value,
          item.label,
          item.description,
          item.tag,
          item.searchText,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesSearch =
          !normalizedSearch || haystack.includes(normalizedSearch);

        return matchesTab && matchesSearch;
      });
    }, [activeTab, dropdown, filterTabs, searchTerm]);

    useEffect(() => {
      if (handleInit) {
        handleInit({ id, isOptional });
      }
    }, []);

    useEffect(() => {
      if (activeDropdown) return;

      setSearchTerm("");
      setActiveTab(filterTabs?.[0]?.value.toLowerCase() || "all");
    }, [activeDropdown, filterTabs]);

    useEffect(() => {
      if (!activeDropdown) return;

      const handleCloseDropdown = (event: MouseEvent) => {
        const target = event.target as Node;
        const currentFieldRef = fieldRef.current;
        const currentDropdownRef = dropdownRef.current;

        if (
          currentFieldRef?.contains(target) ||
          currentDropdownRef?.contains(target)
        ) {
          return;
        }

        setActiveDropdown(false);
      };

      document.addEventListener("mousedown", handleCloseDropdown);
      return () =>
        document.removeEventListener("mousedown", handleCloseDropdown);
    }, [activeDropdown]);

    useLayoutEffect(() => {
      const currentFieldRef = fieldRef.current;
      if (!currentFieldRef) return;

      const root = currentFieldRef.closest(
        "[data-dropdown-root='true']",
      ) as HTMLElement | null;

      setPortalRoot(root);
    }, []);

    useLayoutEffect(() => {
      if (!activeDropdown || !portalRoot) {
        setMenuStyle(null);
        return;
      }

      const updatePosition = () => {
        const currentFieldRef = fieldRef.current;
        if (!currentFieldRef) return;

        const fieldRect = currentFieldRef.getBoundingClientRect();
        const rootRect = portalRoot.getBoundingClientRect();
        const viewportPadding = 16;
        const menuMaxHeight = 336;
        const left = fieldRect.left - rootRect.left;
        const defaultTop = fieldRect.bottom - rootRect.top;
        const maxTop = Math.max(
          0,
          window.innerHeight - rootRect.top - menuMaxHeight - viewportPadding,
        );
        const top = Math.min(defaultTop, maxTop);
        const width = fieldRect.width;

        setMenuStyle({
          left,
          width,
          top,
        });
      };

      updatePosition();

      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);

      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [activeDropdown, portalRoot]);

    const menu = (
      <div
        className={`${styles.menu} ${activeDropdown ? styles.menuActive : ""}`}
        ref={activeDropdown ? dropdownRef : null}
      >
        {(menuTitle || filterTabs) && (
          <div className={styles.menuHeader}>
            {menuTitle && <span className={styles.menuTitle}>{menuTitle}</span>}
            {filterTabs && (
              <div className={styles.tabs}>
                {filterTabs.map((tab) => (
                  <button
                    className={`${styles.tab} ${
                      activeTab === tab.value.toLowerCase()
                        ? styles.tabActive
                        : ""
                    }`}
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveTab(tab.value.toLowerCase())}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showSearch && (
          <div className={styles.searchSection}>
            <div className={styles.searchField}>
              <img alt="" src="/icons/search.svg" />
              <input
                placeholder={searchPlaceholder}
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
        )}

        <div className={styles.menuList}>
          {filteredDropdown.map((item) => (
            <span
              className={`${styles.item} ${
                formdata?.[id] == item.value ? styles.itemActive : ""
              }`}
              key={item.value.toLowerCase()}
              onClick={() => {
                handleOnChange({ value: item.value, id });
                setActiveDropdown(false);
              }}
            >
              <span className={styles.menuItemContent}>
                <AvatarVisual
                  avatarImage={item.avatarImage}
                  avatarText={item.avatarText}
                  avatarTone={item.avatarTone}
                />
                {!item.avatarText && item.icon && (
                  <img
                    alt=""
                    className={`${styles.icon} ${item?.reverse ? styles.reverse : ""}`}
                    src={item.icon}
                  />
                )}

                <span className={styles.menuItemTextGroup}>
                  <span
                    className={`${styles.menuItemTextGroup} ${
                      item.avatarText && avatarMetaLayout === "inline"
                        ? styles.avatarMetaInline
                        : ""
                    }`}
                  >
                    <span className={styles.menuItemText}>
                      {item.label || item.value}
                    </span>
                    {item.description && (
                      <span className={styles.menuItemDescription}>
                        {item.description}
                      </span>
                    )}
                  </span>
                </span>
              </span>

              {item.tag && (
                <span
                  className={`${styles.tag} ${
                    item.tagTone ? styles[`tag-${item.tagTone}`] : ""
                  }`}
                >
                  {item.tag}
                </span>
              )}

              {showSelectedIcon && formdata?.[id] == item.value && (
                <img
                  alt=""
                  className={styles.activeIcon}
                  src="/icons/check.svg"
                />
              )}
            </span>
          ))}

          {filteredDropdown.length === 0 && (
            <span className={styles.emptyState}>No results found.</span>
          )}
        </div>

        {footerAction && (
          <div className={styles.footerSection}>
            <button
              className={styles.footerAction}
              type="button"
              onClick={() => {
                setActiveDropdown(false);
                footerAction.onClick();
              }}
            >
              {footerAction.icon && <img alt="" src={footerAction.icon} />}
              <span>{footerAction.label}</span>
            </button>
          </div>
        )}
      </div>
    );

    return (
      <div className={styles.dropdown}>
        <span className={styles.label}>
          {label}
          {!isOptional && <span className={styles.required}>*</span>}
        </span>

        <div className={styles.dropdownGroup}>
          <div
            className={`${styles.field} ${errordata && errordata[id] ? styles.error : ""} ${
              isDisabled || isLoading ? styles.disabled : ""
            }`}
            ref={fieldRef}
            onClick={() => {
              if (isDisabled || isLoading) return;
              setActiveDropdown(true);
            }}
          >
            {isLoading && (
              <span className={styles.loadingState}>
                <span className={styles.loadingSpinner} />
                <span>{loadingText}</span>
              </span>
            )}

            {!isLoading && !formdata?.[id] && placeholder && (
              <span className={styles.placeholder}>{placeholder}</span>
            )}

            {!isLoading && formdata?.[id] && (
              <span className={styles.item}>
                {selectedDisplay === "avatar" && (
                  <AvatarVisual
                    avatarImage={selectedItem?.avatarImage}
                    avatarText={selectedItem?.avatarText}
                    avatarTone={selectedItem?.avatarTone}
                  />
                )}
                {selectedDisplay !== "avatar" && selectedItem?.icon && (
                  <img
                    alt=""
                    className={`${styles.icon} ${selectedItem?.reverse ? styles.reverse : ""}`}
                    src={selectedItem.icon}
                  />
                )}
                {selectedDisplay === "avatar" ? (
                  <span className={styles.selectedMeta}>
                    <span className={styles.selectedLabel}>
                      {fallbackSelectedLabel}
                    </span>
                    {selectedItem?.description && (
                      <span className={styles.selectedDescription}>
                        {selectedItem.description}
                      </span>
                    )}
                  </span>
                ) : (
                  <span>{fallbackSelectedLabel}</span>
                )}
              </span>
            )}

            {errordata && errordata[id] ? (
              <img
                alt=""
                className={styles.errorIcon}
                src="/icons/alert-circle.svg"
              />
            ) : isLoading ? (
              <span className={styles.loadingIndicator} />
            ) : (
              <img
                alt=""
                className={`${styles.chevronIcon} ${
                  activeDropdown ? styles.chevronActive : ""
                }`}
                src="/figma-assets/email-automation/chevron-down.svg"
              />
            )}
          </div>
        </div>

        <span
          className={`${styles.errorMessage}
          ${errordata && errordata[id] ? styles.visible : ""}`}
        >
          {errordata && errordata[id]}
        </span>
        {activeDropdown &&
          (portalRoot
            ? menuStyle
              ? createPortal(
                  <div
                    className={styles.portalAnchor}
                    style={{
                      left: `${menuStyle.left}px`,
                      top: `${menuStyle.top}px`,
                      width: `${menuStyle.width}px`,
                    }}
                  >
                    {menu}
                  </div>,
                  portalRoot,
                )
              : null
            : menu)}
      </div>
    );
  },
);
