import Swal from "sweetalert2";
import { api } from "@/lib/utils/apiClient";
import { decodeHtmlEntities } from "@/lib/utils/sanitizeInput";

const DEFAULT_CAREER_LIST_PATH = "/recruiter-dashboard/careers";

export type CareerDeletePreviewChild = {
  _id?: string;
  id?: string;
  jobTitle?: string;
  childTitle?: string | null;
};

export type CareerDeletePreviewParent = {
  _id?: string;
  id?: string;
  jobTitle?: string;
};

export type CareerDeletePreview = {
  childCareers?: CareerDeletePreviewChild[] | null;
  parentCareer?: CareerDeletePreviewParent | null;
};

export type DeleteCareerOptions = {
  orgID?: string | null;
  preview?: CareerDeletePreview | null;
  redirectTo?: string;
};

function stripTags(text: string) {
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    return (
      new DOMParser().parseFromString(text, "text/html").body.textContent || ""
    );
  }

  return text.replace(/<[^>]*>/g, "");
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCareerLabel(rawTitle?: string | null) {
  if (!rawTitle) {
    return "Untitled career";
  }

  return stripTags(decodeHtmlEntities(rawTitle)).trim() || "Untitled career";
}

function getChildCareers(preview?: CareerDeletePreview | null) {
  return Array.isArray(preview?.childCareers) ? preview.childCareers : [];
}

function getParentCareer(preview?: CareerDeletePreview | null) {
  return preview?.parentCareer ?? null;
}

function getDeleteModalConfig(preview?: CareerDeletePreview | null) {
  const childCareers = getChildCareers(preview);
  const childCareerCount = childCareers.length;
  const parentCareer = getParentCareer(preview);

  if (childCareerCount > 0) {
    const childLabels = childCareers
      .slice(0, 3)
      .map((child) => formatCareerLabel(child.jobTitle));
    const remainingCount = childCareerCount - childLabels.length;
    const childLabelHtml = childLabels
      .map((label) => `&bull; ${escapeHtml(label)}`)
      .join("<br />");
    const extraCountHtml =
      remainingCount > 0 ? `<br />&bull; +${remainingCount} more` : "";
    const childSummaryLabel =
      childCareerCount === 1 ? "child post" : "child posts";

    return {
      childCareerCount,
      title: "Delete Career?",
      html: `
        <div style="text-align:left;">
          <p style="margin:0 0 12px 0;">
            This career is currently used as the Parent Post for <strong>${childCareerCount}</strong> ${childSummaryLabel}.
          </p>
          <p style="margin:0 0 6px 0;">
            Deleting it will disconnect them from this Parent Post. The child posts will not be deleted.
          </p>
          <div style="margin:0;">
            <strong>Referenced child posts:</strong>
            <div style="margin-top: 8px;">
              ${childLabelHtml}${extraCountHtml}
            </div>
          </div>
        </div>
      `,
    };
  }

  if (parentCareer?.jobTitle) {
    const parentCareerLabel = formatCareerLabel(parentCareer.jobTitle);

    return {
      childCareerCount,
      title: "Delete Career?",
      html: `
        <div style="text-align:left;">
          <p style="margin:0 0 12px 0;">
            This post is currently linked to the Parent Post <strong>${escapeHtml(parentCareerLabel)}</strong>.
          </p>
          <p style="margin:0;">
            Deleting it will remove only this child post. The parent post will not be deleted.
          </p>
        </div>
      `,
    };
  }

  return {
    childCareerCount,
    title: "Delete Career?",
    text: "This action cannot be undone.",
  };
}

async function fetchCareerDeletePreview(
  careerId: string,
  orgID?: string | null
): Promise<CareerDeletePreview | null> {
  try {
    const response = await api.post("/api/career-data", {
      id: careerId,
      ...(orgID ? { orgID } : {}),
      includeChildCareers: true,
    });

    return {
      childCareers: getChildCareers(response.data),
      parentCareer: response.data?.parentCareer ?? null,
    };
  } catch (error) {
    console.error("Failed to fetch career delete preview:", error);
    return null;
  }
}

export function buildCareerListUrl(
  basePath = DEFAULT_CAREER_LIST_PATH,
  orgID?: string | null
) {
  const params = new URLSearchParams();
  if (orgID) {
    params.set("orgID", orgID);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export async function deleteCareer(
  careerId: string,
  options: DeleteCareerOptions = {}
) {
  if (!careerId) {
    await Swal.fire({
      title: "Error!",
      text: "Career ID is required",
      icon: "error",
    });
    return;
  }

  const { orgID, redirectTo } = options;
  const preview =
    options.preview !== undefined
      ? options.preview
      : await fetchCareerDeletePreview(careerId, orgID);
  const modalConfig = getDeleteModalConfig(preview);

  const result = await Swal.fire({
    title: modalConfig.title,
    text: modalConfig.text,
    html: modalConfig.html,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Yes, delete it!",
  });

  if (!result.isConfirmed) {
    return;
  }

  Swal.fire({
    title: "Deleting career...",
    text: "Please wait while we delete the career...",
    allowOutsideClick: false,
    showConfirmButton: false,
    willOpen: () => {
      Swal.showLoading();
    },
  });

  try {
    const response = await api.post("/api/delete-career", {
      id: careerId,
    });

    if (response.data.success) {
      const successText =
        modalConfig.childCareerCount > 0
          ? `The career has been deleted. ${modalConfig.childCareerCount} child ${
              modalConfig.childCareerCount === 1 ? "post was" : "posts were"
            } disconnected from this parent.`
          : "The career has been deleted.";

      Swal.fire({
        title: "Deleted!",
        text: successText,
        icon: "success",
        allowOutsideClick: false,
      }).then(() => {
        window.location.href =
          redirectTo ?? buildCareerListUrl(DEFAULT_CAREER_LIST_PATH, orgID);
      });
    } else {
      Swal.fire({
        title: "Error!",
        text: response.data.error || "Failed to delete the career",
        icon: "error",
      });
    }
  } catch (error: any) {
    console.error("Error deleting career:", error);
    const errorMessage =
      error?.response?.data?.error ||
      "An error occurred while deleting the career";
    Swal.fire({
      title: "Error!",
      text: errorMessage,
      icon: "error",
    });
  }
}
