import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { api } from "@/lib/utils/apiClient";
import { assetConstants } from "./utils/constantsV2";
export { deleteCareer } from "@/lib/utils/careerDelete";
export { archiveCareerRequest, restoreCareerRequest } from "@/lib/utils/careerArchiveActions";

export const CORE_API_URL = process.env.NEXT_PUBLIC_CORE_API_URL;

// export const CORE_API_URL = "https://jia-jvx-1a0eba0de6dd.herokuapp.com";
// export const CORE_API_URL = "http://localhost:4000";

export function validateEmail(email) {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
}

export function convertDate(date) {
  let parsedDate = new Date(date);

  let year = parsedDate.getFullYear();
  let month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  let day = String(parsedDate.getDate()).padStart(2, "0");
  let hours = String(parsedDate.getHours()).padStart(2, "0");
  let minutes = String(parsedDate.getMinutes()).padStart(2, "0");
  let seconds = String(parsedDate.getSeconds()).padStart(2, "0");

  // Format as 'YYYY-MM-DD HH:mm:ss'
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const errorToast = (message, duration) => {
  let toastInstance = document.querySelector(".Toastify__toast");

  if (toastInstance) {
    return false;
  }
  toast.error(message, {
    position: "top-center",
    autoClose: duration ? duration : 2500,
    pauseOnHover: false,
    hideProgressBar: false,
    closeOnClick: true,
    draggable: true,
    progress: undefined,
  });
};

export const successToast = (message, duration) => {
  let toastInstance = document.querySelector(".Toastify__toast");

  if (toastInstance) {
    return false;
  }

  toast.success(message, {
    position: "top-center",
    autoClose: duration ? duration : 1200,
    pauseOnHover: false,
    hideProgressBar: false,
    closeOnClick: true,
    draggable: true,
    progress: undefined,
  });
};

export const infoToast = (message, duration) => {
  let toastInstance = document.querySelector(".Toastify__toast");

  if (toastInstance) {
    return false;
  }

  toast.info(message, {
    position: "top-center",
    autoClose: duration ? duration : 1200,
    pauseOnHover: false,
    hideProgressBar: false,
    closeOnClick: true,
    draggable: true,
    progress: undefined,
  });
};

export const loadingToast = (message) => {
  toast.loading(message, {
    toastId: "loading-toast",
    position: "top-center",
    autoClose: 3000,
    pauseOnHover: false,
    hideProgressBar: false,
    closeOnClick: true,
    draggable: true,
    progress: undefined,
  });
};

export function ellipsis(text, maxLength) {
  let newText = text;
  if (text.length >= maxLength) {
    newText = newText.substring(0, maxLength) + "...";
  }
  return newText;
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "");      // Remove leading/trailing hyphens
}

export const guid = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function copyTextToClipboard(text) {
  if (!navigator.clipboard) {
    console.error("Clipboard API not supported");
    return;
  }

  navigator.clipboard.writeText(text).then(
    function () {
      successToast("Text copied to clipboard successfully", 1000);
    },
    function (err) {
      console.error("Failed to copy text: ", err);
      errorToast("Failed to Copy", 1000);
    }
  );
}

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    throw new Error("Chunk size must be greater than 0");
  }

  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export function formatDateToRelativeTime(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export const formatMap = (target) => {
  let formatVals: any = {
    "Strong Fit": {
      icon: "la la-star",
      iconColor: "Green",
      background: `linear-gradient(
            to right,
            rgba(186, 247, 204, 0.71),
            rgba(241, 229, 163, 0.07)
            )`,
    },

    "Good Fit": {
      icon: "la la-check-circle",
      iconColor: "green",
      background: `linear-gradient(
            to right,
            rgba(186, 247, 204, 0.71),
            rgba(65, 81, 74, 0.07)
            )`,
    },

    "Maybe Fit": {
      icon: "la la-exclamation-circle",
      iconColor: "salmon",
      background: `linear-gradient(
            to right,
            rgba(244, 233, 170, 0.71),
            rgba(250, 128, 114, 0.2)
            )`,
    },

    "Not Fit": {
      icon: "la la-times",
      iconColor: "red",
      background: `linear-gradient(
            to right,
            rgba(250, 177, 146, 0.47),
            rgba(250, 128, 114, 0.07)
            )`,
    },
  };

  if (formatVals[target]) {
    return formatVals[target];
  }

  if (!formatVals[target]) {
    return {
      icon: "la la-square",
      iconColor: "royalblue",
      background: `#ddd`,
    };
  }
};

export const interviewQuestionCategoryMap = {
  "CV Validation / Experience": {
    description:
      "Verify resume/curriculum vitae claims and elicit detail on past projects. If no resume/curriculum vitae is attached by the applicant, then generate questions about most recent jobs and those related to job description.",
  },
  Technical: {
    description:
      "Probe job-specific skills listed in the job description. May also ask questions relating to the principles, patterns, concepts in their field.",
  },
  Behavioral: {
    description: "Test work ethics, teamwork, leadership, adaptability.",
  },
  Analytical: {
    description:
      "Present mini-cases or problems to assess problem-solving approach.",
  },
  Others: {
    description:
      "Logistics (work setup, salary, when to start), hobbies, culture fit.",
  },
};

export const workSetupOptions = ["Fully Remote", "Onsite", "Hybrid"];

export function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
    [arr[i], arr[j]] = [arr[j], arr[i]]; // swap elements
  }
  return arr;
}

export function scoreColor(score: number): string {
  // Ensure score is within 0-100 range
  const clampedScore = Math.max(0, Math.min(100, score));

  if (clampedScore === 0) {
    return "grey";
  }

  // Define color ranges
  if (clampedScore < 20) {
    // Red range (0-19)
    return "#FF0000";
  }

  if (clampedScore < 40) {
    // Orange range (20-39)
    return "#FF8C00";
  }

  if (clampedScore < 60) {
    // Yellow range (40-59)
    return "#c9bf4d";
  }

  if (clampedScore < 80) {
    return "#3dd9a2";
  }

  // Green range (80-100)
  return "#00CC00";
}

export const getStatusBadge = (status) => {
  switch (status) {
    case "For Interview":
      return "text-info";
    case "For Review":
      return "text-primary";
    case "Accepted":
      return "text-success";
    case "Rejected":
      return "text-danger";
    case "Failed CV Screening":
      return "text-salmon";
    case "Action Required":
      return "text-info blink-1";
    default:
      return "bg-secondary";
  }
};

export function saveContentToFile(content, fileName) {
  // Create a Blob with the content
  const blob = new Blob([content], { type: "text/plain" });

  // Create a temporary anchor element
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;

  // Trigger the download
  document.body.appendChild(a);
  a.click();

  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function htmlToPlainText(html) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const plainText = tempDiv.textContent || tempDiv.innerText || "";
  return plainText.replace(/,/g, " ");
}

export function getStage(a: any) {
  if (
    a.currentStep === "AI Interview" ||
    !a.currentStep ||
    (a.currentStep === "CV Screening" && a.status === "For AI Interview")
  ) {
    if (a.status === "For Interview" || a.status === "For AI Interview")
      return "Pending AI Interview";
    return "AI Interview Review";
  }
  if (a.currentStep === "Human Interview") {
    if (a.status === "For Human Interview Review")
      return "Human Interview Review";
    return "For Human Interview";
  }
  if (a.currentStep === "Job Interview") {
    return "Pending Job Interview";
  }
  if (a.currentStep === "Job Offered") {
    return "Job Offered";
  }
  if (a.currentStep === "Contract Signed") {
    return "Contract Signed";
  }
  if (a.currentStep === "CV Screening") return "CV Review";

  if (a.currentStep === "Applied") return "Applied";
  return a.status;
}

export const applicationStatusMap = {
  "CV Review": {
    nextStage: {
      name: "Pending AI Interview",
      step: "AI Interview",
      status: "For Interview",
    },
    currentStage: {
      step: "CV Screening",
      status: "For CV Screening",
    },
  },
  "Pending AI Interview": {
    nextStage: {
      name: "AI Interview Review",
      step: "AI Interview",
      status: "For AI Interview Review",
    },
    currentStage: {
      step: "CV Screening",
      status: "For AI Interview",
    },
  },
  "AI Interview Review": {
    nextStage: {
      name: "For Human Interview",
      step: "Human Interview",
      status: "For Human Interview",
    },
    currentStage: {
      step: "AI Interview",
      status: "For AI Interview Review",
    },
  },
  "For Human Interview": {
    nextStage: {
      name: "Human Interview Review",
      step: "Human Interview",
      status: "For Human Interview Review",
    },
    currentStage: {
      step: "Human Interview",
      status: "For Human Interview",
    },
  },
  "Human Interview Review": {
    nextStage: {
      name: "Pending Job Interview",
      step: "Job Interview",
      status: "For Interview",
    },
    currentStage: {
      step: "Human Interview",
      status: "For Human Interview Review",
    },
  },
  "Pending Job Interview": {
    nextStage: {
      name: "Job Offered",
      step: "Job Offered",
      status: "Accepted",
    },
    currentStage: {
      step: "Job Interview",
      status: "For Interview",
    },
  },
  "Job Offered": {
    nextStage: {
      name: "Contract Signed",
      step: "Contract Signed",
      status: "Accepted",
    },
    currentStage: {
      step: "Job Offered",
      status: "Accepted",
    },
  },
  "Contract Signed": {
    nextStage: {
      name: "Hired",
      step: "Hired",
      status: "Accepted",
    },
    currentStage: {
      step: "Contract Signed",
      status: "Accepted",
    },
  },
};

export const candidateActionToast = (message, duration, icon) => {
  toast.success(message, {
    className: "custom-toast-container",
    icon: icon,
    position: "top-center",
    autoClose: duration ? duration : 1200,
    pauseOnHover: false,
    hideProgressBar: true,
    closeOnClick: true,
    draggable: false,
    progress: undefined,
  });
};

export const emailSentToast = (recipientEmail, recipientName, duration, onUndo, onViewMessage) => {
  // Parse recipient name from email if not provided
  const displayName = recipientName || recipientEmail.split("@")[0];

  const toastContent = (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, paddingLeft: 14 }}>
        <span
          style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}
        >
          Email sent
        </span>
        <span
          style={{
            fontSize: 14,
            color: "#717680",
            fontWeight: 400,
          }}
        >
          Successfully sent to {displayName} &lt;{recipientEmail}&gt;
        </span>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {onUndo && (
            <span
              onClick={onUndo}
              style={{
                fontSize: 14,
                color: "#717680",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Undo
            </span>
          )}
          {onViewMessage && (
            <span
              onClick={onViewMessage}
              style={{
                fontSize: 14,
                color: "#3538CD",
                cursor: "pointer",
                fontWeight: 500,
                // textDecoration: "underline",
              }}
            >
              View message
            </span>
          )}
        </div>
      </div>
    </div>
  );

  toast.success(toastContent, {
    className: "custom-toast-container",
    icon: (
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          backgroundColor: "#D1FADF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          alt="logo"
          style={{
            height: "40px",
            width: "40px",
          }}
          src={assetConstants.checkV2}
        />
      </div>
    ),
    position: "top-center",
    autoClose: duration ? duration : 5000,
    // autoClose: 50000,
    pauseOnHover: true,
    hideProgressBar: true,
    closeOnClick: false,
    draggable: false,
    progress: undefined,
  });
};

export const handleCareerFitColor = (fit: string) => {
  if (fit?.includes("Good Fit")) {
    return {
      background: "#EFF6FF",
      color: "#1849D5",
    };
  }
  if (fit?.includes("Strong Fit")) {
    return {
      background: "#ECFDF3",
      color: "#027A48",
    };
  }

  if (fit?.includes("Maybe Fit")) {
    return {
      background: "#F9F5FF",
      color: "#414651",
    };
  }

  if (fit?.includes("N/A")) {
    return {
      background: "#F5F5F5",
      color: "#414651",
    };
  }

  return {
    background: "#FEE4E2",
    color: "#B42318",
  };
};

export const applicantStatusFormatMap = {
  Ongoing: {
    border: "1px solid #FEDF89",
    backgroundColor: "#FFFAEB",
    color: "#B54708",
    dotColor: "#F79009",
  },
  Dropped: {
    border: "1px solid #FECDCA",
    backgroundColor: "#FEF3F2",
    color: "#B32318",
    dotColor: "#F04438",
  },
  Cancelled: {
    border: "1px solid #FECDCA",
    backgroundColor: "#FEF3F2",
    color: "#B32318",
    dotColor: "#F04438",
  },
  Hired: {
    border: "1px solid #10B981",
    backgroundColor: "#ECFDF3",
    color: "#047857",
    dotColor: "#12B76A",
  },
  "No CV Uploaded": {
    border: "1px solid #E9EAEB",
    backgroundColor: "#F5F5F5",
    color: "#414651",
  },
  Inactive: {
    border: "1px solid #E9EAEB",
    backgroundColor: "#F5F5F5",
    color: "#414651",
    dotColor: "#717680",
  },
};

export const extractInterviewAssessment = (summary: any) => {
  if (!summary) return "";

  const strongBulletPoints = summary
    .slice(
      summary.indexOf("# Strong Points") + "# Strong Points".length,
      summary.indexOf("# Weak Points") - 1
    )
    .trim();
  const endOfWeakPoints =
    summary.indexOf("# Final assessment") === -1
      ? summary.indexOf("# Final Assessment")
      : summary.indexOf("# Final assessment");
  const weakBulletPoints = summary
    .slice(
      summary.indexOf("# Weak Points") + "# Weak Points".length,
      endOfWeakPoints - 1
    )
    .trim();

  const markdownToHtml = (md: string) => {
    if (!md) return "";
    let html = md;

    html = html.replace(/^(\s*[-*])(.+)$/gm, "<li>$2</li>");

    html = `<ul>${html}</ul>`;

    return html;
  };
  return `<h2>Strong Points</h2>${markdownToHtml(
    strongBulletPoints
  )}\n\n<h2>Weak Points</h2>${markdownToHtml(weakBulletPoints)}`;
};

export const getInvitationEmailTemplate = (
  email: string,
  orgName: string,
  role: string
) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(to bottom, #4f04b9f0, #b79fcf76); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Jia</h1>
    </div>
    
    <div style="background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px;">
        Dear ${email},
      </p>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px;">
        We are pleased to invite you to join <strong>${orgName}</strong> on Jia as a <strong>${
  role.charAt(0).toUpperCase() + role.slice(1)
}</strong>. Your expertise and contribution will be valuable to our team.
      </p>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 30px;">
        To get started, please click the button below to access your account:
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://${process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN}" 
           style="background: #4f04b9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Click Here to Login
        </a>
      </div>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px;">
        If you have any questions or need assistance, please don't hesitate to contact us.
      </p>
      
      <p style="font-size: 16px; line-height: 1.6; color: #333333;">
        Best regards,<br>
        The Jia Team
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 20px; color: #666666; font-size: 14px;">
      <p>This is an automated message, please do not reply directly to this email.</p>
    </div>
  </div>
`;

export const clearUserSession = () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  localStorage.removeItem("isCVAvailable");
  localStorage.removeItem("role");
  localStorage.removeItem("activeOrg");
  localStorage.removeItem("orgList");
  localStorage.removeItem("guestOrg");
};

/**
 * Performs full logout: revokes tokens server-side, clears Firebase client state,
 * clears local/session storage, and redirects.
 * Call this instead of clearUserSession when the user explicitly logs out.
 * Uses fetch directly (not apiClient) to avoid 401 retry logic on logout.
 *
 * @param redirectTo - URL to redirect to after logout (default: "/")
 */
export const performLogout = async (redirectTo: string = "/") => {
  try {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  } catch (error) {
    // Best effort - still clear and redirect even if API fails (e.g. already logged out)
    console.error("Error performing logout:", error);
  } finally {
    clearUserSession();
    if (typeof window !== "undefined") {
      sessionStorage.clear();
    }
    try {
      const { firebaseAuth } = await import("@/lib/firebase/firebaseClient");
      await firebaseAuth.signOut();
    } catch {
      // Firebase may not be initialized (e.g. SSR)
    }
    if (typeof window !== "undefined") {
      window.location.href = redirectTo;
    }
  }
};

export const getCVSection = (cvData: any, name: string) => {
  const section = cvData?.find((section: any) => section.name === name);
  return (
    section?.content?.split(`**${name}**`)[1]?.trim()?.replace(/\*\*/g, "") ||
    section?.content?.trim()?.replace(/\*\*/g, "") ||
    ""
  );
};

export const getNextPipelineStage = (
  timelineStages: any[],
  { stage, substage }: { stage: string; substage: string }
): {
  stage: { id: string; name: string };
  substage: { id: string; name: string; currentStep: string; status: string };
  isLastSubstage: boolean;
} | null => {
  // Filter to only enabled stages
  const enabledStages = getEnabledStages(timelineStages);

  const currentStageIndex = enabledStages.findIndex(
    (pipelineStage: any) => pipelineStage.name === stage
  );
  if (currentStageIndex === -1) return null;

  const currentSubstageIndex = enabledStages?.[
    currentStageIndex
  ]?.substages?.findIndex(
    (pipelineSubstage: any) => pipelineSubstage.name === substage
  );
  if (currentSubstageIndex === -1) return null;
  // Check if there is another substage after the current substage
  if (
    currentSubstageIndex <
    enabledStages[currentStageIndex].substages.length - 1
  ) {
    return {
      stage: enabledStages[currentStageIndex],
      substage:
        enabledStages[currentStageIndex].substages[currentSubstageIndex + 1],
      isLastSubstage:
        currentSubstageIndex + 1 ===
        enabledStages[currentStageIndex].substages.length - 1,
    };
  }
  // Check if there is another enabled stage after the current stage
  if (currentStageIndex < enabledStages.length - 1) {
    return {
      stage: enabledStages[currentStageIndex + 1],
      substage: enabledStages[currentStageIndex + 1].substages[0],
      isLastSubstage:
        enabledStages[currentStageIndex + 1].substages.length === 1,
    };
  }
  return null;
};

export const getCurrentPipelineStage = (
  timelineStages: {
    id: string;
    name: string;
    alias?: string;
    substages: {
      id: string;
      name: string;
      currentStep: string;
      status: string;
    }[];
  }[],
  { status, currentStep, stageId, substageId }: { status: string; currentStep: string; stageId?: string; substageId?: string }
): {
  stage: { id: string; name: string; alias?: string };
  substage: { id: string; name: string; currentStep: string; status: string };
} | null => {
  if (stageId && substageId) {
    const pipelineStage = timelineStages.find((s) => s.id === stageId);
    if (pipelineStage) {
      const sub = pipelineStage.substages.find((s) => s.id === substageId);
      if (sub) {
        return {
          stage: { id: pipelineStage.id, name: pipelineStage.name, alias: pipelineStage.alias },
          substage: sub,
        };
      }
    }
  }

  const buildStageResult = (
    pipelineStage:
      | {
          id: string;
          name: string;
          alias?: string;
          substages: {
            id: string;
            name: string;
            currentStep: string;
            status: string;
          }[];
        }
      | undefined,
    substageName: string
  ) => {
    if (!pipelineStage) {
      return null;
    }

    const substage = pipelineStage.substages.find(
      (item) => item.name === substageName
    );

    if (!substage) {
      return null;
    }

    return {
      stage: {
        id: pipelineStage.id,
        name: pipelineStage.name,
        alias: pipelineStage.alias,
      },
      substage,
    };
  };

  if (
    currentStep === "AI Interview" ||
    !currentStep ||
    (currentStep === "CV Screening" && status === "For AI Interview")
  ) {
    const pipelineStage = timelineStages.find(
      (stage) => stage.name === "AI Interview"
    );

    if (status === "For Interview" || status === "For AI Interview") {
      return buildStageResult(pipelineStage, "Waiting Interview");
    }

    return buildStageResult(pipelineStage, "For Review");
  }

  if (currentStep === "Applied" && status === "For CV Upload") {
    const pipelineStage = timelineStages.find(
      (stage) => stage.name === "CV Screening"
    );
    return buildStageResult(pipelineStage, "Waiting Submission");
  }

  if (currentStep === "CV Screening") {
    const pipelineStage = timelineStages.find(
      (stage) => stage.name === "CV Screening"
    );
    return buildStageResult(pipelineStage, "For Review");
  }

  if (currentStep === "Human Interview" || currentStep === "Job Interview") {
    const pipelineStage = timelineStages.find(
      (stage) => stage.name === "Human Interview"
    );

    if (status === "For Human Interview") {
      return buildStageResult(pipelineStage, "Waiting Schedule");
    }

    if (status === "For Interview") {
      return buildStageResult(pipelineStage, "Waiting Interview");
    }

    if (status === "For Human Interview Review") {
      return buildStageResult(pipelineStage, "For Review");
    }
  }

  if (currentStep === "Job Offered") {
    const pipelineStage = timelineStages.find(
      (stage) => stage.name === "Job Offer"
    );
    return buildStageResult(pipelineStage, "For Contract Signing");
  }

  if (currentStep === "Contract Signed") {
    const pipelineStage = timelineStages.find(
      (stage) => stage.name === "Job Offer"
    );
    return buildStageResult(pipelineStage, "Hired");
  }

  // Custom stages
  for (const stage of timelineStages) {
    for (const substage of stage.substages) {
      if (substage.currentStep === currentStep && substage.status === status) {
        return {
          stage: {
            id: stage.id,
            name: stage.name,
          },
          substage: substage,
        };
      }
    }
  }

  return null;
};

export const getAutomationSettings = (careerDetails: any) => {
  const cvScreeningAutoDrop =
    careerDetails?.pipelineStages?.[0]?.autoDrop || "None";
  const cvScreeningAutoEndorse =
    careerDetails?.pipelineStages?.[0]?.autoEndorse || "Good Fit and above";
  console.log(cvScreeningAutoDrop, cvScreeningAutoEndorse);

  let forReviewResult = ["Maybe Fit", "Insufficient Data"];
  let forDropResult = ["No Fit", "Bad Fit"];
  let forPromotionResult = ["Good Fit", "Strong Fit"];

  if (cvScreeningAutoDrop === "None") {
    forDropResult = [];
    forReviewResult = ["No Fit", "Bad Fit", "Maybe Fit", "Insufficient Data"];
  }

  if (cvScreeningAutoDrop === "Bad Fit and below") {
    forDropResult = ["No Fit", "Bad Fit"];
  }

  if (cvScreeningAutoDrop === "Maybe Fit and below") {
    forReviewResult = forReviewResult.filter(
      (result) => result !== "Maybe Fit"
    );
    forDropResult = ["No Fit", "Bad Fit", "Maybe Fit"];
  }

  if (cvScreeningAutoEndorse === "None") {
    forReviewResult = forReviewResult.concat(["Good Fit", "Strong Fit"]);
    forPromotionResult = [];
  }

  if (cvScreeningAutoEndorse === "Maybe Fit and above") {
    forReviewResult = forReviewResult.filter(
      (result) => result !== "Maybe Fit"
    );
    forPromotionResult = ["Maybe Fit", "Good Fit", "Strong Fit"];
  }

  if (cvScreeningAutoEndorse === "Good Fit and above") {
    forPromotionResult = ["Good Fit", "Strong Fit"];
  }

  if (cvScreeningAutoEndorse === "Only Strong Fit") {
    forPromotionResult = ["Strong Fit"];
    forReviewResult = forReviewResult.concat(["Good Fit"]);
  }

  return {
    forReviewResult,
    forDropResult,
    forPromotionResult,
    cvScreeningAutoEndorse,
    cvScreeningAutoDrop,
  };
};

export const isStageEnabled = (stage: any): boolean => {
  return stage?.enabled !== false;
};

export const getEnabledStages = (stages: any[]): any[] => {
  if (!stages || !Array.isArray(stages)) return [];
  return stages.filter(isStageEnabled);
};

export const getFirstEnabledStage = (
  stages: any[]
): { stage: any; substage: any } | null => {
  const enabledStages = getEnabledStages(stages);
  if (enabledStages.length === 0) return null;
  const firstStage = enabledStages[0];
  const firstSubstage = firstStage?.substages?.[0];
  if (!firstSubstage) return null;
  return { stage: firstStage, substage: firstSubstage };
};


export const parseSkillsFromMarkdown = (markdownContent: string): string[] => {
  if (!markdownContent) return [];

  const sectionHeaders = [
    "skills",
    "technical skills",
    "soft skills",
    "hard skills",
    "core competencies",
    "expertise",
    "proficiencies",
    "technologies",
    "tools",
    "languages",
    "frameworks",
  ];

  const cleaned = markdownContent
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[#*_~`]/g, "")
    .replace(/^>\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  const parsed = cleaned
    .split(/[\n,]/)
    .map((skill) => skill.trim())
    .filter((skill) => {
      if (skill.length === 0) return false;

      const lowerSkill = skill.toLowerCase();
      if (sectionHeaders.includes(lowerSkill)) return false;

      if (skill.length < 2) return false;

      if (/^[^a-zA-Z0-9]+$/.test(skill)) return false;

      return true;
    });

  return parsed;
};

export const syncOrgSkillsMetadataDiff = async (
  userEmail: string,
  orgID: string,
  originalSkills: string[],
  currentSkills: string[]
) => {
  if (!userEmail) return;

  const originalSet = new Set(originalSkills || []);
  const currentSet = new Set(currentSkills || []);

  const addedSkills = (currentSkills || []).filter(
    (skill) => !originalSet.has(skill)
  );
  const removedSkills = (originalSkills || []).filter(
    (skill) => !currentSet.has(skill)
  );

  if (addedSkills.length === 0 && removedSkills.length === 0) return;

  try {
    await api.post("/api/sync-org-candidate-skills", {
      candidateEmail: userEmail,
      orgID,
      addedSkills,
      removedSkills,
      source: "employer",
    });
  } catch (error) {
    console.error("Error syncing skills metadata changes:", error);
  }
};

export const syncParsedSkillsToMetadata = async (userEmail: string, skillsList: string[]) => {
  if (!userEmail || !skillsList || skillsList.length === 0) return;

  try {
    await api.post("/api/sync-candidate-skills", {
      candidateEmail: userEmail,
      addedSkills: skillsList,
      removedSkills: [],
      source: "candidate",
      wipeCandidateSource: true,
    });
  } catch (error) {
    console.error("Error syncing candidate skills metadata:", error);
  }
};

export const syncParsedSkillsToOrgMetadata = async (userEmail: string, orgID: string, skillsList: string[]) => {
  if (!userEmail || !orgID || !skillsList || skillsList.length === 0) return;

  try {
    await api.post("/api/sync-org-candidate-skills", {
      candidateEmail: userEmail,
      orgID,
      addedSkills: skillsList,
      removedSkills: [],
      source: "candidate",
      wipeCandidateSource: true,
    });
  } catch (error) {
    console.error("Error syncing org candidate skills metadata:", error);
  }
};

export const convertSkillsToMarkdown = (skillsList: string[]): string => {
  return skillsList.map(skill => `- ${skill}`).join('\n');
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^(\+?[0-9]{1,5}|\(\+[0-9]{1,5}\))?(?=.*[0-9])[0-9\-]+$/;
  return phoneRegex.test(phone);
}

const getCleanedContactContent = (content: string): string | null => {
if (!content) return null;
  return String(content)
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .trim();
};

export const getPhoneFromContent = (content: string): string | null => {
  let extractedPhone = null;
  const cleanContent = getCleanedContactContent(content);
  if (cleanContent) {
    const phonePatterns = [
      /Phone[:\s]*([+\d\s\-()\.]+)/i,
      /Mobile[:\s]*([+\d\s\-()\.]+)/i,
      /Tel[:\s]*([+\d\s\-()\.]+)/i,
      /Contact[:\s]*([+\d\s\-()\.]+)/i,
      /(\+\d{1,3}[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4})/,
      /(\d{4}[\s\-]?\d{3}[\s\-]?\d{4})/,
      /(\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{4})/,
      /(\d{11})/,
    ];

    for (const pattern of phonePatterns) {
      const match = cleanContent.match(pattern);
      if (match && match[1]) {
        extractedPhone = match[1].trim();
        break;
      }
    }
  }
  return extractedPhone;
}

export const normalizePipeline = (pipeline: any[]): any[] => {
  return pipeline.map((stage: any) => {
    if (stage.id !== "1") return stage;
    return {
      ...stage,
      substages: stage.substages?.map((sub: any) => {
        if (["1", "2"].includes(String(sub.id)) && !sub.core) {
          return { ...sub, core: true };
        }
        return sub;
      }),
    };
  });
};

export const isValidStringParameter = (param: string): boolean => {
  return param && typeof param === 'string' && param?.trim() !== '';
}

export const isValidGUID = (guid: string): boolean => {
  return guid && typeof guid === 'string' && guid?.trim() !== '' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(guid);
}
