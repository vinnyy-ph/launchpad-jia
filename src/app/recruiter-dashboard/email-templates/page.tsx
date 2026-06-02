"use client";

import React, { useEffect, useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAppContext } from "@/lib/context/AppContext";
import { errorToast, successToast } from "@/lib/Utils";
import Fuse from "fuse.js";
import moment from "moment";
import AddEmailTemplate from "@/lib/components/EmailComponents/AddEmailTempate";
import { api } from "@/lib/utils/apiClient";
import {
  canCreateTemplate,
  canEditTemplate,
  canDeleteTemplate,
  isSuperAdmin,
  EmailTemplate as EmailTemplateType,
} from "@/lib/utils/emailTemplateAccess";
import Swal from "sweetalert2";
import { Button } from "@/lib/components/ui";

interface EmailTemplate {
  _id: string;
  name: string;
  subject: string;
  messagePreview: string;
  fullMessage: string;
  messageContent?: string;
  action?: "endorse" | "drop";
  dateCreated: Date;
  templateType: "user" | "global" | "system";
  variables?: string[];
  isActive: boolean;
  userEmail?: string; // Email of the user who created the template (for user templates)
  orgID?: string; // Organization ID (for user and global templates)
}

// Function to truncate text with ellipsis
const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

// Function to properly render tokens in HTML content
const renderTokensInHTML = (htmlContent: string): string => {
  if (!htmlContent) return "";

  // If the content already contains properly formatted token pills, return as-is
  if (
    htmlContent.includes('class="token-pill em-dynamic-var"') ||
    htmlContent.includes('class="em-dynamic-var"')
  ) {
    return htmlContent;
  }

  // Define the token pill styling to match the image design
  const tokenPillStyle =
    "display: inline-block; background-color: #6699FF; color: white; padding: 4px 8px; border-radius: 12px; font-size: 14px; margin: 0 2px; font-weight: 500; border: 1px solid #a0d9ff; box-shadow: 0 1px 3px rgba(102, 153, 255, 0.3); transition: all 0.2s ease;";

  // Define the token pill HTML with className
  const createTokenPill = (tokenName: string) =>
    `<span class="em-dynamic-var" style="${tokenPillStyle}">${tokenName}</span>`;

  let processedContent = htmlContent;

  // Decode HTML entities first
  processedContent = processedContent.replace(/&nbsp;/g, " ");
  processedContent = processedContent.replace(/&amp;/g, "&");
  processedContent = processedContent.replace(/&lt;/g, "<");
  processedContent = processedContent.replace(/&gt;/g, ">");
  processedContent = processedContent.replace(/&quot;/g, '"');

  // Define token names
  const tokenNames = [
    "Job Title",
    "Employer Company Name",
    "Candidate First Name",
    "Candidate Full Name",
    "JIA Job Portal Link",
  ];

  // Replace [[token]] patterns with styled spans
  processedContent = processedContent.replace(
    /\[\[([^\]]+)\]\]/g,
    (match, tokenName) => createTokenPill(tokenName)
  );

  // Handle any remaining standalone token names that are not already wrapped
  tokenNames.forEach((tokenName) => {
    const escapedTokenName = tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Simple word boundary replacement for token names not already in spans
    const tokenRegex = new RegExp(`\\b${escapedTokenName}\\b`, "g");
    processedContent = processedContent.replace(
      tokenRegex,
      (match, offset, string) => {
        // Check if this match is already inside a span tag
        const beforeMatch = string.substring(0, offset);
        const afterMatch = string.substring(offset + match.length);

        // Look for the nearest opening and closing span tags
        const lastOpenSpan = beforeMatch.lastIndexOf("<span");
        const lastCloseSpan = beforeMatch.lastIndexOf("</span>");
        const nextCloseSpan = afterMatch.indexOf("</span>");

        // If we're inside a span tag, don't replace
        if (lastOpenSpan > lastCloseSpan && nextCloseSpan !== -1) {
          return match;
        }

        return createTokenPill(tokenName);
      }
    );
  });

  return processedContent;
};

export default function EmailTemplates() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = searchParams.get("tab") || "user";
  const orgIDFromSearchParams =
    searchParams.get("orgID") || searchParams.get("orgId");
  const { orgID, user } = useAppContext();

  const buildTemplatesUrl = (nextTab: "user" | "global" | "system") => {
    const params = new URLSearchParams();
    params.set("tab", nextTab);

    const nextOrgID = orgIDFromSearchParams || currentOrgID;
    if (nextOrgID) {
      params.set("orgID", nextOrgID);
    }

    return `${pathname}?${params.toString()}`;
  };

  // Set userEmail from context or localStorage
  React.useEffect(() => {
    // Try to get user email from multiple sources
    let userEmail = null;

    // First try context
    if (user?.email) {
      userEmail = user.email;
    } else {
      // Fallback to localStorage
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser.email) {
            userEmail = parsedUser.email;
          }
        } catch (error) {
          console.error("Error parsing user from localStorage:", error);
        }
      }
    }

    setCurrentUserEmail(userEmail);
  }, [user]);

  // Set orgID from context or localStorage
  React.useEffect(() => {
    // Try to get orgID from multiple sources
    let currentOrgID = null;

    // First try URL params so admin views keep the selected organization
    if (orgIDFromSearchParams) {
      currentOrgID = orgIDFromSearchParams;
    } else if (orgID) {
      // Fall back to context
      currentOrgID = orgID;
    } else {
      // Fallback to localStorage
      const activeOrg = localStorage.getItem("activeOrg");
      if (activeOrg) {
        try {
          const parsedOrg = JSON.parse(activeOrg);
          if (parsedOrg._id) {
            currentOrgID = parsedOrg._id;
          }
        } catch (error) {
          console.error("Error parsing activeOrg:", error);
        }
      }
    }

    setCurrentOrgID(currentOrgID);
  }, [orgID, orgIDFromSearchParams]);

  // Check if current user is a super admin
  const userIsSuperAdmin = isSuperAdmin(user);

  // Additional initialization on component mount to ensure we have the values
  React.useEffect(() => {
    // Initialize userEmail if not already set
    if (!currentUserEmail) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser.email) {
            setCurrentUserEmail(parsedUser.email);
          }
        } catch (error) {
          console.error("Error parsing user from localStorage:", error);
        }
      }
    }

    // Initialize orgID if not already set
    if (!currentOrgID) {
      const activeOrg = localStorage.getItem("activeOrg");
      if (activeOrg) {
        try {
          const parsedOrg = JSON.parse(activeOrg);
          if (parsedOrg._id) {
            setCurrentOrgID(parsedOrg._id);
          }
        } catch (error) {
          console.error("Error parsing activeOrg:", error);
        }
      }
    }
  }, []); // Run only on mount

  // Add CSS for dynamic variables
  React.useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .em-dynamic-var {
        display: inline-block !important;
        background-color: #6699FF !important;
        color: white !important;
        padding: 4px 8px !important;
        border-radius: 12px !important;
        font-size: 14px !important;
        margin: 0 2px !important;
        font-weight: 500 !important;
        border: 1px solid #a0d9ff !important;
        box-shadow: 0 1px 3px rgba(102, 153, 255, 0.3) !important;
        transition: all 0.2s ease !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // State variables
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>(
    []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [sortBy, setSortBy] = useState("dateCreated");
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track initial load
  const [fuse, setFuse] = useState<Fuse<EmailTemplate> | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplate | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    subject: "",
    messageContent: "",
    templateType: "user",
  });

  // User and organization state
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentOrgID, setCurrentOrgID] = useState<string | null>(null);

  // Dummy data for templates
  const dummyTemplates: EmailTemplate[] = [
    // User Templates
    {
      _id: "1",
      name: "Referral Outreach",
      subject: "Job Title at Employer Company Name",
      messagePreview:
        "We're looking to hire a new Job Title at Employer Company Name. While chatting about the position in the office, one of my colleagu...",
      fullMessage:
        "We're looking to hire a new Job Title at Employer Company Name. While chatting about the position in the office, one of my colleagues mentioned you might be interested. I'd love to refer you for this role if you're open to it.",
      action: "endorse",
      dateCreated: new Date("2025-07-11"),
      templateType: "user",
      variables: ["Job Title", "Employer Company Name"],
      isActive: true,
    },
    {
      _id: "2",
      name: "Application Acknowledgment",
      subject: "You've been shortlisted",
      messagePreview:
        "Good news! You've been shortlisted for the Job Title position. Our team would like to schedule the next step of the hiring process wit...",
      fullMessage:
        "Good news! You've been shortlisted for the Job Title position. Our team would like to schedule the next step of the hiring process with you. Please let us know your availability.",
      action: "endorse",
      dateCreated: new Date("2025-01-04"),
      templateType: "user",
      variables: ["Job Title"],
      isActive: true,
    },
    {
      _id: "3",
      name: "Shortlist Invitation",
      subject: "Interview Invitation...",
      messagePreview:
        "Hi Candidate First Name, We'd like to invite you to an interview for the Job Title role at Employer Company Name. Please confirm your av...",
      fullMessage:
        "Hi Candidate First Name, We'd like to invite you to an interview for the Job Title role at Employer Company Name. Please confirm your availability for the following time slots.",
      dateCreated: new Date("2025-01-04"),
      templateType: "user",
      variables: ["Candidate First Name", "Job Title", "Employer Company Name"],
      isActive: true,
    },
    {
      _id: "4",
      name: "Interview Invitation",
      subject: "Reminder: Your interview",
      messagePreview:
        "Hi Candidate First Name, This is a friendly reminder of your upcoming interview for the Job Title role at Employer Company Name sc...",
      fullMessage:
        "Hi Candidate First Name, This is a friendly reminder of your upcoming interview for the Job Title role at Employer Company Name scheduled for [Interview Date].",
      dateCreated: new Date("2025-01-04"),
      templateType: "user",
      variables: [
        "Candidate First Name",
        "Job Title",
        "Employer Company Name",
        "Interview Date",
      ],
      isActive: true,
    },
    {
      _id: "5",
      name: "Interview Reminder",
      subject: "Next Step: Complete Assessment",
      messagePreview:
        "Hi Candidate First Name, As part of our hiring process for the Job Title role, we'd like you to complete a short assessment. You...",
      fullMessage:
        "Hi Candidate First Name, As part of our hiring process for the Job Title role, we'd like you to complete a short assessment. You can access it through the link below.",
      dateCreated: new Date("2025-01-04"),
      templateType: "user",
      variables: ["Candidate First Name", "Job Title"],
      isActive: true,
    },
    {
      _id: "6",
      name: "Assessment Invitation",
      subject: "Your Application for...",
      messagePreview:
        "Hi Candidate First Name, Thank you for applying to Employer Company Name. After careful review, we've decided not to move forward wi...",
      fullMessage:
        "Hi Candidate First Name, Thank you for applying to Employer Company Name. After careful review, we've decided not to move forward with your application at this time.",
      action: "drop",
      dateCreated: new Date("2025-01-04"),
      templateType: "user",
      variables: ["Candidate First Name", "Employer Company Name"],
      isActive: true,
    },
    {
      _id: "7",
      name: "Rejection — Early Stage",
      subject: "Update on Your Interview",
      messagePreview:
        "Hi Candidate First Name, Thank you for interviewing for the Job Title role at Employer Company Name. We enjoyed learning more about y...",
      fullMessage:
        "Hi Candidate First Name, Thank you for interviewing for the Job Title role at Employer Company Name. We enjoyed learning more about you, but we've decided to move forward with other candidates.",
      action: "drop",
      dateCreated: new Date("2025-01-04"),
      templateType: "user",
      variables: ["Candidate First Name", "Job Title", "Employer Company Name"],
      isActive: true,
    },
    {
      _id: "12",
      name: "Test 1",
      subject: "this is a test Job Title",
      messagePreview:
        "this is a test body content Employer Company Name this is now th...",
      fullMessage:
        "this is a test body content Employer Company Name this is now the full message content with dynamic variables.",
      dateCreated: new Date("2025-10-02"),
      templateType: "user",
      variables: ["Job Title", "Employer Company Name"],
      isActive: true,
    },
    // Global Templates
    {
      _id: "8",
      name: "Welcome Email Template",
      subject: "Welcome to Employer Company Name!",
      messagePreview:
        "Welcome to Employer Company Name! We're excited to have you join our team. This email contains important information about your first day...",
      fullMessage:
        "Welcome to Employer Company Name! We're excited to have you join our team. This email contains important information about your first day, including your schedule, what to bring, and who to contact if you have any questions.",
      dateCreated: new Date("2025-01-15"),
      templateType: "global",
      variables: ["Employer Company Name"],
      isActive: true,
    },
    {
      _id: "9",
      name: "Onboarding Checklist",
      subject: "Your Onboarding Checklist - Employer Company Name",
      messagePreview:
        "Hi [Employee Name], Welcome to Employer Company Name! Please review the attached onboarding checklist and complete the required tasks...",
      fullMessage:
        "Hi [Employee Name], Welcome to Employer Company Name! Please review the attached onboarding checklist and complete the required tasks before your start date. If you have any questions, don't hesitate to reach out.",
      dateCreated: new Date("2025-01-10"),
      templateType: "global",
      variables: ["Employee Name", "Employer Company Name"],
      isActive: true,
    },
    // System Templates
    {
      _id: "10",
      name: "Password Reset",
      subject: "Reset Your Password - Employer Company Name",
      messagePreview:
        "You requested a password reset for your Employer Company Name account. Click the link below to reset your password...",
      fullMessage:
        "You requested a password reset for your Employer Company Name account. Click the link below to reset your password. If you didn't request this, please ignore this email.",
      dateCreated: new Date("2025-01-01"),
      templateType: "system",
      variables: ["Employer Company Name"],
      isActive: true,
    },
    {
      _id: "11",
      name: "Account Verification",
      subject: "Verify Your Email Address - Employer Company Name",
      messagePreview:
        "Please verify your email address to complete your account setup. Click the verification link below...",
      fullMessage:
        "Please verify your email address to complete your account setup. Click the verification link below to activate your account. This link will expire in 24 hours.",
      dateCreated: new Date("2025-01-01"),
      templateType: "system",
      variables: ["Employer Company Name"],
      isActive: true,
    },
  ];

  // Fetch templates from API
  const fetchTemplates = async (searchQuery?: string, dateFilter?: string) => {
    // For system templates, we don't need orgID
    if (!currentOrgID && tab !== "system") return;

    // Check if authToken is available
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
      console.error("No authToken found in localStorage");
      errorToast("Authentication token not found. Please log in again.", 3000);
      return;
    }

    try {
      setIsLoading(true);

      // Build query parameters
      const params = new URLSearchParams({
        type: tab,
      });

      // Only add orgID for user and global templates, not for system templates
      if (currentOrgID && tab !== "system") {
        params.append("orgID", currentOrgID);
      }

      // Add user email for filtering user-specific templates
      if (currentUserEmail && tab === "user") {
        params.append("userEmail", currentUserEmail);
      }

      if (searchQuery && searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      if (dateFilter && dateFilter.trim()) {
        params.append("dateFilter", dateFilter.trim());

        // Add custom date range parameters if using custom filter
        if (
          dateFilter === "custom" &&
          customDateRange.startDate &&
          customDateRange.endDate
        ) {
          params.append("startDate", customDateRange.startDate);
          params.append("endDate", customDateRange.endDate);
        }
      }

      const response = await api.get(
        `/api/email-module/templates?${params.toString()}`
      );
      const result = await response.data;

      if (result.success) {
        setTemplates(result.data);
        // Don't set filteredTemplates here - let the useEffect handle it
      } else {
        // Fallback to dummy data if API fails
        setTemplates(dummyTemplates);
        errorToast("Failed to fetch templates, showing sample data", 2000);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);

      // Check if it's an authentication error
      if (error.response?.status === 401) {
        errorToast("Authentication failed. Please log in again.", 3000);
        // Don't show dummy data for auth errors
        setTemplates([]);
      } else if (error.response?.status === 403) {
        errorToast("You don't have permission to view templates.", 3000);
        setTemplates([]);
      } else {
        // Fallback to dummy data for other errors
        setTemplates(dummyTemplates);
        errorToast("Failed to fetch templates, showing sample data", 2000);
      }
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Initialize with API data
  useEffect(() => {
    // For system templates, we can fetch without orgID
    // For other templates, we need orgID
    if (tab === "system" || currentOrgID) {
      fetchTemplates();
    }
  }, [currentOrgID, tab]);

  // Trigger API search when search query or date filter changes
  useEffect(() => {
    // Only trigger search if we have the required conditions and we're not in initial load
    if ((tab === "system" || currentOrgID) && (searchQuery || dateFilter)) {
      const timeoutId = setTimeout(() => {
        fetchTemplates(searchQuery, dateFilter);
      }, 300); // Debounce search by 300ms

      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, dateFilter]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showDatePicker && !target.closest("#dateFilterDropdown")) {
        setShowDatePicker(false);
      }
    };

    if (showDatePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker]);

  // Initialize Fuse.js for search
  useEffect(() => {
    if (templates.length > 0) {
      const fuseOptions = {
        keys: ["name", "subject", "messagePreview"],
        threshold: 0.3,
        includeScore: true,
      };
      const fuseInstance = new Fuse(templates, fuseOptions);
      setFuse(fuseInstance);
    }
  }, [templates]);

  // Handle search and filtering
  useEffect(() => {
    if (!templates.length) return;

    let filtered = templates.filter(
      (template) => template.templateType === tab
    );

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((template) => {
        return (
          template.name.toLowerCase().includes(query) ||
          template.subject.toLowerCase().includes(query) ||
          template.messagePreview.toLowerCase().includes(query) ||
          (template.fullMessage &&
            template.fullMessage.toLowerCase().includes(query))
        );
      });
    }

    // Apply date filter
    if (dateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((template) => {
        const templateDate = new Date(template.dateCreated);

        switch (dateFilter) {
          case "today":
            return templateDate >= today;
          case "week":
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return templateDate >= weekAgo;
          case "month":
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return templateDate >= monthAgo;
          case "quarter":
            const quarterAgo = new Date(today);
            quarterAgo.setMonth(quarterAgo.getMonth() - 3);
            return templateDate >= quarterAgo;
          case "year":
            const yearAgo = new Date(today);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            return templateDate >= yearAgo;
          case "custom":
            if (customDateRange.startDate && customDateRange.endDate) {
              const startDate = new Date(customDateRange.startDate);
              const endDate = new Date(customDateRange.endDate);
              endDate.setHours(23, 59, 59, 999); // Include the entire end date
              return templateDate >= startDate && templateDate <= endDate;
            }
            return true;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    const sorted = filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "dateCreated":
          return (
            new Date(b.dateCreated).getTime() -
            new Date(a.dateCreated).getTime()
          );
        case "subject":
          return a.subject.localeCompare(b.subject);
        default:
          return 0;
      }
    });

    setFilteredTemplates(sorted);
  }, [templates, searchQuery, dateFilter, customDateRange, sortBy, tab]);

  const getTemplateCount = () => {
    return templates.filter((template) => template.templateType === tab).length;
  };

  const handleViewTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setShowViewModal(true);
  };

  const handleAddTemplate = () => {
    setShowAddModal(true);
  };

  const closeModals = () => {
    setShowViewModal(false);
    setShowAddModal(false);
    setSelectedTemplate(null);
    setNewTemplate({
      name: "",
      subject: "",
      messageContent: "",
      templateType: "user",
    });
  };

  const handleSaveTemplate = (template: any) => {
    successToast(
      selectedTemplate
        ? "Template updated successfully!"
        : "Template created successfully!",
      2000
    );
    closeModals();
    fetchTemplates(); // Refresh the templates list
  };

  const handleDeleteTemplate = async (templateId: string) => {
    // Don't allow deletion of system templates
    if (tab === "system") {
      errorToast("System templates cannot be deleted", 2000);
      return;
    }

    if (!currentOrgID) {
      errorToast("Organization ID is required", 2000);
      return;
    }

    // Check if authToken is available
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
      console.error("No authToken found in localStorage");
      errorToast("Authentication token not found. Please log in again.", 3000);
      return;
    }

    console.log("Opening SweetAlert confirmation dialog...");

    // Test with minimal configuration first
    const result = await Swal.fire({
      title: "Delete Template",
      text: "Are you sure you want to delete this template? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#000",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
      allowOutsideClick: true,
    });

    console.log("SweetAlert result:", result);

    if (!result.isConfirmed) {
      console.log("User cancelled deletion");
      return;
    }

    try {
      // Build query parameters for DELETE request
      const params = new URLSearchParams({
        orgID: currentOrgID,
      });

      // Add user email for user-specific template deletion
      if (currentUserEmail) {
        params.append("userEmail", currentUserEmail);
      }

      const response = await api.delete(
        `/api/email-module/templates/${templateId}?${params.toString()}`
      );

      const result = await response.data;

      if (result.success) {
        successToast("Template deleted successfully!", 2000);
        closeModals();
        fetchTemplates(); // Refresh the templates list
      } else {
        errorToast(result.message || "Failed to delete template", 2000);
      }
    } catch (error) {
      console.error("Error deleting template:", error);

      // Check if it's an authentication error
      if (error.response?.status === 401) {
        errorToast("Authentication failed. Please log in again.", 3000);
      } else if (error.response?.status === 403) {
        errorToast("You don't have permission to delete this template.", 3000);
      } else if (error.response?.data?.message) {
        errorToast(error.response.data.message, 3000);
      } else {
        errorToast("Failed to delete template. Please try again.", 3000);
      }
    }
  };

  return (
    <>
      <HeaderBar
        activeLink="Email Templates"
        currentPage="Overview"
        icon="la la-envelope"
      />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <div className="col">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                marginBottom: "35px",
              }}
            >
              <h1
                style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}
              >
                Email Templates
              </h1>
              <span
                style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}
              >
                Create, edit, and organize all your email templates in one
                place.
              </span>
            </div>

            {/* Tabs */}
            <div className="row mb-4">
              <div className="col">
                <div
                  className="d-flex"
                  style={{ borderBottom: "2px solid #e9ecef" }}
                >
                  <div
                    className={`px-4 py-3 ${
                      tab === "user" ? "active-tab" : ""
                    }`}
                    onClick={() => router.push(buildTemplatesUrl("user"))}
                    style={{
                      cursor: "pointer",
                      backgroundColor: "white",
                      flexShrink: 0,
                      borderBottom:
                        tab === "user"
                          ? "5px solid #000"
                          : "2px solid transparent",
                      fontWeight: tab === "user" ? "600" : "400",
                      color: tab === "user" ? "#000" : "#6c757d",
                      transition: "all 0.2s ease",
                    }}
                  >
                    User Templates
                  </div>
                  <div
                    className={`px-4 py-3 ${
                      tab === "global" ? "active-tab" : ""
                    }`}
                    onClick={() => router.push(buildTemplatesUrl("global"))}
                    style={{
                      cursor: "pointer",
                      backgroundColor: "white",
                      flexShrink: 0,
                      borderBottom:
                        tab === "global"
                          ? "5px solid #000"
                          : "2px solid transparent",
                      fontWeight: tab === "global" ? "600" : "400",
                      color: tab === "global" ? "#000" : "#6c757d",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Global Templates
                  </div>
                  <div
                    className={`px-4 py-3 ${
                      tab === "system" ? "active-tab" : ""
                    }`}
                    onClick={() => router.push(buildTemplatesUrl("system"))}
                    style={{
                      cursor: "pointer",
                      backgroundColor: "white",
                      flexShrink: 0,
                      borderBottom:
                        tab === "system"
                          ? "5px solid #000"
                          : "2px solid transparent",
                      fontWeight: tab === "system" ? "600" : "400",
                      color: tab === "system" ? "#000" : "#6c757d",
                      transition: "all 0.2s ease",
                    }}
                  >
                    System Templates
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="row">
              <div className="col">
                <div className="card">
                  <div className="card-header">
                    <div
                      className="d-flex justify-content-between align-items-center"
                      style={{
                        width: "100%",
                      }}
                    >
                      <div className="d-flex align-items-center">
                        <h3
                          className="mb-0"
                          style={{ fontWeight: 600, color: "#111827" }}
                        >
                          {tab === "user"
                            ? "User Templates"
                            : tab === "global"
                            ? "Global Templates"
                            : "System Templates"}
                        </h3>
                        <i
                          className="la la-question-circle ml-2"
                          style={{ color: "#6c757d" }}
                        ></i>
                        <span
                          className="badge badge-secondary ml-2"
                          style={{ backgroundColor: "#f8#9fc" }}
                        >
                          {getTemplateCount()}
                        </span>
                      </div>
                      <div
                        className="d-flex align-items-center"
                        style={{ gap: "15px", marginLeft: "auto !important" }}
                      >
                        {/* Search Bar */}
                        {/* Search Input */}
                        <div
                          className="input-group"
                          style={{ width: "300px", marginRight: "10px" }}
                        >
                          <div className="input-group-prepend">
                            <span className="input-group-text">
                              <i className="la la-search"></i>
                            </span>
                          </div>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search by name, subject, or message..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                              border: "1px solid #dee2e6",
                              borderRadius: "4px",
                              padding: "8px 12px",
                              fontSize: "14px",
                            }}
                          />
                          {(searchQuery || dateFilter) && (
                            <div className="input-group-append">
                              <button
                                className="btn btn-outline-secondary"
                                type="button"
                                onClick={() => {
                                  setSearchQuery("");
                                  setDateFilter("");
                                }}
                                style={{
                                  border: "1px solid #dee2e6",
                                  borderLeft: "none",
                                  fontSize: "12px",
                                }}
                              >
                                <i className="la la-times"></i>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Date Filter */}
                        <div
                          className="dropdown"
                          style={{ marginRight: "10px" }}
                        >
                          <button
                            className="btn btn-outline-secondary dropdown-toggle"
                            type="button"
                            id="dateFilterDropdown"
                            data-toggle="dropdown"
                            aria-haspopup="true"
                            aria-expanded="false"
                            onClick={() => setShowDatePicker(!showDatePicker)}
                            style={{
                              border: "1px solid #dee2e6",
                              borderRadius: "4px",
                              padding: "8px 12px",
                              fontSize: "14px",
                              minWidth: "180px",
                              textAlign: "left",
                            }}
                          >
                            <i className="la la-calendar"></i>{" "}
                            {dateFilter === "custom" &&
                            customDateRange.startDate &&
                            customDateRange.endDate
                              ? `${customDateRange.startDate} - ${customDateRange.endDate}`
                              : dateFilter === "today"
                              ? "Today"
                              : dateFilter === "week"
                              ? "This week"
                              : dateFilter === "month"
                              ? "This month"
                              : dateFilter === "quarter"
                              ? "This quarter"
                              : dateFilter === "year"
                              ? "This year"
                              : "All dates"}
                          </button>
                          <div
                            className="dropdown-menu"
                            aria-labelledby="dateFilterDropdown"
                            style={{
                              padding: "15px",
                              minWidth: "300px",
                              border: "1px solid #dee2e6",
                              borderRadius: "6px",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            }}
                          >
                            <div className="mb-3">
                              <h6
                                style={{
                                  marginBottom: "10px",
                                  fontSize: "14px",
                                  fontWeight: "600",
                                }}
                              >
                                Quick Filters
                              </h6>
                              <div className="d-flex flex-wrap gap-2">
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => {
                                    setDateFilter("");
                                    setShowDatePicker(false);
                                  }}
                                  style={{
                                    fontSize: "12px",
                                    padding: "4px 8px",
                                  }}
                                >
                                  All dates
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => {
                                    setDateFilter("today");
                                    setShowDatePicker(false);
                                  }}
                                  style={{
                                    fontSize: "12px",
                                    padding: "4px 8px",
                                  }}
                                >
                                  Today
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => {
                                    setDateFilter("week");
                                    setShowDatePicker(false);
                                  }}
                                  style={{
                                    fontSize: "12px",
                                    padding: "4px 8px",
                                  }}
                                >
                                  This week
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => {
                                    setDateFilter("month");
                                    setShowDatePicker(false);
                                  }}
                                  style={{
                                    fontSize: "12px",
                                    padding: "4px 8px",
                                  }}
                                >
                                  This month
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => {
                                    setDateFilter("quarter");
                                    setShowDatePicker(false);
                                  }}
                                  style={{
                                    fontSize: "12px",
                                    padding: "4px 8px",
                                  }}
                                >
                                  This quarter
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => {
                                    setDateFilter("year");
                                    setShowDatePicker(false);
                                  }}
                                  style={{
                                    fontSize: "12px",
                                    padding: "4px 8px",
                                  }}
                                >
                                  This year
                                </button>
                              </div>
                            </div>
                            <hr style={{ margin: "10px 0" }} />
                            <div>
                              <h6
                                style={{
                                  marginBottom: "10px",
                                  fontSize: "14px",
                                  fontWeight: "600",
                                }}
                              >
                                Custom Range
                              </h6>
                              <div className="row">
                                <div className="col-6">
                                  <label
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: "500",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    From
                                  </label>
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={customDateRange.startDate}
                                    onChange={(e) =>
                                      setCustomDateRange({
                                        ...customDateRange,
                                        startDate: e.target.value,
                                      })
                                    }
                                    style={{ fontSize: "12px" }}
                                  />
                                </div>
                                <div className="col-6">
                                  <label
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: "500",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    To
                                  </label>
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={customDateRange.endDate}
                                    onChange={(e) =>
                                      setCustomDateRange({
                                        ...customDateRange,
                                        endDate: e.target.value,
                                      })
                                    }
                                    style={{ fontSize: "12px" }}
                                  />
                                </div>
                              </div>
                              <div className="mt-2">
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    if (
                                      customDateRange.startDate &&
                                      customDateRange.endDate
                                    ) {
                                      setDateFilter("custom");
                                      setShowDatePicker(false);
                                    }
                                  }}
                                  disabled={
                                    !customDateRange.startDate ||
                                    !customDateRange.endDate
                                  }
                                  style={{
                                    fontSize: "12px",
                                    padding: "4px 12px",
                                  }}
                                >
                                  Apply Range
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary ml-2"
                                  onClick={() => {
                                    setCustomDateRange({
                                      startDate: "",
                                      endDate: "",
                                    });
                                    setDateFilter("");
                                    setShowDatePicker(false);
                                  }}
                                  style={{
                                    fontSize: "12px",
                                    padding: "4px 12px",
                                  }}
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Sort Dropdown */}
                        <div className="dropdown">
                          <button
                            className="btn btn-outline-secondary dropdown-toggle"
                            type="button"
                            id="sortDropdown"
                            data-toggle="dropdown"
                            aria-haspopup="true"
                            aria-expanded="false"
                            style={{
                              borderColor: "#dee2e6",
                              padding: "8px 12px",
                              fontSize: "14px",
                            }}
                          >
                            <i className="la la-filter"></i> Sort By:{" "}
                            {sortBy === "dateCreated"
                              ? "Date Created"
                              : sortBy === "name"
                              ? "Name"
                              : "Subject"}
                          </button>
                          <div
                            className="dropdown-menu"
                            aria-labelledby="sortDropdown"
                          >
                            <button
                              className="dropdown-item"
                              onClick={() => setSortBy("dateCreated")}
                            >
                              Date Created
                            </button>
                            <button
                              className="dropdown-item"
                              onClick={() => setSortBy("name")}
                            >
                              Name
                            </button>
                            <button
                              className="dropdown-item"
                              onClick={() => setSortBy("subject")}
                            >
                              Subject
                            </button>
                          </div>
                        </div>

                        {/* Add Template Button */}
                        <Button
                          variant="primary"
                          onClick={handleAddTemplate}
                          disabled={
                            !canCreateTemplate(
                              tab as "user" | "global" | "system",
                              user,
                              currentOrgID
                            )
                          }
                          style={{
                            backgroundColor: !canCreateTemplate(
                              tab as "user" | "global" | "system",
                              user,
                              currentOrgID
                            )
                              ? "#6c757d"
                              : "#000",
                            transition: "all 0.2s ease",
                            cursor: !canCreateTemplate(
                              tab as "user" | "global" | "system",
                              user,
                              currentOrgID
                            )
                              ? "not-allowed"
                              : "pointer",
                          }}
                          title={
                            !canCreateTemplate(
                              tab as "user" | "global" | "system",
                              user,
                              currentOrgID
                            )
                              ? tab === "system"
                                ? "Only super admins can create system templates"
                                : "Organization ID is required"
                              : "Add new template"
                          }
                          label="Add Template"
                          icon="/icons/plus.svg"
                        >
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    {/* Search Results Info */}
                    {(searchQuery || dateFilter) && !isInitialLoad && (
                      <div className="mb-3">
                        <small className="text-muted">
                          {isLoading ? (
                            "Searching..."
                          ) : (
                            <>
                              Found {filteredTemplates.length} template(s)
                              {searchQuery && ` matching "${searchQuery}"`}
                              {dateFilter && ` from ${dateFilter}`}
                            </>
                          )}
                        </small>
                      </div>
                    )}

                    {isLoading && isInitialLoad ? (
                      <div className="text-center py-4">
                        <div className="spinner-border" role="status">
                          <span className="sr-only">Loading...</span>
                        </div>
                        <p className="mt-2">Loading templates...</p>
                      </div>
                    ) : filteredTemplates.length === 0 && !isInitialLoad ? (
                      <div className="text-center py-4">
                        <p className="text-muted">No templates found</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover">
                          <thead>
                            <tr>
                              <th style={{ fontWeight: 500, color: "#000" }}>
                                Name
                              </th>
                              <th style={{ fontWeight: 500, color: "#000" }}>
                                Subject
                              </th>
                              <th style={{ fontWeight: 500, color: "#000" }}>
                                Message Preview
                              </th>
                              <th style={{ fontWeight: 500, color: "#000" }}>
                                Action
                              </th>
                              <th
                                style={{
                                  fontWeight: 500,
                                  color: "#000",
                                  textAlign: "right",
                                }}
                              >
                                Date Created
                              </th>
                              <th
                                style={{
                                  fontWeight: 500,
                                  color: "#000",
                                  textAlign: "center",
                                }}
                              >
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTemplates.map((template) => {
                              const subjectText =
                                template.subject || template.name || "No Subject";
                              const messagePreviewText =
                                template.messagePreview ||
                                template.messageContent ||
                                template.fullMessage ||
                                "No Content";

                              const subjectHtml = renderTokensInHTML(
                                truncateText(subjectText, 60)
                              );
                              const previewHtml = renderTokensInHTML(
                                truncateText(messagePreviewText, 80)
                              );

                              return (
                                <tr
                                  key={template._id}
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setShowViewModal(true);
                                  }}
                                  style={{
                                    cursor: "pointer",
                                    transition: "background-color 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#f8f9fa";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "transparent";
                                  }}
                                >
                                  <td style={{ fontWeight: 500, color: "#000" }}>
                                    {truncateText(template.name, 30) || "—"}
                                  </td>
                                  <td
                                    style={{ fontWeight: 500, color: "#000" }}
                                    dangerouslySetInnerHTML={{
                                      __html: subjectHtml || "—",
                                    }}
                                  />
                                  <td
                                    style={{ fontWeight: 500, color: "#000" }}
                                    dangerouslySetInnerHTML={{
                                      __html: previewHtml || "—",
                                    }}
                                  />
                                  <td style={{ fontWeight: 500, color: "#000" }}>
                                    <span
                                      className={`badge ${
                                        template.action === "endorse"
                                          ? "badge-success"
                                          : "badge-danger"
                                      }`}
                                    >
                                      {template.action === "endorse"
                                        ? "Endorse"
                                        : template.action === "drop"
                                        ? "Drop"
                                        : "N/A"}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      fontWeight: 500,
                                      color: "#000",
                                      textAlign: "right",
                                    }}
                                  >
                                    {moment(template.dateCreated).format(
                                      "MMM DD, YYYY"
                                    )}
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    <div className="btn-group" role="group">
                                      <button
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={() =>
                                          handleViewTemplate(template)
                                        }
                                        title="View template"
                                      >
                                        <i className="la la-eye"></i>
                                      </button>
                                      {/* <button
                                        className="btn btn-sm btn-outline-secondary"
                                        title="More options"
                                      >
                                        <i className="la la-ellipsis-v"></i>
                                      </button> */}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Template Modal */}
      {showViewModal && selectedTemplate && (
        <div
          className="modal fade show"
          style={{ display: "block", zIndex: 1050 }}
          tabIndex={-1}
        >
          <div
            className="modal-dialog modal-lg modal-dialog-centered"
            style={{
              borderRadius: "30px !important",
            }}
          >
            <div className="modal-content p-3" style={{ maxHeight: "90vh" }}>
              <div className="modal-header">
                <h3
                  className="modal-title"
                  style={{ fontSize: "20px", fontWeight: "600" }}
                >
                  {selectedTemplate.name}
                </h3>
                <button type="button" className="close" onClick={closeModals}>
                  <span>&times;</span>
                </button>
              </div>
              <div
                className="modal-body"
                style={{ overflowY: "auto", maxHeight: "calc(90vh - 120px)" }}
              >
                <div className="d-flex flex-column" style={{ gap: "20px" }}>
                  <div>
                    <h6
                      style={{
                        fontWeight: 600,
                        color: "#333",
                        marginBottom: "10px",
                      }}
                    >
                      Subject
                    </h6>
                    <div
                      style={{
                        margin: 0,
                        padding: "10px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "4px",
                        border: "1px solid #e9ecef",
                      }}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: renderTokensInHTML(selectedTemplate.subject),
                        }}
                        style={{ fontSize: "18px" }}
                      />
                    </div>
                  </div>

                  <div>
                    <h6
                      style={{
                        fontWeight: 600,
                        color: "#333",
                        marginBottom: "10px",
                      }}
                    >
                      Message Content
                    </h6>
                    <div
                      style={{
                        padding: "15px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "4px",
                        minHeight: "200px",
                        border: "1px solid #e9ecef",
                      }}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: renderTokensInHTML(
                            selectedTemplate.messageContent ||
                              selectedTemplate.fullMessage
                          ),
                        }}
                        style={{
                          margin: 0,
                          fontFamily: "inherit",
                          lineHeight: "1.5",
                          fontSize: "18px",
                        }}
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-4">
                      <h6
                        style={{
                          fontWeight: 600,
                          color: "#333",
                          marginBottom: "10px",
                        }}
                      >
                        Template Type
                      </h6>
                      <span
                        className={`badge ${
                          selectedTemplate.templateType === "user"
                            ? "badge-primary"
                            : selectedTemplate.templateType === "global"
                            ? "badge-success"
                            : "badge-warning"
                        }`}
                      >
                        {selectedTemplate.templateType.charAt(0).toUpperCase() +
                          selectedTemplate.templateType.slice(1)}
                      </span>
                    </div>
                    <div className="col-md-4">
                      <h6
                        style={{
                          fontWeight: 600,
                          color: "#333",
                          marginBottom: "10px",
                        }}
                      >
                        Action
                      </h6>
                      <span
                        className={`badge ${
                          selectedTemplate.action === "endorse"
                            ? "badge-success"
                            : "badge-danger"
                        }`}
                        style={{
                          backgroundColor:
                            selectedTemplate.action === "endorse"
                              ? "#28a745"
                              : "#dc3545",
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {selectedTemplate.action === "endorse"
                          ? "Endorse"
                          : selectedTemplate.action === "drop"
                          ? "Drop"
                          : "N/A"}
                      </span>
                    </div>
                    <div className="col-md-4">
                      <h6
                        style={{
                          fontWeight: 600,
                          color: "#333",
                          marginBottom: "10px",
                        }}
                      >
                        Date Created
                      </h6>
                      <p style={{ margin: 0 }}>
                        {moment(selectedTemplate.dateCreated).format(
                          "MMMM DD, YYYY"
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModals}
                  style={{
                    padding: "10px 20px",
                    fontSize: "16px",
                    fontWeight: "600",
                    borderRadius: "30px",
                    marginRight: "10px",
                  }}
                >
                  Close
                </button>
                {/* Edit button - show based on permissions */}
                {(() => {
                  const canEdit = canEditTemplate(
                    selectedTemplate,
                    user,
                    currentOrgID
                  );

                  return canEdit ? (
                    <button
                      type="button"
                      className="btn btn-default"
                      onClick={() => {
                        setSelectedTemplate(selectedTemplate);
                        setShowViewModal(false);
                        setShowAddModal(true);
                      }}
                      style={{
                        padding: "10px 20px",
                        fontSize: "16px",
                        fontWeight: "600",
                        borderRadius: "30px",
                        backgroundColor: "#000",
                        marginRight: "10px",
                      }}
                    >
                      <i className="la la-edit"></i> Edit Template
                    </button>
                  ) : null;
                })()}

                {/* Delete button - show based on permissions */}
                {(() => {
                  const canDelete = canDeleteTemplate(
                    selectedTemplate,
                    user,
                    currentOrgID
                  );

                  return canDelete ? (
                    <button
                      type="button"
                      className="btn btn-dark"
                      onClick={() => handleDeleteTemplate(selectedTemplate._id)}
                      style={{
                        padding: "10px 20px",
                        fontSize: "16px",
                        fontWeight: "600",
                        backgroundColor: "#000",
                        borderRadius: "30px",
                      }}
                    >
                      <i className="la la-trash text-red"></i> Delete
                    </button>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Template Modal */}
      <AddEmailTemplate
        isOpen={showAddModal}
        onClose={closeModals}
        onSave={handleSaveTemplate}
        templateType={tab as "user" | "global" | "system"}
        orgID={currentOrgID}
        userEmail={currentUserEmail}
        editingTemplate={selectedTemplate}
      />

      {/* Modal Backdrop */}
      {showViewModal && (
        <div
          className="modal-backdrop fade show"
          onClick={closeModals}
          style={{ zIndex: 1049 }}
        ></div>
      )}
    </>
  );
}
