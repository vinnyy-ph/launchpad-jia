"use client";
import { useEffect, useRef, useState } from "react";
import CareerFit from "./CareerFit";
import Markdown from "react-markdown";
import { useAppContext } from "../../context/AppContext";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import {
  errorToast,
  extractInterviewAssessment,
  loadingToast,
  successToast,
} from "@/lib/Utils";
import { toast } from "react-toastify";
import CardTypingLoader from "../AnalysisComponents/CardTypingLoader";
import CandidateModal from "../CandidateComponents/CandidateModal";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { CandidateCVDocument } from "../CandidateComponents/CandidateCVDocument";
import CircularProgress from "../CandidateComponents/CircularProgress";
import LoadingAnimation from "../Loaders/LoadingAnimation";
import { DEFAULT_JOB_PIPELINE } from "../../utils/constants";
import RecruiterEvaluation from "./RecruiterEvaluation";
import EvaluationByJiaV2 from "@/lib/components/CandidateComponents/EvaluationByJiaV2";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../ui";
import CustomMarkdown from "../ui/markdown/CustomMarkdown";
import ApplicantQualities from "../CandidateComponents/ApplicantQualities";

const ChevronDownIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 8L10 13L15 8"
      stroke="#A4A7AE"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronUpIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15 12L10 7L5 12"
      stroke="#A4A7AE"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function CandidateMenu({
  handleCandidateMenuOpen,
  pipelineStages,
  candidate,
  handleCandidateCVOpen,
  handleEndorseCandidate,
  handleDropCandidate,
  handleCandidateAnalysisComplete,
  handleRetakeInterview,
  canManageCandidates = true,
}: any) {
  const [sectionsOpen, setSectionsOpen] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState(null);
  const [summary, setSummary] = useState(null);
  const [overAllScore, setOverAllScore] = useState(null);
  const [summaryPrompt, setSummaryPrompt] = useState(null);
  const [analysisPrompt, setAnalysisPrompt] = useState(null);
  const [transcripts, setTranscripts] = useState(null);
  const [interviewDetails, setInterviewDetails] = useState(null);
  const isLoadingSettingsRef = useRef(false);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(true);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(true);
  const [candidateDetailsOpen, setCandidateDetailsOpen] = useState(false);
  const { user } = useAppContext();
  const [cvData, setCvData] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [regenerateCVLoading, setRegenerateCVLoading] = useState(false);
  const [cvAnalysis, setCvAnalysis] = useState(null);
  const [sections, setSections] = useState([]);
  const [currentStageDisplay, setCurrentStageDisplay] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgID = searchParams.get("orgID");

  useEffect(() => {
    if (pipelineStages && candidate) {
      const stageIndex = pipelineStages.findIndex(
        (s) => s.id === candidate.stageId || s.name === candidate.stage
      );
      const currentStage = pipelineStages[stageIndex];
      setCurrentStageDisplay(currentStage?.alias || currentStage?.name || candidate?.stage || "");
      
      const sections = pipelineStages
        ?.slice(0, -1)
        .filter((_s, index) => index <= stageIndex)
        .reverse()
        .map((stage) => ({
          name: stage.name,
          displayName: stage.alias || stage.name,
          id: stage.id,
          icon: stage.icon,
        }));
      setSections(sections);
      setSectionsOpen([sections?.[0]?.id]);
    }
  }, [pipelineStages, candidate]);

  useEffect(() => {
    const fetchInterviewDetails = async () => {
      loadingToast("Loading, please wait...");
      try {
        if (!isLoadingSettingsRef.current) {
          isLoadingSettingsRef.current = true;
          const configResponse = await api.post("/api/fetch-global-settings", {
            fields: { summary_prompt: 1, analysis_prompt: 1 },
          });

          setSummaryPrompt(configResponse.data.summary_prompt?.prompt || "");
          setAnalysisPrompt(configResponse.data.analysis_prompt?.prompt || "");
          const interviewDetailsResponse = await api.post(
            "/api/interview-details",
            {
              id: candidate.interviewID,
            }
          );
          setInterviewDetails(interviewDetailsResponse.data);

          if (
            interviewDetailsResponse.data?.cvStatus &&
            interviewDetailsResponse.data?.cvStatus !== "No CV"
          ) {
            setCvAnalysis({
              cvStatus: interviewDetailsResponse.data.cvStatus,
              cvScreeningReason:
                interviewDetailsResponse.data.cvScreeningReason,
              cvAnalysisV2: interviewDetailsResponse.data.cvAnalysisV2 || null,
            });
          }

          if (interviewDetailsResponse.data?.analysis) {
            setAnalysis(interviewDetailsResponse.data.analysis);
            setOverAllScore(
              interviewDetailsResponse.data.analysis.overall_score
            );
            setIsGeneratingAnalysis(false);
          }

          if (interviewDetailsResponse.data?.summary) {
            setSummary(interviewDetailsResponse.data.summary);
            setIsGeneratingSummary(false);
          }

          isLoadingSettingsRef.current = false;
        }
      } catch (error) {

        errorToast("Failed to load candidate analysis", 1300);
      } finally {
        toast.dismiss();
      }
    };

    if (candidate?.interviewID) {
      fetchInterviewDetails();
    }
  }, [candidate?.interviewID]);

  useEffect(() => {
    const fetchTranscripts = async () => {
      try {
        const transcriptResponse = await api.post("/api/fetch-transcript", {
          id: interviewDetails?.interviewID,
        });

        if (transcriptResponse.data?.length > 0) {
          if (!interviewDetails.analysis) {
            generateAnalysis(transcriptResponse.data, interviewDetails);
          }

          if (!interviewDetails.summary) {
            createSummary(transcriptResponse.data, interviewDetails);
          }

          setTranscripts(transcriptResponse.data);
        } else {
          // Set generating analysis and summary to false
          setIsGeneratingAnalysis(false);
          setIsGeneratingSummary(false);
        }
      } catch (error) {

        errorToast("Failed to load candidate analysis", 1300);
      }
    };
    if (interviewDetails) {
      fetchTranscripts();
    }
  }, [interviewDetails]);

  useEffect(() => {
    const fetchCVData = async () => {
      try {
        const response = await api.post("/api/load-user-cv", {
          email: interviewDetails?.email,
        });
        if (response?.data?.digitalCV) {
          setCvData(response.data.digitalCV);
        }
      } catch (error) {

        errorToast("Failed to load candidate CV", 1300);
      }
    };

    if (interviewDetails) {
      fetchCVData();
    }
  }, [interviewDetails]);

  useEffect(() => {
    const fetchRecruiterEvaluations = async () => {
      try {
        const response = await api.post("/api/get-recruiter-evaluations", {
          interviewID: interviewDetails._id,
        });
        if (response.data.length > 0) {
          setEvaluations(response.data);
        }
      } catch (error) {

        errorToast("Failed to load recruiter evaluations", 1300);
      }
    };
    if (interviewDetails) {
      fetchRecruiterEvaluations();
    }
  }, [interviewDetails]);

  const handleViewCV = (e: any) => {
    e.stopPropagation();
    handleCandidateCVOpen(candidate);
  };

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

        errorToast("Failed to update interview", 1300);

        setTimeout(() => {
          toast.dismiss();
        }, 800);
      });
  }

  async function generateAnalysis(trData, details) {
    setIsGeneratingAnalysis(true);
    setAnalysis(null);
    setOverAllScore(null);

    let intSummary = "";

    trData.forEach((msg) => {
      intSummary += `${msg.type === user ? "interviewer" : "applicant"}: ${
        msg.content
      }\n`;
    });

    let llmPrompt = `
        You are a helpful assistant that can answer questions and help with tasks.
        Take the Job details and interview transcript and create an analysis based on the processing instructions.
    
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

      handleCandidateAnalysisComplete({
        ...candidate,
        analysis: codeOuput,
        score: codeOuput.overall_score,
        jobFit: codeOuput.final_assessment,
      });

      setTimeout(() => {
        setOverAllScore(codeOuput.overall_score);
      }, 500);
    } catch (err) {

      errorToast("Failed to generate analysis, please try again later", 1300);
    }

    setAnalysis(codeOuput);
    setIsGeneratingAnalysis(false);
  }

  async function createSummary(trData, details) {
    setIsGeneratingSummary(true);
    setSummary("");
    let intSummary = "";

    trData.forEach((msg) => {
      intSummary += `${msg.type === user ? "interviewer" : "applicant"}: ${
        msg.content
      }`;
    });

    let llmPrompt = `
        You are a helpful assistant that can answer questions and help with tasks.
        Take the Job details and interview transcript and create a summary of the interview.
      
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

  async function regenerateCV() {
    setRegenerateCVLoading(true);
    setCvAnalysis(null);
    try {
      // V2 structured screening first; fall back to V1 for legacy careers.
      const v2 = await api.post("/api/analyze-cv-v2", {
        interviewID: interviewDetails.interviewID,
        userEmail: interviewDetails.email,
      });

      if (v2?.data?.cvAnalysisV2) {
        setCvAnalysis({ cvAnalysisV2: v2.data.cvAnalysisV2 });
        handleCandidateAnalysisComplete({
          ...candidate,
          cvAnalysisV2: v2.data.cvAnalysisV2,
        });
      } else {
        if (v2?.data?.error) errorToast(v2.data.error, 1500);
        const response = await api.post("/api/analyze-cv", {
          interviewID: interviewDetails.interviewID,
          userEmail: interviewDetails.email,
        });

        if (response?.data?.update) {
          setCvAnalysis({
            cvStatus: response.data.update.cvStatus,
            cvScreeningReason: response.data.update.cvScreeningReason,
          });
          handleCandidateAnalysisComplete({
            ...candidate,
            cvStatus: response.data.update.cvStatus,
            cvScreeningReason: response.data.update.cvScreeningReason,
          });
        }
      }
    } catch (error) {

      errorToast("Failed to regenerate CV Analysis", 1300);
    } finally {
      setRegenerateCVLoading(false);
    }
  }

  const handleSectionOpen = (sectionId: string) => {
    const newSectionsOpen = [...sectionsOpen];
    if (newSectionsOpen.includes(sectionId)) {
      newSectionsOpen.splice(newSectionsOpen.indexOf(sectionId), 1);
    } else {
      newSectionsOpen.push(sectionId);
    }
    setSectionsOpen(newSectionsOpen);
  };

  const getEvaluation = (sectionId: string) => {
    return evaluations?.find((evaluation) => evaluation.stageId === sectionId);
  };

  return (
    <div className="candidate-side-menu">
      <div className="candidate-side-menu-content">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
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
            <h1>Candidate Analysis</h1>
            <Button
            variant="secondary"
              onClick={() => {
                router.push(
                  `/recruiter-dashboard/careers/manage/${candidate?.id}/interview-analysis/${candidate?.interviewID}?orgID=${orgID}`
                );
              }}
            label="Full application details"
            icon="/iconsV3/external-link.svg"
            iconPosition="right"
            >
            </Button>
          </div>
          <button
            style={{ background: "none", border: "none", cursor: "pointer" }}
            onClick={handleCandidateMenuOpen}
          >
            <i className="la la-times"></i>
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div
            onClick={() => setCandidateDetailsOpen(true)}
            className="candidate-info-section"
          >
            <img
              alt={candidate?.name}
              src={candidate?.image}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#E0E0E0",
              }}
            />
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                {candidate?.name}
              </div>
              <div style={{ fontSize: 12, color: "#787486" }}>
                {candidate?.email}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: 8,
              borderRadius: "60px",
              background: "#F8F9FC",
              border: "1px solid #D5D9EB",
              padding: "0px 10px",
              maxWidth: "fit-content",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#4E5BA6",
              }}
            />
            <span style={{ fontSize: 14, color: "#363F72", fontWeight: 700 }}>
              Stage: {currentStageDisplay}
            </span>
          </div>
        </div>

        {/* Drop and Endorse buttons */}
        {canManageCandidates && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 8,
              marginBottom: "16px",
              width: "100%",
            }}
          >
            {candidate?.retakeRequest &&
              !["Approved", "Rejected"].includes(
                candidate?.retakeRequest?.status
              ) && (
                <Button
                variant="primary"
                  style={{
                    width: "50%",
                  }}
                  onClick={() => {
                    handleRetakeInterview(candidate);
                  }}
                  label="Review Retake Request"
                  icon="/exclamation-circle.svg"
                >
                </Button>
              )}
            {candidate?.currentStep !== "Contract Signed" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width:
                    candidate?.retakeRequest &&
                    !["Approved", "Rejected"].includes(
                      candidate?.retakeRequest?.status
                    )
                      ? "50%"
                      : "100%",
                }}
              >
                <Button
                variant="tertiary-outline"
                  style={{
                    width: "50%",
                  }}
                  onClick={() => {
                    handleCandidateMenuOpen();
                    handleDropCandidate(candidate);
                  }}
                  label="Drop Candidate"
                >
                </Button>
                <Button
                variant="primary"
                  style={{
                    width: "50%",
                  }}
                  onClick={() => {
                    handleCandidateMenuOpen();
                    handleEndorseCandidate(candidate);
                  }}
                  label="Endorse Candidate"
                >

                </Button>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            width: "100%",
            height: 1,
            background: "#E9EAEB",
            margin: "16px 0",
          }}
        />
        {sections.map((section) => (
          <div
            key={section.id}
            style={{
              marginBottom: 20,
            }}
          >
            {(() => {
              switch (section.id) {
                case "1":
                  return (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          marginBottom: 20,
                        }}
                        onClick={() => handleSectionOpen(section.id)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
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
                              className={section.icon}
                              style={{
                                color: "#FFFFFF",
                                fontSize: 20,
                              }}
                            />
                          </div>
                          <h2>{section.displayName}</h2>
                          {cvData?.length > 0 && candidate && (
                            <>
                              <Button
                              variant="secondary"
                                onClick={() => {
                                  handleCandidateCVOpen(candidate);
                                }}
                                label="View CV"
                              >
                              </Button>
                                {/* Download CV */}
                                <PDFDownloadLink
                                  key={new Date().toISOString()}
                                  document={
                                    <CandidateCVDocument
                                      candidate={candidate}
                                      cvData={cvData}
                                    />
                                  }
                                  fileName={`${candidate?.name}-CV.pdf`}
                                  style={{ color: "#414651" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                >
                                  {(event) => (
                                    <Button
                                    variant="secondary"
                                    style={{
                                      minWidth: "fit-content",
                                    }}
                                    label="Download CV"
                                    icon="/download.svg"
                                    onClick={() => {}}
                                    >
                                    </Button>
                                  )}
                                </PDFDownloadLink>
                            </>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {(getEvaluation(section.id) || cvAnalysis) && (
                            <CareerFit
                              fit={
                                getEvaluation(section.id)
                                  ? getEvaluation(section.id)?.matchFit
                                  : cvAnalysis?.cvStatus
                                  ? cvAnalysis?.cvStatus
                                  : "N/A"
                              }
                              assessment={
                                getEvaluation(section.id)
                                  ? getEvaluation(section.id)?.evaluationNotes
                                  : cvAnalysis?.cvScreeningReason
                              }
                              candidateDetails={candidate}
                              evaluatorName={getEvaluation(section.id)?.updatedBy?.name ? getEvaluation(section.id)?.updatedBy?.name?.split(" ")?.[0] : "Jia"}
                            />
                          )}
                          {sectionsOpen.includes(section.id) ? (
                            <ChevronUpIcon />
                          ) : (
                            <ChevronDownIcon />
                          )}
                        </div>
                      </div>
                      {sectionsOpen.includes(section.id) &&
                        (cvAnalysis?.cvStatus || cvAnalysis?.cvAnalysisV2 || getEvaluation(section.id) ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 12,
                            }}
                          >
                            {getEvaluation(section.id) && (
                              <RecruiterEvaluation
                                evaluation={getEvaluation(section.id)}
                                interview={candidate}
                              />
                            )}
                            {cvAnalysis?.cvAnalysisV2 ? (
                              <EvaluationByJiaV2
                                analysis={cvAnalysis.cvAnalysisV2}
                                onRegenerate={regenerateCV}
                                regenerating={regenerateCVLoading}
                              />
                            ) : (
                            <div
                              style={{
                                border: "1px solid #E9EAEB",
                                borderRadius: 12,
                                padding: 16,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  width: "100%",
                                  gap: 8,
                                  marginBottom: 16,
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
                                      borderRadius: "50%",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <img
                                      src="/jia-dashboard-logo.png"
                                      alt="Logo"
                                      style={{
                                        width: 32,
                                        height: 32,
                                        objectFit: "contain",
                                        borderRadius: "50%",
                                      }}
                                    />
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 16,
                                      color: "#181D27",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Evaluation by JIA
                                  </span>
                                  {cvAnalysis?.cvStatus && (
                                    <CareerFit
                                      fit={cvAnalysis?.cvStatus}
                                      assessment={cvAnalysis?.cvScreeningReason}
                                      candidateDetails={candidate}
                                      evaluatorName={"Jia"}
                                    />
                                  )}
                                </div>
                                {cvData && !regenerateCVLoading && (
                                  <Button
                                  variant="secondary"
                                  style={{
                                    maxWidth: "fit-content",
                                  }}
                                    onClick={regenerateCV}
                                    label="Regenerate"
                                    icon="/redo.svg"
                                  >
                                  </Button>
                                )}
                              </div>
                              {regenerateCVLoading ? (
                                <LoadingAnimation
                                  text="Regenerating CV Analysis..."
                                  subtext="Jia is regenerating the CV Analysis..."
                                />
                              ) : (
                                <p
                                className="markdown-content"
                                  dangerouslySetInnerHTML={{
                                    __html: cvAnalysis?.cvScreeningReason,
                                  }}
                                />
                              )}
                            </div>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              width: "100%",
                              textAlign: "center",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 16,
                                color: "#717680",
                                fontWeight: 500,
                              }}
                            >
                              Candidate has no uploaded CV. <br />
                              Analysis unavailable.
                            </p>
                          </div>
                        ))}
                    </>
                  );
                case "2":
                  return (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          marginBottom: 20,
                        }}
                        onClick={() => handleSectionOpen(section.id)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
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
                              className={section.icon}
                              style={{
                                color: "#FFFFFF",
                                fontSize: 20,
                              }}
                            />
                          </div>
                          <h2>{section.displayName}</h2>
                          <Button
                          variant="secondary"
                            onClick={() => {
                              // e.stopPropagation();
                              router.push(
                                `/recruiter-dashboard/careers/manage/${candidate?.id}/interview-analysis/${candidate?.interviewID}?orgID=${orgID}&tab=AI_Interview`
                              );
                            }}
                            label="Full analysis & transcript"
                            icon="/iconsV3/external-link.svg"
                            iconPosition="right"
                          >
                            
                            {/* <i
                              className="la la-external-link-alt"
                              style={{
                                fontSize: 20,
                                marginLeft: 5,
                              }}
                            /> */}
                          </Button>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {(analysis?.final_assessment ||
                            getEvaluation(section.id)) && (
                            <CareerFit
                              fit={
                                getEvaluation(section.id)
                                  ? getEvaluation(section.id)?.matchFit
                                  : analysis.final_assessment
                              }
                              assessment={
                                getEvaluation(section.id)
                                  ? getEvaluation(section.id)?.evaluationNotes
                                  : extractInterviewAssessment(summary)
                              }
                              candidateDetails={candidate}
                              evaluatorName={getEvaluation(section.id)?.updatedBy?.name ? getEvaluation(section.id)?.updatedBy?.name?.split(" ")?.[0] : "Jia"}
                            />
                          )}
                          {sectionsOpen.includes(section.id) ? (
                            <ChevronUpIcon />
                          ) : (
                            <ChevronDownIcon />
                          )}
                        </div>
                      </div>
                      {sectionsOpen.includes(section.id) && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}
                        >
                          {getEvaluation(section.id) && (
                            <RecruiterEvaluation
                              evaluation={getEvaluation(section.id)}
                              interview={candidate}
                            />
                          )}
                          <div
                            style={{
                              border: "1px solid #E9EAEB",
                              borderRadius: 12,
                              padding: 16,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                width: "100%",
                                marginBottom: 16,
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
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <img
                                    src="/jia-dashboard-logo.png"
                                    alt="Logo"
                                    style={{
                                      width: 32,
                                      height: 32,
                                      objectFit: "contain",
                                      borderRadius: "50%",
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    fontSize: 16,
                                    color: "#181D27",
                                    fontWeight: 700,
                                  }}
                                >
                                  Evaluation by JIA
                                </span>
                                {analysis?.final_assessment && (
                                  <CareerFit
                                    fit={analysis.final_assessment}
                                    assessment={extractInterviewAssessment(
                                      summary
                                    )}
                                    candidateDetails={candidate}
                                    evaluatorName={"Jia"}
                                  />
                                )}
                              </div>
                              {summary &&
                                analysis &&
                                transcripts &&
                                !isGeneratingAnalysis &&
                                !isGeneratingSummary && (
                                  <Button
                                  variant="secondary"
                                    style={{
                                      maxWidth: "fit-content",
                                    }}
                                    onClick={() => {
                                      generateAnalysis(
                                        transcripts,
                                        interviewDetails
                                      );
                                      createSummary(
                                        transcripts,
                                        interviewDetails
                                      );
                                    }}
                                    label="Regenerate"
                                    icon="/redo.svg"
                                  >
                                  </Button>
                                )}
                            </div>
                            {/* Overall Score with curved progress bar */}
                            {isGeneratingAnalysis ? (
                              <LoadingAnimation
                                text="Generating Analysis..."
                                subtext="Jia is generating AI Analysis..."
                              />
                            ) : overAllScore !== null ? (
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "center",
                                  alignItems: "center",
                                  width: "100%",
                                }}
                              >
                                <CircularProgress
                                  percentage={overAllScore}
                                  size={200}
                                  strokeWidth={15}
                                  showLabel={true}
                                  label="Overall Score"
                                  fontSize={30}
                                  labelFontSize={12}
                                  progressType="half-circle"
                                />
                              </div>
                            ) : null}
                            <div className="analysis-summary">
                              {isGeneratingSummary ? (
                                <LoadingAnimation
                                  text="Generating Summary..."
                                  subtext="Working on generating the interview summary..."
                                />
                              ) : summary ? (
                                <CustomMarkdown content={summary} />
                              ) : null}
                            </div>
                            {/* Applicant Qualities */}
                            {isGeneratingAnalysis ? (
                              <LoadingAnimation
                                text="Generating Applicant Qualities Analysis..."
                                subtext="Jia is generating AI Analysis..."
                              />
                            ) : analysis ? (
                              <ApplicantQualities analysis={analysis} />
                            ) : null}
                            {!summary &&
                              !analysis &&
                              !isGeneratingSummary &&
                              !isGeneratingAnalysis && (
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    width: "100%",
                                    textAlign: "center",
                                  }}
                                >
                                  <p
                                    style={{
                                      fontSize: 16,
                                      color: "#717680",
                                      fontWeight: 500,
                                    }}
                                  >
                                    Candidate has not taken {section.displayName}. <br />
                                    Analysis unavailable.
                                  </p>
                                </div>
                              )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                default:
                  return (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          marginBottom: 20,
                        }}
                        onClick={() => handleSectionOpen(section.id)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
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
                              className={section.icon || "la la-cog"}
                              style={{
                                color: "#FFFFFF",
                                fontSize: 20,
                              }}
                            />
                          </div>
                          <h2>{section.displayName || section.name}</h2>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {getEvaluation(section.id) && (
                            <CareerFit
                              fit={getEvaluation(section.id)?.matchFit}
                              assessment={
                                getEvaluation(section.id)?.evaluationNotes
                              }
                              candidateDetails={candidate}
                              evaluatorName={getEvaluation(section.id)?.updatedBy?.name ? getEvaluation(section.id)?.updatedBy?.name?.split(" ")?.[0] : "Jia"}
                            />
                          )}
                          {sectionsOpen.includes(section.id) ? (
                            <ChevronUpIcon />
                          ) : (
                            <ChevronDownIcon />
                          )}
                        </div>
                      </div>
                      {sectionsOpen.includes(section.id) &&
                        (getEvaluation(section.id) ? (
                          <RecruiterEvaluation
                            evaluation={getEvaluation(section.id)}
                            interview={candidate}
                          />
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              width: "100%",
                              textAlign: "center",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 16,
                                color: "#717680",
                                fontWeight: 500,
                              }}
                            >
                              No recruiter evaluation yet for this stage.
                            </p>
                          </div>
                        ))}
                    </>
                  );
              }
            })()}
          </div>
        ))}
      </div>
      {candidateDetailsOpen && (
        <CandidateModal
          candidate={candidate}
          setShowCandidateModal={setCandidateDetailsOpen}
        />
      )}
    </div>
  );
}
