"use client"
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/utils/apiClient";
import Swal from "sweetalert2";
import CareerFit from "../CareerComponents/CareerFit";
import React from "react";

import { extractInterviewAssessment, getCurrentPipelineStage } from "@/lib/Utils";
import { useAppContext } from "../../context/AppContext";
import ApplicantStatusBadge from "../CareerComponents/ApplicantStatusBadge";
import CustomDropdown from "../Dropdown/CustomDropdown";
import { Tooltip } from "react-tooltip";
import CandidateCVAnalysis from "./CandidateCVAnalysisV2";
import { useRouter } from "next/navigation";
import CandidateAvatarWithTooltip from "./CandidateAvatarWithTooltip";
import AvatarImage from "../AvatarImage/AvatarImage";
import ActivityTracker from "../ActivityTracker/ActivityTracker";
import CommentThreads from "../CareerComponents/CommentThreads";
import { ClockRewind, FileAttachment02, Hourglass01, MessageTextSquare01 } from "@untitledui/icons";
import styles from "./CandidateModal.module.scss";

export default function CandidateModal({ candidate, setShowCandidateModal }: { candidate: any, setShowCandidateModal: any }) {
    const { orgID, user } = useAppContext();
    const [candidateInfo, setCandidateInfo] = useState(null);
    const [candidateProfile, setCandidateProfile] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("cv");
    const [interviews, setInterviews] = useState([]);
    const [showTooltip, setShowTooltip] = useState(false);
    const [isTooltipLocked, setIsTooltipLocked] = useState(false);
    const tooltipTimeoutRef = useRef<number | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    // Prevent setState-after-unmount if a tooltip hide timeout is pending
    useEffect(() => {
        return () => {
            if (tooltipTimeoutRef.current) {
                clearTimeout(tooltipTimeoutRef.current);
                tooltipTimeoutRef.current = null;
            }
        };
    }, []);

    const handleTooltipMouseEnter = () => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
        }
        setShowTooltip(true);
    };

    const handleTooltipMouseLeave = () => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
        }
        tooltipTimeoutRef.current = window.setTimeout(() => {
            setShowTooltip(false);
            tooltipTimeoutRef.current = null;
        }, 200);
    };

    useEffect(() => {
        const fetchInterviewsAndProfile = async () => {
            try {
                const response = await api.get(`/api/get-candidate-interviews`, {
                    params: {
                        candidateEmail: candidate?.email,
                        orgID,
                    },
                });
                setInterviews(response?.data);
                setCandidateInfo({ image: candidate?.image, name: candidate?.name, email: candidate?.email });

                // Fetch candidate CV to enrich tooltip profile details
                if (candidate?.email) {
                    const cvResponse = await api.post(`/api/load-user-cv`, {
                        email: candidate.email,
                    });

                    const cvData = cvResponse?.data;
                    if (cvData?.digitalCV) {
                        const contactSection = cvData.digitalCV.find((section: any) => section.name === "Contact Info");
                        const skillsSection = cvData.digitalCV.find((section: any) => section.name === "Skills");
                        const currentPosition = cvData.digitalCV.find((section: any) => section.name === "Current Position");

                        let extractedPhone = "";
                        let extractedLocation = "";

                        if (contactSection?.content) {
                            const contactContent = contactSection.content;

                            const cleanContent = contactContent
                                .replace(/\*\*/g, "")
                                .replace(/\*/g, "")
                                .replace(/^[-*+]\s+/gm, "")
                                .replace(/^\d+\.\s+/gm, "")
                                .trim();

                            const phonePatterns = [
                                /Phone[:\s]*([+\d\s\-\(\)\.]+)/i,
                                /Mobile[:\s]*([+\d\s\-\(\)\.]+)/i,
                                /Tel[:\s]*([+\d\s\-\(\)\.]+)/i,
                                /Contact[:\s]*([+\d\s\-\(\)\.]+)/i,
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

                            const locationPatterns = [
                                /Address[:\s]*([^\n\r]+)/i,
                                /Location[:\s]*([^\n\r]+)/i,
                                /City[:\s]*([^\n\r]+)/i,
                                /([A-Za-z\s]+,\s*[A-Za-z\s]+(?:,\s*[A-Za-z\s]+)*)/,
                            ];

                            for (const pattern of locationPatterns) {
                                const match = cleanContent.match(pattern);
                                if (match && match[1]) {
                                    extractedLocation = match[1]
                                        .trim()
                                        .replace(/\*\*/g, "")
                                        .replace(/\*/g, "")
                                        .replace(/^\s*[-*+]\s*/, "");
                                    break;
                                }
                            }
                        }

                        let extractedSkills: string[] = [];
                        if (skillsSection?.content && typeof skillsSection.content === "string") {
                            const cleaned = skillsSection.content
                                .replace(/^[-*+]\s+/gm, "")
                                .replace(/^\d+\.\s+/gm, "")
                                .replace(/[#*_~`]/g, "")
                                .replace(/^>\s+/gm, "")
                                .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

                            extractedSkills = cleaned
                                .split(/[\n,]/)
                                .map((skill: string) => skill.trim())
                                .filter((skill: string) => skill.length > 1 && !/^[^a-zA-Z0-9]+$/.test(skill));
                        }

                        if (currentPosition?.content) {
                            const cleanedPosition = currentPosition.content
                                .replace(/\*\*/g, "")
                                .replace(/[\*`_~]/g, "")
                                .replace(/^[-*+]\s+/gm, "")
                                .replace(/^\d+\.\s+/gm, "")
                                .trim();

                            setCandidateInfo((prev: any) => ({
                                ...(prev || {
                                    image: candidate?.image,
                                    name: candidate?.name,
                                    email: candidate?.email,
                                }),
                                jobTitle: cleanedPosition,
                            }));
                        }

                        setCandidateProfile({
                            ...cvData,
                            phone: extractedPhone || candidate?.phone,
                            location: extractedLocation || candidate?.location,
                            skills: extractedSkills,
                            contactInfo: contactSection?.content,
                            hasCV: true,
                            jobTitle: candidate?.jobTitle,
                            company: candidate?.company,
                        });
                    } else {
                        setCandidateProfile({
                            hasCV: false,
                            phone: candidate?.phone,
                            location: candidate?.location,
                            skills: [],
                            jobTitle: candidate?.jobTitle,
                            company: candidate?.company,
                        });
                    }
                } else {
                    setCandidateProfile({
                        hasCV: false,
                        phone: candidate?.phone,
                        location: candidate?.location,
                        skills: [],
                        jobTitle: candidate?.jobTitle,
                        company: candidate?.company,
                    });
                }
            } catch (error) {
                Swal.fire({
                    icon: "error",
                    title: "Something went wrong",
                    text: "Redirecting back to candidates page...",
                    timer: 1500,
                }).then(() => {
                    setShowCandidateModal(false);
                    window.location.href = "/recruiter-dashboard/candidates";
                });
            }
        };
        if (candidate) {
            fetchInterviewsAndProfile();
        }
    }, [candidate]);

    const getOtherActiveApplications = () => {
        if (!interviews || !candidate) return [];

        return interviews
            .filter((interview: any) =>
                interview.interviewID !== candidate.interviewID &&
                (interview.applicationStatus === "Ongoing" || !interview.applicationStatus),
            )
            .map((interview: any) => ({
                jobTitle: interview.jobTitle,
                currentStatus: interview.status || interview.currentStep || "Applied",
                daysAgo: Math.floor((new Date().getTime() - new Date(interview.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
                interviewID: interview.interviewID,
                id: interview.id,
            }))
            .slice(0, 3);
    };

    useEffect(() => {
        const fetchTeamMembers = async () => {
            if (!orgID || !candidate?.id) return;

            try {
                const response = await api.post("/api/fetch-careers", { orgID });
                const careers = response?.data || [];
                const matchingCareer = careers.find((c: any) => c.id === candidate.id);
                if (matchingCareer?.teamMembers) setTeamMembers(matchingCareer.teamMembers);

            } catch (error) {
                console.error("Error fetching team members:", error);
            }
        };
        
        fetchTeamMembers();
    }, [orgID, candidate?.id]);

    return (
        <div className="modal-background fade-in">
            <div className="modal-container fade-in-bottom">
                <div className={`modal-content ${styles.modalContent}`}>
                    <div className={`modal-header ${styles.modalHeader}`}>
                        <div className={styles.headerWrapper}>
                            <div className={styles.candidateInfo}>
                                {candidateInfo ? (
                                    <>
                                        <CandidateAvatarWithTooltip
                                            candidate={{ ...candidate, ...candidateInfo }}
                                            orgID={orgID}
                                            onLockChange={setIsTooltipLocked}
                                            tooltipPosition="below"
                                        >
                                            <AvatarImage
                                                alt={`${candidateInfo?.name}'s avatar`}
                                                src={candidateInfo?.image}
                                                fallback="initials"
                                            />
                                        </CandidateAvatarWithTooltip>
                                        <div className={styles.candidateDetails}>
                                            <div className={styles.name}>{candidateInfo?.name}</div>
                                            <div className={styles.email}>{candidateInfo?.email}</div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="skeleton-bar" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            <div className="skeleton-bar" style={{ width: 120, height: 14, borderRadius: 4 }} />
                                            <div className="skeleton-bar" style={{ width: 160, height: 12, borderRadius: 4 }} />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className={styles.tabsContainer}>
                                <div 
                                    className={`${styles.tab} ${activeTab === "cv" ? styles.active : styles.inactive}`}
                                    onClick={() => setActiveTab("cv")}
                                >
                                    <FileAttachment02 size={20} color={activeTab === "cv" ? "#717680" : "#A4A7AE"} />
                                    <span className={`${styles.tabLabel} ${activeTab === "cv" ? styles.active : styles.inactive}`}>CV</span>
                                </div>
                                <div 
                                    className={`${styles.tab} ${activeTab === "comments" ? styles.active : styles.inactive}`}
                                    onClick={() => setActiveTab("comments")}
                                >
                                    <MessageTextSquare01 size={20} color={activeTab === "comments" ? "#717680" : "#A4A7AE"}/>
                                    <span className={`${styles.tabLabel} ${activeTab === "comments" ? styles.active : styles.inactive}`}>Comments</span>
                                </div>
                                <div 
                                    className={`${styles.tab} ${activeTab === "history" ? styles.active : styles.inactive}`}
                                    onClick={() => setActiveTab("history")}
                                >
                                    <Hourglass01 size={20} color={activeTab === "history" ? "#717680" : "#A4A7AE"}/>
                                    <span className={`${styles.tabLabel} ${activeTab === "history" ? styles.active : styles.inactive}`}>Careers</span>
                                </div>
                                <div 
                                    className={`${styles.tab} ${activeTab === "activity" ? styles.active : styles.inactive}`}
                                    onClick={() => setActiveTab("activity")}
                                >
                                    <ClockRewind size={20} color={activeTab === "activity" ? "#717680" : "#A4A7AE"}/>
                                    <span className={`${styles.tabLabel} ${activeTab === "activity" ? styles.active : styles.inactive}`}>Activity</span>
                                </div>
                            </div>
                            <button type="button" className={`close ${styles.closeButton}`} data-dismiss="modal" aria-label="Close" onClick={() => setShowCandidateModal(false)}>
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                    </div>
                    <div className={`modal-body ${styles.modalBody}`}>
                    {activeTab === "cv" && (
                        <CandidateCVAnalysis 
                            candidate={candidate} 
                            interviews={interviews} 
                            setInterviews={setInterviews} 
                            includeEvaluationCard={false} 
                        />
                    )}
                    {activeTab === "comments" && (
                        <CommentThreads
                            interview={{
                                interviewID: candidate?.interviewID,
                                email: candidate?.email,
                                candidateEmail: candidate?.email,
                            }}
                            effectiveOrgID={orgID}
                            user={user}
                            comments={comments}
                            setComments={setComments}
                            teamMembers={teamMembers}
                        />
                    )}
                    {activeTab === "history" && <CandidateApplicationHistory candidate={candidate} interviews={interviews} />}
                    {activeTab === "activity" && (
                        <ActivityTracker
                            orgID={orgID}
                            candidate={candidate ? {
                                ...candidate,
                                candidateId: candidate?.candidateId || candidate?._id,
                                interviewUID: candidate?.interviewUID || candidate?._id,
                            } : null}
                            career={candidate ? {
                                _id: candidate?.careerId,
                                id: candidate?.id,
                                jobTitle: candidate?.jobTitle,
                            } : null}
                        />
                    )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function CandidateApplicationHistory({ candidate, interviews }: { candidate: any, interviews: any }) {
    const [applications, setApplications] = useState([]);
    const filterStatusOptions = ["All Statuses", "Hired", "Ongoing", "Dropped"];
    const assessmentOptions = ["All Assessments", "Insufficient Data","Not Fit", "Bad Fit", "Maybe Fit", "Good Fit", "Strong Fit"];
    const [filterStatus, setFilterStatus] = useState("All Statuses");
    const [filterAssessment, setFilterAssessment] = useState("All Assessments");
    const [filterAssessmentOpen, setFilterAssessmentOpen] = useState(false);
    const [filterStatusOpen, setFilterStatusOpen] = useState(false);
    const { orgID } = useAppContext();
    const router = useRouter();
    
    const filteredApplications = React.useMemo(() => {
        let filtered = applications;
        if (filterStatus !== "All Statuses") {
            filtered = filtered.filter((interview: any) => {
                if (filterStatus === "Ongoing") {
                    return interview.applicationStatus === "Ongoing" || !interview.applicationStatus;
                }

                return interview.applicationStatus === filterStatus;
            });
        }
        if (filterAssessment !== "All Assessments") {
            filtered = filtered.filter((interview: any) => interview.assessment.includes(filterAssessment));
        }
        return filtered;
    }, [applications, filterStatus, filterAssessment]);

    useEffect(() => {
        if (interviews) {
            const getCvScreeningDisplayName = (interview: any) => {
                const cvStage = interview.pipelineStages?.find((s: any) => s.id === "1");
                return cvStage?.alias || "CV Screening";
            };
            const getAiInterviewDisplayName = (interview: any) => {
                const aiStage = interview.pipelineStages?.find((s: any) => s.id === "2");
                return aiStage?.alias || "AI Interview";
            };

            let newApplications = [];
            for (const interview of interviews) {
                const recruiterEvaluation = interview.currentEvaluation?.matchFit ? {
                    fit: `${interview.currentEvaluation?.updatedBy?.name?.split(" ")[0]}: ${interview.currentEvaluation?.matchFit}`,
                    assessment: interview.currentEvaluation?.evaluationNotes,
                } : null;

                const cvAssessment = {
                    fit: interview.cvStatus || "N/A",
                    assessment: interview.cvScreeningReason,
                };
                const interviewAssessment = {
                    fit: interview.jobFit || "N/A",
                    assessment: extractInterviewAssessment(interview?.summary),
                };
                if (interview.currentStep === "AI Interview" || !interview.currentStep || (interview.currentStep === "CV Screening" && interview.status === "For AI Interview")) {
                    if (interview.status === "For Interview" || interview.status === "For AI Interview") {
                        newApplications.push({...interview, stage: `${getAiInterviewDisplayName(interview)} - Waiting Interview`, ...(recruiterEvaluation || cvAssessment) });
                        continue;
                    }

                    newApplications.push({...interview, stage: `${getAiInterviewDisplayName(interview)} - For Review`, ...(recruiterEvaluation || interviewAssessment)});
                    continue;
                }
                
                if (interview.currentStep === "CV Screening" && (interview.status !== "For AI Interview" && interview.status !== "For Interview")) {
                    if (interview.stageId && interview.substageId) {
                        const matchedStage = interview.pipelineStages?.find((s: any) => s.id === interview.stageId);
                        const matchedSubstage = matchedStage?.substages?.find((s: any) => s.id === interview.substageId);
                        if (matchedStage && matchedSubstage) {
                            newApplications.push({...interview, stage: `${matchedStage.alias || matchedStage.name} - ${matchedSubstage.name}`, ...(recruiterEvaluation || cvAssessment)});
                            continue;
                        }
                    }
                    newApplications.push({...interview, stage: `${getCvScreeningDisplayName(interview)} - For Review`, ...(recruiterEvaluation || cvAssessment)});
                    continue;
                }

                if (interview.currentStep === "Human Interview" || interview.currentStep === "Job Interview") {
                    if (interview.status === "For Human Interview") {
                        newApplications.push({...interview, stage: "Human Interview - Waiting Schedule", ...(recruiterEvaluation || interviewAssessment)});
                        continue;
                    }
                    if (interview.status === "For Interview") {
                        newApplications.push({...interview, stage: "Human Interview - Waiting Interview", ...(recruiterEvaluation || interviewAssessment)});
                        continue;
                    }
                    if (interview.status === "For Human Interview Review") {
                        newApplications.push({...interview, stage: "Human Interview - For Review", ...(recruiterEvaluation || interviewAssessment)});
                        continue;
                    }
                }

                if (interview.currentStep === "Job Offered") {
                    newApplications.push({...interview, stage: "Job Offer - For Contract Signing", ...(recruiterEvaluation || interviewAssessment)});
                    continue;
                }

                if (interview.currentStep === "Contract Signed") {
                    newApplications.push({...interview, stage: "Job Offer - Hired", ...(recruiterEvaluation || interviewAssessment)});
                    continue;
                }

                if (interview.currentStep === "Applied") {
                    newApplications.push({...interview, stage: "Applied", fit: interview.status || "N/A"});
                    continue;
                }

                // Custom stages
                const currentStage = getCurrentPipelineStage(interview.pipelineStages, { status: interview.status, currentStep: interview.currentStep, stageId: interview.stageId, substageId: interview.substageId });
                if (currentStage) {
                    newApplications.push({...interview, stage: `${currentStage.stage.alias || currentStage.stage.name} - ${currentStage.substage.name}`, ...(recruiterEvaluation || interviewAssessment) });
                    continue;
                }
            }
            setApplications(newApplications);
        }
    },[interviews])


    return (
    <div className="layered-card-outer" style={{ marginTop: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", backgroundColor: "#FFFFFF", borderRadius: "20px", border: "1px solid #E9EAEB" }}>
            <div className={styles.applicationHistoryHeader}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                   <span style={{fontSize: 16, color: "#181D27", fontWeight: 700}}>Applied Jobs</span>
                    <div style={{borderRadius: "50%", backgroundColor: "lightgray", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center"}}>
                        <span style={{fontSize: 12, color: "#181D27", fontWeight: 700}}>{applications?.length}</span>
                    </div>
                </div>
                <div className={styles.filtersContainer}>
                    <CustomDropdown value={filterAssessment} setValue={setFilterAssessment} options={assessmentOptions} icon="la-filter" />
                    <CustomDropdown value={filterStatus} setValue={setFilterStatus} options={filterStatusOptions} icon="la-filter" />
                </div>
            </div>

            {/* Table */}
            <div className={`table-responsive ${styles.tableWrapper}`}>
            <table className="table align-items-center table-flush">
                    <thead>
                        <tr>
                            <th scope="col" style={{ textTransform: "none", fontWeight: 550 }}>Position Applied</th>
                       
                            <th scope="col" style={{ textTransform: "none", fontWeight: 550 }}>Date Applied</th>
                        
                            <th scope="col" style={{ textTransform: "none", fontWeight: 550 }}>CV/Interview Assessment</th>
                        
                            <th scope="col" style={{ textTransform: "none", fontWeight: 550 }}>Application Status</th>
                        
                            <th scope="col" style={{ textTransform: "none", fontWeight: 550 }}>Stage</th>
                        
                            <th scope="col" style={{ textTransform: "none", fontWeight: 550 }}>Stage Updated</th>
                            <th scope="col"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredApplications?.map((interview: any, index: number) => (
                            <tr key={index} onClick={() => {
                                router.push(`/recruiter-dashboard/careers/manage/${interview.id}/interview-analysis/${interview.interviewID}?orgID=${orgID}`);
                            }}>
                                <td>
                                    <a 
                                    href={`/recruiter-dashboard/careers/manage/${interview.id}/interview-analysis/${interview.interviewID}?orgID=${orgID}`} 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        router.push(`/recruiter-dashboard/careers/manage/${interview.id}/interview-analysis/${interview.interviewID}?orgID=${orgID}`);
                                    }}
                                    style={{ color: "inherit", textDecoration: "none" }}
                                    >
                                    {interview.jobTitle}
                                    </a>
                                </td>
                                <td>{new Date(interview.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                                <td>
                                    <CareerFit fit={interview.fit} assessment={interview.assessment} candidateDetails={interview} evaluatorName={interview.currentEvaluation?.updatedBy?.name ? interview.currentEvaluation?.updatedBy?.name?.split(" ")[0] : "Jia"} />
                                </td>
                                <td><ApplicantStatusBadge status={interview.applicationStatus || "Ongoing"}/></td>
                                <td>{interview.stage}</td>
                                <td>{interview.applicationMetadata?.updatedAt ? new Date(interview.applicationMetadata.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : new Date(interview.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                                <td>
                                    <i className="la la-external-link-alt" style={{ fontSize: "20px", color: "black" }}></i>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Tooltip className="career-fit-tooltip fade-in" id="career-fit-tooltip" clickable={true}/>
            </div>
        </div>
    </div>)
}