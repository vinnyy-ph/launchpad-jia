"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import styles from "@/lib/components/MailgunComponents/editor/editor.module.scss";

interface OnChangeProps {
  id: string;
  value: string;
}

export interface TokenEditorHandle {
  focus: () => void;
  saveSelection: () => Range | null;
  insertToken: (
    token: string,
    tokenType: string,
    rangeOverride?: Range | null,
  ) => void;
  getHtml: () => string;
  getElement: () => HTMLDivElement | null;
  insertTemplate?: (subject: string, body: string) => void;
}

interface TokenEditorFieldProps {
  id: string;
  type?: "input" | "textarea";
  placeholder?: string;
  value?: string;
  height?: number;
  onChange: ({ id, value }: OnChangeProps) => void;
  onFocus?: (id: string) => void;
  onBlur?: (id: string) => void;
  blockStyling?: boolean;
}

const TokenEditorField = forwardRef<TokenEditorHandle, TokenEditorFieldProps>(
  (
    {
      id,
      type = "input",
      placeholder = "",
      value = "",
      height,
      onChange,
      onFocus: onFocusProp,
      onBlur: onBlurProp,
      blockStyling = false,
    },
    ref,
  ) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const [hidePlaceholder, setHidePlaceholder] = useState(false);

    // Determine height based on type
    const fieldHeight = height || (type === "input" ? 44 : 120);

    // Link tooltip state
    const [tooltip, setTooltip] = useState<{
      visible: boolean;
      text: string;
      x: number;
      y: number;
      linkNode?: HTMLAnchorElement | null;
    }>({ visible: false, text: "", x: 0, y: 0, linkNode: null });

    // Ensure caret is not placed inside a token
    function ensureCaretNotInsideToken() {
      const selection = window.getSelection();
      if (!selection || !selection.anchorNode) return;

      const tokenEl = selection.anchorNode.parentElement?.closest(
        `.${styles.token}`,
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

    // Insert a token at the current selection or specified range
    const insertToken = useCallback(
      (token: string, tokenType: string, rangeOverride?: Range | null) => {
        const editor = editorRef.current;
        if (!editor) return;

        editor.focus();
        const selection = window.getSelection();
        const targetRange = rangeOverride
          ? rangeOverride
          : selection && selection.rangeCount > 0
            ? selection.getRangeAt(0)
            : savedRangeRef.current;

        if (!targetRange) return;
        if (!editor.contains(targetRange.commonAncestorContainer)) return;

        const range = targetRange.cloneRange();
        ensureCaretNotInsideToken();

        const span = document.createElement("span");
        span.textContent = token;
        span.contentEditable = "false";
        span.dataset.token = `${tokenType}-${token}`;
        span.className = styles.token;

        range.deleteContents();
        range.insertNode(span);

        const space = document.createTextNode("\u00A0");
        span.after(space);

        range.setStartAfter(space);
        range.collapse(true);

        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }

        savedRangeRef.current = range.cloneRange();
        onChange({ id, value: editor.innerHTML });
      },
      [id, onChange],
    );

    // Insert template HTML into the editor
    const insertTemplate = (subject: string, body: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (id === "email_subject") {
        editor.innerHTML = subject || "";
        onChange({ id, value: subject || "" });
      } else {
        editor.innerHTML = body || "";
        onChange({ id, value: body || "" });
      }
      setHidePlaceholder(true);
    };

    // Save the current selection range (highlight text)
    const saveSelection = useCallback((): Range | null => {
      const selection = window.getSelection();

      if (
        selection &&
        selection.rangeCount > 0 &&
        editorRef.current &&
        editorRef.current.contains(selection.anchorNode)
      ) {
        const range = selection.getRangeAt(0).cloneRange();
        savedRangeRef.current = range;
        return range;
      }

      return savedRangeRef.current;
    }, []);

    // Handle clicks in the editor (for link tooltips and selection)
    function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
      const target = e.target as HTMLElement;

      if (target.tagName === "A" && target.hasAttribute("href")) {
        e.preventDefault();

        const linkRect = target.getBoundingClientRect();
        const containerRect =
          editorRef.current!.offsetParent!.getBoundingClientRect();

        setTooltip({
          visible: true,
          text: target.getAttribute("href") || "",
          x: Math.max(0, linkRect.left - containerRect.left),
          y: linkRect.bottom - containerRect.top,
          linkNode: target as HTMLAnchorElement,
        });
      } else {
        saveSelection();
        setTooltip((t) => ({ ...t, visible: false, linkNode: null }));
      }
    }

    // Handle removing a hyperlink from the tooltip
    function handleRemoveLink(e: React.MouseEvent<HTMLButtonElement>) {
      e.stopPropagation();
      if (tooltip.linkNode) {
        // Remove the <a> but keep its text
        const link = tooltip.linkNode;
        const text = document.createTextNode(link.textContent || "");
        link.replaceWith(text);
        setTooltip((t) => ({
          ...t,
          visible: false,
          linkNode: null,
        }));
        // Update value
        if (editorRef.current) {
          onChange({ id, value: editorRef.current.innerHTML });
        }
      }
    }

    // Initialize editor content
    useEffect(() => {
      if (editorRef.current) {
        const initialValue = value || "";
        editorRef.current.innerHTML = initialValue;
        setHidePlaceholder(!!initialValue);
      }
    }, []);

    // Expose methods to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        focus: () => editorRef.current?.focus(),
        saveSelection,
        insertToken,
        getHtml: () => editorRef.current?.innerHTML || "",
        getElement: () => editorRef.current,
        insertTemplate,
      }),
      [insertToken, saveSelection],
    );

    return (
      <div className={styles.tokenEditorField}>
        <div className={styles.fieldGroup}>
          <div
            className={`${styles.field} ${
              type === "textarea" ? styles.textarea : styles.input
            }`}
            contentEditable
            ref={editorRef}
            style={{
              minHeight: fieldHeight,
              fontSize: "14px",
              color: "#181D27",
              direction: "ltr",
              textAlign: "left",
              pointerEvents: "auto",
            }}
            suppressContentEditableWarning
            onBlur={(e) => {
              if (!e.target.innerHTML || e.target.innerHTML === "<br>") {
                setHidePlaceholder(false);
              }
              onBlurProp?.(id);
            }}
            onClick={handleEditorClick}
            onFocus={() => {
              setHidePlaceholder(true);
              onFocusProp?.(id);
            }}
            onInput={(e) => {
              const target = e.currentTarget;
              if (blockStyling) {
                // Unwrap all non-token elements, preserving their text/children
                const nodes = Array.from(target.childNodes);
                nodes.forEach((node) => {
                  if (
                    node.nodeType === Node.ELEMENT_NODE &&
                    !(node as HTMLElement).classList.contains(styles.token)
                  ) {
                    // Replace the node with its children (preserve text)
                    while (node.firstChild) {
                      target.insertBefore(node.firstChild, node);
                    }
                    target.removeChild(node);
                  }
                });
                // Remove all inline styles from .token spans
                Array.from(target.childNodes).forEach((node) => {
                  if (
                    node.nodeType === Node.ELEMENT_NODE &&
                    (node as HTMLElement).classList.contains(styles.token)
                  ) {
                    (node as HTMLElement).removeAttribute("style");
                  }
                });
              }
              // Only reset styles if empty, otherwise do not touch DOM for styling
              if (!target.textContent?.trim()) {
                target.innerHTML = "";
                // Reset to default styles when empty
                target.style.fontSize = "14px";
                target.style.color = "#181D27";
              }
              saveSelection();
              onChange({ id, value: target.innerHTML });
            }}
            onKeyDown={(e) => {
              if (blockStyling) {
                // Only allow navigation and token deletion
                const selection = window.getSelection();
                if (!selection || !selection.anchorNode) return;
                const token = selection.anchorNode.parentElement?.closest(
                  `.${styles.token}`,
                );
                if (!token) return;
                e.preventDefault();
                if (e.key === "Backspace" || e.key === "Delete") {
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
                return;
              }
              // ...existing code...
              const selection = window.getSelection();
              if (!selection || !selection.anchorNode) return;
              const token = selection.anchorNode.parentElement?.closest(
                `.${styles.token}`,
              );
              if (!token) return;
              e.preventDefault();
              if (e.key === "Backspace" || e.key === "Delete") {
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
          {/* Link Tooltip */}
          {tooltip.visible && (
            <div
              className={styles.linkTooltip}
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <span>{tooltip.text}</span>
              <button
                className={styles.closeBtn}
                tabIndex={0}
                aria-label="Remove link"
                onClick={handleRemoveLink}
              >
                <img src="/iconsV3/x.svg" alt="close" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
);

export default TokenEditorField;
