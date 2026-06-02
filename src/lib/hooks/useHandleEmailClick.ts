import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { errorToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";

// Looks up an applicant by email and navigates to the candidate email page if found.
export async function handleEmailClick(applicant: any, orgID: string, careerId?: string) {
  if (!applicant) return;
  try {
    toast.loading("Checking candidate...", {
        position: "top-center",
    });
    const email = applicant?.email;
    if (!email) {
      errorToast("No email available for this applicant", 1300);
      return;
    }

    const response = await api.post("/api/fetch-applicants", {
      orgID,
    });

    const matches = response.data || [];
    if (Array.isArray(matches) && matches.length > 0) {
      // Try to find the affiliation that matches the applicant email exactly
      const rec =
        matches.find((m: any) => {
          const candidateEmail =
            m?.applicantInfo?.email || m?.applicant?.email || m?.email;
          return (
            candidateEmail &&
            String(candidateEmail).toLowerCase() ===
            String(email).toLowerCase()
          );
        }) || matches[0];

      const affiliationId =
        rec.affiliationId || rec._id || rec.affiliation?._id;
      const applicantData = rec.applicant || rec.applicantInfo || rec;

      // Store a small preview so the email page can render immediately without an extra round-trip
      try {
        sessionStorage.setItem(
          "candidatePreview",
          JSON.stringify({ affiliationId, applicant: applicantData, orgID, careerId })
        );
      } catch (e) {
        // ignore session storage errors
      }

      // Navigate using the org-scoped affiliation id (recruiter-facing identifier)
      // Include careerId as query param if provided
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams({ orgID });
        if (careerId) {
          params.append('careerId', careerId);
        }
        window.location.href = `/recruiter-dashboard/candidates/emails/${affiliationId}?${params.toString()}`;
      }
    } else {
      Swal.fire({
        icon: "error",
        title: "Applicant not found",
        text: "No applicant with that email exists in the applicants collection.",
      });
    }
  } catch (err) {
    console.log(err);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to lookup applicant.",
    });
  } finally {
    toast.dismiss();
  }
}
