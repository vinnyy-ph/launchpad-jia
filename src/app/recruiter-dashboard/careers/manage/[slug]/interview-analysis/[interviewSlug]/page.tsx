"use client";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import Swal from "sweetalert2";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import { useAppContext } from "@/lib/context/AppContext";
import CareerFit from "@/lib/components/CareerComponents/CareerFit";
import CircularProgress from "@/lib/components/CandidateComponents/CircularProgress";
import moment from "moment";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import CandidateTooltip from "@/lib/components/CandidateComponents/CandidateTooltip";
import {
  candidateActionToast,
  errorToast,
  extractInterviewAssessment,
  getCurrentPipelineStage,
  getNextPipelineStage,
  loadingToast,
  successToast,
} from "@/lib/Utils";
import { toast } from "react-toastify";
import ActivityTracker from "@/lib/components/ActivityTracker/ActivityTracker";
import CandidateModal from "@/lib/components/CandidateComponents/CandidateModal";
import CandidateActionModal from "@/lib/components/CandidateComponents/CandidateActionModal";
import ConfirmationModal from "@/lib/components/CandidateComponents/ConfirmationModal";
import LoadingAnimation from "@/lib/components/Loaders/LoadingAnimation";
import RetakeInterviewRequestV2 from "@/lib/components/CandidateComponents/RetakeInterviewRequestV2";
import { Tooltip } from "react-tooltip";
import RecruiterEvaluation from "@/lib/components/CareerComponents/RecruiterEvaluation";
import StageAttachments from "@/lib/components/CareerComponents/StageAttachments";
import LayeredCard from "@/lib/components/LayeredCard";
import LogsExplorer from "@/lib/components/AnalysisComponents/LogsExplorer";
// Comments feature removed
import ShareModalV2 from "@/lib/components/ShareableAssessmentModalComponents/ShareModalV2";
import CommentThreads from "@/lib/components/CareerComponents/CommentThreads";
import { Button } from "@/lib/components/ui";
import CustomMarkdown from "@/lib/components/ui/markdown/CustomMarkdown";
import ApplicantQualities from "@/lib/components/CandidateComponents/ApplicantQualities";
import { handleEmailClick } from "@/lib/hooks/useHandleEmailClick";
import CandidateAnalysisDocument from "@/lib/components/CandidateComponents/CandidateAnalysisDocument";
import { downloadCandidateAnalysisDocx } from "@/lib/components/CandidateComponents/CandidateAnalysisDocx";
import { PDFDownloadLink } from "@react-pdf/renderer";
import CustomDropdown from "@/lib/components/Dropdown/CustomDropdown";
import CandidateCVAnalysisV2 from "@/lib/components/CandidateComponents/CandidateCVAnalysisV2";

export default function InterviewAnalysis() {
  const { user, orgID } = useAppContext();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const orgIDParam = searchParams.get("orgID"); // Support orgID via URL param
  const effectiveOrgID = orgIDParam || orgID; // Use param orgID if provided, else context orgID
  const [comments, setComments] = useState<any[]>([]); // Comments array
  const totalComments = useMemo(
    () => comments.filter((c: any) => !c.deleted).length,
    [comments]
  ); // Total non-deleted comments
  const { slug, interviewSlug } = useParams();
  const [interview, setInterview] = useState<any>(null);
  const [career, setCareer] = useState<any>(null);
  const [interviewRecording, setInterviewRecording] = useState<any>(null);
  const [isLoadingRecording, setIsLoadingRecording] = useState<boolean>(false);
  const [transcripts, setTranscripts] = useState<any>([]);
  const [sourceInterviewID, setSourceInterviewID] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [overAllScore, setOverAllScore] = useState<number>(0);
  const [summaryPrompt, setSummaryPrompt] = useState<string>("");
  const [analysisPrompt, setAnalysisPrompt] = useState<string>("");
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] =
    useState<boolean>(false);
  const [isGeneratingSummary, setIsGeneratingSummary] =
    useState<boolean>(false);
  const [isLoadingTranscripts, setIsLoadingTranscripts] =
    useState<boolean>(false);
  const [showCandidateModal, setShowCandidateModal] = useState<boolean>(false);
  const [showCandidateActionModal, setShowCandidateActionModal] =
    useState<string>("");
  // Comments state removed
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const isLoadingSettingsRef = useRef(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeTabLabelRef = useRef<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<any>([]);
  const [tabs, setTabs] = useState<any>([]);
  const [activeTab, setActiveTab] = useState<any>(null);
  const [activeRecruiterEvaluation, setActiveRecruiterEvaluation] =
    useState<any>(null);
  const [showHeaderTooltip, setShowHeaderTooltip] = useState(false);
  const [isTooltipLocked, setIsTooltipLocked] = useState(false);
  const headerTooltipTimeoutRef = useRef<number | null>(null);
  const router = useRouter();
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [isLoadingRecruiterEvaluations, setIsLoadingRecruiterEvaluations] = useState(false);

  const updateScrollGradients = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftGradient(scrollLeft > 0);
    setShowRightGradient(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  // Removed comments-related socket usage

  const handleHeaderTooltipMouseEnter = () => {
    if (headerTooltipTimeoutRef.current) {
      clearTimeout(headerTooltipTimeoutRef.current);
      headerTooltipTimeoutRef.current = null;
    }
    setShowHeaderTooltip(true);
  };

  const handleHeaderTooltipMouseLeave = () => {
    // Don't close tooltip if it's locked (e.g., comments are open)
    if (isTooltipLocked) return;

    if (headerTooltipTimeoutRef.current) {
      clearTimeout(headerTooltipTimeoutRef.current);
    }
    headerTooltipTimeoutRef.current = window.setTimeout(() => {
      setShowHeaderTooltip(false);
      headerTooltipTimeoutRef.current = null;
    }, 200);
  };

  async function finishUpload(interviewData: any) {
    setIsLoadingRecording(true);
    api
      .post("/api/finish-upload", {
        uploadId: interviewData.interviewUpload.uploadId,
        parts: interviewData.interviewParts,
        fileName: interviewData.interviewUpload.key,
        filetype: interviewData.interviewUpload.filetype,
        uid: interviewData._id,
      })
      .then((res) => {
        // Update state
        setInterviewRecording({
          filename: interviewData.interviewUpload.key,
          filetype: interviewData.interviewUpload.filetype,
        });
      })
      .catch((err) => {
        console.log(err);
      })
      .finally(() => {
        setIsLoadingRecording(false);
      });
  }

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        loadingToast("Loading, please wait...");
        if (!isLoadingSettingsRef.current) {
          isLoadingSettingsRef.current = true;
          const configData = await api.post("/api/fetch-global-settings", {
            fields: { summary_prompt: 1, analysis_prompt: 1 },
          });

          // Guard against missing/global settings entries (can be null)
          const summaryPromptValue =
            configData?.data?.summary_prompt?.prompt || "";
          const analysisPromptValue =
            configData?.data?.analysis_prompt?.prompt || "";
          setSummaryPrompt(summaryPromptValue);
          setAnalysisPrompt(analysisPromptValue);

          const response = await api.post("/api/interview-details", {
            id: interviewSlug,
            orgID: effectiveOrgID, // Use effectiveOrgID here
          });

          // Fetch career data to check if pre-screening questions are enabled
          let careerData = null;
          if (slug) {
            try {
              const careerResponse = await api.post("/api/career-data", {
                id: slug,
                orgID: effectiveOrgID,
              });
              careerData = careerResponse.data;
              setCareer(careerData); // Store in state
            } catch (err) {
              console.error("Failed to fetch career data", err);
            }
          }

          if (
            !response.data?.interviewRecording &&
            response.data?.interviewUpload &&
            response.data?.interviewParts?.length > 0
          ) {
            finishUpload(response.data);
          }

          let targetTranscriptId = interviewSlug;
          let recordingToUse = response.data?.interviewRecording;

          const hasAnsweredPreScreening = response.data?.preScreeningQuestions?.some(
            (q: any) => q.selectedAnswers?.length > 0
          );
          const needsSourceFallback =
            !response.data?.interviewRecording ||
            !hasAnsweredPreScreening;

          if (
            needsSourceFallback &&
            response.data?.invitedFrom?.interviewId
          ) {
            try {
              const sourceResponse = await api.post("/api/interview-details", {
                id: response.data.invitedFrom.interviewId,
                orgID: effectiveOrgID,
                searchBy: "_id",
              });

              if (sourceResponse.data) {
                if (!response.data?.interviewRecording && sourceResponse.data.interviewRecording) {
                  recordingToUse = sourceResponse.data.interviewRecording;
                }

                if (
                  !hasAnsweredPreScreening &&
                  sourceResponse.data.preScreeningQuestions?.some(
                    (q: any) => q.selectedAnswers?.length > 0
                  )
                ) {
                  const sourceAnswersMap = new Map(
                    sourceResponse.data.preScreeningQuestions
                      .filter((q: any) => q.selectedAnswers?.length > 0)
                      .map((q: any) => [q.id, q.selectedAnswers])
                  );

                  if (response.data.preScreeningQuestions?.length > 0) {
                    response.data.preScreeningQuestions = response.data.preScreeningQuestions.map(
                      (q: any) => {
                        const sourceAnswers = sourceAnswersMap.get(q.id);
                        return sourceAnswers ? { ...q, selectedAnswers: sourceAnswers } : q;
                      }
                    );
                  } else {
                    response.data.preScreeningQuestions =
                      sourceResponse.data.preScreeningQuestions;
                  }
                }

                if (!response.data?.interviewRecording && sourceResponse.data.interviewID) {
                  setSourceInterviewID(sourceResponse.data.interviewID);
                  targetTranscriptId = sourceResponse.data.interviewID;
                }
              }
            } catch (err) {
              console.error("Failed to fetch source interview for fallback", err);
            }
          }

          setPipelineStages(response.data.pipelineStages);
          // Remove last stage, then filter out disabled stages
          // Core stages (CV Screening id="1", AI Interview id="2") are always shown
          const mappedStages = response.data.pipelineStages
            ?.slice(0, -1)
            .filter((stage: any) => {
              // Always show CV Screening and AI Interview
              if (stage.id === "1" || stage.id === "2") {
                return true;
              }
              // Hide other stages if explicitly disabled
              return stage.enabled !== false;
            })
            .map((stage: any) => {
              return {
                label: stage.alias || stage.name,
                icon: stage.icon,
                stageId: stage.id,
                substageId: stage.substages?.[stage.substages.length - 1]?.id,
              };
            });
          // Add a Comments tab to display interview feedback/comments
          mappedStages.push({
            label: "Comments",
            // When true, hide recruiter evaluation UI for this tab (badge + panel)
            hideEvaluation: true,
          });
          // Add an Activity tab to display activity history
          mappedStages.push({
            label: "Activity",
            stageId: "activity",
            hideEvaluation: true,
          });
          setTabs(mappedStages);

          const stage = getCurrentPipelineStage(response.data.pipelineStages, {
            status: response.data.status,
            currentStep: response.data.currentStep,
            stageId: response.data.stageId,
            substageId: response.data.substageId,
          });

          // Handle case where stage doesn't match due to case sensitivity or missing data
          let stageLabel = 'Unknown Stage';
          let toStageLabel = null;
          let forEvaluation = false;

          if (stage) {
            // Use alias for display if stage is 1 or 2
            const stageFromPipeline = response.data.pipelineStages?.find((s: any) => s.id === stage.stage.id);
            const stageDisplayName = stageFromPipeline?.alias || stage.stage.name;
            stageLabel = `${stageDisplayName} - ${stage.substage.name}`;
            const nextStage = getNextPipelineStage(response.data.pipelineStages, {
              stage: stage.stage.name,
              substage: stage.substage.name,
            });
            if (nextStage) {
              const nextStageFromPipeline = response.data.pipelineStages?.find((s: any) => s.id === nextStage.stage.id);
              const nextStageDisplayName = nextStageFromPipeline?.alias || nextStage.stage.name;
              toStageLabel = `${nextStageDisplayName} - ${nextStage.substage.name}`;
              forEvaluation = nextStage.isLastSubstage;
            }
          } else {
            // Fallback: use currentStepAlias or currentStep and status directly
            stageLabel = `${response.data.currentStepAlias || response.data.currentStep || 'Unknown'} - ${response.data.status || 'Unknown'}`;
          }

          const interviewPayload = {
            ...response.data,
            stage: stageLabel,
            toStage: toStageLabel,
            forEvaluation: forEvaluation,
          };
          setInterview(interviewPayload);
          // Comments initialization removed
          if (recordingToUse) {
            setInterviewRecording(recordingToUse);
          }

          if (response.data.analysis) {
            setAnalysis(response.data.analysis);
            setOverAllScore(response.data.analysis.overall_score);
          }

          if (response.data.summary) {
            setSummary(response.data.summary);
          }

          isLoadingSettingsRef.current = false;
        }

        toast.dismiss();
      } catch (error) {
        console.log(error);
        Swal.fire({
          icon: "error",
          title: "Failed to load interview",
          text: "Redirecting back to careers page...",
          allowOutsideClick: false,
          showConfirmButton: false,
          timer: 3000,
          willOpen: () => {
            window.location.href = "/recruiter-dashboard/careers";
          },
        });
      }
    };
    if (interviewSlug && effectiveOrgID) {
      fetchInterview();
    }
  }, [interviewSlug, effectiveOrgID]);

  useEffect(() => {
    if (tab && tabs.length > 0) {
      const currentTab = tabs.find(
        (t: any) => t.label === tab.replace(/_/g, " ")
      );
      setActiveTab(currentTab);
      setActiveRecruiterEvaluation(currentTab?.evaluation);
      if (currentTab) {
        activeTabLabelRef.current = currentTab.label;
      }
    }
  }, [tabs, tab]);

  useEffect(() => {
    updateScrollGradients();
  }, [tabs, updateScrollGradients]);

  // Update ref when activeTab changes
  useEffect(() => {
    if (activeTab?.label) {
      activeTabLabelRef.current = activeTab.label;
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchTranscripts = async () => {
      try {
        setIsLoadingTranscripts(true);
        const response = await api.post("/api/fetch-transcript", {
          id: sourceInterviewID || interviewSlug,
        });
        console.log("Fetching transcripts", response.data);
        if (response.data?.length > 0) {
          if (!interview.analysis) {
            generateAnalysis(response.data, interview);
          }

          if (!interview.summary) {
            createSummary(response.data, interview);
          }
        }
        setTranscripts(response.data);
        setIsLoadingTranscripts(false);
      } catch (error) {
        console.log(error);
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Something went wrong!",
        });
      }
    };
    if (interview) {
      fetchTranscripts();
    }
  }, [interview, sourceInterviewID]);

  useEffect(() => {
    const fetchRecruiterEvaluations = async () => {
      try {
        setIsLoadingRecruiterEvaluations(true);
        const response = await api.post("/api/get-recruiter-evaluations", {
          interviewID: interview._id,
        });

        if (!response.data || !Array.isArray(response.data)) {
          return;
        }

        const currentTabs = [...tabs];
        currentTabs.forEach((tab: any) => {
          // Identify evaluation by stageId only (ignore substageId to handle pipeline changes/variations)
          // find() returns the first match, and the API sorts by createdAt: -1, so we get the latest evaluation
          let evaluation = response.data.find(
            (evaluation: any) => evaluation.stageId === tab.stageId
          );

          // Fallback for logic:
          // If this tab corresponds to the candidate's current step (case-insensitive due to legacy data inconsistencies),
          // check if there is an evaluation matching the candidate's stored stageId,
          // even if it differs from the pipeline's current stageId.
          if (!evaluation &&
            tab.label &&
            interview.currentStep &&
            tab.label.toLowerCase() === interview.currentStep.toLowerCase()
          ) {
            evaluation = response.data.find(
              (e: any) => e.stageId === interview.stageId
            );
          }

          tab.evaluation = evaluation;

          if (tab.label === "CV Screening") {
            tab.aiEvaluation = {
              matchFit: interview.cvStatus,
              evaluationNotes: interview.cvScreeningReason,
            };
          }
          if (tab.label === "AI Interview") {
            tab.aiEvaluation = {
              matchFit: interview.jobFit,
              evaluationNotes: extractInterviewAssessment(summary),
            };
          }

          if (tab.evaluation || tab.aiEvaluation) {
            tab.hasContent = true;
          }
        });
        setTabs(currentTabs);
        // Preserve current active tab if it exists, otherwise select latest tab
        if (activeTabLabelRef.current) {
          const preservedTab = currentTabs.find(
            (t: any) => t.label === activeTabLabelRef.current
          );
          if (preservedTab) {
            setActiveTab(preservedTab);
            setActiveRecruiterEvaluation(preservedTab?.evaluation);
          } else {
            // If current tab not found, select latest
            const latestTab =
              currentTabs.findLast((tab: any) => tab.hasContent) ||
              currentTabs[0];
            setActiveTab(latestTab);
            setActiveRecruiterEvaluation(latestTab?.evaluation);
            activeTabLabelRef.current = latestTab?.label || null;
          }
        } else {
          // No active tab, select latest
          const latestTab =
            currentTabs.findLast((tab: any) => tab.hasContent) ||
            currentTabs[0];
          setActiveTab(latestTab);
          setActiveRecruiterEvaluation(latestTab?.evaluation);
          activeTabLabelRef.current = latestTab?.label || null;
        }
      } catch (error) {
        console.log(error);
      } finally {
        setIsLoadingRecruiterEvaluations(false);
      }
    };
    if (interview) {
      fetchRecruiterEvaluations();
    }
  }, [interview]);

  // Fetch comments for this interview from standalone comments collection
  useEffect(() => {
    async function fetchCommentsForInterview() {
      if (!interview?.interviewID || !effectiveOrgID) return;
      try {
        setIsLoadingComments(true);
        const res = await api.post("/api/fetch-feedback-comment", {
          interviewID: interview.interviewID,
          orgID: effectiveOrgID,
        });
        const arr = Array.isArray(res?.data?.comments) ? res.data.comments : [];
        setComments(arr);
        // Mark Comments tab as having content if any non-deleted comments exist
        const hasContent = arr.some((c: any) => !c.deleted);
        setTabs((prevTabs: any[]) =>
          prevTabs.map((t) =>
            t.label === "Comments" ? { ...t, hasContent } : t
          )
        );
      } catch (err) {
        // leave comments empty
      } finally {
        setIsLoadingComments(false);
      }
    }
    if (interview) {
      fetchCommentsForInterview();
    }
  }, [interview, effectiveOrgID]);

  useEffect(() => {
    async function fetchFeedback() {
      if (!interview?.interviewID) return;
      try {
        setIsLoadingFeedback(true);
        const res = await api.get("/api/get-candidate-feedback", {
          params: {
            orgID,
            interviewID: interview.interviewID,
          },
        });
        setFeedback(res.data || null);
      } catch (err) {
        setFeedback(null);
      } finally {
        setIsLoadingFeedback(false);
      }
    }
    if (interview && orgID) {
      fetchFeedback();
    }
  }, [interview, orgID]);

  // Comments feature removed

  function updateInterview(id, data, recruiterAction?: any) {
    loadingToast("Updating Interview, please wait...");
    api
      .post("/api/update-interview", {
        uid: id,
        data: data,
        recruiterAction: recruiterAction,
      })
      .then((res) => {
        successToast("Interview updated successfully", 1300);

        setTimeout(() => {
          toast.dismiss();
        }, 800);
      })
      .catch((err) => {
        console.log(err);
        errorToast("Failed to update interview", 1300);

        setTimeout(() => {
          toast.dismiss();
        }, 800);
      });
  }

  // Comments-related utilities and handlers removed

  async function generateAnalysis(trData, details) {
    setIsGeneratingAnalysis(true);
    setAnalysis(null);

    let intSummary = "";

    trData.forEach((msg) => {
      intSummary += `${msg.type === user ? "interviewer" : "applicant"}: ${msg.content
        }\n`;
    });

    let llmPrompt = `
      You are a helpful assistant that can answer questions and help with tasks.
      Take the Job details and interview transcript and create an analysis based on the processing instructions.
      DO NOT mention the applicant's name in the analysis.
  
      Job Details:
        Applicant Name: ${details.name}
        Job Title: ${details.jobTitle}
        Job Description: 
        ${details.jobDescription}
  
      Interview Transcript:
      ${intSummary}
  
      ${analysisPrompt}
      `;

    const response = await api
      .post("/api/llm-reasoner", {
        corePrompt: llmPrompt,
      })
      .then((res) => {
        return res.data.result;
      });

    let codeOuput: any = {};

    try {
      codeOuput = JSON.parse(
        response.replace("```json", "").replace("```", "")
      );
      console.log(codeOuput);

      // save analysis
      updateInterview(details._id, {
        analysis: codeOuput,
        score: codeOuput.overall_score,
        jobFit: codeOuput.final_assessment,
      }, {
        interviewUID: details._id,
        orgID: orgID,
        action: "Generated AI Interview Analysis",
        recruiterEmail: user?.email,
      });

      setTimeout(() => {
        setOverAllScore(codeOuput.overall_score);
        setIsGeneratingAnalysis(false);
      }, 500);
    } catch (err) {
      console.log(err);
      errorToast("Failed to generate analysis, please try again later", 1300);
    }

    setAnalysis(codeOuput);
  }

  async function createSummary(trData, details) {
    setIsGeneratingSummary(true);
    setSummary("");
    let intSummary = "";

    trData.forEach((msg) => {
      intSummary += `${msg.type === user ? "interviewer" : "applicant"}: ${msg.content
        }`;
    });

    let llmPrompt = `
      You are a helpful assistant that can answer questions and help with tasks.
      Take the Job details and interview transcript and create a summary of the interview.
      DO NOT mention the applicant's name in the summary.
    
      Job Details:
        Applicant Name: ${details.name}
        Job Title: ${details.jobTitle}
        Job Description: ${details.jobDescription}
  
      Interview Transcript:
      ${intSummary}
  
      ${summaryPrompt}
      `;

    const response = await api
      .post("/api/llm-reasoner", {
        corePrompt: llmPrompt,
      })
      .then((res) => {
        return res.data.result;
      });

    let formattedSummary = response
      .replace("```markdown", "")
      .replace("```", "");

    // save summary
    updateInterview(details._id, {
      summary: formattedSummary,
    }, {
      interviewUID: details._id,
      orgID: orgID,
      action: "Generated AI Interview Summary",
      recruiterEmail: user?.email,
    });

    setSummary(formattedSummary);
    setIsGeneratingSummary(false);
  }

  function regenInsights() {
    let btnAnalysis = document.getElementById("regen-analysis");
    let btnSummary = document.getElementById("regen-summary");

    if (btnAnalysis) {
      btnAnalysis.click();
    }

    if (btnSummary) {
      btnSummary.click();
    }
  }

  async function deleteInterview() {
    Swal.fire({
      title: "Deleting Interview...",
      text: "Please wait while we delete the Interview...",
      allowOutsideClick: false,
      showConfirmButton: false,
      willOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const response = await api.post("/api/delete-interview", {
        id: interview._id,
      });

      if (response.data.success) {
        Swal.fire({
          title: "Deleted!",
          text: "The interview has been deleted.",
          icon: "success",
          allowOutsideClick: false,
        }).then(() => {
          window.location.href = "/recruiter-dashboard/careers";
        });
      } else {
        Swal.fire({
          title: "Error!",
          text: response.data.error || "Failed to delete the Interview",
          icon: "error",
        });
      }
    } catch (error) {
      console.error("Error deleting Interview:", error);
      Swal.fire({
        title: "Error!",
        text: "An error occurred while deleting the Interview",
        icon: "error",
      });
    }
  }

  async function resetInterviewData() {
    Swal.fire({
      title: "Resetting Interview Data...",
      text: "Please wait while we reset the Interview Data...",
      allowOutsideClick: false,
      showConfirmButton: false,
      willOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const response = await api.post("/api/reset-interview-data", {
        id: interview._id,
      });

      if (response.data.success) {
        Swal.fire({
          title: "Reset!",
          text: "The interview data has been reset.",
          icon: "success",
          allowOutsideClick: false,
        }).then(() => {
          Swal.close();
        });
      } else {
        Swal.fire({
          title: "Error!",
          text: response.data.error || "Failed to reset the Interview",
          icon: "error",
        });
      }
    } catch (error) {
      console.error("Error deleting Interview:", error);
      Swal.fire({
        title: "Error!",
        text: "An error occurred while deleting the Interview",
        icon: "error",
      });
    }
  }

  function onAction(action: string, data?: any) {
    setShowCandidateActionModal("");
    if (action === "delete") {
      deleteInterview();
    }
    if (action === "reset") {
      resetInterviewData();
    }
    if (action === "drop") {
      dropCandidate(data);
    }
    if (action === "endorse") {
      endorseCandidate(data);
    }
  }

  async function dropCandidate(data?: any) {
    Swal.showLoading();
    try {
      const currentStage = getCurrentPipelineStage(pipelineStages, {
        status: interview.status,
        currentStep: interview.currentStep,
        stageId: interview.stageId,
        substageId: interview.substageId,
      });
      const stageName = currentStage?.stage?.name || interview.currentStep;
      const substageName = currentStage?.substage?.name || interview.status;
      const recruiterEvaluation = data?.matchFit
        ? {
          action: "Dropped",
          matchFit: data?.matchFit,
          evaluationNotes: data?.evaluationNotes,
          updatedBy: {
            image: user?.image,
            name: user?.name,
            email: user?.email,
          },
          createdBy: {
            image: user?.image,
            name: user?.name,
            email: user?.email,
          },
          stageId: currentStage?.stage?.id,
          substageId: currentStage?.substage?.id,
        }
        : null;
      const update = {
        applicationStatus: "Dropped",
        updatedAt: Date.now(),
        applicationMetadata: {
          updatedAt: Date.now(),
          updatedBy: {
            image: user?.image,
            name: user?.name,
            email: user?.email,
          },
          action: "Dropped",
        },
      };
      const response = await api.post("/api/update-interview", {
        uid: interview._id,
        data: update,
        automationIdsToUse: data?.automationIdsToUse,
        interviewTransaction: {
          interviewUID: interview._id,
          careerId: career?._id?.toString(),
          fromStage: `${stageName}: ${substageName}`,
          fromStageId: currentStage?.stage?.id,
          fromSubstageId: currentStage?.substage?.id,
          action: "Dropped",
          updatedBy: {
            image: user?.image,
            name: user?.name,
            email: user?.email,
          },
        },
        recruiterEvaluation: recruiterEvaluation,
        recruiterAction: {
          interviewUID: interview._id,
          orgID: career?.orgID,
          action: "Dropped",
          recruiterEmail: user?.email,
        },
      });

      if (response.data.updatedInterview) {
        const stage = getCurrentPipelineStage(pipelineStages, {
          status: response.data.updatedInterview.status,
          currentStep: response.data.updatedInterview.currentStep,
          stageId: response.data.updatedInterview.stageId,
          substageId: response.data.updatedInterview.substageId,
        });

        let stageLabel = `${response.data.updatedInterview.currentStepAlias || response.data.updatedInterview.currentStep || 'Unknown'} - ${response.data.updatedInterview.status || 'Unknown'}`;
        let toStageLabel = null;

        if (stage) {
          const stageFromPipeline = pipelineStages?.find((s: any) => s.id === stage.stage.id);
          const stageDisplayName = stageFromPipeline?.alias || stage.stage.name;
          stageLabel = `${stageDisplayName} - ${stage.substage.name}`;
          const nextStage = getNextPipelineStage(pipelineStages, {
            stage: stage.stage.name,
            substage: stage.substage.name,
          });
          if (nextStage) {
            const nextStageFromPipeline = pipelineStages?.find((s: any) => s.id === nextStage.stage.id);
            const nextStageDisplayName = nextStageFromPipeline?.alias || nextStage.stage.name;
            toStageLabel = `${nextStageDisplayName} - ${nextStage.substage.name}`;
          }
        }

        setInterview({
          ...response.data.updatedInterview,
          stage: stageLabel,
          toStage: toStageLabel,
        });
      }

      candidateActionToast(
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginLeft: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
              Candidate dropped
            </span>
            <span
              style={{
                fontSize: 14,
                color: "#717680",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              You have dropped the candidate from the application process.{" "}
            </span>
          </div>
        </div>,
        1300,
        <i
          className="la la-user-minus"
          style={{ color: "#DC6803", fontSize: 32 }}
        ></i>
      );
    } catch (error) {
      console.error("Error dropping candidate:", error);
      errorToast("Failed to drop candidate", 1300);
    } finally {
      Swal.close();
    }
  }

  async function endorseCandidate(data?: any) {
    Swal.showLoading();
    try {
      const currentStage = getCurrentPipelineStage(pipelineStages, {
        status: interview.status,
        currentStep: interview.currentStep,
        stageId: interview.stageId,
        substageId: interview.substageId,
      });
      const stageName = currentStage?.stage?.name || interview.currentStep;
      const substageName = currentStage?.substage?.name || interview.status;
      const nextStage = getNextPipelineStage(pipelineStages, {
        stage: stageName,
        substage: substageName,
      });
      if (!nextStage) {
        errorToast("Cannot endorse: no next stage found", 1300);
        Swal.close();
        return;
      }
      const recruiterEvaluation = data?.matchFit
        ? {
          action: "Endorsed",
          matchFit: data?.matchFit,
          evaluationNotes: data?.evaluationNotes,
          updatedBy: {
            image: user?.image,
            name: user?.name,
            email: user?.email,
          },
          createdBy: {
            image: user?.image,
            name: user?.name,
            email: user?.email,
          },
          stageId: nextStage?.stage?.id,
          substageId: nextStage?.substage?.id,
        }
        : null;
      const update: any = {
        currentStep: nextStage?.substage.currentStep,
        status: nextStage?.substage.status,
        updatedAt: Date.now(),
        applicationMetadata: {
          updatedAt: Date.now(),
          updatedBy: {
            image: user?.image,
            name: user?.name,
            email: user?.email,
          },
          action: "Endorsed",
        },
        stageId: nextStage?.stage.id,
        substageId: nextStage?.substage.id,
      };
      if (nextStage?.substage.currentStep === "Contract Signed") {
        update.applicationStatus = "Hired";
      }
      const response = await api.post("/api/update-interview", {
        uid: interview._id,
        data: update,
        interviewTransaction: {
          interviewUID: interview._id,
          careerId: career?._id?.toString(),
          fromStage: `${stageName}: ${substageName}`,
          toStage: `${nextStage?.stage.name}: ${nextStage?.substage.name}`,
          fromStageId: currentStage?.stage?.id,
          fromSubstageId: currentStage?.substage?.id,
          toStageId: nextStage?.stage.id,
          toSubstageId: nextStage?.substage.id,
          action: "Endorsed",
          updatedBy: {
            image: user?.image,
            name: user?.name,
            email: user?.email,
          },
        },
        recruiterEvaluation: recruiterEvaluation,
        automationIdsToUse: data?.automationIdsToUse,
        recruiterAction: {
          interviewUID: interview._id,
          orgID: career?.orgID,
          action: "Endorsed",
          recruiterEmail: user?.email,
        },
      });

      if (response.data.updatedInterview) {
        const stage = getCurrentPipelineStage(pipelineStages, {
          status: response.data.updatedInterview.status,
          currentStep: response.data.updatedInterview.currentStep,
          stageId: response.data.updatedInterview.stageId,
          substageId: response.data.updatedInterview.substageId,
        });

        let stageLabel = `${response.data.updatedInterview.currentStepAlias || response.data.updatedInterview.currentStep || 'Unknown'} - ${response.data.updatedInterview.status || 'Unknown'}`;
        let toStageLabel = null;

        if (stage) {
          const stageFromPipeline = pipelineStages?.find((s: any) => s.id === stage.stage.id);
          const stageDisplayName = stageFromPipeline?.alias || stage.stage.name;
          stageLabel = `${stageDisplayName} - ${stage.substage.name}`;
          const nextStageAfter = getNextPipelineStage(pipelineStages, {
            stage: stage.stage.name,
            substage: stage.substage.name,
          });
          if (nextStageAfter) {
            const nextStageFromPipeline = pipelineStages?.find((s: any) => s.id === nextStageAfter.stage.id);
            const nextStageDisplayName = nextStageFromPipeline?.alias || nextStageAfter.stage.name;
            toStageLabel = `${nextStageDisplayName} - ${nextStageAfter.substage.name}`;
          }
        }

        setInterview({
          ...response.data.updatedInterview,
          stage: stageLabel,
          toStage: toStageLabel,
        });
      }

      candidateActionToast(
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginLeft: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
              Candidate endorsed
            </span>
            <span
              style={{
                fontSize: 14,
                color: "#717680",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              You have endorsed the candidate to the next stage.
            </span>
          </div>
        </div>,
        1300,
        <i
          className="la la-user-check"
          style={{ color: "#039855", fontSize: 32 }}
        ></i>
      );
    } catch (error) {
      console.error("Error endorsing candidate:", error);
      errorToast("Failed to endorse candidate", 1300);
    } finally {
      Swal.close();
    }
  }

  function handlePlaybackRateChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    setPlaybackRate(Number(event.target.value));
    if (videoRef.current) {
      videoRef.current.playbackRate = Number(event.target.value);
    }
  }

  const handleExportCandidates = (value: string) => {
    if (value === "PDF") {
      const pdfDownloadLink = document.getElementById("pdf-download-link");
      if (pdfDownloadLink) {
        pdfDownloadLink.click();
      }
    }

    if (value === "DOCS") {
      downloadCandidateAnalysisDocx({
        candidate: interview,
        evaluations: tabs,
        analysis,
        summary,
        feedback,
        transcripts,
        comments,
      }).catch((err) => {
        console.error("DOCX export failed:", err);
        errorToast("Failed to export analysis as DOCX", 1300);
      });
    }
  }

  const isValidExportCandidate = () => {
    return !isLoadingRecording && 
    interview && 
    tabs.length > 0 && 
    !isLoadingTranscripts && 
    !isGeneratingAnalysis && 
    !isGeneratingSummary &&
    !isLoadingComments &&
    !isLoadingFeedback &&
    !isLoadingRecruiterEvaluations;
  }

  return (
    <>
      <HeaderBar
        activeLink="Careers"
        currentPage="Application Details"
        icon="la la-suitcase"
      />
      <div style={{ padding: "16px 20px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          {interview && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginBottom: "35px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  className="candidate-avatar-container"
                  style={{ position: "relative", display: "inline-block" }}
                  onMouseEnter={handleHeaderTooltipMouseEnter}
                  onMouseLeave={handleHeaderTooltipMouseLeave}
                >
                  {interview?.image ? (
                    <AvatarImage
                      src={interview.image}
                      alt={interview?.name || "Candidate"}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: "#E0E0E0",
                        cursor: "pointer",
                        transition: "transform 0.2s ease",
                        transform: showHeaderTooltip
                          ? "scale(1.05)"
                          : "scale(1)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "50%",
                        backgroundColor: "#F8F9FC",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "transform 0.2s ease",
                        transform: showHeaderTooltip
                          ? "scale(1.05)"
                          : "scale(1)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "18px",
                          color: "#3E4784",
                          fontWeight: 500,
                        }}
                      >
                        {interview?.name
                          ?.split(" ")
                          .map((name: string) => name[0])
                          .join("")}
                      </span>
                    </div>
                  )}

                  {showHeaderTooltip && (
                    <CandidateTooltip
                      candidateInfo={{
                        image: interview?.image,
                        name: interview?.name,
                        email: interview?.email,
                      }}
                      candidate={interview}
                      orgID={orgID}
                      onMouseEnter={handleHeaderTooltipMouseEnter}
                      onMouseLeave={handleHeaderTooltipMouseLeave}
                      onEmailClick={() => handleEmailClick(interview, orgID)}
                      onLockChange={setIsTooltipLocked}
                      onClose={() => {
                        setIsTooltipLocked(false);
                        setShowHeaderTooltip(false);
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <h1
                      style={{
                        fontSize: "24px",
                        fontWeight: 550,
                        color: "#111827",
                        margin: 0,
                      }}
                    >
                      {interview?.name}
                    </h1>
                    {interview?.stage && <StageTag stage={interview?.stage} />}
                  </div>
                  <div
                    onClick={() => {
                      router.push(
                        `/recruiter-dashboard/careers/manage/${interview?.careerID}?orgID=${orgID}`
                      );
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <span>
                      for{" "}
                      <span
                        style={{
                          color: "#6172F3",
                          fontWeight: 500,
                          fontSize: 16,
                          borderBottom: "1px solid #6172F3",
                        }}
                      >
                        {interview?.jobTitle}
                      </span>
                    </span>
                    <i
                      className="la la-external-link-alt"
                      style={{
                        fontSize: 16,
                        color: "#6172F3",
                        marginLeft: 4,
                      }}
                    ></i>
                  </div>
                </div>
              </div>
            </div>
          )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                {interview?.applicationStatus !== "Dropped" &&
                interview?.currentStep !== "Contract Signed" && (
                  <>
                <Button
                variant="tertiary-outline"
                  onClick={() => {
                    setShowCandidateActionModal("drop");
                  }}
                  label="Drop Candidate"
                ></Button>
                <Button
                variant="primary"
                  onClick={() => {
                    setShowCandidateActionModal("endorse");
                  }}
                  label="Endorse Candidate"
                  icon="/circle-check.svg"
                ></Button>
                </>
                )}

                <CustomDropdown
                  disabled={!isValidExportCandidate()}
                  setValue={(value: string) => {
                    handleExportCandidates(value);
                  }}
                  value=""
                  options={["PDF", "DOCS"]}
                  iconMap={{
                    PDF: "/icons/fileTypes/pdf.svg",
                    DOCS: "/icons/fileTypes/docx.svg"
                  }}
                  iconJsx={<img src="/icons/download-cloud.svg" alt="Export" style={{ width: 20, height: 20 }} />}
                ></CustomDropdown>
                <div style={{ display: "none" }}>
                  <PDFDownloadLink
                    id="pdf-download-link"
                    key={new Date().toISOString()}
                    document={
                      <CandidateAnalysisDocument
                        candidate={interview}
                        evaluations={tabs}
                        analysis={analysis}
                        summary={summary}
                        feedback={feedback}
                        transcripts={transcripts}
                        comments={comments}
                      />
                    }
                    fileName={`${interview?.name}-Analysis.pdf`}
                  >
                  </PDFDownloadLink>
                </div>

                <button
                  style={{
                    width: "fit-content",
                    background: "#fff",
                    padding: "11px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#535862",
                  }}
                  className="button-v2 secondary"
                  onClick={() => {
                    setShowShareModal(true);
                  }}
                >
                  <img
                    src="/iconsV3/shareV2.svg"
                    alt="Share"
                    style={{ width: 20, height: 20 }}
                  />
                </button>
              </div>
        </div>
        {/* Tabs */}
        <div className="career-tab-container" style={{ marginBottom: 16, position: "relative" }}>
          {showLeftGradient && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 48,
                background: "linear-gradient(to right, #fff 0%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}
          {showRightGradient && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: 48,
                background: "linear-gradient(to left, #fff 0%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}
          <div
            ref={tabsScrollRef}
            className="career-tab-content"
            onScroll={updateScrollGradients}
          >
            {tabs.map((tab: any, index: number) => (
              <div
                key={index}
                className={`career-tab-item ${activeTab?.label === tab.label ? "active" : ""
                  }`}
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                onClick={() => {
                  setActiveTab(tab);
                  setActiveRecruiterEvaluation(tab.evaluation);
                  activeTabLabelRef.current = tab.label;
                }}
              >
                {tab.icon && (
                  <i className={tab.icon} style={{ fontSize: 24 }} />
                )}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.label === "Comments" && totalComments > 0 && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: 6,
                        minWidth: 24,
                        height: 24,
                        padding: "0 8px",
                        borderRadius: 999,
                        border: "1px solid #E6EEF8",
                        background: "#FFFFFF",
                        color: "#111827",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {totalComments}
                    </span>
                  )}
                </span>
                {!tab.hideEvaluation &&
                  (tab.evaluation || tab.aiEvaluation) && (
                    <CareerFit
                      fit={
                        tab.evaluation?.matchFit ||
                        tab.aiEvaluation?.matchFit ||
                        "N/A"
                      }
                      assessment={
                        tab.evaluation?.evaluationNotes ||
                        tab.aiEvaluation?.evaluationNotes ||
                        "N/A"
                      }
                      candidateDetails={interview}
                      evaluatorName={tab.evaluation?.updatedBy?.name ? tab.evaluation?.updatedBy?.name?.split(" ")[0] : "Jia"}
                    />
                  )}
              </div>
            ))}
          </div>
        </div>
        {activeTab && !activeTab.hideEvaluation && (
          <RecruiterEvaluation
            evaluation={activeRecruiterEvaluation}
            enableEdit={true}
            interview={{
              ...interview,
              evaluationStageId: activeTab?.stageId,
              evaluationSubstageId: activeTab?.substageId,
            }}
            onAction={(action, data) => {
              const newTab = { ...activeTab, evaluation: data };
              setTabs(
                tabs.map((tab: any) =>
                  tab.label === activeTab.label ? newTab : tab
                )
              );
              setActiveRecruiterEvaluation(data);
            }}
          />
        )}
        {activeTab?.label &&
          !["1", "2"].includes(activeTab.stageId) &&
          activeTab.label !== "Comments" &&
          activeTab.label !== "Activity" && (
            <StageAttachments
              attachments={
                interview?.stageAttachments?.find(
                  (b: any) =>
                    b.stageId === activeTab?.stageId &&
                    b.substageId === activeTab?.substageId
                )?.attachments || []
              }
              interviewId={interview?.interviewID}
              stageId={activeTab?.stageId}
              substageId={activeTab?.substageId}
              orgID={effectiveOrgID}
              user={user}
              onUploadComplete={async () => {
                // Refetch interview to get updated attachments
                try {
                  const response = await api.post("/api/interview-details", {
                    id: interviewSlug,
                    orgID: effectiveOrgID,
                  });
                  setInterview((prev: any) => ({
                    ...prev,
                    stageAttachments: response.data.stageAttachments,
                  }));
                } catch (err) {
                  console.error("Failed to refresh attachments", err);
                }
              }}
              onDeleteAttachment={async (attachmentId: string) => {
                if (!interview?.interviewID || !activeTab?.stageId || !activeTab?.substageId)
                  return;

                await api.post("/api/stage-attachments/delete", {
                  interviewId: interview.interviewID,
                  stageId: activeTab.stageId,
                  substageId: activeTab.substageId,
                  attachmentId,
                  orgID: effectiveOrgID,
                });

                const response = await api.post("/api/interview-details", {
                  id: interviewSlug,
                  orgID: effectiveOrgID,
                });
                setInterview((prev: any) => ({
                  ...prev,
                  stageAttachments: response.data.stageAttachments,
                }));
              }}
            />
          )}
        {activeTab?.stageId === "1" && (
          <CandidateCVAnalysisV2
            candidate={interview}
            interviews={[interview]}
            setInterviews={(updatedInterviews) => {
              setInterview(updatedInterviews?.[0]);
            }}
            includePreScreeningQuestions={true}
          />
        )}
        {activeTab?.stageId === "2" && (
          <>
            {interview?.retakeRequest &&
              !["Approved", "Rejected"].includes(
                interview?.retakeRequest?.status
              ) && (
                <RetakeInterviewRequestV2
                  interviewDetails={interview}
                  pipelineStages={pipelineStages}
                />
              )}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                width: "100%",
                gap: 16,
                alignItems: "flex-start",
                marginTop: 16,
              }}
            >
              <div
                style={{
                  width: "60%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div className="layered-card-outer">
                  <div className="layered-card-middle">
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            backgroundColor: "#181D27",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i
                            className="la la-chart-area"
                            style={{ color: "#FFFFFF", fontSize: 20 }}
                          ></i>
                        </div>
                        <span
                          style={{
                            fontSize: 16,
                            color: "#181D27",
                            fontWeight: 700,
                          }}
                        >
                          Interview Analysis
                        </span>
                      </div>
                      <Button
                        disabled={
                          isGeneratingAnalysis || transcripts.length === 0
                        }
                        id="regen-analysis"
                        onClick={() => {
                          generateAnalysis(transcripts, interview);
                        }}
                        variant="secondary"
                        label="Regenerate"
                        icon="/redo.svg"
                      >
                      </Button>
                    </div>
                    <div className="layered-card-content">
                      {isGeneratingAnalysis ? (
                        <LoadingAnimation
                          text="Generating Analysis..."
                          subtext="Jia is generating AI Analysis..."
                        />
                      ) : analysis ? (
                        <>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                            }}
                          >
                            {overAllScore !== undefined ? (
                              <CircularProgress
                                percentage={overAllScore}
                                size={160}
                                strokeWidth={15}
                                showLabel={true}
                                label="Overall Score"
                                fontSize={20}
                                labelFontSize={10}
                              />
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  padding: "16px 24px",
                                }}
                              >
                                <span>No score available</span>
                              </div>
                            )}
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                width: "70%",
                              }}
                            >
                              {analysis?.final_assessment && (
                                <CareerFit
                                  fit={analysis?.final_assessment}
                                  assessment={extractInterviewAssessment(
                                    summary
                                  )}
                                  candidateDetails={interview}
                                  evaluatorName={"Jia"}
                                />
                              )}
                              <Tooltip
                                className="career-fit-tooltip fade-in"
                                id="career-fit-tooltip"
                                clickable={true}
                              />
                              {analysis?.assessment_reason && (
                                <div className="markdown-content">
                                  <span>{analysis?.assessment_reason}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <ApplicantQualities analysis={analysis} />
                        </>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            padding: "16px 24px",
                          }}
                        >
                          <span>No analysis available</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="layered-card-outer">
                  <div className="layered-card-middle">
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            backgroundColor: "#181D27",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i
                            className="la la-file-alt"
                            style={{ color: "#FFFFFF", fontSize: 20 }}
                          ></i>
                        </div>
                        <span
                          style={{
                            fontSize: 16,
                            color: "#181D27",
                            fontWeight: 700,
                          }}
                        >
                          Interview Summary
                        </span>
                      </div>
                      <Button
                        disabled={
                          isGeneratingSummary || transcripts.length === 0
                        }
                        id="regen-summary"
                        onClick={() => {
                          createSummary(transcripts, interview);
                        }}
                        variant="secondary"
                        label="Regenerate"
                        icon="/redo.svg"
                      >
                      </Button>
                    </div>
                    <div className="layered-card-content">
                      {isGeneratingSummary ? (
                        <LoadingAnimation
                          text="Generating Summary..."
                          subtext="Working on generating the interview summary..."
                        />
                      ) : summary ? (
                        <CustomMarkdown content={summary} />
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            padding: "16px 24px",
                          }}
                        >
                          <span>No summary available</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="layered-card-outer">
                  <div className="layered-card-middle">
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            backgroundColor: "#181D27",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i
                            className="la la-microphone"
                            style={{ color: "#FFFFFF", fontSize: 20 }}
                          ></i>
                        </div>
                        <span
                          style={{
                            fontSize: 16,
                            color: "#181D27",
                            fontWeight: 700,
                          }}
                        >
                          Interview Transcript
                        </span>
                        {transcripts.length > 0 && (
                          <div
                            style={{
                              fontSize: 12,
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              borderRadius: "60px",
                              padding: "5px",
                              border: "1px solid #D5D7DA",
                            }}
                          >
                            Duration:
                            {(() => {
                              const startTime = new Date(transcripts[0].time);
                              const endTime = new Date(
                                transcripts[transcripts.length - 1].time
                              );
                              const durationMs =
                                endTime.getTime() - startTime.getTime();
                              const minutes = Math.floor(durationMs / 60000);
                              const seconds = Math.floor(
                                (durationMs % 60000) / 1000
                              );
                              return `${minutes}m ${seconds}s`;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="layered-card-content">
                      {isLoadingTranscripts ? (
                        <LoadingAnimation
                          text="Loading Transcripts..."
                          subtext="Fetching the interview transcript..."
                        />
                      ) : transcripts.length > 0 ? (
                        <>
                          {transcripts.map((msg, idx) => {
                            return (
                              <React.Fragment key={idx}>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <strong>
                                    {msg.type === "user"
                                      ? `${interview
                                        ? interview.name
                                        : "Applicant"
                                      }`
                                      : "Jia"}
                                  </strong>{" "}
                                  <small>
                                    {moment(msg.time).format("hh:mm A")}
                                  </small>
                                  <div
                                    style={{
                                      width: "1px",
                                      height: "20px",
                                      backgroundColor: "#E9EAEB",
                                      margin: "0 5px",
                                    }}
                                  ></div>
                                  <small
                                    title={
                                      "Amount of time from the last message"
                                    }
                                  >
                                    {idx > 0
                                      ? (() => {
                                        const duration = moment.duration(
                                          moment(msg.time).diff(
                                            moment(transcripts[idx - 1].time)
                                          )
                                        );
                                        const seconds = duration.asSeconds();
                                        const minutes = Math.floor(
                                          seconds / 60
                                        );
                                        return seconds >= 60
                                          ? `${minutes}m ${(
                                            seconds -
                                            minutes * 60
                                          ).toFixed(1)}s`
                                          : `${seconds.toFixed(1)}s`;
                                      })()
                                      : "0.0s"}
                                  </small>
                                </div>
                                <div
                                  style={{
                                    backgroundColor:
                                      msg.type === "user"
                                        ? "#F8F9FC"
                                        : "#EFF8FF",
                                    borderRadius: "8px 20px 20px 20px",
                                    border: "1px solid #E9EAEB",
                                    padding: "8px 16px",
                                    width: "fit-content",
                                  }}
                                >
                                  {msg.content}
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            padding: "16px 24px",
                          }}
                        >
                          <span>No transcript available</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              <div
                style={{
                  width: "40%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div className="layered-card-outer">
                  <div className="layered-card-middle">
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        width: "100%",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          backgroundColor: "#181D27",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <i
                          className={`la la-${interviewRecording?.filetype.includes("audio")
                            ? "microphone"
                            : "video"
                            }`}
                          style={{ color: "#FFFFFF", fontSize: 20 }}
                        ></i>
                      </div>
                      <span
                        style={{
                          fontSize: 16,
                          color: "#181D27",
                          fontWeight: 700,
                        }}
                      >
                        {interviewRecording?.filetype.includes("audio")
                          ? "Audio Recording"
                          : "Video Recording"}
                      </span>
                    </div>
                    <div className="layered-card-content">
                      {isLoadingRecording ? (
                        <LoadingAnimation
                          text="Loading Recording..."
                          subtext="Fetching the interview recording..."
                        />
                      ) : interviewRecording ? (
                        interviewRecording?.filetype.includes("audio") ? (
                          <audio
                            style={{ width: "100%" }}
                            className="shadow-sm"
                            preload="auto"
                            controls
                            onError={(e) => {
                              console.error("Audio playback error:", e);
                            }}
                          >
                            <source
                              src={`https://cdn.hellojia.ai/${interviewRecording.filename}`}
                              type={interviewRecording.filetype}
                            />
                          </audio>
                        ) : (
                          <>
                            <video
                              ref={videoRef}
                              style={{ width: "100%" }}
                              preload="metadata"
                              controls
                              src={`https://cdn.hellojia.ai/${interviewRecording.filename}`}
                            />
                            {/*
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 16,
                              }}
                            >
                              <span
                                style={{ fontSize: "14px", fontWeight: 550 }}
                              >
                                Playback Speed
                              </span>
                              <select
                                value={playbackRate}
                                onChange={handlePlaybackRateChange}
                              >
                                <option value="1">1x</option>
                                <option value="1.25">1.25x</option>
                                <option value="1.5">1.5x</option>
                                <option value="2">2x</option>
                              </select>
                            </div>
                            */}
                          </>
                        )
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            padding: "16px 24px",
                          }}
                        >
                          <span>No recording available</span>
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          marginTop: 16,
                        }}
                      >
                        <span style={{ fontSize: "14px", fontWeight: 500 }}>
                          Interview taken on
                        </span>
                        <span
                          style={{ fontSize: "12px", color: "#6B7280", textAlign: "right" }}
                        >
                          {transcripts?.[0]?.time
                            ? new Date(
                              transcripts?.[0]?.time
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="layered-card-outer">
                  <div className="layered-card-middle">
                    <span
                      style={{
                        fontSize: 16,
                        color: "#181D27",
                        fontWeight: 700,
                        marginLeft: 16,
                      }}
                    >
                      Candidate Information
                    </span>

                    <div className="layered-card-content">
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div
                          className="d-flex align-items-center"
                          style={{ gap: "10px" }}
                        >
                          {interview?.image && (
                            <AvatarImage
                              src={interview.image}
                              alt="Candidate"
                            />
                          )}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "5px",
                            }}
                          >
                            <span style={{ fontSize: "14px", fontWeight: 550 }}>
                              {interview?.name || ""}
                            </span>
                            <span
                              style={{ fontSize: "12px", color: "#6B7280" }}
                            >
                              {interview?.email}
                            </span>
                          </div>
                        </div>
                        <button
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            backgroundColor: "#FFFFFF",
                            borderRadius: "8px",
                            padding: "5px 10px",
                            border: "1px solid #D5D7DA",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setShowCandidateModal(true);
                          }}
                        >
                          <i
                            className="la la-user"
                            style={{ color: "#414651", fontSize: 16 }}
                          ></i>
                          <span>View Candidate Details</span>
                        </button>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            width: "100%",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <span style={{ fontSize: "14px", fontWeight: 500 }}>
                              Joined on
                            </span>
                            <span
                              style={{ fontSize: "12px", color: "#6B7280", textAlign: "right" }}
                            >
                              {interview?.createdAt
                                ? new Date(
                                  interview?.createdAt
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="layered-card-outer">
                  <div className="layered-card-middle">
                    <span
                      style={{
                        fontSize: 16,
                        color: "#181D27",
                        fontWeight: 700,
                        marginLeft: 16,
                      }}
                    >
                      Settings
                    </span>

                    <div className="layered-card-content">
                      <button
                        disabled={
                          isGeneratingAnalysis ||
                          isGeneratingSummary ||
                          transcripts.length === 0
                        }
                        onClick={() => {
                          regenInsights();
                        }}
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          backgroundColor: "#FFFFFF",
                          borderRadius: "8px",
                          padding: "5px 10px",
                          border: "1px solid #D5D7DA",
                          cursor: "pointer",
                        }}
                      >
                        <i
                          className="la la-sync-alt"
                          style={{ color: "#414651", fontSize: 16 }}
                        ></i>
                        <span>Regenerate All Insights</span>
                      </button>
                      <span
                        style={{
                          fontSize: "14px",
                          color: "#717680",
                          textAlign: "center",
                        }}
                      >
                        Trigger the button below to delete the interview
                        transcript and set the status to "For Interview".
                      </span>
                      <button
                        onClick={() => {
                          // resetInterviewData();
                          setShowCandidateActionModal("reset");
                        }}
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          backgroundColor: "#FEF3F2",
                          color: "#B32318",
                          borderRadius: "8px",
                          padding: "5px 10px",
                          border: "1px solid #D5D7DA",
                          cursor: "pointer",
                        }}
                      >
                        <i
                          className="la la-redo-alt"
                          style={{ color: "#B32318", fontSize: 16 }}
                        ></i>
                        <span>Reset Interview Data</span>
                      </button>
                    </div>
                  </div>
                </div>

                {feedback && (
                  <div className="layered-card-outer">
                    <div className="layered-card-middle">
                      <span
                        style={{
                          fontSize: 16,
                          color: "#181D27",
                          fontWeight: 700,
                          marginLeft: 16,
                        }}
                      >
                        Feedback
                      </span>

                      <div className="layered-card-content">
                        {/* Star Rating */}
                        <div
                          style={{
                            fontSize: "1.25rem",
                            color: "#FFD600",
                            letterSpacing: "0.18em",
                            display: "flex",
                            gap: "0.25em",
                            justifyContent: "center",
                          }}
                        >
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span
                              key={i}
                              style={{
                                color:
                                  i <= feedback.rating ? "#FFD600" : "#ddd",
                                transition: "color 0.2s",
                                marginRight: i < 5 ? 8 : 0,
                              }}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        {feedback?.feedback && (
                          <span
                            style={{
                              fontSize: "14px",
                              color: "black",
                              textAlign: "left",
                            }}
                          >
                            "{feedback?.feedback}"
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="layered-card-outer">
                  <div className="layered-card-middle">
                    <span
                      style={{
                        fontSize: 16,
                        color: "#181D27",
                        fontWeight: 700,
                        marginLeft: 16,
                      }}
                    >
                      Advanced Settings
                    </span>

                    <div className="layered-card-content">
                      <button
                        onClick={() => {
                          setShowCandidateActionModal("delete");
                        }}
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          backgroundColor: "#FEF3F2",
                          color: "#B32318",
                          borderRadius: "8px",
                          padding: "5px 10px",
                          border: "1px solid #B32318",
                          cursor: "pointer",
                        }}
                      >
                        <i
                          className="la la-trash"
                          style={{ color: "#B32318", fontSize: 16 }}
                        ></i>
                        <span>Delete this interview</span>
                      </button>
                      <span
                        style={{
                          fontSize: "14px",
                          color: "#717680",
                          textAlign: "center",
                        }}
                      >
                        Be careful, this action cannot be undone.
                      </span>
                    </div>
                  </div>
                </div>

                <LayeredCard
                  innerCardStyle={{
                    border: "1px solid #ddd",
                    background: "#fff !important",
                  }}
                  style={{
                    border: "1px solid #ddd",
                    background: "#fff !important",
                  }}
                  innerCardClassName="bg-white px-4 py-3"
                >
                  <h3>Error Logs</h3>
                  <LogsExplorer interviewID={interview.interviewID} />
                </LayeredCard>
              </div>
            </div>
          </>
        )}
        {/* Comments Section */}
        {activeTab?.label === "Comments" && (
          <CommentThreads
            interview={interview}
            effectiveOrgID={effectiveOrgID}
            user={user}
            comments={comments}
            setComments={setComments}
            teamMembers={career?.teamMembers}
          />
        )}
        {/* Activity History Section */}
        {activeTab?.label === "Activity" && (
          <ActivityTracker
            orgID={effectiveOrgID}
            candidate={interview ? {
              ...interview,
              candidateId: interview?.candidateId || interview?._id,
              interviewUID: interview?.interviewUID || interview?._id,
            } : null}
            career={interview ? {
              _id: interview?.careerId,
              id: interview?.id,
              jobTitle: interview?.jobTitle,
            } : null}
          />
        )}
        {showCandidateModal && (
          <CandidateModal
            candidate={interview}
            setShowCandidateModal={setShowCandidateModal}
          />
        )}
        {showCandidateActionModal && (() => {
          const currentStage = getCurrentPipelineStage(pipelineStages, {
            status: interview.status,
            currentStep: interview.currentStep,
            stageId: interview.stageId,
            substageId: interview.substageId,
          });
          const fromStageName = currentStage?.stage?.name || interview.currentStep;
          const fromSubstageName = currentStage?.substage?.name || interview.status;
          const nextStage = getNextPipelineStage(pipelineStages, {
            stage: fromStageName,
            substage: fromSubstageName,
          });
          const isEndorse = showCandidateActionModal === "endorse";
          const targetStageName = isEndorse ? nextStage?.stage?.name : fromStageName;
          const targetSubstageName = isEndorse ? nextStage?.substage?.name : fromSubstageName;
          const targetStageFromPipeline = pipelineStages?.find((s: any) => s.name === targetStageName);
          const targetSubstageFromPipeline = targetStageFromPipeline?.substages?.find(
            (s: any) => s.name === targetSubstageName,
          );
          return (
            <CandidateActionModal
              candidate={interview}
              onAction={onAction}
              action={showCandidateActionModal}
              nextstage={targetStageName}
              substage={targetSubstageName}
              nextStageId={targetStageFromPipeline?.id}
              nextSubstageId={targetSubstageFromPipeline?.id}
              fromStage={fromStageName}
              fromSubstage={fromSubstageName}
              careerId={career?._id?.toString()}
            />
          );
        })()}
        {/* Delete comment modal removed */}
        {showShareModal && (
          <ShareModalV2
            interview={interview}
            setShowShareModal={setShowShareModal}
          />
        )}
      </div>
    </>
  );
}

function StageTag({ stage }: { stage: string }) {
  return (
    <div
      style={{
        borderRadius: "60px",
        border: "1px solid #FEDF89",
        backgroundColor: "#FFFAEB",
        color: "#B54708",
        fontSize: "12px",
        width: "fit-content",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        whiteSpace: "nowrap",
        padding: "5px 10px",
      }}
    >
      <div
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          backgroundColor: "#B54708",
          marginRight: "5px",
        }}
      />{" "}
      {stage}
    </div>
  );
}
