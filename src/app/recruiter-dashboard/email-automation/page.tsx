"use client";

import React, { useEffect, useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppContext } from "@/lib/context/AppContext";
import { errorToast, successToast } from "@/lib/Utils";
import Fuse from "fuse.js";
import axios from "axios";
import moment from "moment";
import { api } from "@/lib/utils/apiClient";
import { Button } from "@/lib/components/ui";

interface AutomationData {
  _id: string;
  email: string;
  name?: string;
  jobTitle: string;
  status: string;
  reminderType: string;
  lastAutoReminder?: Date;
  [key: string]: any;
}

interface PastReminderData {
  _id: string;
  email: string;
  name?: string;
  jobTitle: string;
  status: string;
  lastAutoReminder: Date;
  timeSinceReminder: string;
  daysSinceReminder: number;
  [key: string]: any;
}

interface OrganizationDetails {
  _id: string;
  name: string;
  slug?: string;
  image?: string;
  [key: string]: any;
}

export default function EmailAutomation() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") || "pending";
  const { orgID: contextOrgID } = useAppContext();
  
  // Use orgID from URL parameter if available, otherwise fallback to context
  const orgID = searchParams.get("orgID") || contextOrgID;

  // State variables
  const [data, setData] = useState<AutomationData[]>([]);
  const [pastRemindersData, setPastRemindersData] = useState<
    PastReminderData[]
  >([]);
  const [filteredData, setFilteredData] = useState<AutomationData[]>([]);
  const [filteredPastData, setFilteredPastData] = useState<PastReminderData[]>(
    []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [pastSearchQuery, setPastSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPastLoading, setIsPastLoading] = useState(false);
  const [automationProgress, setAutomationProgress] = useState(0);
  const [isAutomationRunning, setIsAutomationRunning] = useState(false);
  const [processedRows, setProcessedRows] = useState<Set<string>>(new Set());
  const [errorRows, setErrorRows] = useState<Set<string>>(new Set());
  const [sendingIndividual, setSendingIndividual] = useState<Set<string>>(
    new Set()
  );
  const [fuse, setFuse] = useState<Fuse<AutomationData> | null>(null);
  const [pastFuse, setPastFuse] = useState<Fuse<PastReminderData> | null>(null);
  const [selectedInterview, setSelectedInterview] =
    useState<PastReminderData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedReminderType, setSelectedReminderType] =
    useState<string>("All");
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null);

  // Fetch Organization Details
  useEffect(() => {
    if (orgID) {
      const fetchOrgDetails = async () => {
        try {
          const response = await api.post("/api/feth-org-details", { orgID });
          if (response.data && response.data.name) {
            setOrgDetails(response.data);
          } else {
            errorToast("Failed to load organization details. Please check the orgID in the URL.", 3000);
          }
        } catch (error) {
          console.error("Error fetching organization details:", error);
          errorToast("Failed to load organization details. Please check the orgID in the URL.", 3000);
        }
      };
      fetchOrgDetails();
    } else {
      errorToast("Organization ID (orgID) is required in the URL.", 3000);
    }
  }, [orgID]);

  // Step 1: Fetch data on load
  useEffect(() => {
    if (orgID) {
      if (tab === "pending") {
        fetchData();
      } else if (tab === "past") {
        fetchPastRemindersData();
      }
    }
  }, [orgID, tab]);

  // Step 2: Initialize Fuse.js for search
  useEffect(() => {
    if (data.length > 0) {
      const fuseOptions = {
        keys: ["email", "name", "jobTitle", "status", "reminderType"],
        threshold: 0.3,
        includeScore: true,
      };
      const fuseInstance = new Fuse(data, fuseOptions);
      setFuse(fuseInstance);
      setFilteredData(data);
    }
  }, [data]);

  useEffect(() => {
    if (pastRemindersData.length > 0) {
      const fuseOptions = {
        keys: ["email", "name", "jobTitle", "status"],
        threshold: 0.3,
        includeScore: true,
      };
      const fuseInstance = new Fuse(pastRemindersData, fuseOptions);
      setPastFuse(fuseInstance);
      setFilteredPastData(pastRemindersData);
    }
  }, [pastRemindersData]);

  // Step 3: Handle search
  useEffect(() => {
    if (fuse && searchQuery.trim() === "") {
      setFilteredData(data);
    } else if (fuse && searchQuery.trim() !== "") {
      const results = fuse.search(searchQuery);
      const filtered = results.map((result) => result.item);
      setFilteredData(filtered);
    }
  }, [searchQuery, fuse, data]);

  useEffect(() => {
    if (pastFuse && pastSearchQuery.trim() === "") {
      setFilteredPastData(pastRemindersData);
    } else if (pastFuse && pastSearchQuery.trim() !== "") {
      const results = pastFuse.search(pastSearchQuery);
      const filtered = results.map((result) => result.item);
      setFilteredPastData(filtered);
    }
  }, [pastSearchQuery, pastFuse, pastRemindersData]);

  const fetchData = async () => {
    if (!orgID) {
      errorToast("Organization ID (orgID) is required in the URL.", 3000);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch data from both endpoints
      const [cvResponse, interviewResponse] = await Promise.all([
        api.post("/api/automations/fetch-pending-cvs", {
          orgID,
        }),
        api.post("/api/automations/fetch-pending-interviews", {
          orgID,
        }),
      ]);

      const cvResult = await cvResponse.data;
      const interviewResult = await interviewResponse.data;

      if (cvResult.success && interviewResult.success) {
        // Merge both datasets
        const mergedData = [...cvResult.data, ...interviewResult.data];
        setData(mergedData);
      } else {
        errorToast("Failed to fetch data", 1300);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      errorToast("Error fetching data", 1300);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPastRemindersData = async () => {
    if (!orgID) {
      errorToast("Organization ID (orgID) is required in the URL.", 3000);
      return;
    }

    try {
      setIsPastLoading(true);

      const response = await api.post("/api/automations/fetch-past-reminders", {
        orgID,
      });

      const result = await response.data;

      if (result.success) {
        setPastRemindersData(result.data);
      } else {
        errorToast("Failed to fetch past reminders data", 1300);
      }
    } catch (error) {
      console.error("Error fetching past reminders data:", error);
      errorToast("Error fetching past reminders data", 1300);
    } finally {
      setIsPastLoading(false);
    }
  };

  const sendIndividualReminder = async (interviewId: string) => {
    if (!orgID) {
      errorToast("Organization ID (orgID) is required in the URL.", 3000);
      return;
    }

    if (!orgDetails || !orgDetails.name) {
      errorToast("Organization details not loaded. Please wait and try again.", 3000);
      return;
    }

    try {
      setSendingIndividual((prev) => new Set(prev).add(interviewId));

      // Find the item to get its reminder type
      const item = data.find((d) => d._id === interviewId);
      if (!item) {
        errorToast("Item not found", 1300);
        return;
      }

      // Generate email content using the same function used in bulk automation
      const { emailSubject, emailContent } = generateEmailContent(item);

      if (!emailContent || !emailSubject) {
        errorToast("Failed to generate email content. Organization details may not be loaded.", 3000);
        return;
      }

      const response = await api.post("/api/automations/send-single-reminder", {
          interviewId,
          reminderType: item.reminderType, // Pass the reminder type to the API
          emailSubject,
          emailContent,
      });

      const result = await response.data;

      if (result.success) {
        successToast("Reminder sent successfully!", 1300);
        // Update the row to show as processed
        setProcessedRows((prev) => new Set(prev).add(interviewId));
        // Refresh data to update lastAutoReminder
        if (tab === "pending") {
          fetchData();
        } else {
          fetchPastRemindersData();
        }
      } else {
        errorToast("Failed to send reminder", 1300);
        setErrorRows((prev) => new Set(prev).add(interviewId));
      }
    } catch (error) {
      console.error("Error sending individual reminder:", error);
      errorToast("Error sending reminder", 1300);
      setErrorRows((prev) => new Set(prev).add(interviewId));
    } finally {
      setSendingIndividual((prev) => {
        const newSet = new Set(prev);
        newSet.delete(interviewId);
        return newSet;
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        successToast("Copied to clipboard!", 1000);
      })
      .catch(() => {
        errorToast("Failed to copy to clipboard", 1000);
      });
  };

  const showInterviewDetails = (interview: PastReminderData) => {
    setSelectedInterview(interview);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedInterview(null);
  };

  const getSuggestedAction = (errorMessage: string, email?: string): string => {
    const errorLower = errorMessage.toLowerCase();
    if (email) {
      if (email.includes(" ")) {
        return "Email address contains spaces. Remove any spaces from the email address.";
      }
      if (!email.includes("@")) {
        return "Email address is missing an '@' symbol. Please enter a valid email address.";
      }
      if (!/\.[a-zA-Z]{2,}$/.test(email)) {
        return "Email address is missing a valid domain (e.g., '.com'). Please check the domain.";
      }
      if (/[^\w.@+-]/.test(email)) {
        return "Email address contains invalid characters. Only use letters, numbers, and valid symbols (._+-@).";
      }
    }
    if (errorLower.includes("invalid email") || errorLower.includes("email format")) {
      return 'Verify the email address format and update if needed (e.g., must contain "@" and a valid domain).';
    }
    if (errorLower.includes("missing required") || errorLower.includes("required parameter")) {
      return "Check that all required fields are filled in.";
    }
    if (errorLower.includes("mailgun") || errorLower.includes("email service")) {
      return "Check email service configuration or try again later.";
    }
    if (errorLower.includes("network") || errorLower.includes("connection")) {
      return "Check your internet connection and try again.";
    }
    if (errorLower.includes("rate limit") || errorLower.includes("too many")) {
      return "Wait a few minutes before retrying.";
    }
    if (errorLower.includes("authentication") || errorLower.includes("unauthorized")) {
      return "Verify email service credentials are configured correctly.";
    }
    if (errorLower.includes("internal server") || errorLower.includes("server error")) {
      return "Contact support if the issue persists.";
    }
    return "Review the error and try sending again.";
  };

  const runAutomation = async () => {
    if (!orgID) {
      errorToast("Organization ID (orgID) is required in the URL.", 3000);
      return;
    }

    if (!orgDetails || !orgDetails.name) {
      errorToast("Organization details not loaded. Please wait and try again.", 3000);
      return;
    }

    if (getFilteredDataByReminderType().length === 0) {
      errorToast("No data to process", 1300);
      return;
    }

    setIsAutomationRunning(true);
    setAutomationProgress(0);
    setProcessedRows(new Set());
    setErrorRows(new Set());

    const totalItems = getFilteredDataByReminderType().length;
    const processedSet = new Set<string>();
    const errorSet = new Set<string>();
    const errorDetails: Array<{ email: string; reason: string; action: string }> = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < totalItems; i++) {
      const item = getFilteredDataByReminderType()[i];
      const { emailSubject, emailContent } = generateEmailContent(item);

      // Check for specific email format issues before sending
      let emailFormatError = "";
      if (item.email.includes(" ")) {
        emailFormatError = "Email address contains spaces.";
      } else if (!item.email.includes("@")) {
        emailFormatError = 'Email address is missing an "@" symbol.';
      } else if (!/\.[a-zA-Z]{2,}$/.test(item.email)) {
        emailFormatError = 'Email address is missing a valid domain (e.g., ".com").';
      } else if (/[^\w.@+-]/.test(item.email)) {
        emailFormatError = "Email address contains invalid characters.";
      }

      if (emailFormatError) {
        errorSet.add(item._id);
        setErrorRows(new Set(errorSet));
        errorCount++;
        errorDetails.push({
          email: item.email,
          reason: emailFormatError,
          action: getSuggestedAction(emailFormatError, item.email),
        });
        const progress = ((i + 1) / totalItems) * 100;
        setAutomationProgress(progress);
        continue;
      }

      if (emailContent && emailSubject) {
        try {
          // Send email with _id parameter
          const response = await api.post(
            "/api/automations/send-email-reminder",
            {
              to: item.email,
              subject: emailSubject,
              message: emailContent,
              _id: item._id,
            }
          );

          if (response.data.success) {
            // Success - mark as processed with green background
            processedSet.add(item._id);
            setProcessedRows(new Set(processedSet));
            successCount++;
          } else {
            // Error - mark as error with salmon background
            errorSet.add(item._id);
            setErrorRows(new Set(errorSet));
            errorCount++;
            const errorMessage = response.data.error || "Unknown error occurred";
            errorDetails.push({
              email: item.email,
              reason: errorMessage,
              action: getSuggestedAction(errorMessage, item.email),
            });
          }
        } catch (error: any) {
          // Error - mark as error with salmon background
          errorSet.add(item._id);
          setErrorRows(new Set(errorSet));
          errorCount++;
          let errorMessage = "Network or server error";
          if (error?.response?.data?.error) {
            errorMessage = error.response.data.error;
          } else if (error?.message) {
            errorMessage = error.message;
          }
          errorDetails.push({
            email: item.email,
            reason: errorMessage,
            action: getSuggestedAction(errorMessage, item.email),
          });
          console.error(`Error sending email to ${item.email}:`, error);
        }

        // Update progress
        const progress = ((i + 1) / totalItems) * 100;
        setAutomationProgress(progress);

        // 350ms delay for each iteration
        await new Promise((resolve) => setTimeout(resolve, 350));
      } else {
        errorSet.add(item._id);
        setErrorRows(new Set(errorSet));
        errorCount++;
        errorDetails.push({
          email: item.email,
          reason: "Failed to generate email content",
          action: "Check organization details and try again",
        });
        const progress = ((i + 1) / totalItems) * 100;
        setAutomationProgress(progress);
      }
    }

    setIsAutomationRunning(false);
    setAutomationProgress(100);

    // Show SweetAlert with summary
    const { default: Swal } = await import("sweetalert2");
    let htmlContent = `
      <div style="text-align: left;">
        <p><strong>Total Processed:</strong> ${totalItems}</p>
        <p style="color: #28a745;"><strong>Successful:</strong> ${successCount}</p>
        <p style="color: #dc3545;"><strong>Failed:</strong> ${errorCount}</p>
    `;

    if (errorCount > 0 && errorDetails.length > 0) {
      htmlContent += `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <div style="max-height: 300px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed;">
              <thead>
                <tr style="border-bottom: 2px solid #dee2e6;">
                  <th style="width: 30%; text-align: left; padding: 8px; font-weight: 600;">Email</th>
                  <th style="width: 20%; text-align: left; padding: 8px; font-weight: 600;">Reason</th>
                  <th style="width: 50%; text-align: left; padding: 8px; font-weight: 600;">Suggested Action</th>
                </tr>
              </thead>
              <tbody>
      `;
      errorDetails.forEach((error, index) => {
        htmlContent += `
                <tr style="border-bottom: 1px solid #e9ecef; ${index % 2 === 0 ? "background-color: #f8f9fa;" : ""}">
                  <td style="width: 30%; padding: 8px; word-break: break-all;">${error.email}</td>
                  <td style="width: 20%; padding: 8px;">${error.reason}</td>
                  <td style="width: 50%; padding: 8px;">${error.action}</td>
                </tr>
        `;
      });
      htmlContent += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    htmlContent += `</div>`;

    Swal.fire({
      title: "Automation Complete!",
      html: htmlContent,
      icon: errorCount > 0 ? "warning" : "success",
      confirmButtonText: "OK",
      confirmButtonColor: "#000",
      width: errorCount > 0 ? "800px" : "500px",
    });
  };

  const getRowBackgroundColor = (itemId: string) => {
    if (processedRows.has(itemId)) {
      return "bg-success text-white"; // Green background for successful rows
    }
    if (errorRows.has(itemId)) {
      return "bg-danger text-white"; // Red background for error rows
    }
    return "";
  };

  const getReminderTypeStats = () => {
    const stats: {
      [key: string]: { count: number; percentage: number; color: string };
    } = {};
    const total = filteredData.length;

    if (total === 0) return stats;

    filteredData.forEach((item) => {
      if (!stats[item.reminderType]) {
        stats[item.reminderType] = { count: 0, percentage: 0, color: "" };
      }
      stats[item.reminderType].count++;
    });

    // Calculate percentages and assign colors
    Object.keys(stats).forEach((type, index) => {
      stats[type].percentage = (stats[type].count / total) * 100;
      // Assign different colors for each reminder type
      const colors = [
        "#007bff",
        "#28a745",
        "#ffc107",
        "#dc3545",
        "#6f42c1",
        "#fd7e14",
      ];
      stats[type].color = colors[index % colors.length];
    });

    return stats;
  };

  const getFilteredDataByReminderType = () => {
    if (selectedReminderType === "All") {
      return filteredData;
    }
    return filteredData.filter(
      (item) => item.reminderType === selectedReminderType
    );
  };

  const generateEmailContent = (item: AutomationData) => {
    let emailContent = "";
    let emailSubject = "";
    
    // Use organization name from fetched orgDetails, require orgID to be set
    if (!orgDetails || !orgDetails.name) {
      errorToast("Organization details not loaded. Please refresh the page.", 2000);
      return { emailSubject: "", emailContent: "" };
    }
    
    const orgName = orgDetails.name;
    const orgSlug = orgDetails.slug || orgDetails._id;
    const applicantUrl = `https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}/dashboard`;

    if (item.reminderType === "Remind to Submit CV") {
      emailSubject = `[Jia] Reminder to Submit CV for ${
        item.jobTitle
      } role at ${orgName} - ${moment().format("MMMM D, YYYY")}`;
      emailContent = `
<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">

<head>
	<meta charset="utf-8">
	<meta name="x-apple-disable-message-reformatting">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<title>Application Follow-up</title>
</head>

<body style="margin:0;padding:0;background-color:#f6f7f9;">
	<center style="width:100%;background:#f6f7f9;">
		<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
			style="max-width:640px;margin:0 auto;background:#ffffff;">

			<!-- Logo -->
			<tr>
				<td style="text-align:center;padding:28px 0 10px;">
					<img src="https://www.hellojia.ai/jia-new-logo.png" alt="Company Logo" width="80" style="display:block;margin:0 auto;max-width:120px;">
          </td>
			</tr>

			<!-- Body -->
			<tr>
				<td
					style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:16px;line-height:1.6;">
					<p style="margin:0 0 16px;">Hi ${item.name || "there"},</p>

					<p style="margin:0 0 24px;">
						Thank you for applying for the <strong>${item.jobTitle}</strong> role at
						<strong>${orgName}</strong>.
						Please submit your CV via the button below at your earliest convenience. We are looking forward
						to your submission.
					</p>

					<!-- Button -->
					<p style="text-align:center;margin:24px 0;">
						<a href="${applicantUrl}" target="_blank" style="background-color:#2563eb;color:#ffffff;text-decoration:none;
                        padding:12px 28px;border-radius:6px;font-size:16px;
                        font-family:Arial,Helvetica,sans-serif;display:inline-block;">
							Submit Your CV
						</a>
					</p>

					<p style="margin:32px 0 4px;">Best Regards,</p>
					<p style="margin:0;">${orgName} Recruiting Team</p>
				</td>
			</tr>

			<!-- Divider -->
			<tr>
				<td style="height:1px;background:#e5e7eb;"></td>
			</tr>

			<!-- Fallback URL -->
			<tr>
				<td
					style="padding:14px 28px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;font-size:12px;line-height:1.4;">
					If the button above doesn't work, copy and paste this URL into your browser:
					<br>
					<span style="word-break:break-all;">${applicantUrl}</span>
				</td>
			</tr>
		</table>
	</center>
</body>

</html>
      `;
    } else if (item.reminderType === "Take AI Interview") {
      emailSubject = `[Jia] Complete Your AI Interview for ${
        item.jobTitle
      } role at ${orgName} - ${moment().format("MMMM D, YYYY")}`;
      emailContent = `
<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">

<head>
	<meta charset="utf-8">
	<meta name="x-apple-disable-message-reformatting">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<title>AI Interview Reminder</title>
</head>

<body style="margin:0;padding:0;background-color:#f6f7f9;">
	<center style="width:100%;background:#f6f7f9;">
		<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
			style="max-width:640px;margin:0 auto;background:#ffffff;">

			<!-- Logo -->
			<tr>
				<td style="text-align:center;padding:28px 0 10px;">
					<img src="https://www.hellojia.ai/jia-new-logo.png" alt="Company Logo" width="80" style="display:block;margin:0 auto;max-width:120px;">
          </td>
			</tr>

			<!-- Body -->
			<tr>
				<td
					style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:16px;line-height:1.6;">
					<p style="margin:0 0 16px;">Hi ${item.name || "there"},</p>

					<p style="margin:0 0 24px;">
						Great news! Your application for the <strong>${item.jobTitle}</strong> role at
						<strong>${orgName}</strong> has been reviewed and we'd like you to complete an AI-powered interview.
					</p>

					<p style="margin:0 0 24px;">
						This innovative interview process will help us better understand your skills and experience. 
						The interview is designed to be conversational and engaging - just like talking to a real person.
					</p>

					<!-- Button -->
					<p style="text-align:center;margin:24px 0;">
						<a href="${applicantUrl}" target="_blank" style="background-color:#28a745;color:#ffffff;text-decoration:none;
                        padding:12px 28px;border-radius:6px;font-size:16px;
                        font-family:Arial,Helvetica,sans-serif;display:inline-block;">
							Start AI Interview
						</a>
					</p>

					<p style="margin:0 0 16px;">
						<strong>What to expect:</strong>
					</p>
					<ul style="margin:0 0 24px;padding-left:20px;">
						<li>Conversational AI interview experience</li>
						<li>Questions tailored to your role</li>
						<li>Flexible timing - complete at your convenience</li>
						<li>Immediate feedback and assessment</li>
					</ul>

					<p style="margin:32px 0 4px;">Best Regards,</p>
					<p style="margin:0;">${orgName} Recruiting Team</p>
				</td>
			</tr>

			<!-- Divider -->
			<tr>
				<td style="height:1px;background:#e5e7eb;"></td>
			</tr>

			<!-- Fallback URL -->
			<tr>
				<td
					style="padding:14px 28px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;font-size:12px;line-height:1.4;">
					If the button above doesn't work, copy and paste this URL into your browser:
					<br>
					<span style="word-break:break-all;">${applicantUrl}</span>
				</td>
			</tr>
		</table>
	</center>
</body>

</html>
      `;
    }

    return { emailSubject, emailContent };
  };

  return (
    <>
      <HeaderBar
        activeLink="Email Reminders"
        currentPage="Overview"
        icon="la la-cubes"
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
                Email Reminders
              </h1>
              <span
                style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}
              >
                Global Implementation of Automated Email Reminders for
                Applicants.
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
                      tab === "pending" ? "active-tab" : ""
                    }`}
                    onClick={() =>
                      router.push(
                        `/recruiter-dashboard/email-automation?tab=pending`
                      )
                    }
                    style={{
                      cursor: "pointer",
                      backgroundColor: "white",
                      flexShrink: 0,
                      borderBottom:
                        tab === "pending"
                          ? "5px solid #000"
                          : "2px solid transparent",
                      fontWeight: tab === "pending" ? "600" : "400",
                      color: tab === "pending" ? "#000" : "#6c757d",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Pending Reminders
                  </div>
                  <div
                    className={`px-4 py-3 ${
                      tab === "past" ? "active-tab" : ""
                    }`}
                    onClick={() =>
                      router.push(
                        `/recruiter-dashboard/email-automation?tab=past`
                      )
                    }
                    style={{
                      cursor: "pointer",
                      backgroundColor: "white",
                      flexShrink: 0,
                      borderBottom:
                        tab === "past"
                          ? "5px solid #000"
                          : "2px solid transparent",
                      fontWeight: tab === "past" ? "600" : "400",
                      color: tab === "past" ? "#000" : "#6c757d",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Past Reminders
                  </div>
                </div>
              </div>
            </div>

            {tab === "pending" && (
              <>
                {/* Search Bar */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="form-group">
                      <div className="input-group">
                        <div className="input-group-prepend">
                          <span className="input-group-text">
                            <i className="la la-search"></i>
                          </span>
                        </div>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search by email, name, job title, status..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{ paddingLeft: "15px" }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 d-flex align-items-center">
                    <span className="text-muted">
                      {filteredData.length} of {data.length} records
                    </span>
                  </div>
                </div>

                {/* Reminder Type Filter */}
                <div className="row mb-4">
                  <div className="col">
                    <div className="card">
                      <div className="card-body">
                        <h6 className="card-title mb-3">
                          Filter by Reminder Type
                        </h6>
                        <div
                          className="d-flex flex-wrap"
                          style={{ gap: "8px" }}
                        >
                          <button
                            className={`btn btn-sm ${
                              selectedReminderType === "All"
                                ? "btn-primary"
                                : "btn-outline-primary"
                            }`}
                            onClick={() => setSelectedReminderType("All")}
                          >
                            All ({filteredData.length})
                          </button>
                          {Object.keys(getReminderTypeStats()).length > 0 ? (
                            Object.entries(getReminderTypeStats()).map(
                              ([type, stats]) => (
                                <button
                                  key={type}
                                  className={`btn btn-sm ${
                                    selectedReminderType === type
                                      ? "btn-primary"
                                      : "btn-outline-primary"
                                  }`}
                                  onClick={() => setSelectedReminderType(type)}
                                  style={{
                                    borderColor: stats.color,
                                    color:
                                      selectedReminderType === type
                                        ? "#fff"
                                        : stats.color,
                                    backgroundColor:
                                      selectedReminderType === type
                                        ? stats.color
                                        : "transparent",
                                  }}
                                >
                                  {type} ({stats.count})
                                </button>
                              )
                            )
                          ) : (
                            <span className="text-muted">
                              No reminder types available
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reminder Type Progress Bar */}
                <div className="row mb-4">
                  <div className="col">
                    <div className="card">
                      <div className="card-body">
                        <h6 className="card-title mb-3">
                          Reminder Type Distribution
                        </h6>
                        {Object.keys(getReminderTypeStats()).length > 0 ? (
                          <>
                            <div
                              className="progress"
                              style={{ height: "30px" }}
                            >
                              {Object.entries(getReminderTypeStats()).map(
                                ([type, stats]) => (
                                  <div
                                    key={type}
                                    className="progress-bar"
                                    role="progressbar"
                                    style={{
                                      width: `${stats.percentage}%`,
                                      backgroundColor: stats.color,
                                      minWidth: "60px",
                                    }}
                                    title={`${type}: ${
                                      stats.count
                                    } (${stats.percentage.toFixed(1)}%)`}
                                  >
                                    {stats.percentage > 5
                                      ? `${stats.percentage.toFixed(1)}%`
                                      : ""}
                                  </div>
                                )
                              )}
                            </div>
                            <div
                              className="d-flex flex-wrap"
                              style={{ gap: "12px" }}
                            >
                              {Object.entries(getReminderTypeStats()).map(
                                ([type, stats]) => (
                                  <div
                                    key={type}
                                    className="d-flex align-items-center"
                                  >
                                    <div
                                      style={{
                                        width: "12px",
                                        height: "12px",
                                        backgroundColor: stats.color,
                                        borderRadius: "50%",
                                        marginRight: "8px",
                                      }}
                                    ></div>
                                    <span style={{ fontSize: "14px" }}>
                                      {type}: {stats.count} (
                                      {stats.percentage.toFixed(1)}%)
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="text-muted mb-0">
                            No data available to display distribution
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {isAutomationRunning && (
                  <div className="row mb-4">
                    <div className="col">
                      <div className="card">
                        <div className="card-body">
                          <h2
                            className="card-title"
                            style={{
                              fontWeight: 500,
                              color: "#000",
                              marginBottom: "0px",
                            }}
                          >
                            Automation Progress:{" "}
                            {Math.round(automationProgress)}%
                          </h2>
                          <div className="progress">
                            <div
                              className="progress-bar bg-success"
                              role="progressbar"
                              style={{ width: `${automationProgress}%` }}
                              aria-valuenow={automationProgress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Send Reminders Button */}
                <div className="row mb-4">
                  <div className="col">
                    <Button
                      variant="primary"
                      onClick={runAutomation}
                      disabled={
                        isAutomationRunning ||
                        getFilteredDataByReminderType().length === 0
                      }
                      label={isAutomationRunning ? "Running Automation..." : "Send Reminders ( " + getFilteredDataByReminderType().length + " )"}
                      icon={isAutomationRunning ? "/loading-spinner.svg" : "/paper-plane.svg"}
                    >
                    </Button>
                  </div>
                </div>

                {/* Data Table */}
                <div className="row">
                  <div className="col">
                    <div className="card">
                      <div className="card-header">
                        <h3 className="mb-0">Pending Reminders</h3>
                      </div>
                      <div className="card-body">
                        {isLoading ? (
                          <div className="text-center py-4">
                            <div className="spinner-border" role="status">
                              <span className="sr-only">Loading...</span>
                            </div>
                            <p className="mt-2">Loading data...</p>
                          </div>
                        ) : filteredData.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-muted">No data found</p>
                          </div>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-hover">
                              <thead>
                                <tr>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Email
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Name
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Job Title
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Status
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Reminder Type
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Last Reminder
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Action
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {getFilteredDataByReminderType().map((item) => (
                                  <tr
                                    key={item._id}
                                    className={getRowBackgroundColor(item._id)}
                                  >
                                    <td
                                      style={{ fontWeight: 500, color: "#000" }}
                                    >
                                      {item.email}
                                    </td>
                                    <td
                                      style={{ fontWeight: 500, color: "#000" }}
                                    >
                                      {item.name || "-"}
                                    </td>
                                    <td
                                      style={{ fontWeight: 500, color: "#000" }}
                                    >
                                      {item.jobTitle}
                                    </td>
                                    <td>
                                      <span className="badge badge-warning">
                                        {item.status}
                                      </span>
                                    </td>
                                    <td
                                      style={{ fontWeight: 500, color: "#000" }}
                                    >
                                      <span
                                        className="badge"
                                        style={{
                                          backgroundColor:
                                            getReminderTypeStats()[
                                              item.reminderType
                                            ]?.color || "#6c757d",
                                          color: "white",
                                        }}
                                      >
                                        {item.reminderType}
                                      </span>
                                    </td>
                                    <td
                                      style={{ fontWeight: 500, color: "#000" }}
                                    >
                                      {item.lastAutoReminder
                                        ? moment(
                                            item.lastAutoReminder
                                          ).fromNow()
                                        : "Never"}
                                    </td>
                                    <td>
                                      <Button
                                        variant="primary"
                                        onClick={() =>
                                          sendIndividualReminder(item._id)
                                        }
                                        disabled={sendingIndividual.has(
                                          item._id
                                        )}
                                        label={`${sendingIndividual.has(item._id) ? "Sending..." : "Send Reminder"}`}
                                        icon={sendingIndividual.has(item._id) ? "/loading-spinner.svg" : "/paper-plane.svg"}
                                      >
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === "past" && (
              <>
                {/* Search Bar for Past Reminders */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="form-group">
                      <div className="input-group">
                        <div className="input-group-prepend">
                          <span className="input-group-text">
                            <i className="la la-search"></i>
                          </span>
                        </div>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search by email, name, job title, status..."
                          value={pastSearchQuery}
                          onChange={(e) => setPastSearchQuery(e.target.value)}
                          style={{ paddingLeft: "15px" }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 d-flex align-items-center">
                    <span className="text-muted">
                      {filteredPastData.length} of {pastRemindersData.length}{" "}
                      records
                    </span>
                  </div>
                </div>

                {/* Past Reminders Table */}
                <div className="row">
                  <div className="col">
                    <div className="card">
                      <div className="card-header">
                        <h3 className="mb-0">Past Reminders</h3>
                      </div>
                      <div className="card-body">
                        {isPastLoading ? (
                          <div className="text-center py-4">
                            <div className="spinner-border" role="status">
                              <span className="sr-only">Loading...</span>
                            </div>
                            <p className="mt-2">Loading data...</p>
                          </div>
                        ) : filteredPastData.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-muted">
                              No past reminders found
                            </p>
                          </div>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-hover">
                              <thead>
                                <tr>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Email
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Name
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Job Title
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Status
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Last Reminder
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Time Since
                                  </th>
                                  <th
                                    style={{ fontWeight: 500, color: "#000" }}
                                  >
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredPastData.map((item) => (
                                  <tr key={item._id}>
                                    <td
                                      style={{
                                        fontWeight: 500,
                                        color: "#000",
                                        cursor: "pointer",
                                      }}
                                      onClick={() =>
                                        copyToClipboard(item.email)
                                      }
                                      title="Click to copy email"
                                    >
                                      {item.email}
                                    </td>
                                    <td
                                      style={{
                                        fontWeight: 500,
                                        color: "#000",
                                        cursor: "pointer",
                                      }}
                                      onClick={() =>
                                        copyToClipboard(item.name || "")
                                      }
                                      title="Click to copy name"
                                    >
                                      {item.name || "-"}
                                    </td>
                                    <td
                                      style={{ fontWeight: 500, color: "#000" }}
                                    >
                                      {item.jobTitle}
                                    </td>
                                    <td>
                                      <span className="badge badge-warning">
                                        {item.status}
                                      </span>
                                    </td>
                                    <td
                                      style={{ fontWeight: 500, color: "#000" }}
                                    >
                                      {moment(item.lastAutoReminder).format(
                                        "MMM DD, YYYY HH:mm"
                                      )}
                                    </td>
                                    <td
                                      style={{ fontWeight: 500, color: "#000" }}
                                    >
                                      {item.timeSinceReminder}
                                    </td>
                                    <td>
                                      <div className="btn-group" role="group">
                                        <button
                                          className="btn btn-sm btn-outline-primary mr-2"
                                          onClick={() =>
                                            sendIndividualReminder(item._id)
                                          }
                                          disabled={sendingIndividual.has(
                                            item._id
                                          )}
                                          style={{ fontSize: "12px" }}
                                        >
                                          {sendingIndividual.has(item._id) ? (
                                            <>
                                              <span
                                                className="spinner-border spinner-border-sm mr-1"
                                                role="status"
                                                aria-hidden="true"
                                              ></span>
                                              Sending...
                                            </>
                                          ) : (
                                            "Send Again"
                                          )}
                                        </button>
                                        <button
                                          className="btn btn-sm btn-outline-info"
                                          onClick={() =>
                                            showInterviewDetails(item)
                                          }
                                          style={{ fontSize: "12px" }}
                                        >
                                          <i className="la la-expand"></i>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Interview Details Modal */}
      {showModal && selectedInterview && (
        <div
          className="modal fade show"
          style={{ display: "block" }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content" style={{ maxHeight: "90vh" }}>
              <div className="modal-header">
                <h5 className="modal-title">Interview Details</h5>
                <button type="button" className="close" onClick={closeModal}>
                  <span>&times;</span>
                </button>
              </div>
              <div
                className="modal-body"
                style={{ overflowY: "auto", maxHeight: "calc(90vh - 120px)" }}
              >
                <div className="d-flex flex-column" style={{ gap: "20px" }}>
                  {/* Basic Information Section */}
                  <div>
                    <h6
                      className="mb-3"
                      style={{ fontWeight: 600, color: "#333" }}
                    >
                      Basic Information
                    </h6>
                    <div className="d-flex flex-column" style={{ gap: "12px" }}>
                      <div className="d-flex justify-content-between align-items-start">
                        <span
                          style={{
                            fontWeight: 500,
                            minWidth: "120px",
                            color: "#666",
                          }}
                        >
                          Name:
                        </span>
                        <span style={{ flex: 1, wordBreak: "break-word" }}>
                          {selectedInterview.name || "N/A"}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-start">
                        <span
                          style={{
                            fontWeight: 500,
                            minWidth: "120px",
                            color: "#666",
                          }}
                        >
                          Email:
                        </span>
                        <span style={{ flex: 1, wordBreak: "break-all" }}>
                          {selectedInterview.email}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-start">
                        <span
                          style={{
                            fontWeight: 500,
                            minWidth: "120px",
                            color: "#666",
                          }}
                        >
                          Job Title:
                        </span>
                        <span style={{ flex: 1, wordBreak: "break-word" }}>
                          {selectedInterview.jobTitle}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-start">
                        <span
                          style={{
                            fontWeight: 500,
                            minWidth: "120px",
                            color: "#666",
                          }}
                        >
                          Status:
                        </span>
                        <span style={{ flex: 1 }}>
                          <span className="badge badge-warning">
                            {selectedInterview.status}
                          </span>
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-start">
                        <span
                          style={{
                            fontWeight: 500,
                            minWidth: "120px",
                            color: "#666",
                          }}
                        >
                          Last Reminder:
                        </span>
                        <span style={{ flex: 1, wordBreak: "break-word" }}>
                          {moment(selectedInterview.lastAutoReminder).format(
                            "MMM DD, YYYY HH:mm:ss"
                          )}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-start">
                        <span
                          style={{
                            fontWeight: 500,
                            minWidth: "120px",
                            color: "#666",
                          }}
                        >
                          Time Since:
                        </span>
                        <span style={{ flex: 1, wordBreak: "break-word" }}>
                          {selectedInterview.timeSinceReminder}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Additional Information Section */}
                  <div>
                    <h6
                      className="mb-3"
                      style={{ fontWeight: 600, color: "#333" }}
                    >
                      Additional Information
                    </h6>
                    <div className="d-flex flex-column" style={{ gap: "12px" }}>
                      {Object.entries(selectedInterview).map(([key, value]) => {
                        // Skip fields we already displayed
                        if (
                          [
                            "_id",
                            "name",
                            "email",
                            "jobTitle",
                            "status",
                            "lastAutoReminder",
                            "timeSinceReminder",
                            "daysSinceReminder",
                          ].includes(key)
                        ) {
                          return null;
                        }

                        // Skip functions and complex objects
                        if (
                          typeof value === "function" ||
                          (typeof value === "object" &&
                            value !== null &&
                            !Array.isArray(value))
                        ) {
                          return null;
                        }

                        const displayValue = Array.isArray(value)
                          ? value.join(", ")
                          : typeof value === "boolean"
                          ? value
                            ? "Yes"
                            : "No"
                          : String(value || "N/A");

                        return (
                          <div
                            key={key}
                            className="d-flex justify-content-between align-items-start"
                          >
                            <span
                              style={{
                                fontWeight: 500,
                                minWidth: "120px",
                                color: "#666",
                              }}
                            >
                              {key}:
                            </span>
                            <span style={{ flex: 1, wordBreak: "break-word" }}>
                              {displayValue}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Backdrop */}
      {showModal && (
        <div className="modal-backdrop fade show" onClick={closeModal}></div>
      )}
    </>
  );
}
