"use client"
import React,{ useEffect, useState } from "react";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import Swal from "sweetalert2";
import Markdown from "react-markdown";
import CareerFit from "../CareerComponents/CareerFit";
import { errorToast, getCVSection } from "@/lib/Utils";
import { CandidateCVDocument } from "./CandidateCVDocument";
import { PDFDownloadLink } from "@react-pdf/renderer";
import LoadingAnimation from "@/lib/components/Loaders/LoadingAnimation";
import { Tooltip } from "react-tooltip";
import { decodeHtmlEntities } from "@/lib/utils/sanitizeInput";
import { CandidateSkillsSection } from "./CandidateSkillsSection";
import { Button } from "../ui";
import CustomMarkdown from "../ui/markdown/CustomMarkdown";

export default function CandidateCVAnalysis({ candidate, interviews, setInterviews, includePreScreeningQuestions = false }: { candidate: any, interviews: any, setInterviews: any, includePreScreeningQuestions?: boolean }) {
    const [isLoading, setIsLoading] = useState(false);
    const [cvData, setCvData] = useState<any[]>([]);
    const [regenerateLoading, setRegenerateLoading] = useState(false);
    const [fallbackOrgSkills, setFallbackOrgSkills] = useState<string[]>([]);

    const getActiveInterviews = (interviews: any[]) => {
        return interviews?.filter((interview: any) => !["Dropped", "Cancelled"].includes(interview.applicationStatus));
    }

    useEffect(() => {
        const fetchCVData = async () => {
            setIsLoading(true);
            try {
                const response = await api.post("/api/load-user-cv", { email: candidate?.email });
                if (response?.data?.digitalCV) {
                    setCvData(response?.data?.digitalCV);
                }
            } catch (error) {
                Swal.fire({
                    icon: "error",
                    title: "Failed to load CV",
                    text: "Redirecting back to candidates page...",
                    allowOutsideClick: false,
                    confirmButtonText: "Back to Candidates Page",
                }).then(() => {
                    window.location.href = "/recruiter-dashboard/candidates";
                }); 
            } finally{
                setIsLoading(false);
            }
        };

        if (candidate) {
            fetchCVData();
        }
      }, [candidate]);

    const candidateSkillsForExport: string[] = Array.isArray(candidate?.skills)
        ? candidate.skills
        : Array.isArray(interviews?.[0]?.skills)
            ? interviews[0].skills
            : [];

    useEffect(() => {
        const fetchOrgSkillsFallback = async () => {
            if (candidateSkillsForExport.length > 0) {
                setFallbackOrgSkills([]);
                return;
            }

            const candidateEmail = candidate?.email || interviews?.[0]?.email;
            if (!candidateEmail) {
                setFallbackOrgSkills([]);
                return;
            }

            let orgID = candidate?.orgID || interviews?.[0]?.orgID;

            if (!orgID && typeof window !== "undefined") {
                try {
                    const queryOrgID = new URLSearchParams(window.location.search).get("orgID");
                    if (queryOrgID) {
                        orgID = queryOrgID;
                    } else {
                        const stored = window.localStorage.getItem("activeOrg");
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            orgID = parsed?._id || undefined;
                        }
                    }
                } catch {
                    // no-op
                }
            }

            if (!orgID) {
                setFallbackOrgSkills([]);
                return;
            }

            try {
                const response = await api.get(
                    `/api/get-org-candidate-skills?candidateEmail=${encodeURIComponent(
                        candidateEmail,
                    )}&orgID=${encodeURIComponent(orgID)}`,
                );

                const items = response?.data?.items || [];
                const skills = items
                    .map((item: any) => item?.skillName)
                    .filter((skill: any) => typeof skill === "string" && skill.trim().length > 0);
                setFallbackOrgSkills(skills);
            } catch (error) {
                console.error("Failed to load org candidate skills fallback for export:", error);
                setFallbackOrgSkills([]);
            }
        };

        fetchOrgSkillsFallback();
    }, [
        candidate?.email,
        candidate?.orgID,
        interviews?.[0]?.email,
        interviews?.[0]?.orgID,
        candidateSkillsForExport.length,
    ]);

    async function regenerateCV() {
        const interviewsToProcess = interviews.filter((interview: any) => !["Dropped", "Cancelled"].includes(interview.applicationStatus) && interview.currentStep !== "Applied");
        if (interviewsToProcess.length === 0) return;
        try {
            setRegenerateLoading(true);
            let updatedInterviews = [...interviews];
            
            for (const interview of interviewsToProcess) {
                const response = await api.post("/api/analyze-cv", {
                    interviewID: interview.interviewID,
                    userEmail: interview.email,
                });
                let updatedInterview = {...interview};

                if (response?.data?.update) {
                    updatedInterview = {...updatedInterview, ...response?.data?.update};
                }
                
                updatedInterviews = updatedInterviews.map((i: any) => i._id === interview._id ? updatedInterview : i);
            }
            setInterviews(updatedInterviews);
        } catch (error) {
            console.log(error);
            errorToast("Failed to regenerate CV Analysis", 1300);
        } finally {
            setRegenerateLoading(false);
        }
    }
    return (<>
    <div className="layered-card-outer" style={{ margin: 0, position: "sticky", top: 0, zIndex: 10 }}>
        <div className="layered-card-middle">
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src="/jia-dashboard-logo.png" alt="Logo" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: "50%" }} />
                    </div>
                    <span style={{fontSize: 16, color: "#181D27", fontWeight: 700}}>Evaluation by JIA</span>
                </div>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Button 
                    disabled={regenerateLoading || interviews?.filter((interview: any) => !["Dropped", "Cancelled"].includes(interview.applicationStatus) && interview.currentStep !== "Applied")?.length === 0}
                    onClick={regenerateCV}
                    variant="secondary"
                    label="Regenerate"
                    icon="/redo.svg"
                    >
                    </Button>
                    {cvData?.length > 0 && <PDFDownloadLink
                            key={new Date().toISOString()}
                            document={<CandidateCVDocument
                                candidate={{
                                    ...(interviews?.[0] || {}),
                                    name: interviews?.[0]?.name || candidate?.name,
                                    email: interviews?.[0]?.email || candidate?.email,
                                    image: interviews?.[0]?.image || candidate?.image,
                                }}
                                cvData={cvData}
                                candidateSkills={candidateSkillsForExport.length > 0 ? candidateSkillsForExport : fallbackOrgSkills}
                                includeCVAnalysis={false}
                            />}
                            fileName={`${interviews?.[0]?.name}-CV.pdf`}
                    >
                    <Button
                    disabled={cvData?.length === 0}
                    variant="secondary"
                    label="Download CV"
                    icon="/download.svg"
                    onClick={() => {  
                    }}
                    >
                    </Button>
                    </PDFDownloadLink>}
                </div>
            </div>
        {/* CV Analysis by JIA content */}
        <div className="layered-card-content">
            {regenerateLoading ? (
                <LoadingAnimation text="Regenerating CV Analysis..." subtext="JIA is analyzing the CV..." />
            ) : 
            getActiveInterviews(interviews)?.length > 0 ? getActiveInterviews(interviews).map((interview: any) => (
                <div key={interview.id}>
                    <div style={{ display: "flex", flexDirection: "row", justifyContent:"flex-start", gap: 4, alignItems: "center" }}>
                        {interview.cvStatus &&
                        <>
                        <CareerFit fit={interview.cvStatus} assessment={interview.cvScreeningReason} candidateDetails={interview} evaluatorName={"Jia"} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#717680", lineHeight: "1" }}>
                            for
                        </span>
                        </>}
                        <span style={{fontSize: 12, fontWeight: 700, color: "#181D27", lineHeight: "1" }}>
                            {interview.jobTitle}
                        </span>
                        {interview.currentStep === "Applied" && (
                            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px", color: "#414651", border: "1px solid #E9EAEB", backgroundColor: "#F5F5F5", borderRadius: "60px", padding: "2px 10px", fontSize: "12px" }}>
                                <i className="la la-exclamation-triangle" style={{ fontSize: "12px", color: "#414651" }}></i>
                                <span>No CV Uploaded</span>
                            </div>
                        )}
                    </div>
                    <span style={{fontSize: 16, color: "#414651", fontWeight: 500}}>
                    <p className="markdown-content" dangerouslySetInnerHTML={{ __html: interview.cvScreeningReason || "No CV Analysis available" }}></p>
                    </span>
                </div>
            )) : (
                <div className="text-center">
                    <h3>No Active Applications</h3>
                </div>
            )}
            <Tooltip className="career-fit-tooltip fade-in" id="career-fit-tooltip" clickable={true}/>
        </div>
        </div>
    </div>
    {/* Pre-Screening Questions */}
    {includePreScreeningQuestions && interviews?.[0]?.preScreeningQuestions?.length > 0 && (
        <div className="layered-card-outer">
        <div className="layered-card-middle">
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: 8 }}>
                <div style={{ width: 32, height: 32, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, background: "#181D27", borderRadius: "60px" }}>
                    <i className="la la-user-check" style={{ fontSize: 20, color: "#FFFFFF"}} /> 
                </div>
                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Pre-Screening Questions</span>
                </div>
            <div className="layered-card-content">
                {interviews?.[0]?.preScreeningQuestions?.map((question: any) => (
                    <div key={question.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: 16, borderBottom: "1px solid #E9EAEB", paddingBottom: 16 }}>
                        <span style={{ fontSize: 16, color: "#414651", fontWeight: 500 }}>{question.questionType}</span>
                        <span style={{ fontSize: 14, color: "#717680", fontWeight: 500 }}>{question.question}</span>
                        <span style={{ fontSize: 14, color: "#717680", fontWeight: 500 }}>Answer: {question.selectedAnswers?.map((answer: any) => decodeHtmlEntities(answer.value || '')).join(", ")}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>)}
        {isLoading ? (
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 16, alignItems: "flex-start", marginTop: 16 }}>
                <div style={{ width: "60%", display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...Array(6)].map((_, index) => (
                        <div key={index} className="layered-card-middle">
                            <div className="skeleton-bar" style={{ width: "30%", height: "20px", marginBottom: 8 }}></div>
                            <div className="skeleton-bar" style={{ width: "100%", height: "20px" }}></div>
                        </div>
                    ))}
                </div>
                <div style={{ width: "40%", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="layered-card-middle">
                        <div className="skeleton-bar" style={{ width: "30%", height: "20px", marginBottom: 8 }}></div>
                        <div className="skeleton-bar" style={{ width: "100%", height: "20px" }}></div>
                    </div>
                </div>
            </div>
        ) : cvData?.length > 0 ? <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 16, alignItems: "flex-start", marginTop: 16, position: "relative", zIndex: 1 }}>
            <div style={{ width: "60%", display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Current Experience */}
            <div className="layered-card-middle">
                <span style={{fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16}}>Experience</span>
                {cvData?.find((section) => section.name === "Experience") && <div className="layered-card-content">
                <CustomMarkdown content={getCVSection(cvData, "Experience")} />
                </div>}
            </div>
            {/* Education */}
            <div className="layered-card-middle">
                <span style={{fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16}}>Education</span>
                {cvData?.find((section) => section.name === "Education") && <div className="layered-card-content">
                <CustomMarkdown content={getCVSection(cvData, "Education")} />
                </div>}
            </div>
            {/* Certifications */}
            <div className="layered-card-middle">
                <span style={{fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16}}>Certifications</span>
                {cvData?.find((section) => section.name === "Certifications") && <div className="layered-card-content">
                <CustomMarkdown content={getCVSection(cvData, "Certifications")} />
                </div>}
            </div>
            {/* Projects */}
            <div className="layered-card-middle">
                <span style={{fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16}}>Projects</span>
                {cvData?.find((section) => section.name === "Projects") && <div className="layered-card-content">
                <CustomMarkdown content={getCVSection(cvData, "Projects")} />
                </div>}
            </div>
            {/* Awards */}
            <div className="layered-card-middle">
                <span style={{fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16}}>Awards</span>
                {cvData?.find((section) => section.name === "Awards") && <div className="layered-card-content">
                <CustomMarkdown content={getCVSection(cvData, "Awards")} />
                </div>}
            </div>
            </div>
            <div style={{ width: "40%", display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 8 }}>
            {/* Contact Info */}
            <div className="layered-card-middle">
                <span style={{fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16}}>Contact Information</span>
                {cvData?.find((section) => section.name === "Contact Info") && <div className="layered-card-content">
                <CustomMarkdown content={getCVSection(cvData, "Contact Info")} />
                </div>}
            </div>
            {/* Skills */}
            <div className="layered-card-middle">
                <CandidateSkillsSection
                    candidate={candidate}
                    cvData={cvData}
                    setCvData={setCvData}
                />
            </div>
            </div>
        </div> : (
            <div className="text-center" style={{ marginTop: 16 }}>
                <h3>Applicant has no uploaded CV</h3>
            </div>
        )}
    </>)
}
