"use client";

import styles from "./editor.module.scss";
import { Dropdown, Search, Tooltip } from "@/lib/components/ui";
import {
  toolbarDefaultItems,
  tokens,
  toolbarDefaultGroups,
} from "@/lib/data/editor";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type ToolbarItems = (typeof toolbarDefaultItems)[number];

interface OnChangeProps {
  id: string;
  value: string;
}

interface EditorProps {
  dropdownPosition?: "bottom" | "top";
  formdata: Record<string, string>;
  height?: number;
  isLabelVisible?: boolean;
  label: string;
  placeholder: string;
  toolbarItems?: ToolbarItems[];
  useFixedDropdown?: boolean;
  onChange: ({ id, value }: OnChangeProps) => void;
}

function Editor({
  dropdownPosition = "top",
  formdata,
  height = 44,
  isLabelVisible = true,
  label,
  placeholder,
  toolbarItems = toolbarDefaultItems as unknown as ToolbarItems[],
  useFixedDropdown = false,
  onChange,
}: EditorProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const tokenButtonRef = useRef<HTMLSpanElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const foreColorRef = useRef<HTMLInputElement | null>(null);
  const hiliteColorRef = useRef<HTMLInputElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [deboucedSearch, setDebouncedSearch] = useState("");
  const [dropdown, setDropdown] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [hidePlaceholder, setHidePlaceholder] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState(tokens[0].type);
  const [linkDropdown, setLinkDropdown] = useState(false);
  const [linkDropdownStyle, setLinkDropdownStyle] = useState<React.CSSProperties>({});
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const linkDropdownRef = useRef<HTMLDivElement | null>(null);
  const linkButtonRef = useRef<HTMLDivElement | null>(null);
  const dropdownItems = useMemo(() => tokens.map((item) => item.type), []);
  const fromSelectedType = tokens.find(
    (item) => item.type == selectedType
  )?.item;
  const filterFromSelectedType =
    fromSelectedType?.filter((item) =>
      item.toLowerCase().includes(deboucedSearch.toLowerCase())
    ) || [];
  const id = label.toLowerCase().replaceAll(" ", "_");

  const handleOnSelectType = useCallback((value: string) => {
    setSearch("");
    setSelectedType(value);
  }, []);

  function ensureCaretNotInsideToken() {
    // TODO(Vince)
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return;

    const tokenEl = selection.anchorNode.parentElement?.closest(
      `.${styles.token}`
    );

    if (!tokenEl) return;

    const range = document.createRange();

    let spaceNode = tokenEl.nextSibling;
    if (
      !spaceNode ||
      !(
        spaceNode.nodeType === Node.TEXT_NODE &&
        spaceNode.nodeValue === "\u00A0"
      )
    ) {
      spaceNode = document.createTextNode("\u00A0");
      tokenEl.after(spaceNode);
    }

    range.setStartAfter(spaceNode);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
  }

  function handleCloseDropdown(e: MouseEvent) {
    const currentRef = dropdownRef.current;

    if (currentRef && !currentRef.contains(e.target as Node)) {
      setDropdown(false);
      setSearch("");
    }

    const isInsideButton =
      linkButtonRef.current &&
      linkButtonRef.current.contains(e.target as Node);
    const isInsidePanel =
      linkDropdownRef.current &&
      linkDropdownRef.current.contains(e.target as Node);
    if (!isInsideButton && !isInsidePanel) {
      setLinkDropdown(false);
    }
  }

  // Calculate portal dropdown position whenever the token dropdown opens
  useEffect(() => {
    if (!dropdown || !tokenButtonRef.current) return;
    const rect = tokenButtonRef.current.getBoundingClientRect();
    const dropdownWidth = 299;
    // align dropdown's left edge with the button's left edge, offset -50px, clamped to screen
    const left = Math.min(
      window.innerWidth - dropdownWidth - 8,
      Math.max(8, rect.left - 50),
    );
    if (dropdownPosition === "bottom") {
      setDropdownStyle({ top: rect.bottom + 8, left });
    } else {
      setDropdownStyle({ bottom: window.innerHeight - rect.top + 8, left });
    }
  }, [dropdown, dropdownPosition]);

  // Calculate portal position for the createLink dropdown
  useEffect(() => {
    if (!linkDropdown || !linkButtonRef.current) return;
    const rect = linkButtonRef.current.getBoundingClientRect();
    const panelWidth = 280;
    const left = Math.min(
      window.innerWidth - panelWidth - 8,
      Math.max(8, rect.left),
    );
    // always render above the toolbar button
    setLinkDropdownStyle({
      bottom: window.innerHeight - rect.top + 8,
      left,
    });
  }, [linkDropdown]);

  function handleFontSize() {
    // TODO(Vince)
  }

  function handleInsertImage() {
    // TODO(Vince)
  }

  function handleLinkClick() {
    saveSelection();
    const selection = window.getSelection();
    const selectedText = selection?.toString() ?? "";
    setLinkText(selectedText);
    setLinkUrl("");
    setLinkDropdown(true);
  }

  function handleApplyLink() {
    const editor = editorRef.current;
    if (!editor || !linkUrl.trim()) return;

    editor.focus();
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const a = document.createElement("a");
    a.href = linkUrl.trim();
    a.textContent = linkText.trim() || linkUrl.trim();
    a.target = "_blank";

    range.deleteContents();
    range.insertNode(a);

    range.setStartAfter(a);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    onChange({ id, value: editor.innerHTML });
    setLinkDropdown(false);
    setLinkUrl("");
    setLinkText("");
  }

  function insertToken(token: string) {
    // TODO(Vince)
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    restoreSelection();
    ensureCaretNotInsideToken();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount == 0) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const span = document.createElement("span");

    span.textContent = token;
    span.contentEditable = "true";
    span.dataset.token = `${selectedType}-${token}`;

    range.deleteContents();
    range.insertNode(span);

    const space = document.createTextNode("\u00A0");
    span.after(space);

    range.setStartAfter(space);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    onChange({ id, value: editor.innerHTML });
    setDropdown(false);
  }

  function restoreSelection() {
    // TODO(Vince)
    const selection = window.getSelection();

    if (selection && savedRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }
  }

  function saveSelection() {
    // TODO(Vince)
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  useEffect(() => {
    if (editorRef.current) {
      const initialValue = formdata[id] || "";
      editorRef.current.innerHTML = initialValue;
      setHidePlaceholder(!!initialValue);
    }

    document.addEventListener("mousedown", handleCloseDropdown);
    return () => document.removeEventListener("mousedown", handleCloseDropdown);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className={styles.editor}>
      {isLabelVisible && <span className={styles.label}>{label}</span>}

      <div className={styles.editorGroup}>
        <div className={styles.fieldGroup}>
          <div
            className={styles.field}
            contentEditable
            ref={editorRef}
            style={{ height }}
            onBlur={(e) => {
              if (!e.target.innerHTML) {
                setHidePlaceholder(false);
              }
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement;

              if (target.tagName == "A") {
                window.open((target as HTMLAnchorElement).href, "_blank");
              }

              saveSelection();
            }}
            onFocus={() => setHidePlaceholder(true)}
            onInput={(e) => {
              const target = e.currentTarget;

              if (!target.textContent.trim()) {
                target.innerHTML = "";
              }

              saveSelection();
              onChange({ id, value: target.innerHTML });
            }}
            onKeyDown={(e) => {
              // TODO(Vince)
              const selection = window.getSelection();
              if (!selection || !selection.anchorNode) return;

              const token = selection.anchorNode.parentElement?.closest(
                `.${styles.token}`
              );
              if (!token) return;

              e.preventDefault();

              if (e.key === "Backspace") {
                token.remove();

                if (editorRef.current) {
                  onChange({ id, value: editorRef.current.innerHTML });
                }

                return;
              }

              const moveCaretAfter = (node: Node) => {
                const range = document.createRange();

                range.setStartAfter(node);
                range.collapse(true);

                selection.removeAllRanges();
                selection.addRange(range);
              };

              let spaceNode = token.nextSibling;
              if (
                !spaceNode ||
                !(
                  spaceNode.nodeType === Node.TEXT_NODE &&
                  spaceNode.nodeValue === "\u00A0"
                )
              ) {
                const space = document.createTextNode("\u00A0");
                token.after(space);
                spaceNode = space;
              }

              moveCaretAfter(spaceNode);
            }}
          />
          {!hidePlaceholder && placeholder && (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>

        <div className={styles.toolbar}>
          {toolbarDefaultGroups
            .map((group) => group.filter((item) => toolbarItems.includes(item)))
            .filter((group) => group.length > 0)
            .map((group) => (
              <div
                className={`${styles.toolbarGroup}
                ${group.includes("insertToken") ? styles.tokenGroup : ""}
                ${group.includes("fontSize") ? styles.fontGroup : ""}`}
                key={JSON.stringify(group)}
              >
                {group.map((item) => {
                  if (item == "insertToken") {
                    return (
                      <Fragment key={item}>
                        <span
                          ref={tokenButtonRef}
                          className={`${styles.tokenText}
                          ${dropdown ? styles.active : ""}`}
                          onClick={() => setDropdown(true)}
                        >
                          Insert Token
                          <img alt="" src="/icons/toolbars/arrow.svg" />
                        </span>

                        {/* Rendered via portal so it escapes any overflow container */}
                        {dropdown &&
                          typeof document !== "undefined" &&
                          createPortal(
                            <div
                              className={`${styles.tokenPortalDropdown} ${styles[dropdownPosition]}`}
                              ref={dropdownRef}
                              style={dropdownStyle}
                            >
                              <div className={styles.inputGroup}>
                                <span className={styles.labelToken}>
                                  Insert Token
                                </span>
                                <Dropdown
                                  dropdownItems={dropdownItems}
                                  label="Type"
                                  placeholder="Select type"
                                  size="small"
                                  value={selectedType}
                                  onSelect={handleOnSelectType}
                                />
                                <Search
                                  placeholder="Search tokens"
                                  size="small"
                                  value={search}
                                  onChange={setSearch}
                                />
                              </div>

                              <div className={styles.itemGroup}>
                                {filterFromSelectedType.map((item) => (
                                  <span
                                    key={item}
                                    onClick={() => insertToken(item)}
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>

                              <div className={styles.arrow} />
                            </div>,
                            document.body,
                          )}

                        <Tooltip
                          message="Tokens are used to enter your existing values from Jia into standardized email templates."
                          width={289}
                        />
                      </Fragment>
                    );
                  }

                  if (item == "fontSize") {
                    return (
                      <span key={item} onClick={handleFontSize}>
                        {16}
                        <img alt="" src="/icons/toolbars/caret.svg" />
                      </span>
                    );
                  }

                  if (item == "foreColor" || item == "hiliteColor") {
                    const ref =
                      item == "foreColor" ? foreColorRef : hiliteColorRef;

                    return (
                      <div
                        className={styles.icon}
                        key={item}
                        onClick={() => ref.current?.click()}
                      >
                        <img alt="" src={`/icons/toolbars/${item}.svg`} />
                        <input
                          name="color"
                          ref={ref}
                          type="color"
                          onChange={(e) =>
                            document.execCommand(item, false, e.target.value)
                          }
                        />
                      </div>
                    );
                  }

                  if (item == "insertImage") {
                    <div
                      className={styles.icon}
                      key={item}
                      onClick={handleInsertImage}
                    >
                      <img alt="" src={`/icons/toolbars/${item}.svg`} />
                    </div>;
                  }

                  if (item == "createLink") {
                    return (
                      <Fragment key={item}>
                        <div
                          className={styles.icon}
                          ref={linkButtonRef}
                          onClick={handleLinkClick}
                        >
                          <img alt="" src={`/icons/toolbars/${item}.svg`} />
                        </div>

                        {/* Rendered via portal so it escapes any overflow container */}
                        {linkDropdown &&
                          typeof document !== "undefined" &&
                          createPortal(
                            <div
                              className={styles.linkPortalPanel}
                              ref={linkDropdownRef}
                              style={linkDropdownStyle}
                            >
                              <label className={styles.labelToken}>
                                Link (href)
                              </label>
                              <input
                                autoFocus
                                placeholder="https://..."
                                type="url"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                              />
                              <label className={styles.labelToken}>Text</label>
                              <input
                                placeholder="Link text"
                                type="text"
                                value={linkText}
                                onChange={(e) => setLinkText(e.target.value)}
                              />
                              <button
                                className={styles.linkApplyBtn}
                                type="button"
                                onClick={handleApplyLink}
                              >
                                Apply
                              </button>
                            </div>,
                            document.body,
                          )}
                      </Fragment>
                    );
                  }

                  return (
                    <div
                      className={styles.icon}
                      key={item}
                      onClick={() => document.execCommand(item)}
                    >
                      <img alt="" src={`/icons/toolbars/${item}.svg`} />
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default memo(Editor);
