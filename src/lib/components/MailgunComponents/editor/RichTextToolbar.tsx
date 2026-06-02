import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/lib/components/MailgunComponents/editor/editor.module.scss";
import { Dropdown, Search } from "@/lib/components/ui";
import { tokens } from "@/lib/data/editor";
import type { TokenEditorHandle } from "./TokenEditorField";

const defaultColorOptions = [
  "#181D27",
  "#252B37",
  "#414651",
  "#535862",
  "#717680",
  "#A4A7AE",
  "#D5D7DA",
  "#FFFFFF",
  "#079455",
  "#1570EF",
  "#444CE7",
  "#6938EF",
  "#BA24D5",
  "#DD2590",
  "#D92D20",
  "#E04F16",
];

interface RichTextToolbarProps {
  subjectEditorHandle?: React.RefObject<TokenEditorHandle | null>;
  bodyEditorHandle?: React.RefObject<TokenEditorHandle | null>;
  activeEditorId?: string | null;
  dropdownPosition?: "bottom" | "top";
}

const RichTextToolbar = ({
  subjectEditorHandle,
  bodyEditorHandle,
  activeEditorId,
  dropdownPosition = "top",
}: RichTextToolbarProps) => {
  const [fontSize, setFontSize] = useState(14);
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);
  const [showFontColorModal, setShowFontColorModal] = useState(false);
  const [tokenDropdown, setTokenDropdown] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState(tokens[0].type);
  const [selectedColor, setSelectedColor] = useState(defaultColorOptions[0]);
  const savedRangeRef = useRef<Range | null>(null);
  const tokenDropdownRef = useRef<HTMLDivElement | null>(null);
  const fontColorModalRef = useRef<HTMLDivElement | null>(null);
  const foreColorRef = useRef<HTMLInputElement | null>(null);
  const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36];

  const dropdownItems = useMemo(() => tokens.map((item) => item.type), []);
  const fromSelectedType = useMemo(
    () => tokens.find((item) => item.type === selectedType)?.item || [],
    [selectedType],
  );
  const filteredTokens = useMemo(
    () =>
      fromSelectedType.filter((item) =>
        item.toLowerCase().includes(search.toLowerCase()),
      ),
    [fromSelectedType, search],
  );

  const getEditorEl = () => {
    const handle =
      activeEditorId === "email_subject"
        ? subjectEditorHandle?.current
        : activeEditorId === "email_body"
          ? bodyEditorHandle?.current
          : bodyEditorHandle?.current || subjectEditorHandle?.current;

    return handle?.getElement() || null;
  };

  const getActiveEditorHandle = () =>
    activeEditorId === "email_subject"
      ? subjectEditorHandle?.current
      : activeEditorId === "email_body"
        ? bodyEditorHandle?.current
        : bodyEditorHandle?.current || subjectEditorHandle?.current;

  const executeCommand = (command: string, value?: string) => {
    const el = getEditorEl();
    if (!el) return;

    el.focus();
    document.execCommand(command, false, value);
  };

  const handleFontSize = (size: number) => {
    setFontSize(size);
    executeCommand("fontSize", "7");

    // Replace the font size with a custom span
    const el = getEditorEl();
    if (el) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement("span");
        span.style.fontSize = `${size}px`;

        try {
          range.surroundContents(span);
        } catch (e) {
          // If surroundContents fails, use alternate method
          const contents = range.extractContents();
          span.appendChild(contents);
          range.insertNode(span);
        }
      }
    }

    setShowFontSizeDropdown(false);
  };

  const handleSaveSelection = () => {
    const handle = getActiveEditorHandle();
    const saved = handle?.saveSelection();
    savedRangeRef.current = saved || null;
  };

  const handleInsertToken = (token: string) => {
    const handle = getActiveEditorHandle();
    handle?.insertToken(
      token,
      selectedType,
      savedRangeRef.current || undefined,
    );
    setTokenDropdown(false);
    setSearch("");
  };

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        tokenDropdown &&
        tokenDropdownRef.current &&
        !tokenDropdownRef.current.contains(e.target as Node)
      ) {
        setTokenDropdown(false);
        setSearch("");
      }

      if (
        showFontColorModal &&
        fontColorModalRef.current &&
        !fontColorModalRef.current.contains(e.target as Node)
      ) {
        setShowFontColorModal(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [tokenDropdown, showFontColorModal]);

  return (
    <div className={styles.richTextToolbar}>
      <div className={styles.toolbarGroup}>
        {/* Font Size */}
        <div className={styles.toolbarButton} style={{ position: "relative" }}>
          <button
            className={styles.fontSizeBtn}
            onClick={() => setShowFontSizeDropdown(!showFontSizeDropdown)}
          >
            {fontSize}
            <img
              src="/icons/toolbars/email/caret-up-down.svg"
              alt="font size"
            />
          </button>
          {showFontSizeDropdown && (
            <div className={styles.fontSizeDropdown}>
              {fontSizes.map((size) => (
                <div
                  key={size}
                  className={styles.fontSizeOption}
                  onClick={() => handleFontSize(size)}
                >
                  {size}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={styles.toolbarDivider} />
      <div className={styles.toolbarGroup}>
        {/* Bold */}
        <div
          className={styles.toolbarButton}
          onClick={() => executeCommand("bold")}
        >
          <img src="/icons/toolbars/email/bold.svg" alt="bold" />
        </div>
        {/* Italic */}
        <div
          className={styles.toolbarButton}
          onClick={() => executeCommand("italic")}
        >
          <img src="/icons/toolbars/email/italic.svg" alt="italic" />
        </div>
        {/* Underline */}
        <div
          className={styles.toolbarButton}
          onClick={() => executeCommand("underline")}
        >
          <img src="/icons/toolbars/email/underline.svg" alt="underline" />
        </div>
      </div>
      <div className={styles.toolbarDivider} />
      <div className={styles.toolbarGroup}>
        {/* Font Color */}
        <div className={styles.toolbarButton} style={{ position: "relative" }}>
          <button
            className={styles.colorButton}
            onClick={(e) => {
              setShowFontColorModal(!showFontColorModal);
            }}
            style={{ background: selectedColor }}
          />
          {/* Font Color Modal */}
          {showFontColorModal && (
            <div className={styles.fontColorModal} ref={fontColorModalRef}>
              <div className={styles.colorOptions}>
                {defaultColorOptions.map((color) => (
                  <button
                    key={color}
                    className={styles.colorOption}
                    style={{
                      background: color,
                      ...(selectedColor.toUpperCase() === color
                        ? {
                            outline: "1.5px solid",
                            outlineOffset: "2px",
                            outlineColor:
                              color === "#FFFFFF" ? "#E5E5E5" : color,
                          }
                        : {}),
                    }}
                    onClick={() => {
                      setSelectedColor(color);
                      executeCommand("foreColor", color);
                    }}
                  />
                ))}
              </div>
              <div className={styles.customGroup}>
                <span className={styles.customLabel}>Custom</span>
                <div className={styles.customInput}>
                  <button
                    className={styles.colorOption}
                    style={{
                      outline: 0,

                      background: selectedColor,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="#000000"
                    value={selectedColor}
                    maxLength={7}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (value.length > 0 && !value.startsWith("#")) {
                        value = "#" + value;
                      }
                      if (value.length <= 7) {
                        setSelectedColor(value);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.toolbarDivider} />
      {/* Text Alignment */}
      <div className={styles.toolbarGroup}>
        <div
          className={styles.toolbarButton}
          onClick={() => executeCommand("justifyLeft")}
        >
          <img src="/icons/toolbars/email/align-left.svg" alt="left" />
        </div>
        <div
          className={styles.toolbarButton}
          onClick={() => executeCommand("justifyCenter")}
        >
          <img src="/icons/toolbars/email/align-center.svg" alt="center" />
        </div>
        <div
          className={styles.toolbarButton}
          onClick={() => executeCommand("justifyRight")}
        >
          <img src="/icons/toolbars/email/align-right.svg" alt="right" />
        </div>
      </div>
      <div className={styles.toolbarDivider} />
      {/* Bullet */}
      <div className={styles.toolbarGroup}>
        <div
          className={styles.toolbarButton}
          onClick={() => executeCommand("insertOrderedList")}
        >
          <img src="/icons/toolbars/email/ordered.svg" alt="ordered list" />
        </div>
        <div
          className={styles.toolbarButton}
          onClick={() => executeCommand("insertUnorderedList")}
        >
          <img src="/icons/toolbars/email/unordered.svg" alt="unordered list" />
        </div>
      </div>
      <div className={styles.toolbarDivider} />
      {/* Insert Token */}
      <div className={styles.tokenDropdownWrapper}>
        <button
          className={styles.insertBtn}
          onClick={() => {
            handleSaveSelection();
            setTokenDropdown((prev) => !prev);
          }}
        >
          Insert Token <img src="/icons/toolbars/arrow.svg" alt="token" />
        </button>

        <div
          className={`${styles.tokenDropdown} ${styles[dropdownPosition]} ${
            tokenDropdown ? styles.active : ""
          }`}
          ref={tokenDropdown ? tokenDropdownRef : null}
        >
          <div className={styles.inputGroup}>
            <span className={styles.labelToken}>Insert Token</span>
            <Dropdown
              dropdownItems={dropdownItems}
              label="Type"
              placeholder="Select type"
              size="small"
              value={selectedType}
              onSelect={(val) => {
                setSearch("");
                setSelectedType(val);
                handleSaveSelection();
              }}
            />
            <Search
              placeholder="Search tokens"
              size="small"
              value={search}
              onChange={setSearch}
            />
          </div>

          <div className={styles.itemGroup}>
            {filteredTokens.length > 0 ? (
              filteredTokens.map((item) => (
                <span key={item} onClick={() => handleInsertToken(item)}>
                  {item}
                </span>
              ))
            ) : (
              <span className={styles.noResults}>No tokens found</span>
            )}
          </div>

          <div className={styles.arrow} />
        </div>
      </div>
    </div>
  );
};

export default RichTextToolbar;
