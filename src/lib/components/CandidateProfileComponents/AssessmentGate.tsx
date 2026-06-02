"use client";

import { useEffect, useState } from "react";
import PasscodePromptModal from "@/lib/components/CandidateProfileComponents/PasscodePromptModal";
import { api } from "@/lib/utils/apiClient";
import Swal from "sweetalert2";
import CandidateProfile from "./CandidateProfile";
import LoadingAnimation from "../Loaders/LoadingAnimation";
import CandidateProfileV2 from "./CandidateProfileV2";

interface AssessmentGateProps {
  userName: string;
  jobTitle: string;
  profileId: string;
  previewToken?: string;
}

export default function AssessmentGate({ userName, jobTitle, profileId, previewToken }: AssessmentGateProps) {
  const [assessment, setAssessment] = useState<any>(null);
  const [passcode, setPasscode] = useState<string>("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(Boolean(previewToken));

  const handleValidatedAction = async (enteredPasscode: string) => {
    try {
      const { data } = await api.post("/api/fetch-shareable-assessment", {
        assessmentId: profileId,
        passcode: enteredPasscode,
      });

      if (!data.success) {
        throw new Error("Fetching assessment details failed.");
      }

      if (!data.assessment.active) {
        const result = await Swal.fire({
          title: "Inactive",
          text: "This shareable link is inactive.",
          icon: "warning",
          confirmButtonText: "Go to dashboard",
        });
        if (result.isConfirmed) {
          window.location.href = `/recruiter-dashboard?orgID=${data.assessment.orgID}`;
        }

        return;
      }

      setPasscode(enteredPasscode);
      setAssessment(data.assessment);
    } catch (err: any) {
      const message = err?.response?.data?.error || "Unable to fetch assessment.";
      throw new Error(message);
    }
  };

  useEffect(() => {
    if (!previewToken) {
      setIsPreviewLoading(false);
      return;
    }

    const fetchPreviewAssessment = async () => {
      setIsPreviewLoading(true);
      try {
        const { data } = await api.post("/api/fetch-shareable-assessment", {
          assessmentId: profileId,
          previewToken,
        });

        if (!data.success || !data.assessment) {
          throw new Error("Fetching preview assessment failed.");
        }

        setAssessment(data.assessment);
      } catch (err) {
        const message = (err as any)?.response?.data?.error || "Unable to fetch preview assessment.";
        void Swal.fire({
          title: "Preview unavailable",
          text: message,
          icon: "error",
          confirmButtonText: "Close",
        }).then(() => {
          window.location.href = "/recruiter-dashboard";
        });
      } finally {
        setIsPreviewLoading(false);
      }
    };

    fetchPreviewAssessment();
  }, [previewToken, profileId]);

  if (isPreviewLoading) {
    return <LoadingAnimation text={"Loading"} subtext={"Preparing shared view preview"} />;
  }

  if (assessment) {
    return <CandidateProfileV2 assessment={{ ...assessment, profileId, passcode, previewToken }} />
  }

  return (
    <PasscodePromptModal
      onValidatedAction={(code) => handleValidatedAction(code)}
    />
  );
}
