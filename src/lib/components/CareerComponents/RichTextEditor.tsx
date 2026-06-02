"use client";

import React, { useRef, useEffect } from "react";

export default function RichTextEditor({ setText, text, error }) {
  const descriptionEditorRef = useRef(null);

  const formatText = (command, value = null) => {
    document.execCommand(command, false, value);
    descriptionEditorRef.current?.focus();
  };

  const handleDescriptionChange = () => {
    if (descriptionEditorRef.current) {
      setText(descriptionEditorRef.current.innerHTML);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();

    // Get plain text from clipboard
    const text = e.clipboardData.getData("text/plain");

    // Insert the plain text at cursor position
    document.execCommand("insertText", false, text);

    // Update the state
    handleDescriptionChange();
  };

  // Handle placeholder for contenteditable div
  useEffect(() => {
    const editor = descriptionEditorRef.current;
    if (editor) {
      const handleFocus = () => {
        if (editor.innerHTML === "" || editor.innerHTML === "<br>") {
          editor.innerHTML = "";
        }
      };

      const handleBlur = () => {
        if (editor.innerHTML === "" || editor.innerHTML === "<br>") {
          editor.innerHTML = "";
        }
      };

      editor.addEventListener("focus", handleFocus);
      editor.addEventListener("blur", handleBlur);

      return () => {
        editor.removeEventListener("focus", handleFocus);
        editor.removeEventListener("blur", handleBlur);
      };
    }
  }, []);

  useEffect(() => {
    if (
      descriptionEditorRef.current &&
      !descriptionEditorRef.current.innerHTML &&
      text
    ) {
      descriptionEditorRef.current.innerHTML = text;
    }
  }, [text]);

  return (
    <div
      style={{
        border: `1px solid ${error ? "#EF4444" : "#E9EAEB"}`,
        borderRadius: "8px",
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      <div
        ref={descriptionEditorRef}
        contentEditable={true}
        style={{
          height: "300px",
          overflowY: "auto",
          padding: "16px",
          lineHeight: "1.5",
          position: "relative",
          textAlign: "left",
          border: "none",
          outline: "none",
          fontSize: "1rem",
          color: "#333",
        }}
        onInput={handleDescriptionChange}
        onBlur={handleDescriptionChange}
        onPaste={handlePaste}
        data-placeholder="Enter job description..."
      ></div>
      <style jsx>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
      {/* Rich Text Editor Toolbar */}
      <div
        style={{
          borderTop: "1px solid #E9EAEB",
          backgroundColor: "#FFFFFF",
          display: "flex",
          gap: "8px",
          padding: "8px 12px",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => formatText("bold")}
          title="Bold"
          style={{
            padding: "6px 10px",
            fontSize: 20,
            color: "#535862",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="la la-bold"></i>
        </button>
        <button
          type="button"
          onClick={() => formatText("italic")}
          title="Italic"
          style={{
            padding: "6px 10px",
            fontSize: 20,
            color: "#535862",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="la la-italic"></i>
        </button>
        <button
          type="button"
          onClick={() => formatText("underline")}
          title="Underline"
          style={{
            padding: "6px 10px",
            fontSize: 20,
            color: "#535862",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="la la-underline"></i>
        </button>
        <button
          type="button"
          onClick={() => formatText("strikeThrough")}
          title="Strikethrough"
          style={{
            padding: "6px 10px",
            fontSize: 20,
            color: "#535862",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="la la-strikethrough"></i>
        </button>

        <div
          style={{
            width: "1px",
            backgroundColor: "#E9EAEB",
            height: "24px",
            margin: "0 4px",
          }}
        ></div>
        <button
          type="button"
          onClick={() => formatText("insertOrderedList")}
          title="Numbered List"
          style={{
            padding: "6px 10px",
            fontSize: 20,
            color: "#535862",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="la la-list-ol"></i>
        </button>
        <button
          type="button"
          onClick={() => formatText("insertUnorderedList")}
          title="Bullet List"
          style={{
            padding: "6px 10px",
            fontSize: 20,
            color: "#535862",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="la la-list-ul"></i>
        </button>
      </div>
    </div>
  );
}
