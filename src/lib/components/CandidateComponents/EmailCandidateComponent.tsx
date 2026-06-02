import React, { useState, useEffect } from "react";
import CandidateRichTextEditor from "./CandidateRichTextEditor";
import { errorToast, successToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import { useStageMapping } from "@/lib/utils/stageMapping";
import { useRouter } from "next/navigation";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/utils/emailTemplateDefaults";
import { Button } from "../ui";

interface EmailCandidateComponentProps {
  isDisabled?: boolean;
  emailContent?: {
    subject?: string;
    body?: string;
  };
  onEmailContentChange?: (content: { subject: string; body: string }) => void;
  endorseFrom?: string;
  endorseTo?: string;
  onEndorseFromChange?: (value: string) => void;
  onEndorseToChange?: (value: string) => void;
  onActionChange?: (value: string) => void;
  // External data for dynamic content
  candidate?: any;
  interviewDate?: string;
  action?: string;
  // New stage information for proper endorseTo calculation
  newStageName?: string;
  newSubstageName?: string;
  // Selected careers for invite action
  selectedCareers?: any[];
}

export default function EmailCandidateComponent({
  isDisabled = false,
  emailContent = {
    subject: "Application: [Candidate Name] - [Job Title] @ [Company Name]",
    body: `Hi [Candidate Name],

Great news! You have been shortlisted for the role [Job Title].

Please take the AI interview by [Interview Date].

Reminders:
• The interview will take around 30 minutes, which widely varies based on the length of your answers.
• The interview recording will be reviewed by a human recruiter.
• Please ensure you have a stable internet connection and a quiet environment.`,
  },
  onEmailContentChange,
  endorseFrom = "CV Screening: For Review",
  endorseTo = "AI Interview: Waiting Interview",
  onEndorseFromChange,
  onEndorseToChange,
  onActionChange,
  candidate,
  interviewDate = "August 2, 2025",
  action = "endorse",
  newStageName,
  newSubstageName,
  selectedCareers,
}: EmailCandidateComponentProps) {
  // Resolve stage display name with alias fallback
  const resolveStageDisplayName = (
    stageName?: string,
    stageId?: string,
    pipelineStages?: any[]
  ) => {
    if (!pipelineStages || pipelineStages.length === 0) return stageName;
    const stage = pipelineStages.find(
      (s) => (stageId && s.id === stageId) || (stageName && s.name === stageName)
    );
    return stage?.alias || stage?.name || stageName;
  };

  // Resolve substage display name (no alias concept for substages today)
  const resolveSubstageDisplayName = (
    substageName?: string,
    substageId?: string,
    stageId?: string,
    pipelineStages?: any[]
  ) => {
    if (!pipelineStages || pipelineStages.length === 0) return substageName;
    const stage = pipelineStages.find((s) => (stageId && s.id === stageId) || !stageId);
    const substage = stage?.substages?.find(
      (sub: any) => (substageId && sub.id === substageId) || (substageName && sub.name === substageName)
    );
    return substage?.name || substageName;
  };

  // Generate stage mapping using the candidate data
  const stageMapping = useStageMapping(candidate);

  // Use the generated stage mapping values, fallback to props if not available
  const finalEndorseFrom = stageMapping.endorseFrom || endorseFrom;

  // Use new stage information if provided (from drag operation), otherwise use stage mapping
  const finalEndorseTo =
    newStageName && newSubstageName
      ? `${resolveStageDisplayName(newStageName, candidate?.toStageId, candidate?.pipelineStages)}: ${resolveSubstageDisplayName(
          newSubstageName,
          candidate?.toSubstageId,
          candidate?.toStageId,
          candidate?.pipelineStages
        )}`
      : stageMapping.endorseTo || endorseTo;

  // Debug logging for new stage information
  console.log("EmailCandidateComponent - New Stage Info Debug:", {
    candidate: candidate?.name || "No candidate",
    newStageName,
    newSubstageName,
    finalEndorseTo,
    stageMappingEndorseTo: stageMapping.endorseTo,
    candidateToStage: candidate?.toStage,
    candidateToSubstage: candidate?.toSubstage,
  });

  // Track stage step change when component renders or candidate changes
  useEffect(() => {
    // Stage step change tracking logic can be added here if needed
  }, [stageMapping.stageStepChange, candidate]);

  // Watch for changes in candidate stage data and trigger template refetch
  useEffect(() => {
    // Reset template selection when candidate stage data changes (candidate moved to new stage)
    setSelectedTemplate(null);
    // For invite action, use "default" template type; otherwise use "system"
    setSelectedTemplateType(action === "invite" ? "default" : "system");
    fetchTemplates(finalEndorseTo, action);
  }, [
    candidate?.stageId,
    candidate?.substageId,
    finalEndorseTo,
    newStageName,
    newSubstageName,
    action,
  ]);

  // Fetch templates when component mounts or when endorseTo/action changes
  useEffect(() => {
    fetchTemplates(finalEndorseTo, action);
  }, [finalEndorseTo, action]);

  // Load sender mode preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSenderMode = localStorage.getItem("emailSenderMode");
      if (
        savedSenderMode &&
        (savedSenderMode === "jia-automated" ||
          savedSenderMode === "personal-gmail")
      ) {
        setSenderMode(savedSenderMode);
        console.log("Sender mode preference loaded:", savedSenderMode);
      } else {
        // Default to jia-automated if no preference found
        setSenderMode("jia-automated");
        console.log(
          "No sender mode preference found, using default: jia-automated"
        );
      }
    }
  }, []);

  // Load template preference from localStorage (skip for invite action - always use default)
  useEffect(() => {
    // Skip preference loading for invite action - always use default template
    if (action === "invite") {
      return;
    }

    if (typeof window !== "undefined") {
      const preferenceKey = `emailTemplatePreference_${finalEndorseTo}_${action}`;
      const savedPreference = localStorage.getItem(preferenceKey);
      if (savedPreference) {
        try {
          const preference = JSON.parse(savedPreference);

          // Restore template type preference
          if (preference.templateType) {
            setSelectedTemplateType(preference.templateType);

            // Update template source based on saved preference
            const templateSource =
              preference.templateType === "system"
                ? "System Template"
                : preference.templateType === "global"
                ? "Global Template"
                : "User Template";
            setCurrentTemplateSource(templateSource);

            console.log(
              `Template type preference loaded for ${finalEndorseTo} - ${action}:`,
              {
                templateType: preference.templateType,
                lastUpdated: preference.lastUpdated,
              }
            );
          }

          // Restore selected template if available
          if (preference.template) {
            setSelectedTemplate(preference.template);
          }
        } catch (e) {
          console.error("Error parsing template preference:", e);
        }
      } else {
        // No saved preference found, reset to defaults
        console.log(
          `No template preference found for ${finalEndorseTo} - ${action}, using defaults`
        );
      }
    }
  }, [finalEndorseTo, action]);

  // Extract candidate properties
  const candidateName = candidate?.name || "Hector";
  const candidateEmail = candidate?.email || "hector@jia.com";
  const jobTitle = candidate?.jobTitle || "10x Developer";

  const [isAutomationEnabled, setIsAutomationEnabled] = useState(true);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [senderMode, setSenderMode] = useState("jia-automated");

  // Template selection state
  const [availableTemplates, setAvailableTemplates] = useState({
    system: [],
    global: [],
    user: [],
  });
  const [selectedTemplateType, setSelectedTemplateType] = useState(
    action === "invite" ? "default" : "system"
  );
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [currentTemplateSource, setCurrentTemplateSource] = useState(
    action === "invite" ? "Invite Template (Default)" : "System Template"
  );

  const router = useRouter();

  // Function to get organization and user data
  const getOrgAndUserData = () => {
    let orgID = null;
    let userEmail = null;

    if (typeof window !== "undefined") {
      try {
        const activeOrg = localStorage.getItem("activeOrg");
        if (activeOrg) {
          const parsedOrg = JSON.parse(activeOrg);
          orgID = parsedOrg._id;
        }

        const user = localStorage.getItem("user");
        if (user) {
          const parsedUser = JSON.parse(user);
          userEmail = parsedUser.email;
        }
      } catch (e) {
        console.error("Error parsing localStorage data:", e);
      }
    }

    return { orgID, userEmail };
  };

  // Function to fetch templates from API
  const fetchTemplates = async (
    endorseToValue?: string,
    actionValue?: string
  ) => {
    setIsLoadingTemplates(true);
    try {
      // Check if authToken is available
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        console.error("No authToken found in localStorage");
        errorToast(
          "Authentication token not found. Please log in again.",
          3000
        );
        setIsLoadingTemplates(false);
        return;
      }

      const { orgID, userEmail } = getOrgAndUserData();

      // Use the provided values or fall back to current values
      const currentEndorseTo = endorseToValue || finalEndorseTo;
      // For invite action, fetch "endorse" templates since invite reuses those
      const currentAction = action === "invite" ? "endorse" : (actionValue || action);

      const params = new URLSearchParams({
        endorseTo: currentEndorseTo,
        action: currentAction,
      });

      if (orgID) params.append("orgID", orgID);
      if (userEmail) params.append("userEmail", userEmail);

      console.log("Fetching templates with params:", {
        endorseTo: currentEndorseTo,
        action: currentAction,
        orgID: !!orgID,
        userEmail: !!userEmail,
      });

      const response = await api.get(
        `/api/email-module/templates/find?${params.toString()}`
      );
      const result = await response.data;

      if (result.success) {
        console.log("Templates fetched successfully:", result.data);
        setAvailableTemplates(result.data);

        // Auto-select template based on saved preference or first available
        let autoSelectedType = selectedTemplateType;
        let autoSelectedTemplate = selectedTemplate;
        let templateSource = "Fallback Template";

        // Check if there's a saved preference for this stage/action combination
        let savedPreference = null;
        if (typeof window !== "undefined") {
          const preferenceKey = `emailTemplatePreference_${currentEndorseTo}_${currentAction}`;
          const savedPreferenceStr = localStorage.getItem(preferenceKey);
          if (savedPreferenceStr) {
            try {
              savedPreference = JSON.parse(savedPreferenceStr);
            } catch (e) {
              console.error(
                "Error parsing saved preference in fetchTemplates:",
                e
              );
            }
          }
        }

        // If there's a saved preference and templates are available for that type, use it
        if (savedPreference?.templateType) {
          const templatesForSavedType =
            result.data[savedPreference.templateType] || [];
          if (templatesForSavedType.length > 0) {
            autoSelectedType = savedPreference.templateType;
            autoSelectedTemplate =
              savedPreference.template || templatesForSavedType[0];
            templateSource =
              savedPreference.templateType === "system"
                ? "System Template"
                : savedPreference.templateType === "global"
                ? "Global Template"
                : "User Template";
          }
        }

        // If no saved preference or saved type has no templates, find the first available type
        if (!autoSelectedTemplate) {
          const templateTypes = ["system", "global", "user"];
          for (const type of templateTypes) {
            const templatesForType = result.data[type] || [];
            if (templatesForType.length > 0) {
              autoSelectedType = type;
              autoSelectedTemplate = templatesForType[0];
              templateSource =
                type === "system"
                  ? "System Template"
                  : type === "global"
                  ? "Global Template"
                  : "User Template";
              break;
            }
          }
        }

        // Update states if we found templates
        // For invite action, don't auto-select - keep using "default" template type
        if (autoSelectedTemplate && action !== "invite") {
          setSelectedTemplateType(autoSelectedType);
          setSelectedTemplate(autoSelectedTemplate);
          setCurrentTemplateSource(templateSource);

          // Parse and update email content
          const parsedContent = {
            subject: parseDynamicVariables(autoSelectedTemplate.subject),
            body: parseDynamicVariables(
              autoSelectedTemplate.messageContent ||
                autoSelectedTemplate.fullMessage ||
                ""
            ),
          };
          setCurrentEmailContent(parsedContent);
          onEmailContentChange?.(parsedContent);
        } else if (action !== "invite") {
          // No templates found, use fallback (not for invite action)
          setCurrentTemplateSource("Fallback Template");
        }
      } else {
        console.error("Failed to fetch templates:", result.message);
        // Keep empty state, will fall back to hardcoded templates
        setCurrentTemplateSource("Fallback Template");
      }
    } catch (error) {
      console.error("Error fetching templates:", error);

      // Check if it's an authentication error
      if (error.response?.status === 401) {
        errorToast("Authentication failed. Please log in again.", 3000);
      } else if (error.response?.status === 403) {
        errorToast("You don't have permission to view templates.", 3000);
      } else if (error.response?.data?.message) {
        errorToast(error.response.data.message, 3000);
      } else {
        console.log("Falling back to hardcoded templates due to API error");
      }
      // Keep empty state, will fall back to hardcoded templates
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Function to parse dynamic variables in template content
  const parseDynamicVariables = (templateContent: string) => {
    if (!templateContent) return "";

    // Get dynamic values
    let companyName = "";
    if (typeof window !== "undefined" && localStorage.activeOrg) {
      try {
        const activeOrg = JSON.parse(localStorage.activeOrg);
        companyName = activeOrg?.name || "";
      } catch (e) {
        companyName = "";
      }
    }

    const candidateFirstName = candidateName?.split(" ")[0] || candidateName;

    // Generate job titles list for invite action
    const jobTitlesList =
      selectedCareers && selectedCareers.length > 0
        ? `<ul style="margin: 10px 0; padding-left: 20px;">${selectedCareers.map((c) => `<li>${c.jobTitle}</li>`).join("")}</ul>`
        : "";

    // Variable mapping
    const variableMap: { [key: string]: string } = {
      "Job Title": jobTitle,
      "Company Name": companyName,
      "Employer Company Name": companyName,
      "Candidate First Name": candidateFirstName,
      "Candidate Full Name": candidateName,
      "Candidate Name": candidateName,
      "JIA Job Portal Link": "https://www.hellojia.ai/dashboard",
      "Job Titles List": jobTitlesList,
    };

    let parsed = templateContent;

    // STEP 1: Replace HTML span tokens (for body content)
    // Match: <span ... data-token="[[Variable]]">...</span>
    // Replace with: actual value (no HTML)
    parsed = parsed.replace(
      /<span[^>]*data-token="\[\[([^\]]+)\]\]"[^>]*>.*?<\/span>/g,
      (match, variableName) => variableMap[variableName] || match
    );

    // STEP 2: Decode HTML entities
    parsed = parsed
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#91;/g, "[")
      .replace(/&#93;/g, "]")
      .replace(/&nbsp;/g, " ");

    // STEP 3: Replace plain [[Variable]] patterns (for subjects)
    Object.entries(variableMap).forEach(([varName, value]) => {
      const pattern = new RegExp(`\\[\\[${varName}\\]\\]`, "g");
      parsed = parsed.replace(pattern, value);
    });

    return parsed;
  };

  // Function to replace placeholders with actual values
  const replacePlaceholders = (text: string) => {
    return text
      .replace(/\[Candidate Name\]/g, candidateName)
      .replace(/\[Job Title\]/g, jobTitle)
      .replace(/\[Interview Date\]/g, interviewDate);
  };

  // Function to highlight dynamic values in blue
  const highlightDynamicValues = (text: string) => {
    if (!text) return "";

    let highlightedText = text;

    // Get company name for highlighting
    let companyName = "";
    if (typeof window !== "undefined" && localStorage.activeOrg) {
      try {
        const activeOrg = JSON.parse(localStorage.activeOrg);
        companyName = activeOrg?.name || "";
      } catch (e) {
        companyName = "";
      }
    }

    const candidateFirstName = candidateName?.split(" ")[0] || candidateName;

    // Highlight all dynamic variables
    const variables = [
      { value: candidateName, color: "#007bff" },
      { value: candidateFirstName, color: "#007bff" },
      { value: jobTitle, color: "#007bff" },
      { value: companyName, color: "#007bff" },
      { value: interviewDate, color: "#007bff" },
      { value: "https://www.hellojia.ai/dashboard", color: "#007bff" },
    ];

    variables.forEach(({ value, color }) => {
      if (value) {
        const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        highlightedText = highlightedText.replace(
          new RegExp(escapedValue, "g"),
          `<span style="color: ${color};">${value}</span>`
        );
      }
    });

    return highlightedText;
  };

  // Function to map endorseTo values to template keys
  const mapEndorseToTemplate = (endorseToValue: string): string => {
    // Extract stage name from "Stage: Substage" format
    const stageName = endorseToValue.split(":")[0]?.trim() || endorseToValue;

    const mapping: { [key: string]: string } = {
      "CV Screening": "CV Screening",
      "AI Interview": "AI Interview",
      "Human Interview": "Human Review",
      "Job Offer": "Job Offer",
      // Handle legacy values that might still be used
      "Pending AI Interview": "AI Interview",
      "AI Interview Review": "Human Review",
      "For Human Interview": "Human Review",
      "Pending Job Interview": "Job Offer",
      "Job Offered": "Job Offer",
    };

    return mapping[stageName] || "AI Interview";
  };

  // Function to generate dynamic email content based on endorseTo and action
  const generateEmailTemplate = (
    endorseToValue: string,
    actionValue: string = "endorse"
  ) => {
    let companyName = "";
    if (typeof window !== "undefined" && localStorage.activeOrg) {
      try {
        const activeOrg = JSON.parse(localStorage.activeOrg);
        companyName = activeOrg?.name || "";
      } catch (e) {
        companyName = "";
      }
    }

    // Unified subject line for all stages - standardized format for thread management
    const unifiedSubject = `Application: ${candidateName} - ${jobTitle} @ ${companyName}`;

    const templates = {
      "CV Screening": {
        endorse: {
          subject: unifiedSubject,
          body: `<p>Hi ${candidateName},</p>

<p>Thank you for your interest in the ${jobTitle} position at ${companyName}.</p>

<p>Your application is currently in the <strong>CV Screening</strong> stage and is being processed by our recruitment team. We will review your qualifications and experience to determine the next steps in your application.</p>

<p>We will notify you once the screening process is complete. Thank you for your patience.</p>

<p>Best Regards,<br>
${companyName} Recruitment Team</p>`,
        },
        drop: {
          subject: unifiedSubject,
          body: `<p>Hi ${candidateName},</p>

<p>Thank you for your interest in the ${jobTitle} position at ${companyName}.</p>

<p>After careful review of your application, we have decided not to move forward with your candidacy at this time. We appreciate the time and effort you put into your application.</p>

<p>We encourage you to apply for other positions that may be a better fit for your skills and experience.</p>

<p>Best Regards,<br>
${companyName} Recruitment Team</p>`,
        },
      },
      "AI Interview": {
        endorse: {
          subject: unifiedSubject,
          body: `<p>Hi ${candidateName},</p>

<p>Great news! Your application for the ${jobTitle} position at ${companyName} has progressed to the <strong>AI Interview</strong> stage.</p>

<p>You are now invited to complete an AI-powered interview. Please complete this interview by ${interviewDate}.</p>

<p><strong>Interview Details:</strong></p>
<ul style="padding-left: 20px; margin: 0;">
<li>Duration: Approximately 30 minutes</li>
<li>Format: Video interview with AI questions</li>
<li>Environment: Please ensure a quiet, distraction-free space</li>
<li>Technical: Stable internet connection and working camera/microphone required</li>
</ul>

<p>You can access your interview through the <a href="https://www.hellojia.ai/dashboard" target="_blank" rel="noopener noreferrer">Jia Job Portal</a>.</p>

<p>Best Regards,<br>
${companyName} Recruitment Team</p>`,
        },
        drop: {
          subject: unifiedSubject,
          body: `<p>Hi ${candidateName},</p>

<p>Thank you for your interest in the ${jobTitle} position at ${companyName}.</p>

<p>After careful review of your application, we have decided not to move forward with your candidacy at this time. We appreciate the time and effort you put into your application.</p>

<p>We encourage you to apply for other positions that may be a better fit for your skills and experience.</p>

<p>Best Regards,<br>
${companyName} Recruitment Team</p>`,
        },
      },
      "Human Review": {
        endorse: {
          subject: unifiedSubject,
          body: `<p>Hi ${candidateName},</p>

<p>Your application for the ${jobTitle} position at ${companyName} has progressed to the <strong>Human Review</strong> stage.</p>

<p>Your interview responses are now being reviewed by our human recruitment team. This process typically takes 3-5 business days.</p>

<p>We will contact you with the next steps once the review is complete. Thank you for your patience.</p>

<p>Best Regards,<br>
${companyName} Recruitment Team</p>`,
        },
        drop: {
          subject: unifiedSubject,
          body: `<p>Hi ${candidateName},</p>

<p>Thank you for your interest in the ${jobTitle} position at ${companyName}.</p>

<p>After careful review of your application and interview responses, we have decided not to move forward with your candidacy at this time. We appreciate the time and effort you put into your application.</p>

<p>We encourage you to apply for other positions that may be a better fit for your skills and experience.</p>

<p>Best Regards,<br>
${companyName} Recruitment Team</p>`,
        },
      },
      "Job Offer": {
        endorse: {
          subject: unifiedSubject,
          body: `<p>Hi ${candidateName},</p>

<p>Congratulations! Your application for the ${jobTitle} position at ${companyName} has progressed to the <strong>Job Offer</strong> stage.</p>

<p>We are pleased to inform you that we would like to extend a job offer. Our HR team will contact you shortly with the formal offer details and next steps.</p>

<p>We look forward to welcoming you to the ${companyName} team!</p>

<p>Best Regards,<br>
${companyName} Recruitment Team</p>`,
        },
        drop: {
          subject: unifiedSubject,
          body: `<p>Hi ${candidateName},</p>

<p>Thank you for your interest in the ${jobTitle} position at ${companyName}.</p>

<p>After careful consideration, we have decided not to move forward with your candidacy at this time. We appreciate the time and effort you put into your application.</p>

<p>We encourage you to apply for other positions that may be a better fit for your skills and experience.</p>

<p>Best Regards,<br>
${companyName} Recruitment Team</p>`,
        },
      },
    };

    // Map the endorseTo value to the correct template key
    const templateKey = mapEndorseToTemplate(endorseToValue);
    const stageTemplate = templates[templateKey] || templates["AI Interview"];
    return stageTemplate[actionValue] || stageTemplate["endorse"];
  };

  // Function to get current template content
  const getCurrentTemplateContent = () => {
    // Handle invite action with "default" template type - use default template from constants
    if (action === "invite" && selectedTemplateType === "default") {
      const inviteTemplate = DEFAULT_EMAIL_TEMPLATES.invite;
      setCurrentTemplateSource("Invite Template (Default)");
      return {
        subject: parseDynamicVariables(inviteTemplate.subject),
        body: parseDynamicVariables(inviteTemplate.body),
      };
    }

    if (selectedTemplate) {
      return {
        subject: parseDynamicVariables(selectedTemplate.subject),
        body: parseDynamicVariables(
          selectedTemplate.messageContent || selectedTemplate.fullMessage || ""
        ),
      };
    }

    // For invite action without selected template, fall back to default template
    if (action === "invite") {
      const inviteTemplate = DEFAULT_EMAIL_TEMPLATES.invite;
      setCurrentTemplateSource("Invite Template (Default)");
      return {
        subject: parseDynamicVariables(inviteTemplate.subject),
        body: parseDynamicVariables(inviteTemplate.body),
      };
    }

    // Fallback to hardcoded template for endorse/drop actions
    setCurrentTemplateSource("Fallback Template");
    const template = generateEmailTemplate(finalEndorseTo, action);
    return {
      subject: template.subject,
      body: template.body,
    };
  };

  const [currentEmailContent, setCurrentEmailContent] = useState(() => {
    return getCurrentTemplateContent();
  });

  // Update email content when endorseTo, action, or selected template changes
  useEffect(() => {
    const newContent = getCurrentTemplateContent();
    setCurrentEmailContent(newContent);
    onEmailContentChange?.(newContent);
  }, [
    finalEndorseTo,
    action,
    selectedTemplate,
    selectedTemplateType,
    candidateName,
    jobTitle,
    interviewDate,
  ]);

  // Template selection handlers
  const handleTemplateTypeChange = (templateType: string) => {
    setSelectedTemplateType(templateType);

    // Handle "default" template type for invite action
    if (templateType === "default" && action === "invite") {
      setSelectedTemplate(null);
      const inviteTemplate = DEFAULT_EMAIL_TEMPLATES.invite;
      setCurrentTemplateSource("Invite Template (Default)");
      const parsedContent = {
        subject: parseDynamicVariables(inviteTemplate.subject),
        body: parseDynamicVariables(inviteTemplate.body),
      };
      setCurrentEmailContent(parsedContent);
      onEmailContentChange?.(parsedContent);
      return;
    }

    // Auto-select first template from the newly selected type
    const templatesForType = availableTemplates[templateType] || [];
    let selectedTemplate = null;

    if (templatesForType.length > 0) {
      // Auto-select first template
      selectedTemplate = templatesForType[0];
      setSelectedTemplate(selectedTemplate);

      // Update template source
      const templateSource =
        templateType === "system"
          ? "System Template"
          : templateType === "global"
          ? "Global Template"
          : "User Template";
      setCurrentTemplateSource(templateSource);

      // Parse and update email content
      const parsedContent = {
        subject: parseDynamicVariables(selectedTemplate.subject),
        body: parseDynamicVariables(
          selectedTemplate.messageContent || selectedTemplate.fullMessage || ""
        ),
      };
      setCurrentEmailContent(parsedContent);
      onEmailContentChange?.(parsedContent);
    } else {
      setSelectedTemplate(null);
      // For invite action with no templates, fall back to default invite template
      if (action === "invite") {
        const inviteTemplate = DEFAULT_EMAIL_TEMPLATES.invite;
        setCurrentTemplateSource("Invite Template (Default)");
        const parsedContent = {
          subject: parseDynamicVariables(inviteTemplate.subject),
          body: parseDynamicVariables(inviteTemplate.body),
        };
        setCurrentEmailContent(parsedContent);
        onEmailContentChange?.(parsedContent);
      } else {
        setCurrentTemplateSource("Fallback Template");
      errorToast(
        `No ${
          templateType === "user" ? "personal" : templateType
        } templates found for this stage. Please create one first.`,
        3000
      );
        // If no templates available for this type, refetch to ensure we have the latest data
        fetchTemplates(finalEndorseTo, action);
      }
    }

    // Save template type preference to localStorage for this specific stage/substage/action combination
    if (typeof window !== "undefined") {
      const preferenceKey = `emailTemplatePreference_${finalEndorseTo}_${action}`;
      const existingPreference = localStorage.getItem(preferenceKey);
      let preference = {};

      // Parse existing preference if it exists
      if (existingPreference) {
        try {
          preference = JSON.parse(existingPreference);
        } catch (e) {
          console.error("Error parsing existing template preference:", e);
          preference = {};
        }
      }

      // Update preference with new template type and selected template
      const updatedPreference = {
        ...preference,
        templateType,
        template: selectedTemplate,
        lastUpdated: new Date().toISOString(),
      };

      localStorage.setItem(preferenceKey, JSON.stringify(updatedPreference));

      console.log(
        `Template type preference saved for ${finalEndorseTo} - ${action}:`,
        {
          templateType,
          templateId: selectedTemplate?._id || null,
          templateName: selectedTemplate?.name || null,
        }
      );
    }
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);

    // Save template selection preference to localStorage for this specific stage/substage/action combination
    if (typeof window !== "undefined") {
      const preferenceKey = `emailTemplatePreference_${finalEndorseTo}_${action}`;
      const existingPreference = localStorage.getItem(preferenceKey);
      let preference = {};

      // Parse existing preference if it exists
      if (existingPreference) {
        try {
          preference = JSON.parse(existingPreference);
        } catch (e) {
          console.error("Error parsing existing template preference:", e);
          preference = {};
        }
      }

      // Update preference with selected template
      const updatedPreference = {
        ...preference,
        templateType: selectedTemplateType,
        template: template,
        lastUpdated: new Date().toISOString(),
      };

      localStorage.setItem(preferenceKey, JSON.stringify(updatedPreference));

      console.log(
        `Template selection preference saved for ${finalEndorseTo} - ${action}:`,
        {
          templateType: selectedTemplateType,
          templateId: template?._id || null,
          templateName: template?.name || null,
        }
      );
    }
  };

  const handleCreateNewTemplate = () => {
    router.push("/recruiter-dashboard/email-templates");
  };

  const handleEmailContentChange = (
    field: "subject" | "body",
    value: string
  ) => {
    const updatedContent = {
      ...currentEmailContent,
      [field]: value,
    };
    setCurrentEmailContent(updatedContent);
    onEmailContentChange?.(updatedContent);
  };

  const toggleAutomation = () => {
    if (!isDisabled) {
      setIsAutomationEnabled(!isAutomationEnabled);
    }
  };

  const toggleEmailEditing = () => {
    if (!isDisabled) {
      setIsEditingEmail(!isEditingEmail);
    }
  };

  const handleSenderModeChange = (mode: string) => {
    if (!isDisabled) {
      setSenderMode(mode);

      // Save preference to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("emailSenderMode", mode);
        console.log("Sender mode preference saved:", mode);
      }
    }
  };

  // Function to build email automation JSON
  const buildEmailAutomationData = () => {
    if (!isAutomationEnabled) {
      return;
    }

    const emailAutomation = {
      to: candidateEmail,
      subject: currentEmailContent.subject,
      message: currentEmailContent.body,
    };

    return emailAutomation;
  };

  const sendEmailAutomation = async () => {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
      console.error("No authToken found in localStorage");
      errorToast("Authentication token not found. Please log in again.", 3000);
      return;
    }

    const emailAutomation = buildEmailAutomationData();
    if (!emailAutomation) {
      errorToast("Email automation data is not available", 3000);
      return;
    }

    try {
      if (senderMode === "jia-automated") {
        // Send via JIA automated email
        const response = await api.post(
          "/api/automations/send-email-reminder",
          {
            to: emailAutomation.to,
            subject: emailAutomation.subject,
            message: emailAutomation.message,
            _id: candidate?._id,
            careerId: candidate?.id || null,
          }
        );

        if (response.data?.success) {
          successToast(
            "Email sent successfully via JIA automated system",
            "bottom-center"
          );
        } else {
          errorToast(response.data?.error || "Failed to send email", 3000);
        }
      } else if (senderMode === "personal-gmail") {
        // Send via personal Gmail
        const { orgID, userEmail } = getOrgAndUserData();

        if (!userEmail) {
          errorToast("User email not found. Please log in again.", 3000);
          return;
        }

        if (!orgID) {
          errorToast("Organization ID not found. Please refresh the page.", 3000);
          return;
        }

        const response = await api.post("/api/email-module/gm-send-email", {
          orgID,
          fromEmail: userEmail,
          toEmail: emailAutomation.to,
          subject: emailAutomation.subject,
          message: emailAutomation.message,
        });

        if (response.data?.success) {
          successToast(
            "Email sent successfully via your Gmail account",
            "bottom-center"
          );
        } else {
          errorToast(response.data?.error || "Failed to send email", 3000);
        }
      }
    } catch (error) {
      console.error("Error sending email automation:", error);

      // Check if it's an authentication error
      if (error.response?.status === 401) {
        errorToast("Authentication failed. Please log in again.", 3000);
      } else if (error.response?.status === 403) {
        errorToast("You don't have permission to send emails.", 3000);
      } else if (error.response?.data?.error) {
        // Handle Gmail-specific errors
        const errorMessage = error.response.data.error;
        if (senderMode === "personal-gmail") {
          if (errorMessage.includes("No Gmail token found")) {
            errorToast(
              "Gmail account not connected. Please connect your Gmail account in settings.",
              3000
            );
          } else if (errorMessage.includes("Failed to refresh access token")) {
            errorToast(
              "Gmail authentication expired. Please reconnect your account.",
              3000
            );
          } else {
            errorToast(errorMessage, 3000);
          }
        } else {
          errorToast(errorMessage, 3000);
        }
      } else {
        errorToast("Failed to send email. Please try again.", 3000);
      }
    }
  };

  return (
    <div className="card" style={{ margin: 0, border: "none" }}>
      <div
        className="card-body"
        style={{
          padding: isAutomationEnabled ? "0px 20px 20px 20px" : "0px 20px",
        }}
      >
        {/* Header Section */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4
            className="mb-0"
            style={{
              fontWeight: "600",
              color: "#333",
              fontSize: "18px",
            }}
          >
            Automation
          </h4>
          <div className="d-flex align-items-center">
            <button
              type="button"
              onClick={toggleAutomation}
              disabled={isDisabled}
              style={{
                background: "none",
                border: "none",
                cursor: isDisabled ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
            >
              <i
                className={`la ${
                  isAutomationEnabled
                    ? "la-toggle-on jia-gradient-text"
                    : "la-toggle-off"
                }`}
                style={{
                  fontSize: "30px",
                  color: isAutomationEnabled ? "" : "#6c757d",
                }}
              ></i>

              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  position: "relative",
                  top: "-1px",
                }}
              >
                Send Email Automation
              </span>
            </button>
          </div>
        </div>

        {/* Sender Mode Selection Section - Only show if automation is enabled */}
        {isAutomationEnabled && (
          <>
            {/* Sender Mode Selection */}
            <div
              className="mb-3 p-2"
              style={{
                borderRadius: "8px",
                backgroundColor: "#f8f9fa",
                border: "1px solid #e9ecef",
              }}
            >
              <div className="row">
                <div className="col-12">
                  <label
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#333",
                      marginBottom: "8px",
                      display: "block",
                    }}
                  >
                    Email Sender
                  </label>
                  <select
                    className="form-control"
                    value={senderMode}
                    onChange={(e) => handleSenderModeChange(e.target.value)}
                    disabled={isDisabled}
                    style={{ fontSize: "13px" }}
                  >
                    <option value="jia-automated">noreply@hellojia.ai</option>
                    <option value="personal-gmail">
                      {getOrgAndUserData().userEmail || "Work Email (Gmail)"}
                    </option>
                  </select>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#6c757d",
                      marginTop: "4px",
                    }}
                  >
                    {senderMode === "jia-automated"
                      ? "Email will be sent from JIA no-reply address"
                      : "Email will be sent from your connected work Gmail account"}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Template Selection Section - Only show if automation is enabled */}
        {isAutomationEnabled && (
          <>
            {/* Template Selection */}
            <div
              className="mb-2 p-2"
              style={{
                borderRadius: "8px",
              }}
            >
              <div className="row">
                {/* Template Type - Full width on mobile */}
                <div className="col-12 mb-3">
                  <label
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#333",
                      marginBottom: "8px",
                      display: "block",
                    }}
                  >
                    Template Type
                  </label>
                  <div className="d-flex flex-wrap gap-2">
                    {(action === "invite" ? ["default", "system", "global", "user"] : ["system", "global", "user"]).map((type) => (
                      <label
                        key={type}
                        className="d-flex align-items-center"
                        style={{
                          fontSize: "13px",
                          cursor: "pointer",
                          marginRight: "12px",
                        }}
                      >
                        <input
                          type="radio"
                          name="templateType"
                          value={type}
                          checked={selectedTemplateType === type}
                          onChange={(e) =>
                            handleTemplateTypeChange(e.target.value)
                          }
                          disabled={isDisabled}
                          style={{ marginRight: "6px" }}
                        />
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Hide template dropdown and create button when "default" is selected for invite action */}
                {selectedTemplateType !== "default" && (
                  <>
                    {/* Template Dropdown - 8 cols on desktop, full on mobile */}
                    <div className="col-12 col-md-8 mb-3 mb-md-0">
                      <select
                        className="form-control"
                        value={selectedTemplate?._id || ""}
                        onChange={(e) => {
                          const templateId = e.target.value;
                          const templates =
                            availableTemplates[selectedTemplateType] || [];
                          const template = templates.find(
                            (t) => t._id === templateId
                          );
                          handleTemplateSelect(template);
                        }}
                        disabled={isDisabled || isLoadingTemplates}
                        style={{ fontSize: "13px" }}
                      >
                        <option value="">
                          {isLoadingTemplates
                            ? "Loading templates..."
                            : "Select a template"}
                        </option>
                        {(availableTemplates[selectedTemplateType] || []).map(
                          (template) => (
                            <option key={template._id} value={template._id}>
                              {template.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {/* Create Button - 4 cols on desktop, full on mobile */}
                    <div className="col-12 col-md-4">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleCreateNewTemplate}
                        disabled={isDisabled}
                        label="New Template"
                        icon="/plus-black.svg"
                      >
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Template Source Notice */}
            <div className="mb-3">
              <div
                style={{
                  fontSize: "12px",
                  color: "#6c757d",
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #e9ecef",
                  borderRadius: "4px",
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <i
                  className="la la-info-circle"
                  style={{ fontSize: "14px" }}
                ></i>
                <span>
                  Currently showing: <strong>{currentTemplateSource}</strong>
                </span>
              </div>
            </div>
          </>
        )}

        {/* Email Preview Section - Only show if automation is enabled */}
        {isAutomationEnabled && (
          <>
            {/* Workflow Stages Row */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              {/* Show Endorse From/To for non-invite actions */}
              {action !== "invite" && (
                <>
                  {/* Endorse From */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6c757d",
                        marginBottom: "4px",
                        textAlign: "left",
                      }}
                    >
                      Endorse from
                    </div>
                    <div
                      style={{ fontSize: "14px", color: "#333", fontWeight: "500" }}
                    >
                      {finalEndorseFrom}
                    </div>
                  </div>

                  {/* Endorse To */}
                  <div style={{ flex: 1, marginLeft: "24px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6c757d",
                        marginBottom: "4px",
                        textAlign: "left",
                      }}
                    >
                      Endorse to
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#333",
                        fontWeight: "500",
                        textAlign: "left",
                      }}
                    >
                      {finalEndorseTo}
                    </div>
                  </div>
                </>
              )}

              {/* Show Invite To for invite action */}
              {action === "invite" && selectedCareers && selectedCareers.length > 0 && (
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6c757d",
                      marginBottom: "4px",
                      textAlign: "left",
                    }}
                  >
                    Invite to
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#333",
                      fontWeight: "500",
                      textAlign: "left",
                    }}
                  >
                    {selectedCareers.map((c) => c.jobTitle).join(", ")}
                  </div>
                </div>
              )}

              {/* Edit Email Button */}
              <div style={{ marginLeft: "24px" }}>
                <Button
                  variant={isEditingEmail ? "primary" : "secondary"}
                  onClick={toggleEmailEditing}
                  disabled={isDisabled || !isAutomationEnabled}
                  icon={isEditingEmail ? "/iconsV3/xV3.svg" : "/iconsV3/edit.svg"}
                  label={isEditingEmail ? "Stop editing" : "Edit email"}
                >
                </Button>
              </div>
            </div>

            <button
              onClick={sendEmailAutomation}
              className="btn btn-primary d-none"
              style={{ marginTop: "10px" }}
              id="candidate-email-send-button"
            >
              Send Email
            </button>

            <div
              className="border rounded p-4"
              style={{
                backgroundColor: "#f8f9fa",
                borderColor: "#dee2e6",
                textAlign: "left",
              }}
            >
              <div className="mb-3">
                <label
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#333",
                    marginBottom: "8px",
                  }}
                >
                  Subject
                </label>
                {isEditingEmail ? (
                  <input
                    type="text"
                    className="form-control"
                    value={currentEmailContent.subject}
                    onChange={(e) =>
                      handleEmailContentChange("subject", e.target.value)
                    }
                    disabled={isDisabled}
                    style={{
                      fontSize: "13px",
                      border: "2px solid #4169e1",
                      borderRadius: "4px",
                      outline: "none",
                      boxShadow: "0 0 0 1px #4169e1",
                    }}
                  />
                ) : (
                  <div
                    className="p-2"
                    style={{
                      backgroundColor: "white",
                      border: "1px solid #dee2e6",
                      borderRadius: "4px",
                      fontSize: "14px",
                      minHeight: "38px",
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: highlightDynamicValues(
                        currentEmailContent.subject
                      ),
                    }}
                  />
                )}
              </div>

              <div>
                <label
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#333",
                    marginBottom: "8px",
                  }}
                >
                  Body
                </label>

                {isEditingEmail ? (
                  <div
                    style={{
                      backgroundColor: "white",
                      border: "2px solid #4169e1",
                      borderRadius: "4px",
                      outline: "none",
                      boxShadow: "0 0 0 1px #4169e1",
                      minHeight: "200px",
                    }}
                  >
                    <CandidateRichTextEditor
                      value={currentEmailContent.body}
                      onChange={(value) =>
                        handleEmailContentChange("body", value)
                      }
                    />
                  </div>
                ) : (
                  <div
                    className="p-3"
                    style={{
                      backgroundColor: "white",
                      border: "1px solid #dee2e6",
                      borderRadius: "4px",
                      fontSize: "14px",
                      minHeight: "200px",
                      lineHeight: "1.5",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: highlightDynamicValues(currentEmailContent.body),
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
