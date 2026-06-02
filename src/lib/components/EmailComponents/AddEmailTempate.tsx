"use client";

import React, { useState, useRef, useEffect } from "react";
import { errorToast, successToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";

interface AddEmailTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: any) => void;
  templateType?: "user" | "global" | "system";
  orgID?: string;
  userEmail?: string; // Current user's email
  editingTemplate?: any; // Template to edit
}

interface Token {
  id: string;
  name: string;
  value: string;
}

const AVAILABLE_TOKENS: Token[] = [
  { id: "job-title", name: "Job Title", value: "[[Job Title]]" },
  {
    id: "employer-company",
    name: "Employer Company Name",
    value: "[[Employer Company Name]]",
  },
  {
    id: "candidate-first-name",
    name: "Candidate First Name",
    value: "[[Candidate First Name]]",
  },
  {
    id: "candidate-full-name",
    name: "Candidate Full Name",
    value: "[[Candidate Full Name]]",
  },
  {
    id: "jia-job-portal-link",
    name: "JIA Job Portal Link",
    value: "[[JIA Job Portal Link]]",
  },
];

export default function AddEmailTemplate({
  isOpen,
  onClose,
  onSave,
  templateType = "user",
  orgID,
  userEmail,
  editingTemplate,
}: AddEmailTemplateProps) {
  // State to track the actual values we'll use
  const [actualOrgID, setActualOrgID] = useState<string | null>(orgID || null);
  const [actualUserEmail, setActualUserEmail] = useState<string | null>(
    userEmail || null
  );

  // Update state when props change
  React.useEffect(() => {
    setActualOrgID(orgID || null);
    setActualUserEmail(userEmail || null);
  }, [orgID, userEmail]);

  // Fallback to localStorage if props are still null - run on mount and when props change
  React.useEffect(() => {
    if (!actualOrgID) {
      const activeOrg = localStorage.getItem("activeOrg");
      if (activeOrg) {
        try {
          const parsedOrg = JSON.parse(activeOrg);
          if (parsedOrg._id) {
            setActualOrgID(parsedOrg._id);
          }
        } catch (error) {
          console.error("Error parsing activeOrg:", error);
        }
      }
    }

    if (!actualUserEmail) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);

          // Try different possible email field names
          const possibleEmailFields = [
            "email",
            "Email",
            "EMAIL",
            "userEmail",
            "user_email",
            "e_mail",
          ];
          for (const field of possibleEmailFields) {
            if (parsedUser[field]) {
              setActualUserEmail(parsedUser[field]);
              break;
            }
          }
        } catch (error) {
          console.error("Error parsing user from localStorage:", error);
        }
      }
    }
  }, [orgID, userEmail]); // Run when props change, not when state changes

  // Initialize values on component mount
  React.useEffect(() => {
    // Initialize orgID if not already set
    if (!actualOrgID) {
      const activeOrg = localStorage.getItem("activeOrg");
      if (activeOrg) {
        try {
          const parsedOrg = JSON.parse(activeOrg);
          if (parsedOrg._id) {
            setActualOrgID(parsedOrg._id);
          }
        } catch (error) {
          console.error("Error parsing activeOrg:", error);
        }
      }
    }

    // Initialize userEmail if not already set
    if (!actualUserEmail) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);

          // Try different possible email field names
          const possibleEmailFields = [
            "email",
            "Email",
            "EMAIL",
            "userEmail",
            "user_email",
            "e_mail",
          ];
          for (const field of possibleEmailFields) {
            if (parsedUser[field]) {
              setActualUserEmail(parsedUser[field]);
              break;
            }
          }
        } catch (error) {
          console.error("Error parsing user from localStorage:", error);
        }
      }
    }
  }, []); // Run only on mount

  const [templateName, setTemplateName] = useState("");
  const [subject, setSubject] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [action, setAction] = useState<"endorse" | "drop">("endorse");
  const [actionTouched, setActionTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [activeField, setActiveField] = useState<"subject" | "message" | null>(
    null
  );

  const subjectRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const lastActiveFieldRef = useRef<string | null>(null);

  // Rich text editor state
  const [fontSize, setFontSize] = useState("16");
  const [fontFamily, setFontFamily] = useState("Arial");

  useEffect(() => {
    if (isOpen) {
      if (editingTemplate) {
        // Populate form for editing
        setTemplateName(editingTemplate.name || "");
        setSubject(editingTemplate.subject || "");
        setMessageContent(
          editingTemplate.messageContent || editingTemplate.fullMessage || ""
        );
        // Ensure action is always set to a valid value, default to "endorse" if null/undefined
        const templateAction = editingTemplate.action;
        setAction(
          templateAction === "endorse" || templateAction === "drop"
            ? templateAction
            : "endorse"
        );
        setActionTouched(false); // Reset touched state when editing
        setFontSize("16");
        setFontFamily("Arial");

        // Set the content in both editors
        setTimeout(() => {
          if (subjectRef.current) {
            subjectRef.current.innerHTML = editingTemplate.subject || "";
          }
          if (messageRef.current) {
            messageRef.current.innerHTML =
              editingTemplate.messageContent ||
              editingTemplate.fullMessage ||
              "";
          }
        }, 100);
      } else {
        // Reset form when creating new template
        setTemplateName("");
        setSubject("");
        setMessageContent("");
        setAction("endorse"); // Always default to "endorse" for new templates
        setActionTouched(false); // Reset touched state when creating new template
        setFontSize("16");
        setFontFamily("Arial");

        // Clear both editors and reset last active field
        setTimeout(() => {
          if (subjectRef.current) {
            subjectRef.current.innerHTML = "";
          }
          if (messageRef.current) {
            messageRef.current.innerHTML = "";
          }
          lastActiveFieldRef.current = null;
        }, 100);
      }
    }
  }, [isOpen, editingTemplate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showTokenDropdown) {
        const target = event.target as HTMLElement;
        // Close if clicking outside the dropdown menu and not on the insert token button
        if (
          !target.closest(".dropdown-menu") &&
          !target.closest("[data-dropdown-trigger]")
        ) {
          setShowTokenDropdown(false);
        }
      }
    };

    if (showTokenDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTokenDropdown]);

  // Handle placeholder for subject field
  useEffect(() => {
    const updatePlaceholder = () => {
      if (subjectRef.current) {
        const isEmpty = subjectRef.current.innerHTML.trim() === "";
        const isFocused = document.activeElement === subjectRef.current;

        if (isEmpty && !isFocused) {
          // Show placeholder
          subjectRef.current.style.color = "#999";
          if (!subjectRef.current.innerHTML.includes("Enter email subject")) {
            subjectRef.current.innerHTML = "Enter email subject";
          }
        } else if (!isEmpty || isFocused) {
          // Hide placeholder
          subjectRef.current.style.color = "#000";
          if (subjectRef.current.innerHTML === "Enter email subject") {
            subjectRef.current.innerHTML = "";
          }
        }
      }
    };

    updatePlaceholder();

    const subjectElement = subjectRef.current;
    if (subjectElement) {
      subjectElement.addEventListener("focus", updatePlaceholder);
      subjectElement.addEventListener("blur", updatePlaceholder);
      subjectElement.addEventListener("input", updatePlaceholder);
    }

    return () => {
      if (subjectElement) {
        subjectElement.removeEventListener("focus", updatePlaceholder);
        subjectElement.removeEventListener("blur", updatePlaceholder);
        subjectElement.removeEventListener("input", updatePlaceholder);
      }
    };
  }, [subject]);

  const insertToken = (token: Token) => {
    // Use activeField first, then fallback to lastActiveFieldRef, then default to message
    const targetField = activeField || lastActiveFieldRef.current || "message";

    // Only allow insertion into subject or message fields
    if (targetField !== "subject" && targetField !== "message") {
      setShowTokenDropdown(false);
      return;
    }

    if (targetField === "subject" && subjectRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const tokenElement = createTokenElement(token);
        range.deleteContents();
        range.insertNode(tokenElement);

        // Update the subject state
        setSubject(subjectRef.current.innerHTML);

        // Move cursor after the token
        range.setStartAfter(tokenElement);
        range.setEndAfter(tokenElement);
        selection.removeAllRanges();
        selection.addRange(range);
        subjectRef.current.focus();
      } else {
        // If no selection, append to the end of the subject
        if (subjectRef.current) {
          const tokenElement = createTokenElement(token);
          subjectRef.current.appendChild(tokenElement);

          // Update the subject state
          setSubject(subjectRef.current.innerHTML);

          subjectRef.current.focus();

          // Set cursor after the token
          const range = document.createRange();
          range.setStartAfter(tokenElement);
          range.setEndAfter(tokenElement);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    } else if (targetField === "message" && messageRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const tokenElement = createTokenElement(token);
        range.deleteContents();
        range.insertNode(tokenElement);

        // Update the message content state
        setMessageContent(messageRef.current.innerHTML);

        // Move cursor after the token
        range.setStartAfter(tokenElement);
        range.setEndAfter(tokenElement);
        selection.removeAllRanges();
        selection.addRange(range);
        messageRef.current.focus();
      } else {
        // If no selection, append to the end of the message
        if (messageRef.current) {
          const tokenElement = createTokenElement(token);
          messageRef.current.appendChild(tokenElement);

          // Update the message content state
          setMessageContent(messageRef.current.innerHTML);

          messageRef.current.focus();

          // Set cursor after the token
          const range = document.createRange();
          range.setStartAfter(tokenElement);
          range.setEndAfter(tokenElement);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    }
    setShowTokenDropdown(false);
    setActiveField(null);
  };

  const createTokenElement = (token: Token): HTMLElement => {
    const span = document.createElement("span");
    span.className = "token-pill em-dynamic-var";
    span.contentEditable = "false";
    span.style.cssText = `
      display: inline-block;
      background-color: #6699FF;
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 14px;
      margin: 0 2px;
      cursor: pointer;
      user-select: none;
      border: 1px solid #a0d9ff;
      font-weight: 500;
      box-shadow: 0 1px 3px rgba(102, 153, 255, 0.3);
      transition: all 0.2s ease;
    `;

    // Add hover effect
    span.addEventListener("mouseenter", () => {
      span.style.backgroundColor = "#5a8ae6";
      span.style.boxShadow = "0 2px 6px rgba(102, 153, 255, 0.4)";
    });

    span.addEventListener("mouseleave", () => {
      span.style.backgroundColor = "#6699FF";
      span.style.boxShadow = "0 1px 3px rgba(102, 153, 255, 0.3)";
    });
    span.textContent = token.name;
    span.setAttribute("data-token", token.value);

    // Add click handler to remove token
    span.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const parentElement = span.parentElement;
      span.remove();
      // Update the appropriate state after removal
      if (parentElement === subjectRef.current) {
        setSubject(subjectRef.current?.innerHTML || "");
      } else if (parentElement === messageRef.current) {
        setMessageContent(messageRef.current?.innerHTML || "");
      }
    });

    return span;
  };

  const handleSubjectInput = () => {
    if (subjectRef.current) {
      setSubject(subjectRef.current.innerHTML);
    }
  };

  const handleSubjectFocus = () => {
    setActiveField("subject");
    lastActiveFieldRef.current = "subject";
  };

  const handleMessageFocus = () => {
    setActiveField("message");
    lastActiveFieldRef.current = "message";
  };

  const handleBlur = () => {
    // Don't clear active field immediately - keep it for token insertion
    // Only clear if user clicks outside the modal or on a non-field element
    setTimeout(() => {
      const activeElement = document.activeElement;
      const isClickingOnField =
        activeElement === subjectRef.current ||
        activeElement === messageRef.current ||
        activeElement?.closest(".dropdown-menu") ||
        activeElement?.closest("[data-dropdown-trigger]");

      if (!isClickingOnField) {
        setActiveField(null);
      }
    }, 300);
  };

  const handleMessageInput = () => {
    if (messageRef.current) {
      setMessageContent(messageRef.current.innerHTML);
    }
  };

  const formatText = (command: string, value?: string) => {
    try {
      if (command === "fontSize" && value) {
        document.execCommand("fontSize", false, "7");
        if (messageRef.current) {
          const html = messageRef.current.innerHTML;
          const replaced = html.replace(
            /<font size=\"7\">([\s\S]*?)<\/font>/gim,
            `<span style=\"font-size:${value}px\">$1</span>`
          );
          messageRef.current.innerHTML = replaced;
        }
      } else {
        document.execCommand(command, false, value);
      }
      if (messageRef.current) {
        setMessageContent(messageRef.current.innerHTML);
      }
    } catch (e) {
      console.error("formatText error", e);
    }
  };

  const handleSave = async () => {
    if (!templateName.trim() || !subject.trim() || !messageContent.trim()) {
      errorToast("Please fill in all required fields", 2000);
      return;
    }

    // Validate that action is set and not null
    if (!action || (action !== "endorse" && action !== "drop")) {
      errorToast("Please select an action (Endorse or Drop)", 2000);
      return;
    }

    // System templates don't require orgID, but user and global templates do
    if (templateType !== "system" && !actualOrgID) {
      errorToast("Organization ID is required", 2000);
      return;
    }

    // User templates require userEmail
    if (templateType === "user" && !actualUserEmail) {
      errorToast("User email is required for user templates", 2000);
      return;
    }

    // Validate that userEmail is not null or empty
    if (
      actualUserEmail === null ||
      actualUserEmail === undefined ||
      actualUserEmail === ""
    ) {
      errorToast("User email is required", 2000);
      return;
    }

    // Final check before API call - get values directly from localStorage if state is null
    let finalOrgID = actualOrgID;
    let finalUserEmail = actualUserEmail;

    if (!finalOrgID && templateType !== "system") {
      const activeOrg = localStorage.getItem("activeOrg");
      if (activeOrg) {
        try {
          const parsedOrg = JSON.parse(activeOrg);
          if (parsedOrg._id) {
            finalOrgID = parsedOrg._id;
          }
        } catch (error) {
          console.error("Error parsing activeOrg:", error);
        }
      }
    }

    if (!finalUserEmail) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);

          // Try different possible email field names
          const possibleEmailFields = [
            "email",
            "Email",
            "EMAIL",
            "userEmail",
            "user_email",
            "e_mail",
          ];
          for (const field of possibleEmailFields) {
            if (parsedUser[field]) {
              finalUserEmail = parsedUser[field];
              break;
            }
          }
        } catch (error) {
          console.error("Error parsing user from localStorage:", error);
        }
      }
    }

    // TEMPORARY: Hardcoded fallback for testing
    if (!finalUserEmail) {
      finalUserEmail = "bryce.mercines@whitecloak.com";
    }

    // Check if authToken is available
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
      console.error("No authToken found in localStorage");
      errorToast("Authentication token not found. Please log in again.", 3000);
      return;
    }

    setIsLoading(true);

    try {
      // Extract variables from content
      const variables: string[] = [];
      const tokenRegex = /\[\[([^\]]+)\]\]/g;
      let match;

      // Extract from subject
      while ((match = tokenRegex.exec(subject)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }

      // Extract from message content
      const messageText = messageRef.current?.textContent || "";
      tokenRegex.lastIndex = 0; // Reset regex
      while ((match = tokenRegex.exec(messageText)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }

      const templateData = {
        name: templateName,
        subject: subject,
        messageContent: messageContent,
        action: action || "endorse", // Ensure action is never null/undefined
        templateType: templateType,
        orgID: templateType === "system" ? null : finalOrgID || "", // System templates don't have orgID
        variables: variables,
        isActive: true,
        createdBy: finalUserEmail || "unknown",
        userEmail: finalUserEmail,
      };

      console.log("Creating/updating template with:", {
        finalUserEmail,
        finalOrgID,
        templateType,
        hasAuthToken: !!authToken,
        editingTemplate: !!editingTemplate,
        templateData: {
          name: templateData.name,
          subject: templateData.subject,
          messageContent: templateData.messageContent ? "Present" : "Missing",
          action: templateData.action,
          templateType: templateData.templateType,
          orgID: templateData.orgID,
        },
        rawAction: action,
        processedAction: templateData.action,
      });

      let response;
      if (editingTemplate) {
        // Update existing template
        console.log("Updating template:", editingTemplate._id);
        response = await api.put(
          `/api/email-module/templates/${editingTemplate._id}`,
          templateData
        );
      } else {
        // Create new template
        console.log("Creating new template");
        response = await api.post("/api/email-module/templates", templateData);
      }

      const result = await response.data;
      console.log("API response:", result);

      if (result.success) {
        onSave(result.data);
        onClose();
      } else {
        errorToast(
          result.message ||
            (editingTemplate
              ? "Failed to update template"
              : "Failed to create template"),
          2000
        );
      }
    } catch (error) {
      console.error("Error creating/updating template:", error);

      // Check if it's an authentication error
      if (error.response?.status === 401) {
        errorToast("Authentication failed. Please log in again.", 3000);
      } else if (error.response?.status === 403) {
        errorToast("You don't have permission to perform this action.", 3000);
      } else if (error.response?.status === 409) {
        // Handle duplicate template validation error
        const errorMessage =
          error.response?.data?.message ||
          "A template with this name and action already exists.";
        errorToast(errorMessage, 4000);
      } else if (error.response?.data?.message) {
        errorToast(error.response.data.message, 3000);
      } else {
        errorToast(
          editingTemplate
            ? "Failed to update template. Please try again."
            : "Failed to create template. Please try again.",
          3000
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal */}
      <div
        className="modal fade show"
        style={{ display: "block", zIndex: 1050 }}
        tabIndex={-1}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h3
                className="modal-title"
                style={{ fontSize: "18px", fontWeight: "500" }}
              >
                {editingTemplate ? "Edit Template" : "Add Template"}
              </h3>
              <button
                type="button"
                className="close"
                onClick={onClose}
                style={{ border: "none", background: "none", fontSize: "24px" }}
              >
                <span>&times;</span>
              </button>
            </div>

            <div className="modal-body" style={{ padding: "24px", overflowY: "auto", maxHeight: "80vh" }}>
              {/* Template Name */}
              <div className="form-group mb-4">
                <label
                  htmlFor="templateName"
                  style={{
                    fontWeight: 600,
                    color: "#333",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  Template Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name"
                  style={{
                    border: "1px solid #dee2e6",
                    borderRadius: "4px",
                    padding: "12px",
                    fontSize: "16px",
                  }}
                />
              </div>

              {/* Action */}
              <div className="form-group mb-4">
                <label
                  htmlFor="templateAction"
                  style={{
                    fontWeight: 600,
                    color: "#333",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  Action <span style={{ color: "#dc3545" }}>*</span>
                </label>
                <select
                  className="form-control"
                  id="templateAction"
                  value={action}
                  onChange={(e) => {
                    const newAction = e.target.value as "endorse" | "drop";
                    setActionTouched(true);
                    // Only allow valid action values
                    if (newAction === "endorse" || newAction === "drop") {
                      setAction(newAction);
                    } else {
                      // Fallback to "endorse" if invalid value is somehow selected
                      setAction("endorse");
                    }
                  }}
                  required
                  style={{
                    border:
                      action && (action === "endorse" || action === "drop")
                        ? "1px solid #dee2e6"
                        : "2px solid #dc3545",
                    borderRadius: "4px",
                    padding: "12px",
                    fontSize: "16px",
                    backgroundColor: "white",
                  }}
                >
                  <option value="endorse">Endorse</option>
                  <option value="drop">Drop</option>
                </select>
                <small
                  style={{
                    color: "#6c757d",
                    fontSize: "12px",
                    marginTop: "4px",
                    display: "block",
                  }}
                >
                  Select whether this template is for endorsing or dropping
                  candidates
                </small>
                {actionTouched &&
                  (!action || (action !== "endorse" && action !== "drop")) && (
                    <small
                      style={{
                        color: "#dc3545",
                        fontSize: "12px",
                        marginTop: "4px",
                        display: "block",
                      }}
                    >
                      Please select a valid action
                    </small>
                  )}
              </div>

              {/* Subject */}
              <div className="form-group mb-4">
                <label
                  htmlFor="templateSubject"
                  style={{
                    fontWeight: 600,
                    color: "#333",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  Subject
                </label>
                <div
                  ref={subjectRef}
                  contentEditable
                  onInput={handleSubjectInput}
                  onFocus={handleSubjectFocus}
                  onBlur={handleBlur}
                  style={{
                    border:
                      activeField === "subject"
                        ? "3px solid #4169E1"
                        : "1px solid #dee2e6",
                    borderRadius: "4px",
                    padding: "12px",
                    fontSize: "16px",
                    outline: "none",
                    backgroundColor: "white",
                    transition: "border-color 0.2s ease",
                    minHeight: "50px",
                    position: "relative",
                  }}
                />
              </div>

              {/* Message */}
              <div className="form-group mb-4">
                <label
                  style={{
                    fontWeight: 600,
                    color: "#333",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  Message
                </label>
                <div
                  ref={messageRef}
                  contentEditable
                  onInput={handleMessageInput}
                  onFocus={handleMessageFocus}
                  onBlur={handleBlur}
                  style={{
                    border:
                      activeField === "message"
                        ? "3px solid #4169E1"
                        : "1px solid #dee2e6",
                    borderRadius: "4px",
                    padding: "12px",
                    minHeight: "225px",
                    fontSize: "16px",
                    outline: "none",
                    backgroundColor: "white",
                    transition: "border-color 0.2s ease",
                  }}
                  data-placeholder="Enter email message content"
                />
              </div>

              {/* Rich Text Editor Toolbar */}
              <div
                className="d-flex align-items-center mb-3"
                style={{
                  border: "1px solid #dee2e6",
                  borderRadius: "4px",
                  padding: "8px",
                  backgroundColor: "#f8f9fa",
                  flexWrap: "nowrap",
                  gap: "8px",
                  minHeight: "50px",
                  overflowX: "auto",
                }}
              >
                {/* Font Size */}
                <div className="d-flex align-items-center">
                  <select
                    value={fontSize}
                    onChange={(e) => {
                      setFontSize(e.target.value);
                      formatText("fontSize", e.target.value);
                    }}
                    style={{
                      border: "1px solid #dee2e6",
                      borderRadius: "4px",
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                    }}
                  >
                    <option value="12">12</option>
                    <option value="14">14</option>
                    <option value="16">16</option>
                    <option value="18">18</option>
                    <option value="20">20</option>
                    <option value="24">24</option>
                  </select>
                  <i
                    className="la la-chevron-down ml-1"
                    style={{ fontSize: "10px" }}
                  ></i>
                </div>

                {/* Text Formatting */}
                <div
                  className="d-flex align-items-center"
                  style={{ gap: "4px" }}
                >
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => formatText("bold")}
                    style={{
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                      minWidth: "35px",
                    }}
                    title="Bold"
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => formatText("italic")}
                    style={{
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                      minWidth: "35px",
                    }}
                    title="Italic"
                  >
                    <em>I</em>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => formatText("underline")}
                    style={{
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                      minWidth: "35px",
                    }}
                    title="Underline"
                  >
                    <u>U</u>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => formatText("strikeThrough")}
                    style={{
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                      minWidth: "35px",
                    }}
                    title="Strikethrough"
                  >
                    <s>S</s>
                  </button>
                </div>

                {/* Text Alignment */}
                <div
                  className="d-flex align-items-center"
                  style={{ gap: "4px" }}
                >
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => formatText("justifyLeft")}
                    style={{
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                      minWidth: "35px",
                    }}
                    title="Align Left"
                  >
                    <i className="la la-align-left"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => formatText("justifyCenter")}
                    style={{
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                      minWidth: "35px",
                    }}
                    title="Align Center"
                  >
                    <i className="la la-align-center"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => formatText("justifyRight")}
                    style={{
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                      minWidth: "35px",
                    }}
                    title="Align Right"
                  >
                    <i className="la la-align-right"></i>
                  </button>
                </div>

                {/* Lists */}
                <div
                  className="d-flex align-items-center"
                  style={{ gap: "4px" }}
                >
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => formatText("insertUnorderedList")}
                    style={{
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                      minWidth: "35px",
                    }}
                    title="Bulleted List"
                  >
                    <i className="la la-list-ul"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => formatText("insertOrderedList")}
                    style={{
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                      minWidth: "35px",
                    }}
                    title="Numbered List"
                  >
                    <i className="la la-list-ol"></i>
                  </button>
                </div>

                {/* Insert Token Dropdown */}
                <div className="dropdown" style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary dropdown-toggle"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTokenDropdown(!showTokenDropdown);
                    }}
                    data-dropdown-trigger
                    style={{
                      padding: "6px 10px",
                      fontSize: "14px",
                      minHeight: "35px",
                      opacity: (() => {
                        const targetField =
                          activeField || lastActiveFieldRef.current;
                        return targetField === "subject" ||
                          targetField === "message"
                          ? 1
                          : 0.6;
                      })(),
                    }}
                    title={(() => {
                      const targetField =
                        activeField || lastActiveFieldRef.current;
                      return targetField === "subject" ||
                        targetField === "message"
                        ? "Insert dynamic variable"
                        : "Click on subject or message field first";
                    })()}
                  >
                    Insert Token
                  </button>
                </div>

                {/* Help Icon */}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  style={{
                    padding: "6px 10px",
                    fontSize: "14px",
                    minHeight: "35px",
                    minWidth: "35px",
                  }}
                  title="Help"
                >
                  <i className="la la-question-circle"></i>
                </button>
              </div>
            </div>

            {/* Token Dropdown Menu - Rendered outside toolbar */}
            {showTokenDropdown && (
              <>
                {/* Dropdown Menu */}
                <div
                  className="dropdown-menu show"
                  style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 1060,
                    minWidth: "250px",
                    maxWidth: "300px",
                    border: "1px solid #dee2e6",
                    borderRadius: "8px",
                    backgroundColor: "white",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    padding: "8px 0",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 16px",
                      borderBottom: "1px solid #f0f0f0",
                      marginBottom: "4px",
                    }}
                  >
                    <h6
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#333",
                      }}
                    >
                      Insert Dynamic Variable
                    </h6>
                    <small style={{ color: "#666", fontSize: "12px" }}>
                      {(() => {
                        const targetField =
                          activeField ||
                          lastActiveFieldRef.current ||
                          "message";
                        if (targetField === "subject") {
                          return "Click to insert into subject field";
                        } else if (targetField === "message") {
                          return "Click to insert into message field";
                        } else {
                          return "Click on subject or message field first to insert variables";
                        }
                      })()}
                    </small>
                  </div>
                  {AVAILABLE_TOKENS.map((token) => (
                    <button
                      key={token.id}
                      className="dropdown-item"
                      onClick={() => insertToken(token)}
                      style={{
                        padding: "12px 16px",
                        border: "none",
                        background: "none",
                        width: "100%",
                        textAlign: "left",
                        fontSize: "14px",
                        cursor: "pointer",
                        borderBottom: "1px solid #f8f9fa",
                        display: "block",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#e3f2fd";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: "500", color: "#333" }}>
                            {token.name}
                          </span>
                          <br />
                          <small style={{ color: "#666", fontSize: "12px" }}>
                            {token.value}
                          </small>
                        </div>
                        <span
                          style={{
                            backgroundColor: "#007bff",
                            color: "white",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "500",
                          }}
                        >
                          Token
                        </span>
                      </div>
                    </button>
                  ))}
                  <div
                    style={{
                      padding: "8px 16px",
                      borderTop: "1px solid #f0f0f0",
                      marginTop: "4px",
                    }}
                  >
                    <small style={{ color: "#999", fontSize: "11px" }}>
                      Variables will be replaced with actual values when sending
                      emails
                    </small>
                  </div>
                </div>
              </>
            )}

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={handleSave}
                disabled={isLoading}
                style={{
                  backgroundColor: "#000",
                  borderColor: "#000",
                }}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm mr-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="la la-plus"></i>{" "}
                    {editingTemplate ? "Update template" : "Add template"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Backdrop */}
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1049 }}
      ></div>

      {/* Custom Styles */}
      <style jsx>{`
        .token-pill:hover {
          background-color: #0056b3 !important;
        }

        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #6c757d;
          pointer-events: none;
        }

        .dropdown-menu.show {
          display: block;
        }
      `}</style>
    </>
  );
}
